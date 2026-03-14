/**
 * ICS export — generates a standards-compliant iCalendar file
 * from DevNotes tasks and plan milestones.
 *
 * Spec: RFC 5545
 */

import type { Task, Plan } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────

function icsDate(iso: string, includeTime = false): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  if (!includeTime) return date;
  return `${date}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  // RFC 5545: lines > 75 chars must be folded with CRLF + SPACE
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    chunks.push(line.slice(i, i + (i === 0 ? 75 : 74)));
    i += i === 0 ? 75 : 74;
  }
  return chunks.join("\r\n ");
}

function uid(id: string): string {
  return `devnotes-${id}@softcurse.studio`;
}

// ─── VEVENT builders ─────────────────────────────────────────────

function taskToVEvent(task: Task): string {
  if (!task.dueDate) return "";
  const hasTime = !!task.dueTime;
  const dtStart = hasTime
    ? `DTSTART:${icsDate(task.dueDate)}T${(task.dueTime ?? "00:00").replace(":", "")}00`
    : `DTSTART;VALUE=DATE:${icsDate(task.dueDate)}`;
  const dtEnd = hasTime
    ? `DTEND:${icsDate(task.dueDate)}T${(task.dueTime ?? "01:00").replace(":", "")}00`
    : `DTEND;VALUE=DATE:${icsDate(task.dueDate)}`;

  const priority = { low: 9, medium: 5, high: 3, critical: 1 }[task.priority] ?? 5;

  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${uid(task.id)}`,
    `DTSTAMP:${icsDate(new Date().toISOString(), true)}Z`,
    dtStart,
    dtEnd,
    `SUMMARY:${icsEscape(`[${task.priority.toUpperCase()}] ${task.title}`)}`,
    task.description ? `DESCRIPTION:${icsEscape(task.description)}` : "",
    `PRIORITY:${priority}`,
    `STATUS:${task.status === "done" ? "COMPLETED" : "NEEDS-ACTION"}`,
  ];

  // Reminder alarm
  if (task.reminder?.enabled) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(task.title)}`,
      `TRIGGER:-PT${task.reminder.offsetMinutes}M`,
      "END:VALARM"
    );
  }

  // Recurrence rule
  if (task.recurring) {
    const freqMap: Record<string, string> = {
      daily: "DAILY", weekly: "WEEKLY",
      monthly: "MONTHLY",
    };
    const freq  = freqMap[task.recurring.frequency] ?? "WEEKLY";
    lines.push(`RRULE:FREQ=${freq}`);
  }

  lines.push("END:VEVENT");
  return lines.filter(Boolean).map(foldLine).join("\r\n");
}

function milestoneToVEvent(
  ms: Plan["milestones"][0],
  projectName: string
): string {
  if (!ms.date) return "";
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid(ms.id)}`,
    `DTSTAMP:${icsDate(new Date().toISOString(), true)}Z`,
    `DTSTART;VALUE=DATE:${icsDate(ms.date)}`,
    `DTEND;VALUE=DATE:${icsDate(ms.date)}`,
    `SUMMARY:${icsEscape(`📍 ${projectName}: ${ms.title}`)}`,
    `STATUS:${ms.status === "done" ? "COMPLETED" : "NEEDS-ACTION"}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:Milestone: ${icsEscape(ms.title)}`,
    "TRIGGER:-P1D",     // 1 day before
    "END:VALARM",
    "END:VEVENT",
  ];
  return lines.filter(Boolean).map(foldLine).join("\r\n");
}

// ─── Main export function ─────────────────────────────────────────

export interface ICSExportOptions {
  tasks?:      Task[];
  plans?:      Array<{ plan: Plan; projectName: string }>;
  calName?:    string;
}

export function generateICS(opts: ICSExportOptions): string {
  const { tasks = [], plans = [], calName = "DevNotes" } = opts;

  const events: string[] = [];

  for (const task of tasks) {
    const v = taskToVEvent(task);
    if (v) events.push(v);
  }

  for (const { plan, projectName } of plans) {
    for (const ms of plan.milestones ?? []) {
      const v = milestoneToVEvent(ms, projectName);
      if (v) events.push(v);
    }
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Softcurse Studio//DevNotes//EN",
    `X-WR-CALNAME:${icsEscape(calName)}`,
    "X-WR-TIMEZONE:UTC",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

/**
 * Trigger a browser download of the .ics file.
 */
export function downloadICS(content: string, filename = "devnotes.ics"): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * On Tauri: write to disk. On browser: download.
 */
export async function exportICS(content: string, filename = "devnotes.ics"): Promise<void> {
  const isTauri = "__TAURI_INTERNALS__" in window;
  if (isTauri) {
    try {
      const { save } = await import(/* @vite-ignore */ "@tauri-apps/plugin-dialog");
      const path = await save({ defaultPath: filename, filters: [{ name: "Calendar", extensions: ["ics"] }] });
      if (path) {
        const { writeTextFile } = await import(/* @vite-ignore */ "@tauri-apps/plugin-fs");
        await writeTextFile(path, content);
        return;
      }
    } catch { /* fall through to browser download */ }
  }
  downloadICS(content, filename);
}
