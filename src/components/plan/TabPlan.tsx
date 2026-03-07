// ─────────────────────────────────────────────
// src/components/plan/TabPlan.tsx
// ─────────────────────────────────────────────
import { useAppStore, selActiveProject, selPlan } from "@/stores/useAppStore";
import s from "./TabPlan.module.css";

export function TabPlan() {
  const project = useAppStore(selActiveProject);
  const plan    = useAppStore(selPlan(project?.id ?? null));
  const update  = useAppStore((st) => st.updatePlan);

  if (!project || !plan) return null;

  return (
    <div className={s.root}>
      <div className={s.sidebar}>
        <div className={s.sidebarTitle}>MILESTONES</div>
        {plan.milestones.length === 0
          ? <p className={s.empty}>No milestones yet.</p>
          : plan.milestones.map((m) => (
              <div key={m.id} className={`${s.milestone} ${s["ms-"+m.status]}`}>
                <span className={s.msStatus}>{m.status}</span>
                <span className={s.msTitle}>{m.title}</span>
                {m.date && <span className={s.msDate}>{m.date}</span>}
              </div>
            ))
        }
        <button className="btn" style={{marginTop:12}} onClick={() => {
          const title = prompt("Milestone title:");
          if (title) update(project.id, {
            milestones: [...plan.milestones, {
              id: `ms-${Date.now()}`, title, date: null, status: "todo", calendarEventId: null
            }]
          });
        }}>+ ADD MILESTONE</button>
      </div>
      <div className={s.editor}>
        <textarea
          className={s.textarea}
          value={plan.body}
          onChange={(e) => update(project.id, { body: e.target.value })}
          placeholder={"# Project Plan\n\n## Goals\n\n## Tech Stack\n\n## Milestones\n"}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
