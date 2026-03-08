import { useState, useMemo } from "react";
import { useAppStore, selActiveProject } from "@/stores/useAppStore";
import type { Decision, DecisionStatus } from "@/types";
import ExportDialog from "@/components/export/ExportDialog";
import s from "./TabDecisions.module.css";

const STATUS_LABELS: Record<DecisionStatus, string> = {
  proposed:  "Proposed",
  accepted:  "Accepted",
  rejected:  "Rejected",
  deferred:  "Deferred",
};
const STATUS_COLOURS: Record<DecisionStatus, string> = {
  proposed: "var(--yellow)",
  accepted: "var(--green)",
  rejected: "var(--red)",
  deferred: "var(--text-dim)",
};

export default function TabDecisions() {
  const project       = useAppStore(selActiveProject);
  const decisions     = useAppStore((s) => s.data.decisions ?? []);
  const tasks         = useAppStore((s) => s.data.tasks);
  const addDecision   = useAppStore((s) => s.addDecision);
  const updateDecision = useAppStore((s) => s.updateDecision);
  const deleteDecision = useAppStore((s) => s.deleteDecision);

  const [editId,   setEditId]   = useState<string | null>(null);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<DecisionStatus | "all">("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [exportOpen, setExportOpen] = useState(false);
  if (!project) return null;

  const projectDecisions = useMemo(() =>
    decisions
      .filter((d) => d.projectId === project.id)
      .filter((d) => filter === "all" || d.status === filter)
      .filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.context.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [decisions, project.id, filter, search]
  );

  const editingDecision = decisions.find((d) => d.id === editId);
  const projectTasks = tasks.filter((t) => t.projectId === project.id && t.status !== "done");

  const handleAdd = () => {
    const id = addDecision({ projectId: project.id });
    setEditId(id);
  };

  const upd = (patch: Partial<Decision>) => {
    if (editId) updateDecision(editId, patch);
  };

  return (
    <div className={s.root}>
      {/* Toolbar */}
      <div className={s.toolbar}>
        <button className="btn" onClick={() => setExportOpen(true)} title="Export">⬇ Export</button>
        <button className="btn btn-primary" onClick={handleAdd}>+ New Decision</button>
        <input className={`input ${s.search}`} placeholder="Search decisions…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className={s.filterBtns}>
          {(["all", "proposed", "accepted", "rejected", "deferred"] as const).map((f) => (
            <button key={f}
              className={`${s.filterBtn} ${filter === f ? s.filterActive : ""}`}
              style={filter === f && f !== "all" ? { borderBottomColor: STATUS_COLOURS[f as DecisionStatus], color: STATUS_COLOURS[f as DecisionStatus] } : {}}
              onClick={() => setFilter(f)}>
              {f === "all" ? "All" : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        <span className={s.count}>{projectDecisions.length} decisions</span>
      </div>

      <div className={s.body}>
        {/* List */}
        <div className={s.list}>
          {!projectDecisions.length && (
            <div className={s.empty}>
              <div className={s.emptyIcon}>🤔</div>
              <div>No decisions recorded yet.</div>
              <div className={s.emptyHint}>Document architectural choices, tech stack decisions, and trade-offs.</div>
              <button className="btn btn-primary" onClick={handleAdd}>+ Record First Decision</button>
            </div>
          )}
          {projectDecisions.map((d) => (
            <div key={d.id}
              className={`${s.card} ${editId === d.id ? s.cardActive : ""}`}
              onClick={() => setEditId(d.id)}>
              <div className={s.cardHeader}>
                <span className={s.cardTitle}>{d.title || "Untitled Decision"}</span>
                <span className={s.cardStatus} style={{ color: STATUS_COLOURS[d.status] }}>
                  ● {STATUS_LABELS[d.status]}
                </span>
              </div>
              <div className={s.cardMeta}>
                {d.decisionDate && <span className={s.cardDate}>📅 {d.decisionDate}</span>}
                {d.decidedBy && <span className={s.cardBy}>by {d.decidedBy}</span>}
                {d.tags.length > 0 && d.tags.map((t) => (
                  <span key={t} className={s.tag}>{t}</span>
                ))}
              </div>
              {d.context && (
                <p className={s.cardContext}>{d.context.slice(0, 120)}{d.context.length > 120 ? "…" : ""}</p>
              )}
              <div className={s.cardFooter}>
                <button className={s.delBtn}
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(d.id); }}>
                  ✕ Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Editor panel */}
        {editId && editingDecision && (
          <div className={s.editor}>
            <div className={s.editorHeader}>
              <span className={s.editorTitle}>DECISION RECORD</span>
              <button className="btn-icon" onClick={() => setEditId(null)}>✕</button>
            </div>

            <div className={s.fields}>
              <Field label="Title">
                <input className="input" value={editingDecision.title}
                  onChange={(e) => upd({ title: e.target.value })} autoFocus
                  placeholder="What was decided?" />
              </Field>

              <div className={s.row2}>
                <Field label="Status">
                  <select className="input" value={editingDecision.status}
                    onChange={(e) => upd({ status: e.target.value as DecisionStatus })}>
                    {(Object.entries(STATUS_LABELS) as [DecisionStatus, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Decision Date">
                  <input className="input" type="date" value={editingDecision.decisionDate ?? ""}
                    onChange={(e) => upd({ decisionDate: e.target.value || null })} />
                </Field>
              </div>

              <Field label="Decided By">
                <input className="input" value={editingDecision.decidedBy}
                  onChange={(e) => upd({ decidedBy: e.target.value })}
                  placeholder="Name or team" />
              </Field>

              <Field label="Context — What problem are we solving?">
                <textarea className="input" rows={3}
                  value={editingDecision.context}
                  onChange={(e) => upd({ context: e.target.value })}
                  placeholder="Describe the situation, constraints, and requirements…" />
              </Field>

              <Field label="Options Considered">
                <textarea className="input" rows={3}
                  value={editingDecision.options}
                  onChange={(e) => upd({ options: e.target.value })}
                  placeholder="Option A: …&#10;Option B: …&#10;Option C: …" />
              </Field>

              <Field label="Decision & Rationale">
                <textarea className="input" rows={4}
                  value={editingDecision.outcome}
                  onChange={(e) => upd({ outcome: e.target.value })}
                  placeholder="We chose Option X because…&#10;Trade-offs accepted: …&#10;Consequences: …" />
              </Field>

              <Field label="Tags (comma separated)">
                <input className="input"
                  value={editingDecision.tags.join(", ")}
                  onChange={(e) => upd({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  placeholder="architecture, performance, security…" />
              </Field>

              <Field label="Linked Task">
                <select className="input" value={editingDecision.linkedTaskId ?? ""}
                  onChange={(e) => upd({ linkedTaskId: e.target.value || null })}>
                  <option value="">— None —</option>
                  {projectTasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className={s.confirmOverlay} onClick={() => setConfirmDelete(null)}>
          <div className={s.confirmBox} onClick={(e) => e.stopPropagation()}>
            <p>Delete this decision? This cannot be undone.</p>
            <div style={{ display: "flex", gap: "0.75em", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => {
                deleteDecision(confirmDelete);
                if (editId === confirmDelete) setEditId(null);
                setConfirmDelete(null);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {exportOpen && <ExportDialog target="decisions" onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.field}>
      <label className={s.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}
