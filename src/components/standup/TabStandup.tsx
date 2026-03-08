import { useState, useMemo } from "react";
import { useAppStore, selActiveProject, selTasks } from "@/stores/useAppStore";
import type { StandupEntry } from "@/types";
import ExportDialog from "@/components/export/ExportDialog";
import s from "./TabStandup.module.css";

const MOOD_LABELS = ["", "😫 Rough", "😕 Meh", "😐 OK", "😊 Good", "🔥 Excellent"];
const MOOD_COLOURS = ["", "var(--red)", "var(--orange,#ff8800)", "var(--yellow)", "var(--green)", "var(--cyan)"];

function today(): string { return new Date().toISOString().slice(0, 10); }

export default function TabStandup() {
  const project    = useAppStore(selActiveProject);
  const tasks      = useAppStore(selTasks);
  const standups   = useAppStore((s) => s.data.standups ?? []);
  const addStandup    = useAppStore((s) => s.addStandup);
  const updateStandup = useAppStore((s) => s.updateStandup);

  const [view, setView] = useState<"today" | "history">("today");
  const [copyMsg, setCopyMsg] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  if (!project) return null;

  const projectStandups = useMemo(() =>
    standups
      .filter((e) => e.projectId === project.id)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [standups, project.id]
  );

  const todayEntry = projectStandups.find((e) => e.date === today());

  // Ensure today's entry exists
  const ensureToday = (): string => {
    if (todayEntry) return todayEntry.id;
    return addStandup({
      projectId: project.id,
      date: today(),
      yesterday: "",
      today: "",
      blockers: "",
      mood: 3,
    });
  };

  const upd = (patch: Partial<StandupEntry>) => {
    if (todayEntry) updateStandup(todayEntry.id, patch);
    else {
      const id = ensureToday();
      updateStandup(id, patch);
    }
  };

  const pendingTasks = tasks.filter(
    (t) => t.projectId === project.id && t.status === "in-progress"
  );
  const overdueTasks = tasks.filter(
    (t) => t.projectId === project.id && t.dueDate && t.dueDate < today() && t.status !== "done" && t.status !== "archived"
  );

  // Copy to clipboard as formatted text
  const handleCopy = () => {
    if (!todayEntry) return;
    const text = [
      `🗓 Daily Standup — ${todayEntry.date} — ${project.name}`,
      "",
      `✅ Yesterday:\n${todayEntry.yesterday || "—"}`,
      "",
      `📋 Today:\n${todayEntry.today || "—"}`,
      "",
      `🚧 Blockers:\n${todayEntry.blockers || "None"}`,
      "",
      `Mood: ${MOOD_LABELS[todayEntry.mood]}`,
    ].join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
    setCopyMsg(true);
    setTimeout(() => setCopyMsg(false), 2000);
  };

  const entry = todayEntry ?? { yesterday: "", today: "", blockers: "", mood: 3 as const };

  return (
    <div className={s.root}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.tabs}>
          <button className={`${s.tab} ${view==="today"   ? s.tabActive : ""}`} onClick={() => setView("today")}>Today</button>
          <button className={`${s.tab} ${view==="history" ? s.tabActive : ""}`} onClick={() => setView("history")}>
            History ({projectStandups.length})
          </button>
        </div>
        {view === "today" && (
          <div style={{ display: "flex", gap: "0.75em", alignItems: "center" }}>
            <span className={s.dateLabel}>📅 {today()}</span>
            <button className="btn" onClick={handleCopy} disabled={!todayEntry}>
              {copyMsg ? "✓ Copied!" : "⎘ Copy"}
            </button>
            <button className="btn" onClick={() => setExportOpen(true)} title="Export standup history">⬇ Export</button>
          </div>
        )}
      </div>

      {view === "today" && (
        <div className={s.todayForm}>
          {/* Context cards */}
          {(pendingTasks.length > 0 || overdueTasks.length > 0) && (
            <div className={s.contextCards}>
              {pendingTasks.length > 0 && (
                <div className={s.contextCard} style={{ borderLeftColor: "var(--yellow)" }}>
                  <span className={s.contextLabel}>IN PROGRESS</span>
                  <ul className={s.contextList}>
                    {pendingTasks.slice(0, 4).map((t) => <li key={t.id}>{t.title}</li>)}
                    {pendingTasks.length > 4 && <li>+{pendingTasks.length - 4} more</li>}
                  </ul>
                </div>
              )}
              {overdueTasks.length > 0 && (
                <div className={s.contextCard} style={{ borderLeftColor: "var(--red)" }}>
                  <span className={s.contextLabel} style={{ color: "var(--red)" }}>OVERDUE</span>
                  <ul className={s.contextList}>
                    {overdueTasks.slice(0, 3).map((t) => <li key={t.id} style={{ color: "var(--red)" }}>{t.title}</li>)}
                    {overdueTasks.length > 3 && <li>+{overdueTasks.length - 3} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Form fields */}
          <div className={s.field}>
            <label className={s.fieldLabel}>
              ✅ What did you accomplish yesterday?
            </label>
            <textarea className="input" rows={4}
              placeholder="— completed X&#10;— reviewed Y&#10;— merged PR #42"
              value={entry.yesterday}
              onChange={(e) => upd({ yesterday: e.target.value })}
              onFocus={ensureToday} />
          </div>

          <div className={s.field}>
            <label className={s.fieldLabel}>
              📋 What are you working on today?
            </label>
            <textarea className="input" rows={4}
              placeholder="— start implementing Z&#10;— write tests for X&#10;— review team's PRs"
              value={entry.today}
              onChange={(e) => upd({ today: e.target.value })}
              onFocus={ensureToday} />
          </div>

          <div className={s.field}>
            <label className={s.fieldLabel}>
              🚧 Any blockers or dependencies?
            </label>
            <textarea className="input" rows={2}
              placeholder="None — or describe what's blocking you"
              value={entry.blockers}
              onChange={(e) => upd({ blockers: e.target.value })}
              onFocus={ensureToday} />
          </div>

          {/* Mood selector */}
          <div className={s.field}>
            <label className={s.fieldLabel}>How are you feeling today?</label>
            <div className={s.moodRow}>
              {[1,2,3,4,5].map((m) => (
                <button key={m}
                  className={`${s.moodBtn} ${entry.mood === m ? s.moodActive : ""}`}
                  style={entry.mood === m ? { borderColor: MOOD_COLOURS[m], color: MOOD_COLOURS[m] } : {}}
                  onClick={() => upd({ mood: m as StandupEntry["mood"] })}
                  onMouseDown={ensureToday}>
                  <span className={s.moodEmoji}>{MOOD_LABELS[m].split(" ")[0]}</span>
                  <span className={s.moodText}>{MOOD_LABELS[m].split(" ").slice(1).join(" ")}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === "history" && (
        <div className={s.history}>
          {!projectStandups.length && (
            <div className={s.empty}>No standup entries yet. Fill in today's standup to get started.</div>
          )}
          {projectStandups.map((entry) => (
            <div key={entry.id} className={s.historyCard}>
              <div className={s.historyHeader}>
                <span className={s.historyDate}>{entry.date}</span>
                <span className={s.historyMood} style={{ color: MOOD_COLOURS[entry.mood] }}>
                  {MOOD_LABELS[entry.mood]}
                </span>
              </div>
              <div className={s.historySection}>
                <span className={s.historySectionLabel}>Yesterday</span>
                <p>{entry.yesterday || "—"}</p>
              </div>
              <div className={s.historySection}>
                <span className={s.historySectionLabel}>Today</span>
                <p>{entry.today || "—"}</p>
              </div>
              {entry.blockers && (
                <div className={s.historySection}>
                  <span className={s.historySectionLabel} style={{ color: "var(--red)" }}>Blockers</span>
                  <p style={{ color: "var(--red)" }}>{entry.blockers}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {exportOpen && <ExportDialog target="standups" onClose={() => setExportOpen(false)} />}
    </div>
  );
}
