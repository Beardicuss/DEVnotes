import { useState, useMemo } from "react";
import { useAppStore, selActiveProject, selTasks, selNotes } from "@/stores/useAppStore";
import { isOverdue, shortDate } from "@/utils/date";
import { useGitStatus } from "@/hooks/useGitStatus";
import AiPanel from "@/components/ai/AiPanel";
import s from "./TabDashboard.module.css";

function todayStr() { return new Date().toISOString().slice(0, 10); }

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

/* ── Stat card ── */
function StatCard({ label, value, colour, alert, sub }: {
  label: string; value: number | string; colour: string; alert?: boolean; sub?: string;
}) {
  return (
    <div className={`${s.stat} ${alert ? s.statAlert : ""}`}>
      <div className={s.statValue} style={{ color: colour }}>{value}</div>
      <div className={s.statLabel}>{label}</div>
      {sub && <div className={s.statSub}>{sub}</div>}
    </div>
  );
}

/* ── 7-day burndown ── */
function BurndownChart({ tasks }: { tasks: any[] }) {
  const days   = getLast7Days();
  const counts = days.map(d =>
    tasks.filter(t => t.status === "done" && t.updatedAt?.slice(0, 10) === d).length
  );
  const max = Math.max(...counts, 1);
  const dow = (iso: string) => ["S","M","T","W","T","F","S"][new Date(iso).getDay()];

  return (
    <div className={s.burndown}>
      {days.map((d, i) => (
        <div key={d} className={s.burnCol}>
          <div className={s.burnBarWrap}>
            <div className={s.burnBar}
              style={{ height: `${Math.max(4, (counts[i] / max) * 100)}%`,
                background: counts[i] > 0 ? "var(--cyan)" : "var(--border)" }} />
          </div>
          <div className={s.burnLabel}>{dow(d)}</div>
          {counts[i] > 0 && <div className={s.burnCount}>{counts[i]}</div>}
        </div>
      ))}
    </div>
  );
}

/* ── Activity feed ── */
function ActivityFeed({ tasks, notes }: { tasks: any[]; notes: any[] }) {
  const items = useMemo(() => {
    const out: { ts: string; icon: string; text: string }[] = [];
    tasks.slice(0, 20).forEach(t => {
      if (t.status === "done")
        out.push({ ts: t.updatedAt, icon: "✅", text: `Completed: ${t.title}` });
      else if (t.status === "in-progress")
        out.push({ ts: t.updatedAt, icon: "🔄", text: `In progress: ${t.title}` });
    });
    notes.slice(0, 10).forEach(n =>
      out.push({ ts: n.updatedAt, icon: "📝", text: `Updated: ${n.title || "Untitled"}` })
    );
    return out.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 7);
  }, [tasks, notes]);

  if (!items.length) return <div className={s.empty}>No recent activity.</div>;
  return (
    <div className={s.feed}>
      {items.map((item, i) => (
        <div key={i} className={s.feedRow}>
          <span className={s.feedIcon}>{item.icon}</span>
          <span className={s.feedText}>{item.text}</span>
          <span className={s.feedTime}>{item.ts.slice(0, 10)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Upcoming deadlines ── */
function Upcoming({ tasks, onGo }: { tasks: any[]; onGo: () => void }) {
  const list = useMemo(() =>
    tasks
      .filter(t => t.dueDate && t.dueDate >= todayStr() && t.status !== "done" && t.status !== "archived")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6),
    [tasks]
  );
  if (!list.length) return <div className={s.empty}>No upcoming deadlines — nice!</div>;
  return (
    <div className={s.upcomingList}>
      {list.map(t => {
        const days   = Math.ceil((new Date(t.dueDate).getTime() - Date.now()) / 86400000);
        const urgent = days <= 2;
        return (
          <div key={t.id} className={`${s.upcomingRow} ${urgent ? s.upcomingUrgent : ""}`} onClick={onGo}>
            <span className={`chip chip-${t.priority}`}>{t.priority}</span>
            <span className={s.upcomingTitle}>{t.title}</span>
            <span className={s.upcomingDue} style={{ color: urgent ? "var(--red)" : "var(--yellow)" }}>
              {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Quick add ── */
function QuickAdd({ projectId }: { projectId: string }) {
  const [val,  setVal]  = useState("");
  const [mode, setMode] = useState<"task" | "note">("task");
  const addTask    = useAppStore(s => s.addTask);
  const addNote    = useAppStore(s => s.addNote);
  const updateNote = useAppStore(s => s.updateNote);

  const submit = () => {
    const v = val.trim(); if (!v) return;
    if (mode === "task") addTask({ projectId, title: v, priority: "medium", status: "todo" });
    else { const id = addNote(); updateNote(id, { title: v }); }
    setVal("");
  };

  return (
    <div className={s.quickAdd}>
      <div className={s.quickRow}>
        <input className={`input ${s.quickInput}`}
          placeholder={mode === "task" ? "New task…" : "New note title…"}
          value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} />
        <button className="btn btn-primary" onClick={submit} disabled={!val.trim()}>+ Add</button>
      </div>
      <div className={s.quickToggle}>
        {(["task", "note"] as const).map(m => (
          <button key={m}
            className={`${s.toggleBtn} ${mode === m ? s.toggleActive : ""}`}
            onClick={() => setMode(m)}>
            {m === "task" ? "✅ Task" : "📝 Note"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main Dashboard ── */
export default function TabDashboard() {
  const [aiOpen, setAiOpen] = useState(false);

  const project   = useAppStore(selActiveProject);
  const tasks     = useAppStore(selTasks);
  const notes     = useAppStore(selNotes);
  const git       = useGitStatus();
  const setTab    = useAppStore(s => s.setTab);
  const plans     = useAppStore(s => s.data.plans);
  const standups  = useAppStore(s => s.data.standups  ?? []);
  const decisions = useAppStore(s => s.data.decisions ?? []);
  const pomodoros = useAppStore(s => s.data.pomodoros ?? []);

  if (!project) return null;

  const plan           = plans.find(p => p.projectId === project.id);
  const total          = tasks.length;
  const done           = tasks.filter(t => t.status === "done").length;
  const inProg         = tasks.filter(t => t.status === "in-progress").length;
  const overdue        = tasks.filter(t => isOverdue(t.dueDate) && t.status !== "done").length;
  const dueToday       = tasks.filter(t => t.dueDate === todayStr() && t.status !== "done").length;
  const pct            = total ? Math.round(done / total * 100) : 0;
  const milestones     = plan?.milestones ?? [];
  const msDone         = milestones.filter(m => m.status === "done").length;
  const todayStandup   = standups.find(e => e.projectId === project.id && e.date === todayStr());
  const projDecisions  = decisions.filter(d => d.projectId === project.id);
  const todayPomos     = pomodoros.filter(p => p.projectId === project.id && p.startedAt.slice(0, 10) === todayStr() && p.completed);
  const totalFocusMins = todayPomos.reduce((a, p) => a + p.duration, 0);
  const circumference  = 2 * Math.PI * 26;

  return (
    <div className={s.root}>

      {/* ── Header ── */}
      <div className={s.header}>
        <span className={s.headerIcon}>{project.icon ?? "📁"}</span>
        <div className={s.headerMeta}>
          <h1 className={s.projName}>{project.name}</h1>
          <p className={s.projDesc}>{project.description || "No description yet."}</p>
          {project.techStack?.length > 0 && (
            <div className={s.tags}>
              {project.techStack.map(t => <span key={t} className="chip chip-tag">{t}</span>)}
            </div>
          )}
        </div>
        <div className={s.headerRight}>
          {project.deadline && (
            <div className={s.deadline}>
              <span className={s.deadlineLabel}>DEADLINE</span>
              <span className={s.deadlineDate}>{shortDate(project.deadline)}</span>
            </div>
          )}
          {/* SVG progress ring */}
          <div className={s.ring} title={`${pct}% complete`}>
            <svg viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="26" fill="none" stroke="var(--border)" strokeWidth="5" />
              <circle cx="30" cy="30" r="26" fill="none"
                stroke={pct === 100 ? "var(--green)" : "var(--cyan)"} strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - pct / 100)}
                strokeLinecap="round"
                style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className={s.ringInner}>
              <span className={s.ringPct}>{pct}<span style={{ fontSize: "0.5em" }}>%</span></span>
              <span className={s.ringKey}>done</span>
            </div>
          </div>
          {/* AI toggle */}
          <button className={`${s.aiBtn} ${aiOpen ? s.aiBtnActive : ""}`}
            onClick={() => setAiOpen(o => !o)} title="AI Assistant">
            ✦ AI
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className={s.statsRow}>
        <StatCard label="OPEN"       value={total - done}          colour="var(--cyan)"   sub={`${inProg} in progress`} />
        <StatCard label="DONE"       value={done}                  colour="var(--green)"  sub={`of ${total}`} />
        <StatCard label="OVERDUE"    value={overdue}               colour="var(--red)"    alert={overdue > 0} />
        <StatCard label="DUE TODAY"  value={dueToday}              colour="var(--yellow)" />
        <StatCard label="NOTES"      value={notes.length}          colour="var(--blue)" />
        <StatCard label="DECISIONS"  value={projDecisions.length}  colour="#9900bb" />
        {milestones.length > 0 && (
          <StatCard label="MILESTONES" value={`${msDone}/${milestones.length}`} colour="var(--cyan)" />
        )}
      </div>

      {/* ── Content + optional AI drawer ── */}
      <div className={s.contentRow}>
        <div className={s.grid}>

          {/* Left col */}
          <div className={s.col}>
            <div className={s.card}>
              <div className={s.cardTitle}>⚡ QUICK ADD</div>
              <QuickAdd projectId={project.id} />
            </div>

            <div className={s.card}>
              <div className={s.cardHeader}>
                <span className={s.cardTitle}>📅 UPCOMING DEADLINES</span>
                <button className={s.cardLink} onClick={() => setTab("tasks")}>all →</button>
              </div>
              <Upcoming tasks={tasks} onGo={() => setTab("tasks")} />
            </div>

            {overdue > 0 && (
              <div className={`${s.card} ${s.cardDanger}`}>
                <div className={s.cardHeader}>
                  <span className={s.cardTitle} style={{ color: "var(--red)" }}>⚠ OVERDUE ({overdue})</span>
                  <button className={s.cardLink} onClick={() => setTab("tasks")}>view →</button>
                </div>
                {tasks.filter(t => isOverdue(t.dueDate) && t.status !== "done").slice(0, 4).map(t => (
                  <div key={t.id} className={s.overdueRow} onClick={() => setTab("tasks")}>
                    <span className={`chip chip-${t.priority}`}>{t.priority}</span>
                    <span className={s.overdueTitle}>{t.title}</span>
                    <span className={s.overdueDate}>{shortDate(t.dueDate!)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={s.card}>
              <div className={s.cardTitle}>🍅 FOCUS — TODAY</div>
              <div className={s.pomoRow}>
                <div className={s.pomoStat}><span className={s.pomoVal}>{todayPomos.length}</span><span className={s.pomoKey}>sessions</span></div>
                <div className={s.pomoStat}><span className={s.pomoVal}>{totalFocusMins}m</span><span className={s.pomoKey}>focused</span></div>
                <div className={s.pomoStat}><span className={s.pomoVal}>{pomodoros.filter(p => p.projectId === project.id && p.completed).length}</span><span className={s.pomoKey}>all-time</span></div>
              </div>
            </div>

            {git && (
              <div className={s.card}>
                <div className={s.cardTitle}>⎇ GIT</div>
                <div className={s.gitRow}>
                  <span className={s.gitBranch}>⎇ {git.branch}</span>
                  {git.dirty
                    ? <span style={{ color: "var(--yellow)" }}>● uncommitted</span>
                    : <span style={{ color: "var(--green)" }}>✓ clean</span>}
                </div>
                {git.lastCommit && <div className={s.gitCommit}>↳ {git.lastCommit.slice(0, 68)}</div>}
              </div>
            )}
          </div>

          {/* Right col */}
          <div className={s.col}>
            <div className={s.card}>
              <div className={s.cardTitle}>📊 COMPLETIONS — LAST 7 DAYS</div>
              <BurndownChart tasks={tasks} />
            </div>

            <div className={s.card}>
              <div className={s.cardTitle}>🕐 RECENT ACTIVITY</div>
              <ActivityFeed tasks={tasks} notes={notes} />
            </div>

            <div className={s.card}>
              <div className={s.cardHeader}>
                <span className={s.cardTitle}>🗓 TODAY'S STANDUP</span>
                <button className={s.cardLink} onClick={() => setTab("standup")}>
                  {todayStandup ? "view →" : "fill in →"}
                </button>
              </div>
              {todayStandup ? (
                <div className={s.standupPreview}>
                  {todayStandup.today && <p><strong>Today:</strong> {todayStandup.today.slice(0, 120)}</p>}
                  {todayStandup.blockers && <p className={s.standupBlocker}><strong>Blockers:</strong> {todayStandup.blockers.slice(0, 80)}</p>}
                  {!todayStandup.today && !todayStandup.blockers && <p className={s.empty}>Standup saved but empty.</p>}
                </div>
              ) : (
                <div className={s.standupMissing}>
                  Not filled in yet.
                  <button className="btn" style={{ marginLeft: "0.75em", fontSize: "var(--fs-xxs)" }}
                    onClick={() => setTab("standup")}>Go →</button>
                </div>
              )}
            </div>

            {notes.length > 0 && (
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>📝 RECENT NOTES</span>
                  <button className={s.cardLink} onClick={() => setTab("notes")}>all →</button>
                </div>
                {notes.slice(0, 4).map(n => (
                  <div key={n.id} className={s.noteRow} onClick={() => setTab("notes")}>
                    <span className={s.noteTitle}>{n.title || "Untitled"}</span>
                    <span className={s.noteDate}>{n.updatedAt.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI side drawer */}
        {aiOpen && (
          <div className={s.aiDrawer}>
            <AiPanel />
          </div>
        )}
      </div>
    </div>
  );
}
