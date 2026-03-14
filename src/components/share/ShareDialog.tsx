import { useState } from "react";
import { useAppStore, selActiveProject } from "@/stores/useAppStore";
import { uid } from "@/utils/id";
import { exportHTMLReport, exportProjectJSON } from "@/integrations/export/htmlReport";
import s from "./ShareDialog.module.css";

export default function ShareDialog({ onClose }: { onClose: () => void }) {
  const project   = useAppStore(selActiveProject);
  const notes     = useAppStore((s) => s.data.notes);
  const tasks     = useAppStore((s) => s.data.tasks);
  const plans     = useAppStore((s) => s.data.plans);
  const decisions = useAppStore((s) => s.data.decisions ?? []);
  const standups  = useAppStore((s) => s.data.standups ?? []);
  const pomodoros = useAppStore((s) => s.data.pomodoros ?? []);
  const addProject   = useAppStore((s) => s.addProject);
  const importNotes  = useAppStore((s) => s.importNotes);
  const addTask      = useAppStore((s) => s.addTask);

  const [loading,  setLoading]  = useState<string | null>(null);
  const [done,     setDone]     = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [dragOver, setDragOver]  = useState(false);

  if (!project) return null;

  const projNotes     = notes.filter((n) => n.projectId === project.id);
  const projTasks     = tasks.filter((t) => t.projectId === project.id);
  const projPlan      = plans.find((p) => p.projectId === project.id);
  const projDecisions = decisions.filter((d) => d.projectId === project.id);
  const projStandups  = standups.filter((e) => e.projectId === project.id);
  const projPomodoros = pomodoros.filter((p) => p.projectId === project.id);

  const reportData = {
    project, notes: projNotes, tasks: projTasks, plan: projPlan,
    decisions: projDecisions, standups: projStandups, pomodoros: projPomodoros,
    generatedAt: new Date().toLocaleString(),
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setLoading(key); setError(null); setDone(null);
    try { await fn(); setDone(key); setTimeout(() => setDone(null), 2500); }
    catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setLoading(null); }
  };

  // ── Import ──────────────────────────────────────────────────────
  const handleImport = (json: string) => {
    setImportMsg(null);
    try {
      const data = JSON.parse(json);
      if (!data.exportVersion || !data.project) throw new Error("Not a valid DevNotes project export.");

      // Create new project (with suffix to avoid collision)
      const newId = addProject({ ...data.project, id: undefined, name: data.project.name + " (imported)" });

      // Import notes as a batch — no flash, no selectedNoteId side-effect
      const importedNotes = (data.notes ?? []).map((n: any) => ({
        ...n,
        id: uid(),
        projectId: newId,
        createdAt: n.createdAt ?? new Date().toISOString(),
        updatedAt: n.updatedAt ?? new Date().toISOString(),
      }));
      if (importedNotes.length) importNotes(importedNotes);
      // Import tasks — pass projectId explicitly, don't rely on store's activeProjectId
      for (const t of data.tasks ?? []) {
        addTask({ ...t, id: undefined, projectId: newId });
      }
      // Import decisions — pass projectId explicitly after partial so it can't be overridden
      const store = useAppStore.getState();
      for (const d of data.decisions ?? []) {
        // Bypass store action's activeProjectId lookup by calling updateDecision after addDecision
        const decId = store.addDecision({ projectId: newId });
        store.updateDecision(decId, { ...d, id: decId, projectId: newId });
      }

      setImportMsg(`✓ Imported "${data.project.name}" — ${data.notes?.length ?? 0} notes, ${data.tasks?.length ?? 0} tasks`);
    } catch (e: any) {
      setImportMsg(`✗ ${e.message}`);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleImport(ev.target?.result as string);
    reader.readAsText(file);
  };

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.header}>
          <span className={s.title}>SHARE & COLLABORATE</span>
          <button className={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={s.body}>
          {/* Project info */}
          <div className={s.projectInfo}>
            <span className={s.projectIcon}>{project.icon ?? "📁"}</span>
            <div>
              <div className={s.projectName}>{project.name}</div>
              <div className={s.projectStats}>
                {projNotes.length} notes · {projTasks.length} tasks · {projDecisions.length} decisions
              </div>
            </div>
          </div>

          {/* Export section */}
          <div className={s.section}>
            <div className={s.sectionTitle}>Export Project</div>

            <div className={s.optionCard} onClick={() => run("html", () => exportHTMLReport(reportData))}>
              <div className={s.optionIcon}>🌐</div>
              <div className={s.optionBody}>
                <div className={s.optionLabel}>HTML Report</div>
                <div className={s.optionDesc}>Self-contained .html file — open in any browser, no server needed. Includes sidebar navigation, stats, all content formatted. Share by email or upload anywhere.</div>
              </div>
              <div className={s.optionAction}>
                {loading === "html" ? "…" : done === "html" ? "✓" : "⬇"}
              </div>
            </div>

            <div className={s.optionCard} onClick={() => run("json", () => exportProjectJSON(reportData))}>
              <div className={s.optionIcon}>📦</div>
              <div className={s.optionBody}>
                <div className={s.optionLabel}>Project JSON</div>
                <div className={s.optionDesc}>Full project export including all notes, tasks, decisions, and standups as structured JSON. Use to transfer to another DevNotes instance or back up a single project.</div>
              </div>
              <div className={s.optionAction}>
                {loading === "json" ? "…" : done === "json" ? "✓" : "⬇"}
              </div>
            </div>
          </div>

          {/* Import section */}
          <div className={s.section}>
            <div className={s.sectionTitle}>Import Project</div>
            <label
              className={`${s.dropZone} ${dragOver ? s.dropActive : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) { const r = new FileReader(); r.onload = (ev) => handleImport(ev.target?.result as string); r.readAsText(f); } }}>
              <input type="file" accept=".json" style={{ display:"none" }} onChange={handleFileInput} />
              <span className={s.dropIcon}>📂</span>
              <span>Drop a project .json export here or click to browse</span>
            </label>
            {importMsg && (
              <div className={`${s.importMsg} ${importMsg.startsWith("✓") ? s.importOk : s.importErr}`}>
                {importMsg}
              </div>
            )}
          </div>

          {error && <div className={s.error}>✗ {error}</div>}
        </div>
      </div>
    </div>
  );
}
