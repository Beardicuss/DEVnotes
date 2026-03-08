// ─────────────────────────────────────────────
// src/components/plan/TabPlan.tsx
// ─────────────────────────────────────────────
import { useState } from "react";
import { useAppStore, selActiveProject, selPlan } from "@/stores/useAppStore";
import { uid } from "@/utils/id";
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
                <select
                  className={s.msStatusSelect}
                  value={m.status}
                  onChange={(e) => update(project.id, {
                    milestones: plan.milestones.map((x) =>
                      x.id === m.id ? { ...x, status: e.target.value as typeof m.status } : x
                    )
                  })}>
                  <option value="todo">todo</option>
                  <option value="in-progress">in-progress</option>
                  <option value="done">done</option>
                </select>
                <span className={s.msTitle}>{m.title}</span>
                {m.date && <span className={s.msDate}>{m.date}</span>}
                <button
                  className={s.msDelete}
                  title="Delete milestone"
                  onClick={() => update(project.id, {
                    milestones: plan.milestones.filter((x) => x.id !== m.id)
                  })}>✕</button>
              </div>
            ))
        }
        <MilestoneAdder onAdd={(title) => update(project.id, {
          milestones: [...plan.milestones, {
            id: uid(), title, date: null, status: "todo", calendarEventId: null
          }]
        })} />
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

function MilestoneAdder({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal]   = useState("");
  if (!open) return (
    <button className="btn" style={{marginTop:12,width:"100%"}} onClick={() => setOpen(true)}>
      + ADD MILESTONE
    </button>
  );
  return (
    <div style={{marginTop:12,display:"flex",gap:"4px"}}>
      <input
        className="input" style={{flex:1,fontSize:"var(--fs-xs)"}}
        placeholder="Milestone title…" value={val} autoFocus
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); setOpen(false); }
          if (e.key === "Escape") { setVal(""); setOpen(false); }
        }}
      />
      <button className="btn btn-primary"
        onClick={() => { if(val.trim()){ onAdd(val.trim()); setVal(""); setOpen(false); } }}>✓</button>
      <button className="btn" onClick={() => { setVal(""); setOpen(false); }}>✕</button>
    </div>
  );
}
