import { useAppStore } from "@/stores/useAppStore";
import { createEvent, updateEvent, taskToGCalEvent } from "./google";
import type { Task, Milestone, Plan } from "@/types";

let isSyncing = false;
let lastHourlySync = 0;

/**
 * Triggers a Google Calendar sync based on the specified trigger context.
 * Honors user settings for sync scope, frequency, and milestones.
 */
export async function triggerCalendarSync(
    trigger: "on-save" | "hourly" | "manual"
) {
    if (isSyncing) return;

    const state = useAppStore.getState();
    const { settings } = state.data;
    const token = settings.calendarAccessToken;

    // Guard clauses
    if (!token) return;
    if (trigger !== "manual" && settings.calendarSyncFrequency !== trigger) return;
    if (settings.calendarSyncScope === "none") return;

    // Throttle hourly sync strictly
    if (trigger === "hourly") {
        const now = Date.now();
        if (now - lastHourlySync < 3600_000) return;
        lastHourlySync = now;
    }

    isSyncing = true;
    try {
        const { tasks, plans } = state.data;
        const { updateTask, updatePlan } = state;

        // 1. Sync Tasks
        for (const task of tasks) {
            if (task.status === "archived") continue;
            if (!task.dueDate && !task.reminder?.enabled) continue; // Skip totally unscheduled tasks attached to nothing

            // Filter by scope
            if (settings.calendarSyncScope === "high-and-critical") {
                if (task.priority !== "high" && task.priority !== "critical") continue;
            }

            const event = taskToGCalEvent(task);

            try {
                if (task.calendarEventId) {
                    await updateEvent(token, task.calendarEventId, "primary", event);
                } else if (settings.calendarAutoPush || trigger === "manual") {
                    // If it doesn't have an ID, only push if AutoPush is enabled or if done manually
                    const created = await createEvent(token, "primary", event);
                    if (created.id) updateTask(task.id, { calendarEventId: created.id });
                }
            } catch (err) {
                console.warn(`[GCal Sync] Failed to sync task ${task.id}:`, err);
            }
        }

        // 2. Sync Milestones
        if (settings.calendarSyncMilestones) {
            for (const plan of plans) {
                let planModified = false;
                const mappedMilestones = [...plan.milestones];

                for (let i = 0; i < mappedMilestones.length; i++) {
                    const m = mappedMilestones[i];
                    if (m.status === "done" || !m.date) continue;

                    const event = {
                        summary: `Milestone: ${m.title}`,
                        description: m.description,
                        start: { date: m.date },
                        end: { date: m.date }
                    };

                    try {
                        if (m.calendarEventId) {
                            await updateEvent(token, m.calendarEventId, "primary", event);
                        } else if (settings.calendarAutoPush || trigger === "manual") {
                            const created = await createEvent(token, "primary", event);
                            if (created.id) {
                                mappedMilestones[i] = { ...m, calendarEventId: created.id };
                                planModified = true;
                            }
                        }
                    } catch (err) {
                        console.warn(`[GCal Sync] Failed to sync milestone ${m.id}:`, err);
                    }
                }

                if (planModified) {
                    updatePlan(plan.projectId, { milestones: mappedMilestones });
                }
            }
        }

    } finally {
        isSyncing = false;
    }
}
