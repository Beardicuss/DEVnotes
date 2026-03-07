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

// ─── Schedule ─────────────────────────────────────────────────────

export function scheduleReminder(task: Task): void {
  clearReminder(task.id);

  if (!task.reminder?.enabled || !task.dueDate) return;

  const dueMs = task.dueTime
    ? new Date(`${task.dueDate}T${task.dueTime}`).getTime()
    : new Date(`${task.dueDate}T09:00`).getTime();   // default 9am if no time

  const fireAt = dueMs - task.reminder.offsetMinutes * 60_000;
  const delay  = fireAt - Date.now();

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
export function scheduleAllReminders(tasks: Task[]): void {
  clearAllReminders();
  for (const task of tasks) {
    if (task.status !== "done" && task.status !== "archived") {
      scheduleReminder(task);
    }
  }
}

// ─── Fire notification ────────────────────────────────────────────

async function fireNotification(task: Task): Promise<void> {
  const title = `⏰ ${task.title}`;
  const body  = task.dueDate
    ? `Due: ${task.dueDate}${task.dueTime ? " at " + task.dueTime : ""}`
    : "Task reminder";

  const isTauri = "__TAURI_INTERNALS__" in window;

  if (isTauri) {
    try {
      const { sendNotification, isPermissionGranted, requestPermission } =
        await import(/* @vite-ignore */ "@tauri-apps/plugin-notification");
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
  digestHour: number   // 0–23, e.g. 8 for 8am
): void {
  const now  = new Date();
  const fire = new Date();
  fire.setHours(digestHour, 0, 0, 0);
  if (fire <= now) fire.setDate(fire.getDate() + 1);   // tomorrow

  const delay = fire.getTime() - now.getTime();

  const timer = setTimeout(() => {
    const today    = new Date().toISOString().slice(0, 10);
    const dueToday = tasks.filter(
      (t) => t.dueDate === today && t.status !== "done" && t.status !== "archived"
    );
    const overdue  = tasks.filter(
      (t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "archived"
    );

    const title = "DevNotes — Daily Digest";
    const lines  = [];
    if (dueToday.length)  lines.push(`📋 ${dueToday.length} task(s) due today`);
    if (overdue.length)   lines.push(`⚠ ${overdue.length} overdue`);
    if (!lines.length)    lines.push("✓ No tasks due today");

    fireNotification({
      id: "digest", title,
      description: lines.join(" · "),
      dueDate: today, dueTime: null,
      reminder: { enabled: true, offsetMinutes: 0, notificationId: null },
    } as any);

    // Reschedule for next day
    scheduleDailyDigest(tasks, digestHour);
  }, delay);

  scheduled.set("__digest__", timer);
}
