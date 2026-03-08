/**
 * HTML Report Generator — Phase 6
 * Produces a single self-contained .html file with embedded CSS.
 * No server, no dependencies — just open in any browser.
 */

import type { Project, Note, Task, Plan, Decision, StandupEntry, PomodoroSession } from "@/types";

interface ReportData {
  project:   Project;
  notes:     Note[];
  tasks:     Task[];
  plan:      Plan | undefined;
  decisions: Decision[];
  standups:  StandupEntry[];
  pomodoros: PomodoroSession[];
  generatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function mdToHtml(md: string): string {
  let h = esc(md);
  h = h.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
  h = h.replace(/^##### (.+)$/gm,  "<h5>$1</h5>");
  h = h.replace(/^#### (.+)$/gm,   "<h4>$1</h4>");
  h = h.replace(/^### (.+)$/gm,    "<h3>$1</h3>");
  h = h.replace(/^## (.+)$/gm,     "<h2>$1</h2>");
  h = h.replace(/^# (.+)$/gm,      "<h1>$1</h1>");
  h = h.replace(/\*\*(.+?)\*\*/g,  "<strong>$1</strong>");
  h = h.replace(/\*(.+?)\*/g,      "<em>$1</em>");
  h = h.replace(/`([^`]+)`/g,      "<code>$1</code>");
  h = h.replace(/^&gt; (.+)$/gm,   "<blockquote>$1</blockquote>");
  h = h.replace(/^---+$/gm,        "<hr>");
  h = h.replace(/- \[x\] (.+)/g,   "<li class='done'>☑ $1</li>");
  h = h.replace(/- \[ \] (.+)/g,   "<li>☐ $1</li>");
  h = h.replace(/^[-*] (.+)$/gm,   "<li>$1</li>");
  h = h.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  h = h.replace(/^([^<\n].+)$/gm,  "<p>$1</p>");
  return h;
}

const STATUS_COLOUR: Record<string, string> = {
  done: "#1a8a44", "in-progress": "#a06000", todo: "#1a4fcc",
  backlog: "#888", archived: "#aaa",
};
const PRIORITY_COLOUR: Record<string, string> = {
  critical: "#cc2233", high: "#c05800", medium: "#0068b8", low: "#888",
};
const DECISION_COLOUR: Record<string, string> = {
  accepted: "#1a8a44", rejected: "#cc2233", proposed: "#a06000", deferred: "#888",
};

// ─── Section builders ──────────────────────────────────────────────

function buildPlan(plan: Plan | undefined, projectName: string): string {
  if (!plan) return "";
  const milestones = (plan.milestones ?? []).map((ms) => `
    <div class="milestone ${ms.status==="done"?"done":""}">
      <span class="ms-dot" style="color:${ms.status==="done"?"#1a8a44":"#9900bb"}">◆</span>
      <span class="ms-title">${esc(ms.title)}</span>
      ${ms.date ? `<span class="ms-date">${ms.date}</span>` : ""}
      <span class="badge" style="background:${ms.status==="done"?"#1a8a44":"#9900bb"}20;color:${ms.status==="done"?"#1a8a44":"#9900bb"};border-color:${ms.status==="done"?"#1a8a44":"#9900bb"}">${ms.status}</span>
    </div>`).join("");

  return `
  <section id="plan">
    <h2>📋 Project Plan</h2>
    ${milestones ? `<div class="milestones">${milestones}</div>` : ""}
    ${plan.body ? `<div class="markdown">${mdToHtml(plan.body)}</div>` : ""}
  </section>`;
}

function buildTasks(tasks: Task[]): string {
  if (!tasks.length) return "";
  const order = ["in-progress","todo","backlog","done","archived"];
  const grouped: Record<string, Task[]> = {};
  tasks.forEach((t) => { (grouped[t.status] ??= []).push(t); });

  const cols = order.filter((s) => grouped[s]?.length).map((status) => {
    const items = grouped[status].map((t) => `
      <div class="task-card ${t.status==="done"?"done":""}">
        <div class="task-header">
          <span class="task-title">${esc(t.title)}</span>
          <span class="badge" style="background:${PRIORITY_COLOUR[t.priority]}20;color:${PRIORITY_COLOUR[t.priority]};border-color:${PRIORITY_COLOUR[t.priority]}">${t.priority}</span>
        </div>
        ${t.description ? `<p class="task-desc">${esc(t.description)}</p>` : ""}
        ${t.dueDate ? `<span class="task-due">📅 ${t.dueDate}</span>` : ""}
      </div>`).join("");
    return `
      <div class="kanban-col">
        <div class="kanban-col-header" style="border-top-color:${STATUS_COLOUR[status] ?? "#888"}">
          <span style="color:${STATUS_COLOUR[status] ?? "#888"}">${status.replace("-"," ").toUpperCase()}</span>
          <span class="count">${grouped[status].length}</span>
        </div>
        ${items}
      </div>`;
  }).join("");

  return `
  <section id="tasks">
    <h2>✅ Tasks (${tasks.length})</h2>
    <div class="kanban">${cols}</div>
  </section>`;
}

function buildNotes(notes: Note[]): string {
  if (!notes.length) return "";
  const items = notes.filter((n) => !n.archived).map((n) => `
    <div class="note-card">
      <div class="note-header">
        <h3>${esc(n.title || "Untitled")}</h3>
        <span class="note-date">${n.updatedAt.slice(0,10)}</span>
      </div>
      ${n.tags?.length ? `<div class="tags">${n.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="markdown">${mdToHtml(n.body ?? "")}</div>
    </div>`).join("");
  return `
  <section id="notes">
    <h2>📝 Notes (${notes.filter(n=>!n.archived).length})</h2>
    ${items}
  </section>`;
}

function buildDecisions(decisions: Decision[]): string {
  if (!decisions.length) return "";
  const items = decisions.map((d) => `
    <div class="decision-card">
      <div class="decision-header">
        <h3>${esc(d.title)}</h3>
        <span class="badge" style="background:${DECISION_COLOUR[d.status]}20;color:${DECISION_COLOUR[d.status]};border-color:${DECISION_COLOUR[d.status]}">${d.status}</span>
      </div>
      <div class="decision-meta">
        ${d.decisionDate ? `<span>📅 ${d.decisionDate}</span>` : ""}
        ${d.decidedBy ? `<span>👤 ${esc(d.decidedBy)}</span>` : ""}
        ${d.tags?.length ? d.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("") : ""}
      </div>
      ${d.context  ? `<div class="decision-section"><strong>Context</strong><p>${esc(d.context)}</p></div>`  : ""}
      ${d.options  ? `<div class="decision-section"><strong>Options</strong><p>${esc(d.options)}</p></div>`  : ""}
      ${d.outcome  ? `<div class="decision-section"><strong>Decision</strong><p>${esc(d.outcome)}</p></div>` : ""}
    </div>`).join("");
  return `
  <section id="decisions">
    <h2>🤔 Decision Log (${decisions.length})</h2>
    ${items}
  </section>`;
}

function buildStats(data: ReportData): string {
  const doneTasks    = data.tasks.filter((t) => t.status === "done").length;
  const totalTasks   = data.tasks.length;
  const pct          = totalTasks ? Math.round((doneTasks/totalTasks)*100) : 0;
  const focusMins    = data.pomodoros.filter((p) => p.completed).reduce((a,p) => a + p.duration, 0);
  const decisions    = data.decisions.filter((d) => d.status === "accepted").length;

  return `
  <section id="stats">
    <h2>📊 Stats</h2>
    <div class="stats-grid">
      <div class="stat"><span class="stat-val">${doneTasks}/${totalTasks}</span><span class="stat-key">Tasks done</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="stat"><span class="stat-val">${data.notes.filter(n=>!n.archived).length}</span><span class="stat-key">Notes</span></div>
      <div class="stat"><span class="stat-val">${Math.round(focusMins/60)}h ${focusMins%60}m</span><span class="stat-key">Focus time</span></div>
      <div class="stat"><span class="stat-val">${decisions}</span><span class="stat-key">Decisions accepted</span></div>
    </div>
  </section>`;
}

// ─── CSS ──────────────────────────────────────────────────────────

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter','Segoe UI',sans-serif;font-size:11pt;line-height:1.7;color:#1e1a14;background:#f0ede8;padding:0}
  a{color:#0068b8}
  /* Layout */
  .wrapper{display:flex;min-height:100vh}
  nav{width:220px;flex-shrink:0;background:#1a1610;color:#c8e8ff;position:sticky;top:0;height:100vh;overflow-y:auto;padding:1.5em 0}
  .nav-title{padding:0 1.2em 1em;font-family:'Courier New',monospace;font-size:10pt;color:#00ffff;letter-spacing:0.2em;text-transform:uppercase;border-bottom:1px solid rgba(0,255,255,0.1)}
  .nav-sub{padding:0.4em 0.8em;font-size:9pt;color:rgba(200,232,255,0.4);text-transform:uppercase;letter-spacing:0.1em;margin-top:0.8em}
  nav a{display:block;padding:0.45em 1.2em;font-size:10pt;color:rgba(200,232,255,0.7);text-decoration:none;transition:all 0.15s}
  nav a:hover{background:rgba(0,255,255,0.08);color:#00ffff}
  main{flex:1;padding:2.5em 3em;max-width:900px}
  /* Header */
  .report-header{margin-bottom:2.5em;padding-bottom:1.2em;border-bottom:2px solid #0068b8}
  .report-title{font-size:22pt;font-weight:700;color:#0068b8;letter-spacing:0.05em}
  .report-meta{font-size:9pt;color:#6b5e4e;margin-top:0.3em}
  /* Sections */
  section{margin-bottom:3em}
  section h2{font-size:14pt;font-weight:600;color:#1e1a14;margin-bottom:1em;padding-bottom:0.4em;border-bottom:1px solid rgba(80,60,40,0.2)}
  h3{font-size:12pt;font-weight:600;color:#1e1a14;margin-bottom:0.4em}
  /* Badge */
  .badge{display:inline-block;padding:0.1em 0.5em;border:1px solid;font-size:8pt;font-family:'Courier New',monospace;border-radius:2px;white-space:nowrap}
  /* Plan */
  .milestones{display:flex;flex-direction:column;gap:0.5em;margin-bottom:1.2em}
  .milestone{display:flex;align-items:center;gap:0.6em;padding:0.5em 0.8em;background:#fff;border:1px solid rgba(80,60,40,0.15)}
  .milestone.done{opacity:0.55}
  .ms-title{flex:1;font-weight:500}
  .ms-date{font-family:'Courier New',monospace;font-size:9pt;color:#6b5e4e}
  /* Tasks kanban */
  .kanban{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1em}
  .kanban-col{background:#fff;border:1px solid rgba(80,60,40,0.12)}
  .kanban-col-header{display:flex;justify-content:space-between;align-items:center;padding:0.5em 0.8em;border-top:3px solid;font-family:'Courier New',monospace;font-size:8.5pt;font-weight:600}
  .count{background:rgba(0,0,0,0.06);padding:0.1em 0.4em;border-radius:999px;font-size:8pt}
  .task-card{padding:0.7em 0.8em;border-bottom:1px solid rgba(80,60,40,0.08)}
  .task-card.done .task-title{text-decoration:line-through;opacity:0.5}
  .task-header{display:flex;justify-content:space-between;align-items:flex-start;gap:0.4em;margin-bottom:0.3em}
  .task-title{font-weight:500;font-size:10pt;flex:1}
  .task-desc{font-size:9pt;color:#6b5e4e;margin-bottom:0.3em}
  .task-due{font-family:'Courier New',monospace;font-size:8.5pt;color:#a06000}
  /* Notes */
  .note-card{background:#fff;border:1px solid rgba(80,60,40,0.12);padding:1.2em;margin-bottom:1em}
  .note-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.5em}
  .note-date{font-family:'Courier New',monospace;font-size:8.5pt;color:#6b5e4e}
  /* Decisions */
  .decision-card{background:#fff;border:1px solid rgba(80,60,40,0.12);padding:1.2em;margin-bottom:1em}
  .decision-header{display:flex;justify-content:space-between;align-items:flex-start;gap:0.5em;margin-bottom:0.5em}
  .decision-meta{display:flex;flex-wrap:wrap;gap:0.5em;margin-bottom:0.75em;font-size:9pt;color:#6b5e4e}
  .decision-section{margin-top:0.75em}
  .decision-section strong{font-size:9pt;text-transform:uppercase;letter-spacing:0.1em;color:#6b5e4e;display:block;margin-bottom:0.2em}
  .decision-section p{font-size:10pt;color:#1e1a14;white-space:pre-wrap}
  /* Tags */
  .tags{display:flex;flex-wrap:wrap;gap:0.3em;margin-bottom:0.5em}
  .tag{font-family:'Courier New',monospace;font-size:8pt;padding:0.1em 0.4em;border:1px solid rgba(0,104,184,0.3);color:#0068b8}
  /* Stats */
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1em}
  .stat{background:#fff;border:1px solid rgba(80,60,40,0.12);padding:1em;display:flex;flex-direction:column;gap:0.3em}
  .stat-val{font-family:'Courier New',monospace;font-size:16pt;color:#0068b8;font-weight:700}
  .stat-key{font-size:9pt;color:#6b5e4e;text-transform:uppercase;letter-spacing:0.08em}
  .progress-bar{height:4px;background:#e0dbd4;border-radius:2px;margin-top:0.3em}
  .progress-fill{height:100%;background:#0068b8;border-radius:2px}
  /* Markdown */
  .markdown h1,.markdown h2,.markdown h3{margin:0.8em 0 0.4em}
  .markdown p{margin:0.4em 0}
  .markdown ul{margin:0.4em 0 0.4em 1.5em}
  .markdown li.done{opacity:0.5}
  .markdown code{font-family:'Courier New',monospace;font-size:9pt;background:#f0ede8;padding:0.1em 0.3em}
  .markdown blockquote{border-left:3px solid #b0a090;padding-left:0.8em;color:#6b5e4e;margin:0.5em 0}
  .markdown hr{border:none;border-top:1px solid #c8c0b4;margin:0.8em 0}
  /* Footer */
  footer{margin-top:3em;padding-top:1em;border-top:1px solid rgba(80,60,40,0.2);font-size:8.5pt;color:#b0a090}
  @media print{nav{display:none}main{padding:0}@page{margin:2cm}}
  @media(max-width:700px){.wrapper{flex-direction:column}nav{width:100%;height:auto;position:static}.kanban{grid-template-columns:1fr}}
`;

// ─── Main builder ─────────────────────────────────────────────────

export function buildHTMLReport(d: ReportData): string {
  const nav = `
    <nav>
      <div class="nav-title">${esc(d.project.icon ?? "")} ${esc(d.project.name)}</div>
      <div class="nav-sub">Sections</div>
      <a href="#stats">📊 Stats</a>
      ${d.plan ? '<a href="#plan">📋 Plan</a>' : ""}
      ${d.tasks.length ? '<a href="#tasks">✅ Tasks</a>' : ""}
      ${d.notes.filter(n=>!n.archived).length ? '<a href="#notes">📝 Notes</a>' : ""}
      ${d.decisions.length ? '<a href="#decisions">🤔 Decisions</a>' : ""}
      <div class="nav-sub" style="margin-top:auto">Export</div>
      <a href="#" onclick="window.print();return false">🖨 Print / PDF</a>
    </nav>`;

  const header = `
    <div class="report-header">
      <div class="report-title">${esc(d.project.icon ?? "")} ${esc(d.project.name)}</div>
      <div class="report-meta">
        Status: ${d.project.status} &nbsp;·&nbsp;
        Generated: ${d.generatedAt} &nbsp;·&nbsp;
        ${d.tasks.length} tasks · ${d.notes.filter(n=>!n.archived).length} notes · ${d.decisions.length} decisions
      </div>
    </div>`;

  const body = [
    buildStats(d),
    buildPlan(d.plan, d.project.name),
    buildTasks(d.tasks),
    buildNotes(d.notes),
    buildDecisions(d.decisions),
  ].filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(d.project.name)} — DevNotes Report</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="wrapper">
    ${nav}
    <main>
      ${header}
      ${body}
      <footer>
        Generated by DevNotes · ${d.generatedAt} · This report is self-contained — share or archive as-is.
      </footer>
    </main>
  </div>
</body>
</html>`;
}

// ─── Save helpers ──────────────────────────────────────────────────

async function saveFile(content: string, filename: string, mimeType: string): Promise<void> {
  const isTauri = "__TAURI_INTERNALS__" in window;
  if (isTauri) {
    try {
      const { save } = await import(/* @vite-ignore */ "@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import(/* @vite-ignore */ "@tauri-apps/plugin-fs");
      const path = await save({ defaultPath: filename, filters: [{ name: "HTML", extensions: ["html"] }] });
      if (path) { await writeTextFile(path, content); return; }
    } catch {}
  }
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export async function exportHTMLReport(d: ReportData): Promise<void> {
  const html     = buildHTMLReport(d);
  const filename = `${d.project.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-report-${new Date().toISOString().slice(0,10)}.html`;
  await saveFile(html, filename, "text/html");
}

// ─── Project JSON import/export ────────────────────────────────────

export async function exportProjectJSON(d: ReportData): Promise<void> {
  const payload = {
    exportVersion: 1,
    exportedAt:    new Date().toISOString(),
    project:   d.project,
    notes:     d.notes,
    tasks:     d.tasks,
    plan:      d.plan,
    decisions: d.decisions,
    standups:  d.standups,
  };
  const json     = JSON.stringify(payload, null, 2);
  const filename = `${d.project.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-export.json`;
  await saveFile(json, filename, "application/json");
}
