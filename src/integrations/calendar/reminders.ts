/**
 * Reminder scheduler — Phase 2
 *
 * Bridges DevNotes tasks → OS notifications via:
 *  - Tauri: @tauri-apps/plugin-notification (Windows toast)
 *  - Browser: Web Notifications API (dev mode)
 *
 * Strategy: setTimeout-based scheduler that fires when the app is open.
 * For tasks due while the app is closed, the Rust tray process can check
 * on launch (Phase 3 enhancement).
 */

import type { Task } from "@/types";

// ─── Scheduled reminder tracker ──────────────────────────────────

const scheduled = new Map<string, ReturnType<typeof setTimeout>>();

export function clearAllReminders(): void {
  scheduled.forEach((timer) => clearTimeout(timer));
  scheduled.clear();
}

export function clearReminder(taskId: string): void {
  const t = scheduled.get(taskId);
  if (t) { clearTimeout(t); scheduled.delete(taskId); }
}

// ─── DND Helper ───────────────────────────────────────────────────

function applyDND(fireAtMs: number, dndStart?: string, dndEnd?: string): number {
  if (!dndStart || !dndEnd) return fireAtMs;

  const fireDate = new Date(fireAtMs);
  const startParts = dndStart.split(':').map(Number);
  const endParts = dndEnd.split(':').map(Number);

  const startMs = new Date(fireDate).setHours(startParts[0] ?? 22, startParts[1] ?? 0, 0, 0);
  let endMs = new Date(fireDate).setHours(endParts[0] ?? 8, endParts[1] ?? 0, 0, 0);

  if (startMs > endMs) {
    // Spans midnight: 22:00 -> 08:00
    if (fireAtMs >= startMs) return endMs + 86400_000; // delay to tomorrow morning
    if (fireAtMs < endMs) return endMs; // delay to this morning
  } else {
    // Normal range: 14:00 -> 16:00
    if (fireAtMs >= startMs && fireAtMs < endMs) return endMs;
  }
  return fireAtMs;
}

// ─── Schedule ─────────────────────────────────────────────────────

export function scheduleReminder(task: Task, dndStart?: string, dndEnd?: string): void {
  clearReminder(task.id);

  if (!task.reminder?.enabled || !task.dueDate) return;

  const dueMs = task.dueTime
    ? new Date(`${task.dueDate}T${task.dueTime}`).getTime()
    : new Date(`${task.dueDate}T09:00`).getTime();   // default 9am if no time

  let fireAt = dueMs - task.reminder.offsetMinutes * 60_000;
  fireAt = applyDND(fireAt, dndStart, dndEnd);
  const delay = fireAt - Date.now();

  if (delay < 0) return;   // already past — don't fire

  const timer = setTimeout(() => {
    fireNotification(task);
    scheduled.delete(task.id);
  }, delay);

  scheduled.set(task.id, timer);
}

/**
 * Re-schedule all tasks on app start or when tasks change.
 */
export function scheduleAllReminders(tasks: Task[], dndStart?: string, dndEnd?: string): void {
  clearAllReminders();
  for (const task of tasks) {
    if (task.status !== "done" && task.status !== "archived") {
      scheduleReminder(task, dndStart, dndEnd);
    }
  }
}

// ─── Fire notification ────────────────────────────────────────────

async function fireNotification(task: Task): Promise<void> {
  const title = `⏰ ${task.title}`;
  const body = task.dueDate
    ? `Due: ${task.dueDate}${task.dueTime ? " at " + task.dueTime : ""}`
    : "Task reminder";

  const isTauri = "__TAURI_INTERNALS__" in window;

  if (isTauri) {
    try {
      const { sendNotification, isPermissionGranted, requestPermission } =
        await import("@tauri-apps/plugin-notification");
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === "granted";
      }
      if (granted) await sendNotification({ title, body });
      return;
    } catch { /* fall through */ }
  }

  // Web fallback
  if ("Notification" in window) {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon.png" });
    }
  }
}

// ─── Daily digest ─────────────────────────────────────────────────

export function scheduleDailyDigest(
  tasks: Task[],
  digestHour: number,   // 0–23, e.g. 8 for 8am
  dndStart?: string,
  dndEnd?: string
): void {
  const now = new Date();
  const fire = new Date();
  fire.setHours(digestHour, 0, 0, 0);
  if (fire <= now) fire.setDate(fire.getDate() + 1);   // tomorrow

  let fireAt = fire.getTime();
  fireAt = applyDND(fireAt, dndStart, dndEnd);

  const delay = fireAt - now.getTime();

  const timer = setTimeout(() => {
    const today = new Date().toISOString().slice(0, 10);
    const dueToday = tasks.filter(
      (t) => t.dueDate === today && t.status !== "done" && t.status !== "archived"
    );
    const overdue = tasks.filter(
      (t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "archived"
    );

    const title = "DevNotes — Daily Digest";
    const lines = [];
    if (dueToday.length) lines.push(`📋 ${dueToday.length} task(s) due today`);
    if (overdue.length) lines.push(`⚠ ${overdue.length} overdue`);
    if (!lines.length) lines.push("✓ No tasks due today");

    fireNotification({
      id: "digest", title,
      projectId: "",
      description: lines.join(" · "),
      dueDate: today, dueTime: null,
      reminder: { enabled: true, offsetMinutes: 0, notificationId: null },
    } as unknown as Task);

    // Reschedule for next day — useReminders hook will re-call this
    // when tasks change, so we don't need to recurse with stale data.
    // Just let the React effect cycle handle re-scheduling.
  }, delay);

  scheduled.set("__digest__", timer);
}

// ─── Overdue alert ────────────────────────────────────────────────

export function triggerOverdueAlert(tasks: Task[]): void {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "archived"
  );
  if (overdue.length > 0) {
    fireNotification({
      id: "overdueAlert", title: "⚠ Overdue Tasks",
      projectId: "",
      description: `You remain behind on ${overdue.length} task(s)!`,
      dueDate: today, dueTime: null,
      reminder: { enabled: true, offsetMinutes: 0, notificationId: null },
    } as unknown as Task);
  }
}
