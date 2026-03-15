import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/useAppStore";
import type { Project, ProjectStatus } from "@/types";
import { shortDate } from "@/utils/date";
import s from "./ProjectPicker.module.css";

const STATUS_COLOUR: Record<ProjectStatus, string> = {
  active: "var(--green)",
  "on-hold": "var(--yellow)",
  completed: "var(--cyan)",
  archived: "var(--text-dim)",
};

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

export default function ProjectPicker() {
  const { t } = useTranslation();
  const projects = useAppStore((st) => st.data.projects);
  const openProject = useAppStore((st) => st.openProject);
  const addProject = useAppStore((st) => st.addProject);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

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

  const handleEditSave = () => {
    if (editing && editing.name.trim()) {
      useAppStore.getState().updateProject(editing.id, { name: editing.name.trim() });
    }
    setEditing(null);
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
          <ProjectCard key={p.id} project={p} onOpen={() => openProject(p.id)} onEdit={(p) => setEditing({ id: p.id, name: p.name })} />
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

      {/* Edit project modal */}
      {editing && (
        <div className={s.overlay} onClick={() => setEditing(null)}>
          <div className={`glass ${s.modal}`} onClick={(e) => e.stopPropagation()}>
            <h3 className={s.modalTitle}>{t("common.edit").toUpperCase()} PROJECT</h3>
            <input
              className="input"
              placeholder="Project name…"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
              autoFocus
            />
            <div className={s.modalActions}>
              <button className="btn" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary" onClick={handleEditSave}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onOpen, onEdit }: { project: Project; onOpen: () => void; onEdit: (p: Project) => void; }) {
  const { t } = useTranslation();
  const deleteProject = useAppStore((s) => s.deleteProject);
  const confirmDelete = useAppStore((s) => s.data.settings.confirmDelete);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete || window.confirm(t("common.confirm") + " " + t("common.delete").toLowerCase() + "?")) {
      deleteProject(project.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(project);
  };

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
        <div className={s.cardActions}>
          <button className="icon-btn" onClick={handleEdit} title={t("common.edit")}><EditIcon /></button>
          <button className="icon-btn text-red" onClick={handleDelete} title={t("common.delete")}><TrashIcon /></button>
        </div>
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
