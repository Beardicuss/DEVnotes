import { useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";
import {
  scheduleAllReminders,
  scheduleDailyDigest,
  clearAllReminders,
} from "@/integrations/calendar/reminders";

/**
 * Keeps the reminder scheduler in sync with the current task list and settings.
 * Uses a SINGLE effect to avoid the double-clearAllReminders race where a second
 * effect's cleanup would wipe reminders scheduled by the first effect.
 * Run once at app root level.
 */
export function useReminders() {
  const tasks    = useAppStore((s) => s.data.tasks);
  // Select only the fields we need — avoids re-running on every settings change
  const dailyDigest     = useAppStore((s) => s.data.settings.dailyDigest);
  const dailyDigestTime = useAppStore((s) => s.data.settings.dailyDigestTime);

  useEffect(() => {
    // Always schedule task reminders first
    scheduleAllReminders(tasks);

    // Optionally layer on daily digest
    if (dailyDigest) {
      const hour = parseInt(
        (dailyDigestTime ?? "08:00").split(":")[0] ?? "8"
      );
      scheduleDailyDigest(tasks, hour);
    }

    // Single cleanup clears everything — no race with a second effect
    return () => clearAllReminders();
  }, [tasks, dailyDigest, dailyDigestTime]);
}
