import { useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";
import {
  scheduleAllReminders,
  scheduleDailyDigest,
  clearAllReminders,
} from "@/integrations/calendar/reminders";

/**
 * Keeps the reminder scheduler in sync with the current task list.
 * Run once at app root level.
 */
export function useReminders() {
  const tasks    = useAppStore((s) => s.data.tasks);
  const settings = useAppStore((s) => s.data.settings);

  // Re-schedule whenever tasks change
  useEffect(() => {
    scheduleAllReminders(tasks);
    return () => clearAllReminders();
  }, [tasks]);

  // Daily digest
  useEffect(() => {
    if (settings.dailyDigest) {
      const hour = parseInt(
        (settings.dailyDigestTime ?? "08:00").split(":")[0] ?? "8"
      );
      scheduleDailyDigest(tasks, hour);
    }
  }, [tasks, settings.dailyDigest, settings.dailyDigestTime]);
}
