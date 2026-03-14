import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/useAppStore";
import type { Project, ProjectStatus } from "@/types";
import { shortDate } from "@/utils/date";
import s from "./ProjectPicker.module.css";

const STATUS_COLOUR: Record<ProjectStatus, string> = {
  active:     "var(--green)",
  "on-hold":  "var(--yellow)",
  completed:  "var(--cyan)",
  archived:   "var(--text-dim)",
};

export default function ProjectPicker() {
  const { t }       = useTranslation();
  const projects    = useAppStore((st) => st.data.projects);
  const openProject = useAppStore((st) => st.openProject);
  const addProject  = useAppStore((st) => st.addProject);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const filtered = projects
    .filter((p) => p.status !== "archived")
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = addProject({ name: newName.trim() });
    openProject(id);
    setShowNew(false);
    setNewName("");
  };

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>DEV<span className="text-cyan">NOTES</span></h1>
          <p className={s.sub}>Softcurse Studio · project workspace</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          {t("projects.new")}
        </button>
      </div>

      <input
        className={`input ${s.search}`}
        placeholder={t("projects.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 && (
        <div className={s.empty}>{t("projects.empty")}</div>
      )}

      <div className={s.grid}>
        {filtered.map((p) => (
          <ProjectCard key={p.id} project={p} onOpen={() => openProject(p.id)} />
        ))}
      </div>

      {/* New project modal */}
      {showNew && (
        <div className={s.overlay} onClick={() => setShowNew(false)}>
          <div className={`glass ${s.modal}`} onClick={(e) => e.stopPropagation()}>
            <h3 className={s.modalTitle}>NEW PROJECT</h3>
            <input
              className="input"
              placeholder="Project name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <div className={s.modalActions}>
              <button className="btn" onClick={() => setShowNew(false)}>CANCEL</button>
              <button className="btn btn-primary" onClick={handleCreate}>CREATE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  // Single selector for both counts — avoids scanning all tasks twice on every render
  const { taskCount, doneCount } = useAppStore((s) => {
    const proj = s.data.tasks.filter((t) => t.projectId === project.id && t.status !== "archived");
    return { taskCount: proj.length, doneCount: proj.filter((t) => t.status === "done").length };
  });

  return (
    <div className={s.card} onClick={onOpen}>
      <div className={s.cardTop}>
        <span className={s.cardIcon}>{project.icon}</span>
        {project.pinned && <span className={s.pin}>★</span>}
        <span
          className={s.statusDot}
          style={{ background: STATUS_COLOUR[project.status] }}
          title={project.status}
        />
      </div>
      <div className={s.cardName}>{project.name}</div>
      {project.description && (
        <div className={s.cardDesc}>{project.description}</div>
      )}
      <div className={s.cardTags}>
        {project.techStack.slice(0, 3).map((t) => (
          <span key={t} className={`chip chip-tag ${s.techTag}`}>{t}</span>
        ))}
      </div>
      <div className={s.cardMeta}>
        <span>{taskCount > 0 ? `${doneCount}/${taskCount} tasks` : "no tasks"}</span>
        {project.deadline && (
          <span className={s.deadline}>⏱ {shortDate(project.deadline)}</span>
        )}
      </div>
    </div>
  );
}
