import { useState, useMemo, useEffect, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";
import s from "./GlobalSearch.module.css";

type ResultKind = "note" | "task" | "decision" | "standup" | "project";

interface SearchResult {
  id:        string;
  kind:      ResultKind;
  title:     string;
  preview:   string;
  projectId: string;
  projectName: string;
  score:     number;
}

const KIND_ICON: Record<ResultKind, string> = {
  note:      "📝",
  task:      "✅",
  decision:  "🤔",
  standup:   "🗓",
  project:   "📁",
};
const KIND_LABEL: Record<ResultKind, string> = {
  note:      "Note",
  task:      "Task",
  decision:  "Decision",
  standup:   "Standup",
  project:   "Project",
};

function score(haystack: string, needle: string): number {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 100;
  if (h.startsWith(n)) return 80;
  if (h.includes(n)) return 60;
  // word match
  const words = n.split(/\s+/);
  const matches = words.filter((w) => h.includes(w)).length;
  return Math.round((matches / words.length) * 40);
}

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery]   = useState("");
  const [filter, setFilter] = useState<ResultKind | "all">("all");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const projects  = useAppStore((s) => s.data.projects);
  const notes     = useAppStore((s) => s.data.notes);
  const tasks     = useAppStore((s) => s.data.tasks);
  const decisions = useAppStore((s) => s.data.decisions ?? []);
  const standups  = useAppStore((s) => s.data.standups ?? []);
  const openProject = useAppStore((s) => s.openProject);
  const setTab      = useAppStore((s) => s.setTab);
  const selectNote  = useAppStore((s) => s.selectNote);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name ?? "Unknown";

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim();
    if (q.length < 1) return [];
    const out: SearchResult[] = [];

    // Projects
    if (filter === "all" || filter === "project") {
      for (const p of projects) {
        const sc = Math.max(score(p.name, q), score(p.description ?? "", q));
        if (sc > 0) out.push({ id: p.id, kind: "project", title: p.name,
          preview: p.description ?? p.status, projectId: p.id, projectName: p.name, score: sc });
      }
    }
    // Notes
    if (filter === "all" || filter === "note") {
      for (const n of notes.filter((n) => !n.archived)) {
        const sc = Math.max(score(n.title, q), score(n.body ?? "", q));
        if (sc > 0) out.push({ id: n.id, kind: "note", title: n.title || "Untitled",
          preview: (n.body ?? "").slice(0, 100).replace(/[#*`]/g, ""),
          projectId: n.projectId, projectName: projectName(n.projectId), score: sc });
      }
    }
    // Tasks
    if (filter === "all" || filter === "task") {
      for (const t of tasks.filter((t) => t.status !== "archived")) {
        const sc = Math.max(score(t.title, q), score(t.description ?? "", q));
        if (sc > 0) out.push({ id: t.id, kind: "task", title: t.title,
          preview: `[${t.priority}] ${t.status}${t.dueDate ? " · " + t.dueDate : ""}`,
          projectId: t.projectId, projectName: projectName(t.projectId), score: sc });
      }
    }
    // Decisions
    if (filter === "all" || filter === "decision") {
      for (const d of decisions) {
        const sc = Math.max(score(d.title, q), score(d.context, q), score(d.outcome, q));
        if (sc > 0) out.push({ id: d.id, kind: "decision", title: d.title,
          preview: d.context.slice(0, 100),
          projectId: d.projectId, projectName: projectName(d.projectId), score: sc });
      }
    }
    // Standups
    if (filter === "all" || filter === "standup") {
      for (const e of standups) {
        const sc = Math.max(score(e.today, q), score(e.yesterday, q), score(e.blockers, q));
        if (sc > 0) out.push({ id: e.id, kind: "standup", title: `Standup ${e.date}`,
          preview: e.today.slice(0, 100),
          projectId: e.projectId, projectName: projectName(e.projectId), score: sc });
      }
    }

    return out.sort((a, b) => b.score - a.score).slice(0, 40);
  }, [query, filter, projects, notes, tasks, decisions, standups]);

  // Reset cursor when results change
  useEffect(() => { setCursor(0); }, [results.length, query]);

  const navigate = (result: SearchResult) => {
    openProject(result.projectId);
    switch (result.kind) {
      case "project":  break;
      case "note":     setTab("notes");     setTimeout(() => selectNote(result.id), 50); break;
      case "task":     setTab("tasks");     break;
      case "decision": setTab("decisions"); break;
      case "standup":  setTab("standup");   break;
    }
    onClose();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && results[cursor]) navigate(results[cursor]);
  };

  const filters: (ResultKind | "all")[] = ["all", "note", "task", "decision", "standup", "project"];

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.palette} onClick={(e) => e.stopPropagation()}>
        {/* Search input */}
        <div className={s.inputRow}>
          <span className={s.searchIcon}>⌕</span>
          <input
            ref={inputRef}
            className={s.input}
            placeholder="Search everything… notes, tasks, decisions, standups"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          {query && (
            <button className={s.clearBtn} onClick={() => setQuery("")}>✕</button>
          )}
        </div>

        {/* Filter pills */}
        <div className={s.filters}>
          {filters.map((f) => (
            <button key={f}
              className={`${s.filterPill} ${filter === f ? s.filterActive : ""}`}
              onClick={() => setFilter(f)}>
              {f === "all" ? "All" : KIND_ICON[f] + " " + KIND_LABEL[f]}
            </button>
          ))}
          {query && <span className={s.resultCount}>{results.length} results</span>}
        </div>

        {/* Results */}
        <div className={s.results}>
          {query.length === 0 && (
            <div className={s.hint}>
              <div className={s.hintTitle}>Global Search</div>
              <div className={s.hintSub}>Search across all projects, notes, tasks, decisions and standups.</div>
              <div className={s.shortcuts}>
                <span><kbd>↑↓</kbd> navigate</span>
                <span><kbd>Enter</kbd> open</span>
                <span><kbd>Esc</kbd> close</span>
              </div>
            </div>
          )}

          {query.length > 0 && results.length === 0 && (
            <div className={s.empty}>No results for <strong>"{query}"</strong></div>
          )}

          {results.map((r, i) => (
            <div key={r.id}
              className={`${s.result} ${i === cursor ? s.resultActive : ""}`}
              onClick={() => navigate(r)}
              onMouseEnter={() => setCursor(i)}>
              <span className={s.resultIcon}>{KIND_ICON[r.kind]}</span>
              <div className={s.resultBody}>
                <div className={s.resultTitle}>{highlight(r.title, query)}</div>
                {r.preview && (
                  <div className={s.resultPreview}>{highlight(r.preview.slice(0,80), query)}</div>
                )}
              </div>
              <div className={s.resultMeta}>
                <span className={s.resultProject}>{r.projectName}</span>
                <span className={s.resultKind}>{KIND_LABEL[r.kind]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Wrap matched substring in a highlight span */
function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
