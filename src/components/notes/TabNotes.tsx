// ─── NOTES TAB ───────────────────────────────────────────
import { useAppStore, selNotes, selActiveProject } from "@/stores/useAppStore";
import { useTranslation } from "react-i18next";
import s from "./TabNotes.module.css";
import { useState } from "react";
import ExportDialog from "@/components/export/ExportDialog";
import AiPanel from "@/components/ai/AiPanel";

export function TabNotes() {
  const { t }        = useTranslation();
  const project      = useAppStore(selActiveProject);
  const notes        = useAppStore(selNotes);
  const selectedId   = useAppStore((st) => st.selectedNoteId);
  const selectNote   = useAppStore((st) => st.selectNote);
  const addNote      = useAppStore((st) => st.addNote);
  const updateNote   = useAppStore((st) => st.updateNote);
  const archiveNote  = useAppStore((st) => st.archiveNote);
  const setFilter    = useAppStore((st) => st.setNoteFilter);
  const filter       = useAppStore((st) => st.noteFilter);
  const selected     = notes.find((n) => n.id === selectedId) ?? notes[0] ?? null;

  const [exportTarget, setExportTarget] = useState<"note"|"all-notes"|null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  if (!project) return null;

  return (
    <div className={s.root} style={{display:"flex"}}>
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <aside className={`glass ${s.sidebar}`}>
        <div className={s.sidebarHeader}>
          <input className={`input ${s.search}`} placeholder={t("notes.searchPlaceholder")}
            value={filter.search} onChange={(e) => setFilter({ search: e.target.value })} />
          <button className="btn btn-primary" onClick={() => addNote()}>+</button>
          <button className="btn" title="Export all notes" onClick={() => setExportTarget("all-notes")}>⬇ Export</button>
        </div>
        <ul className={s.list}>
          {notes.map((n) => (
            <li key={n.id} className={`${s.item} ${n.id === selectedId ? s.active : ""}`}
              onClick={() => selectNote(n.id)}>
              <span className={s.dot}>●</span>
              <span className={`${s.noteTitle} truncate`}>{n.title || t("notes.untitled")}</span>
              {n.pinned && <span style={{color:"var(--yellow)",fontSize:10}}>★</span>}
            </li>
          ))}
          {notes.length === 0 && <li className={s.empty}>{t("notes.empty")}</li>}
        </ul>
      </aside>

      <section className={s.editor}>
        {selected ? (
          <>
            <div className={s.editorHeader}>
              <input className={s.titleInput} value={selected.title}
                placeholder={t("notes.untitled")}
                onChange={(e) => updateNote(selected.id, { title: e.target.value })} />
              <button className="btn-icon" onClick={() => archiveNote(selected.id)} title={t("notes.archive")}>⊟</button>
              <button className="btn-icon" onClick={() => setExportTarget("note")} title="Export this note">⬇</button>
              <button className="btn-icon" style={aiOpen?{color:"var(--cyan)"}:{}} onClick={() => setAiOpen(o=>!o)} title="AI Assistant">✦ AI</button>
            </div>
            <div className={s.divider} />
            <textarea className={s.body} value={selected.body}
              placeholder="# Markdown supported\n\nStart writing…"
              onChange={(e) => updateNote(selected.id, { body: e.target.value })}
              spellCheck={false} />
          </>
        ) : (
          <div className={s.emptyEditor}>{t("notes.empty")}</div>
        )}
      </section>
      </div>
      {aiOpen && selected && <div style={{width:"320px",flexShrink:0}}><AiPanel noteId={selected.id}/></div>}
      {exportTarget && (
        <ExportDialog
          target={exportTarget}
          note={exportTarget === "note" ? (selected ?? undefined) : undefined}
          onClose={() => setExportTarget(null)}
        />
      )}
    </div>
  );
}
export default TabNotes;
