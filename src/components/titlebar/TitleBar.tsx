import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/useAppStore";
import { isTauri } from "@/utils/platform";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ProjectTab } from "@/types";
import s from "./TitleBar.module.css";

interface TitleBarProps {
  onPomodoroToggle?: () => void;
  pomodoroOpen?: boolean;
  onSearchOpen?: () => void;
  onShareOpen?: () => void;
}

export default function TitleBar({ onPomodoroToggle, pomodoroOpen, onSearchOpen, onShareOpen }: TitleBarProps = {}) {
  const { t } = useTranslation();

  // Tabs defined inside component so t() is available
  const TABS: { id: ProjectTab; label: string; hotkey?: string }[] = [
    { id: "dashboard", label: t("nav.dashboard"), hotkey: "1" },
    { id: "plan", label: t("nav.plan"), hotkey: "2" },
    { id: "notes", label: t("nav.notes"), hotkey: "3" },
    { id: "todos", label: t("nav.todos"), hotkey: "4" },
    { id: "tasks", label: t("nav.tasks"), hotkey: "5" },
    { id: "mindmap", label: t("nav.mindmap"), hotkey: "6" },
    { id: "tools", label: t("nav.tools"), hotkey: "7" },
    { id: "gantt", label: t("nav.gantt", "Gantt") },
    { id: "decisions", label: t("nav.decisions", "Decisions") },
    { id: "standup", label: t("nav.standup", "Standup") },
  ];

  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);
  const openProject = useAppStore((s) => s.openProject);
  const isSaving = useAppStore((s) => s.isSaving);
  const syncState = useAppStore((s) => s.syncState);
  const ghEnabled = useAppStore((s) => s.data.settings.githubSyncEnabled);
  const projects = useAppStore((s) => s.data.projects);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleMin = async () => { try { await getCurrentWindow().minimize(); } catch (e: any) { alert("Min failed: " + String(e)); } };
  const handleMax = async () => { try { await getCurrentWindow().toggleMaximize(); } catch (e: any) { alert("Max failed: " + String(e)); } };
  const handleClose = async () => { try { await getCurrentWindow().hide(); } catch (e: any) { alert("Close failed: " + String(e)); window.close(); } };

  const handleDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (!isTauri) return;
    const target = e.target as HTMLElement;
    // Prevent dragging if the user clicked a button or a tab inside the navigation
    if (target.closest('button') || target.closest('nav')) return;
    try {
      getCurrentWindow().startDragging();
    } catch (err) {
      console.warn("Failed to drag window:", err);
    }
  };

  return (
    <header className={s.bar} onPointerDown={handleDrag}>
      {/* Logo */}
      <div className={s.logo}>
        <span className={s.logoCyan}>DEV</span>
        <span className={s.logoText}>NOTES</span>
        {activeProject && (
          <>
            <span className={s.sep}>›</span>
            <button className={s.projNameBtn} onClick={() => openProject("")} title="Switch Project">
              {activeProject.name} <span style={{ opacity: 0.5, fontSize: "0.8em", marginLeft: "4px" }}>▾</span>
            </button>
          </>
        )}
      </div>

      {/* Tabs */}
      {activeProjectId && (
        <nav className={s.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${s.tab} ${activeTab === tab.id ? s.tabActive : ""}`}
              onClick={() => setTab(tab.id)}
              title={tab.hotkey ? `Ctrl+${tab.hotkey}` : tab.label}
            >
              {tab.label}
            </button>
          ))}
          {/* Draggable blank space next to tabs */}
          <div style={{ flex: 1, minWidth: "20px" }} />
        </nav>
      )}

      {!activeProjectId && (
        /* Draggable blank space when no project is selected */
        <div style={{ flex: 1 }} />
      )}

      <div className={s.right}>
        {isSaving && <span className={s.saving}>SAVING…</span>}

        {ghEnabled && (
          <span className={`${s.sync} sync-${syncState.status}`}>
            {syncState.status === "syncing" ? "↻" : syncState.status === "error" ? "⚠" : "⬆"}
          </span>
        )}

        {onSearchOpen && (
          <button className={s.settingsBtn} onClick={onSearchOpen} title="Global Search (Ctrl+K)">⌕</button>
        )}
        {onShareOpen && activeProjectId && (
          <button className={s.settingsBtn} onClick={onShareOpen} title="Share / Export Project">↑ Share</button>
        )}
        {onPomodoroToggle && (
          <button className={`${s.settingsBtn} ${pomodoroOpen ? s.pomodoroActive : ""}`}
            onClick={onPomodoroToggle} title="Pomodoro Timer">🍅</button>
        )}
        <button className={s.settingsBtn} onClick={() => setTab("settings")} title={t("nav.settings")}>⚙</button>

        {isTauri && (
          <div className={s.winBtns}>
            <button className={s.winBtn} onClick={handleMin} title="Minimise">
              <svg viewBox="0 0 10 10" width="10" height="10" style={{ pointerEvents: 'none' }}><path d="M 0,5 10,5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
            </button>
            <button className={s.winBtn} onClick={handleMax} title="Maximise">
              <svg viewBox="0 0 10 10" width="10" height="10" style={{ pointerEvents: 'none' }}><path d="M 1,1 9,1 9,9 1,9 Z" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
            </button>
            <button className={`${s.winBtn} ${s.close}`} onClick={handleClose} title="Close">
              <svg viewBox="0 0 10 10" width="10" height="10" style={{ pointerEvents: 'none' }}><path d="M 0,0 10,10 M 10,0 0,10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
