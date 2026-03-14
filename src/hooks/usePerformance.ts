/**
 * usePerformance.ts  —  Phase 7 hardening
 *
 * Memoised selectors for large datasets.
 * Prevents full re-renders when only unrelated slice of store changes.
 */
import { useMemo } from "react";
import { useAppStore } from "@/stores/useAppStore";

// Tasks filtered + sorted — only recomputes when tasks array reference changes
export function useProjectTasks(projectId: string | null) {
  const tasks = useAppStore(s => s.data.tasks);
  return useMemo(() => {
    if (!projectId) return [];
    return tasks
      .filter(t => t.projectId === projectId && t.status !== "archived")
      .sort((a, b) => {
        // Priority order
        const P = { critical:0, high:1, medium:2, low:3 };
        const pd = (P[a.priority as keyof typeof P] ?? 4) - (P[b.priority as keyof typeof P] ?? 4);
        if (pd !== 0) return pd;
        // Then due date
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [tasks, projectId]);
}

// Notes filtered — excludes archived, sorts by updatedAt desc
export function useProjectNotes(projectId: string | null) {
  const notes = useAppStore(s => s.data.notes);
  return useMemo(() => {
    if (!projectId) return [];
    return notes
      .filter(n => n.projectId === projectId && !n.archived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, projectId]);
}

// Overdue count — cheap derived value for status bar / badges
export function useOverdueCount(projectId: string | null): number {
  const tasks = useAppStore(s => s.data.tasks);
  return useMemo(() => {
    if (!projectId) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter(t =>
      t.projectId === projectId &&
      t.dueDate &&
      t.dueDate < today &&
      t.status !== "done" &&
      t.status !== "archived"
    ).length;
  }, [tasks, projectId]);
}

// Search index — builds once per notes change, used by GlobalSearch
export function useNoteSearchIndex() {
  const notes = useAppStore(s => s.data.notes);
  return useMemo(() =>
    notes
      .filter(n => !n.archived)
      .map(n => ({
        id: n.id,
        projectId: n.projectId,
        searchable: `${n.title} ${n.body ?? ""} ${n.tags?.join(" ") ?? ""}`.toLowerCase(),
      })),
    [notes]
  );
}
