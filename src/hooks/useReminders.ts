import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";
import {
  scheduleAllReminders,
  scheduleDailyDigest,
  clearAllReminders,
  triggerOverdueAlert,
} from "@/integrations/calendar/reminders";

/**
 * Keeps the reminder scheduler in sync with the current task list and settings.
 * Uses a SINGLE effect to avoid the double-clearAllReminders race where a second
 * effect's cleanup would wipe reminders scheduled by the first effect.
 * Run once at app root level.
 */
export function useReminders() {
  const tasks = useAppStore((s) => s.data.tasks);
  const settings = useAppStore((s) => s.data.settings);
  const { dailyDigest, dailyDigestTime, dndStart, dndEnd, overdueAlert } = settings;

  const booted = useRef(false);

  useEffect(() => {
    // Always schedule task reminders first (honoring DND)
    scheduleAllReminders(tasks, dndStart, dndEnd);

    // Optionally layer on daily digest
    if (dailyDigest) {
      const hour = parseInt((dailyDigestTime ?? "08:00").split(":")[0] ?? "8");
      scheduleDailyDigest(tasks, hour, dndStart, dndEnd);
    }

    // Single boot-time check for overdue tasks
    if (!booted.current) {
      booted.current = true;
      if (overdueAlert) triggerOverdueAlert(tasks);
    }

    // Single cleanup clears everything — no race with a second effect
    return () => clearAllReminders();
  }, [tasks, dailyDigest, dailyDigestTime, dndStart, dndEnd, overdueAlert]);

  // Hourly background Google Calendar sync
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const pollCal = async () => {
      try {
        const { triggerCalendarSync } = await import("@/integrations/calendar/sync");
        await triggerCalendarSync("hourly");
      } catch (e) {
        console.warn("[GCal Sync] Hourly background sync failed:", e);
      }
    };

    interval = setInterval(pollCal, 3600_000);
    return () => clearInterval(interval);
  }, []);
}
