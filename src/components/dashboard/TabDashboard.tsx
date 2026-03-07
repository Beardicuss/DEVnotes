// src/components/dashboard/TabDashboard.tsx
import { useTranslation } from "react-i18next";
import { useAppStore, selActiveProject, selTasks, selNotes } from "@/stores/useAppStore";
import { isOverdue, shortDate } from "@/utils/date";
import { useGitStatus } from "@/hooks/useGitStatus";
import s from "./TabDashboard.module.css";

export default function TabDashboard() {
  const { t }    = useTranslation();
  const project  = useAppStore(selActiveProject);
  const tasks    = useAppStore(selTasks);
  const notes    = useAppStore(selNotes);
  const git      = useGitStatus();
  const setTab   = useAppStore((st) => st.setTab);

  if (!project) return null;

  const totalTasks   = tasks.length;
  const doneTasks    = tasks.filter((t) => t.status === "done").length;
  const overdueTasks = tasks.filter((t) => isOverdue(t.dueDate) && t.status !== "done").length;
  const dueToday     = tasks.filter((t) => t.dueDate === new Date().toISOString().slice(0,10) && t.status !== "done").length;

  return (
    <div className={s.root}>
      {/* Project header */}
      <div className={s.projHeader}>
        <span className={s.icon}>{project.icon}</span>
        <div>
          <h1 className={s.projName}>{project.name}</h1>
          <p className={s.projDesc}>{project.description || "No description yet."}</p>
        </div>
        {project.deadline && (
          <div className={s.deadline}>
            <span className={s.deadlineLabel}>DEADLINE</span>
            <span className={s.deadlineDate}>{shortDate(project.deadline)}</span>
          </div>
        )}
      </div>

      {/* Health stats */}
      <div className={s.statsRow}>
        <StatCard label="TASKS OPEN"     value={totalTasks - doneTasks} colour="var(--cyan)"    />
        <StatCard label="DONE"           value={doneTasks}              colour="var(--green)"   />
        <StatCard label="OVERDUE"        value={overdueTasks}           colour="var(--red)"     alert={overdueTasks > 0} />
        <StatCard label="DUE TODAY"      value={dueToday}               colour="var(--yellow)"  />
        <StatCard label="NOTES"          value={notes.length}           colour="var(--blue)"    />
      </div>

      {/* Tech stack */}
      {project.techStack.length > 0 && (
        <div className={s.section}>
          <div className={s.sectionTitle}>TECH STACK</div>
          <div className={s.tags}>
            {project.techStack.map((t) => (
              <span key={t} className="chip chip-tag">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Git status */}
      {git && (
        <div className={s.section}>
          <div className={s.sectionTitle}>GIT STATUS</div>
          <div className={s.gitRow}>
            <span className={s.gitBranch}>⎇ {git.branch}</span>
            {git.dirty
              ? <span style={{color:"var(--yellow)"}}>● uncommitted changes</span>
              : <span style={{color:"var(--green)"}}>✓ clean</span>
            }
            <span className={s.gitCommit} title={git.lastCommit}>↳ {git.lastCommit.slice(0,60)}</span>
          </div>
        </div>
      )}

      {/* Overdue tasks */}
      {overdueTasks > 0 && (
        <div className={s.section}>
          <div className={s.sectionTitle} style={{color:"var(--red)"}}>⚠ OVERDUE TASKS</div>
          {tasks.filter((t) => isOverdue(t.dueDate) && t.status !== "done").map((t) => (
            <div key={t.id} className={`${s.taskRow} task-overdue`} onClick={() => setTab("tasks")}>
              <span className={`chip chip-${t.priority}`}>{t.priority}</span>
              <span className={s.taskTitle}>{t.title}</span>
              <span style={{color:"var(--red)",fontSize:"var(--fs-xs)"}}>{shortDate(t.dueDate!)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent notes */}
      {notes.length > 0 && (
        <div className={s.section}>
          <div className={s.sectionTitle}>RECENT NOTES</div>
          {notes.slice(0,3).map((n) => (
            <div key={n.id} className={s.noteRow} onClick={() => setTab("notes")}>
              <span className={s.noteTitle}>{n.title}</span>
              {n.tags.map((tag) => <span key={tag} className="chip chip-tag" style={{fontSize:"9px"}}>{tag}</span>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, colour, alert }: { label: string; value: number; colour: string; alert?: boolean }) {
  return (
    <div className={`${s.stat} ${alert ? s.statAlert : ""}`}>
      <div className={s.statValue} style={{ color: colour }}>{value}</div>
      <div className={s.statLabel}>{label}</div>
    </div>
  );
}
