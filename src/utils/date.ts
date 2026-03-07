/** Returns ISO datetime string for right now. */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Returns "YYYY-MM-DD" for right now. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True if a due date string is in the past (overdue). */
export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return dueDate < todayISO();
}

/** "Jun 10" style short label */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "19:42:07" */
export function timeString(d = new Date()): string {
  return d.toTimeString().slice(0, 8);
}
