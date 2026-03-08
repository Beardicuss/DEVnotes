import { useState } from "react";
import { useAppStore, selActiveProject } from "@/stores/useAppStore";
import {
  exportNote, exportAllNotes, exportTasks,
  exportDecisions, exportStandups, exportProject,
} from "@/integrations/export/exportEngine";
import type { Note } from "@/types";
import s from "./ExportDialog.module.css";

export type ExportTarget =
  | "note"
  | "all-notes"
  | "tasks"
  | "plan"
  | "decisions"
  | "standups"
  | "project";

type Format = "md" | "txt" | "pdf";

interface Props {
  target:  ExportTarget;
  note?:   Note;          // required when target === "note"
  onClose: () => void;
}

const TARGET_LABELS: Record<ExportTarget, string> = {
  "note":       "Export Note",
  "all-notes":  "Export All Notes",
  "tasks":      "Export Tasks",
  "plan":       "Export Plan",
  "decisions":  "Export Decision Log",
  "standups":   "Export Standup History",
  "project":    "Export Entire Project",
};

const FORMAT_INFO: Record<Format, { icon: string; label: string; desc: string }> = {
  md:  { icon: "M↓", label: "Markdown",   desc: ".md — preserves formatting, headers, checklists" },
  txt: { icon: "TXT", label: "Plain Text", desc: ".txt — stripped, universal, paste anywhere" },
  pdf: { icon: "PDF", label: "PDF",        desc: ".pdf — print dialog → Save as PDF" },
};

export default function ExportDialog({ target, note, onClose }: Props) {
  const project   = useAppStore(selActiveProject);
  const notes     = useAppStore((s) => s.data.notes ?? []);
  const tasks     = useAppStore((s) => s.data.tasks ?? []);
  const plans     = useAppStore((s) => s.data.plans ?? []);
  const decisions = useAppStore((s) => s.data.decisions ?? []);
  const standups  = useAppStore((s) => s.data.standups ?? []);

  const [format,   setFormat]   = useState<Format>("md");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  if (!project) return null;

  const projNotes     = notes.filter((n) => n.projectId === project.id && !n.archived);
  const projTasks     = tasks.filter((t) => t.projectId === project.id);
  const projPlan      = plans.find((p) => p.projectId === project.id);
  const projDecisions = decisions.filter((d) => d.projectId === project.id);
  const projStandups  = standups.filter((e) => e.projectId === project.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const counts: Record<ExportTarget, string> = {
    "note":      note ? `"${note.title.slice(0, 32)}"` : "",
    "all-notes": `${projNotes.length} notes`,
    "tasks":     `${projTasks.length} tasks`,
    "plan":      projPlan ? "1 plan" : "no plan",
    "decisions": `${projDecisions.length} decisions`,
    "standups":  `${projStandups.length} entries`,
    "project":   `${projNotes.length} notes, ${projTasks.length} tasks, ${projDecisions.length} decisions`,
  };

  const handleExport = async () => {
    setLoading(true); setError(null);
    try {
      switch (target) {
        case "note":
          if (note) await exportNote(note, format);
          break;
        case "all-notes":
          await exportAllNotes(projNotes, project.name, format);
          break;
        case "tasks":
          await exportTasks(projTasks, project.name, format);
          break;
        case "plan":
          if (projPlan) await exportProject(project, [], [], projPlan, [], format);
          break;
        case "decisions":
          await exportDecisions(projDecisions, project.name, format);
          break;
        case "standups":
          await exportStandups(projStandups, project.name, format);
          break;
        case "project":
          await exportProject(project, projNotes, projTasks, projPlan, projDecisions, format);
          break;
      }
      setDone(true);
      if (format !== "pdf") setTimeout(onClose, 1200);
    } catch (e: any) {
      setError(e?.message ?? "Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={s.header}>
          <span className={s.title}>{TARGET_LABELS[target]}</span>
          <button className={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* What will be exported */}
        <div className={s.summary}>
          <span className={s.summaryIcon}>📦</span>
          <span className={s.summaryText}>
            <strong>{project.name}</strong> — {counts[target]}
          </span>
        </div>

        {/* Format selector */}
        <div className={s.formats}>
          {(["md", "txt", "pdf"] as Format[]).map((f) => {
            const info = FORMAT_INFO[f];
            return (
              <button key={f}
                className={`${s.fmtCard} ${format === f ? s.fmtActive : ""}`}
                onClick={() => setFormat(f)}>
                <span className={s.fmtIcon}>{info.icon}</span>
                <span className={s.fmtLabel}>{info.label}</span>
                <span className={s.fmtDesc}>{info.desc}</span>
              </button>
            );
          })}
        </div>

        {format === "pdf" && (
          <div className={s.pdfNote}>
            💡 A print dialog will open. Choose <strong>Save as PDF</strong> as the printer.
          </div>
        )}

        {error && <div className={s.error}>⚠ {error}</div>}

        {/* Actions */}
        <div className={s.actions}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={loading || done || (target === "plan" && !projPlan)}>
            {done
              ? "✓ Exported!"
              : loading
              ? "Exporting…"
              : `Export as ${FORMAT_INFO[format].label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
