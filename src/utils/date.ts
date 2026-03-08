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

/** "Jun 10" style short label. Returns "?" on invalid input. */
export function shortDate(iso: string): string {
  if (!iso) return "?";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10); // fall back to raw string
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Full date label e.g. "Jun 10, 2025" */
export function longDate(iso: string): string {
  if (!iso) return "?";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Returns how many days until a due date. Negative = overdue. */
export function daysUntil(isoDate: string): number {
  const due   = new Date(isoDate).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86_400_000);
}

/** "19:42:07" */
export function timeString(d = new Date()): string {
  return d.toTimeString().slice(0, 8);
}
