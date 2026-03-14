/**
 * Export Engine — Phase 5
 *
 * Supports three formats: Markdown (.md), Plain Text (.txt), PDF (.pdf)
 * Exportable content: individual notes, all project notes, tasks, plan, decisions, standup history
 *
 * PDF: generated via browser print API (window.print with a hidden iframe)
 *      — no external dependency, works in both Tauri and browser
 * MD/TXT: plain text generation, saved via Tauri dialog or browser download
 */

import type { Note, Task, Plan, Decision, StandupEntry, Project } from "@/types";
import { exportICS as _exportICS } from "@/integrations/calendar/ics";   // re-export convenience

// ─── Save helpers ─────────────────────────────────────────────────

async function saveFile(content: string, filename: string, mimeType: string): Promise<void> {
  const isTauri = "__TAURI_INTERNALS__" in window;
  if (isTauri) {
    try {
      const { save } = await import(/* @vite-ignore */ "@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import(/* @vite-ignore */ "@tauri-apps/plugin-fs");
      const path = await save({
        defaultPath: filename,
        filters: [{ name: "Document", extensions: [filename.split(".").pop() ?? "txt"] }],
      });
      if (path) { await writeTextFile(path, content); return; }
    } catch { /* fall through to browser download */ }
  }
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function slug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function dateStr(): string { return new Date().toISOString().slice(0, 10); }

// ─── Markdown builders ────────────────────────────────────────────

export function noteToMarkdown(note: Note): string {
  const lines: string[] = [];
  lines.push(`# ${note.title}`);
  lines.push(`> Created: ${note.createdAt.slice(0,10)}  Updated: ${note.updatedAt.slice(0,10)}`);
  if (note.tags?.length) lines.push(`> Tags: ${note.tags.join(", ")}`);
  lines.push("");
  lines.push(note.body ?? "");
  return lines.join("\n");
}

export function tasksToMarkdown(tasks: Task[], projectName: string): string {
  const lines: string[] = [];
  lines.push(`# Tasks — ${projectName}`);
  lines.push(`> Exported: ${dateStr()}`);
  lines.push("");

  const groups: Record<string, Task[]> = {};
  for (const t of tasks) {
    if (!groups[t.status]) groups[t.status] = [];
    groups[t.status].push(t);
  }

  const order = ["in-progress", "todo", "backlog", "done", "archived"];
  for (const status of order) {
    const group = groups[status];
    if (!group?.length) continue;
    lines.push(`## ${status.replace("-", " ").replace(/\b\w/g, c => c.toUpperCase())}`);
    lines.push("");
    for (const t of group) {
      const check  = t.status === "done" ? "[x]" : "[ ]";
      const due    = t.dueDate ? ` 📅 ${t.dueDate}` : "";
      const pri    = `[${t.priority}]`;
      lines.push(`- ${check} **${t.title}** ${pri}${due}`);
      if (t.description) lines.push(`  > ${t.description}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function planToMarkdown(plan: Plan, projectName: string): string {
  const lines: string[] = [];
  lines.push(`# Project Plan — ${projectName}`);
  lines.push(`> Exported: ${dateStr()}`);
  lines.push("");

  if (plan.milestones?.length) {
    lines.push("## Milestones");
    lines.push("");
    for (const ms of plan.milestones) {
      const check = ms.status === "done" ? "[x]" : "[ ]";
      const due   = ms.date ? ` — ${ms.date}` : "";
      lines.push(`- ${check} **${ms.title}**${due}`);
      if (ms.description) lines.push(`  ${ms.description}`);
    }
    lines.push("");
  }

  if (plan.body) {
    lines.push("## Notes");
    lines.push("");
    lines.push(plan.body);
  }

  return lines.join("\n");
}

export function decisionsToMarkdown(decisions: Decision[], projectName: string): string {
  const lines: string[] = [];
  lines.push(`# Decision Log — ${projectName}`);
  lines.push(`> Exported: ${dateStr()}`);
  lines.push("");

  for (const d of decisions) {
    lines.push(`## ${d.title}`);
    lines.push(`**Status:** ${d.status}  |  **Date:** ${d.decisionDate ?? "—"}  |  **By:** ${d.decidedBy || "—"}`);
    if (d.tags?.length) lines.push(`**Tags:** ${d.tags.join(", ")}`);
    lines.push("");
    if (d.context)  { lines.push("### Context"); lines.push(d.context); lines.push(""); }
    if (d.options)  { lines.push("### Options Considered"); lines.push(d.options); lines.push(""); }
    if (d.outcome)  { lines.push("### Decision & Rationale"); lines.push(d.outcome); lines.push(""); }
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

export function standupsToMarkdown(standups: StandupEntry[], projectName: string): string {
  const lines: string[] = [];
  lines.push(`# Standup History — ${projectName}`);
  lines.push(`> Exported: ${dateStr()}`);
  lines.push("");

  const moodLabels = ["","😫 Rough","😕 Meh","😐 OK","😊 Good","🔥 Excellent"];
  for (const s of standups) {
    lines.push(`## ${s.date}  ${moodLabels[s.mood] ?? ""}`);
    lines.push(`**Yesterday:**\n${s.yesterday || "—"}`);
    lines.push(`\n**Today:**\n${s.today || "—"}`);
    if (s.blockers) lines.push(`\n**Blockers:**\n${s.blockers}`);
    lines.push("\n---\n");
  }
  return lines.join("\n");
}

export function projectToMarkdown(
  project: Project,
  notes: Note[],
  tasks: Task[],
  plan: Plan | undefined,
  decisions: Decision[],
): string {
  const parts: string[] = [];
  parts.push(`# ${project.icon ?? ""} ${project.name}`);
  parts.push(`> Status: ${project.status}  |  Exported: ${dateStr()}`);
  parts.push("");

  if (plan) parts.push(planToMarkdown(plan, project.name));
  if (tasks.length) parts.push(tasksToMarkdown(tasks, project.name));
  if (notes.length) {
    parts.push(`# Notes (${notes.length})`);
    for (const n of notes) { parts.push(noteToMarkdown(n)); parts.push("\n---\n"); }
  }
  if (decisions.length) parts.push(decisionsToMarkdown(decisions, project.name));
  return parts.join("\n\n");
}

// ─── Plain text (strip markdown) ─────────────────────────────────

function mdToText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")          // headings
    .replace(/\*\*(.*?)\*\*/g, "$1")       // bold
    .replace(/\*(.*?)\*/g, "$1")           // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, "")    // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/^[-*+]\s+/gm, "  • ")       // bullets
    .replace(/^>\s+/gm, "  ")             // blockquotes
    .replace(/^---+$/gm, "─".repeat(60))  // hr
    .replace(/\n{3,}/g, "\n\n")           // excess newlines
    .trim();
}

// ─── Public API ───────────────────────────────────────────────────

/** Export a single note */
export async function exportNote(note: Note, format: "md" | "txt" | "pdf"): Promise<void> {
  const md  = noteToMarkdown(note);
  const fn  = `${slug(note.title)}-${dateStr()}`;
  if (format === "md")  return saveFile(md, `${fn}.md`,  "text/markdown");
  if (format === "txt") return saveFile(mdToText(md), `${fn}.txt`, "text/plain");
  if (format === "pdf") return printToPDF(md, note.title);
}

/** Export all notes from a project */
export async function exportAllNotes(notes: Note[], projectName: string, format: "md"|"txt"|"pdf"): Promise<void> {
  const combined = notes.map(noteToMarkdown).join("\n\n---\n\n");
  const fn = `${slug(projectName)}-notes-${dateStr()}`;
  if (format === "md")  return saveFile(combined, `${fn}.md`, "text/markdown");
  if (format === "txt") return saveFile(mdToText(combined), `${fn}.txt`, "text/plain");
  if (format === "pdf") return printToPDF(combined, `Notes — ${projectName}`);
}

/** Export tasks */
export async function exportTasks(tasks: Task[], projectName: string, format: "md"|"txt"|"pdf"): Promise<void> {
  const md = tasksToMarkdown(tasks, projectName);
  const fn = `${slug(projectName)}-tasks-${dateStr()}`;
  if (format === "md")  return saveFile(md, `${fn}.md`, "text/markdown");
  if (format === "txt") return saveFile(mdToText(md), `${fn}.txt`, "text/plain");
  if (format === "pdf") return printToPDF(md, `Tasks — ${projectName}`);
}

/** Export full project */
export async function exportProject(
  project: Project,
  notes: Note[],
  tasks: Task[],
  plan: Plan | undefined,
  decisions: Decision[],
  format: "md" | "txt" | "pdf"
): Promise<void> {
  const md = projectToMarkdown(project, notes, tasks, plan, decisions);
  const fn = `${slug(project.name)}-export-${dateStr()}`;
  if (format === "md")  return saveFile(md, `${fn}.md`, "text/markdown");
  if (format === "txt") return saveFile(mdToText(md), `${fn}.txt`, "text/plain");
  if (format === "pdf") return printToPDF(md, project.name);
}

/** Export decisions */
export async function exportDecisions(decisions: Decision[], projectName: string, format: "md"|"txt"|"pdf"): Promise<void> {
  const md = decisionsToMarkdown(decisions, projectName);
  const fn = `${slug(projectName)}-decisions-${dateStr()}`;
  if (format === "md")  return saveFile(md, `${fn}.md`, "text/markdown");
  if (format === "txt") return saveFile(mdToText(md), `${fn}.txt`, "text/plain");
  if (format === "pdf") return printToPDF(md, `Decision Log — ${projectName}`);
}

/** Export standup history */
export async function exportStandups(standups: StandupEntry[], projectName: string, format: "md"|"txt"|"pdf"): Promise<void> {
  const md = standupsToMarkdown(standups, projectName);
  const fn = `${slug(projectName)}-standups-${dateStr()}`;
  if (format === "md")  return saveFile(md, `${fn}.md`, "text/markdown");
  if (format === "txt") return saveFile(mdToText(md), `${fn}.txt`, "text/plain");
  if (format === "pdf") return printToPDF(md, `Standup History — ${projectName}`);
}

// ─── PDF via print iframe ─────────────────────────────────────────

export async function printToPDF(markdownContent: string, title: string): Promise<void> {
  // Convert markdown to basic HTML for the print view
  const html = markdownToHTML(markdownContent);

  const printHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Fira+Code&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', 'Segoe UI', sans-serif;
      font-size: 11pt; line-height: 1.7;
      color: #1e1a14; background: #fff;
      padding: 2cm 2.5cm;
      max-width: 21cm; margin: 0 auto;
    }
    h1 { font-size: 20pt; font-weight: 700; color: #0068b8; margin: 0 0 0.4em; border-bottom: 2px solid #0068b8; padding-bottom: 0.3em; }
    h2 { font-size: 14pt; font-weight: 600; color: #1e1a14; margin: 1.4em 0 0.4em; }
    h3 { font-size: 12pt; font-weight: 600; color: #444; margin: 1em 0 0.3em; }
    p  { margin: 0.5em 0; }
    ul, ol { margin: 0.4em 0 0.4em 1.5em; }
    li { margin: 0.2em 0; }
    code { font-family: 'Fira Code', 'Consolas', monospace; font-size: 9pt; background: #f0ede8; padding: 0.1em 0.3em; border-radius: 2px; }
    pre  { font-family: 'Fira Code', 'Consolas', monospace; font-size: 9pt; background: #f0ede8; padding: 0.8em 1em; margin: 0.6em 0; overflow-x: auto; border-left: 3px solid #0068b8; }
    blockquote { border-left: 3px solid #b0a090; padding-left: 1em; color: #6b5e4e; margin: 0.6em 0; }
    hr { border: none; border-top: 1px solid #c8c0b4; margin: 1.2em 0; }
    strong { font-weight: 600; color: #1e1a14; }
    em { font-style: italic; }
    table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
    th, td { border: 1px solid #c8c0b4; padding: 0.4em 0.7em; text-align: left; }
    th { background: #f0ede8; font-weight: 600; }
    .footer { margin-top: 2em; padding-top: 0.5em; border-top: 1px solid #c8c0b4; font-size: 9pt; color: #b0a090; }
    @media print {
      body { padding: 0; }
      @page { margin: 2cm; }
    }
  </style>
</head>
<body>
  ${html}
  <div class="footer">DevNotes — Exported ${new Date().toLocaleDateString()}</div>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }

  doc.open(); doc.write(printHTML); doc.close();

  // Wait for fonts/images
  await new Promise((r) => setTimeout(r, 600));

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  // Clean up after print dialog closes
  setTimeout(() => document.body.removeChild(iframe), 2000);
}

// ─── Markdown → HTML (minimal, no external dep) ──────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function markdownToHTML(md: string): string {
  let html = escapeHtml(md);

  // Headings
  html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.+)$/gm,  "<h5>$1</h5>");
  html = html.replace(/^#### (.+)$/gm,   "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm,    "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm,     "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm,      "<h1>$1</h1>");

  // Inline
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g,     "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g,     "<code>$1</code>");

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // HR
  html = html.replace(/^---+$/gm, "<hr>");

  // Checkboxes
  html = html.replace(/- \[x\] (.+)/g, "<li>☑ $1</li>");
  html = html.replace(/- \[ \] (.+)/g, "<li>☐ $1</li>");

  // Bullets
  html = html.replace(/^[•\-\*] (.+)$/gm, "<li>$1</li>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

  // Paragraphs — wrap non-tag lines
  html = html.replace(/^([^<\n].+)$/gm, "<p>$1</p>");

  return html;
}
