import { useAppStore } from "@/stores/useAppStore";
import { isTauri } from "@/utils/platform";
import type { ProjectTab } from "@/types";
import s from "./TitleBar.module.css";

const TABS: { id: ProjectTab; label: string; hotkey?: string }[] = [
  { id: "dashboard", label: "Dashboard",  hotkey: "1" },
  { id: "plan",      label: "Plan",       hotkey: "2" },
  { id: "notes",     label: "Notes",      hotkey: "3" },
  { id: "todos",     label: "Todo",       hotkey: "4" },
  { id: "tasks",     label: "Tasks",      hotkey: "5" },
  { id: "mindmap",   label: "Mind Map",   hotkey: "6" },
  { id: "tools",     label: "Tools",      hotkey: "7" },
  { id: "gantt",     label: "Gantt" },
  { id: "decisions", label: "Decisions" },
  { id: "standup",   label: "Standup" },
];

interface TitleBarProps { onPomodoroToggle?: () => void; pomodoroOpen?: boolean; onSearchOpen?: () => void; onShareOpen?: () => void; }
export default function TitleBar({ onPomodoroToggle, pomodoroOpen, onSearchOpen, onShareOpen }: TitleBarProps = {}) {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeTab       = useAppStore((s) => s.activeTab);
  const setTab          = useAppStore((s) => s.setTab);
  const isSaving        = useAppStore((s) => s.isSaving);
  const syncState       = useAppStore((s) => s.syncState);
  const ghEnabled       = useAppStore((s) => s.data.settings.githubSyncEnabled);
  const projects        = useAppStore((s) => s.data.projects);
  const activeProject   = projects.find((p) => p.id === activeProjectId);

  const handleMin   = async () => { try { const { getCurrentWindow } = await import(/* @vite-ignore */"@tauri-apps/api/window"); await getCurrentWindow().minimize(); } catch {} };
  const handleMax   = async () => { try { const { getCurrentWindow } = await import(/* @vite-ignore */"@tauri-apps/api/window"); await getCurrentWindow().toggleMaximize(); } catch {} };
  const handleClose = async () => { try { const { getCurrentWindow } = await import(/* @vite-ignore */"@tauri-apps/api/window"); await getCurrentWindow().hide(); } catch { window.close(); } };

  return (
    <header className={s.bar} data-tauri-drag-region>
      {/* Logo */}
      <div className={s.logo}>
        <span className={s.logoCyan}>DEV</span>
        <span className={s.logoText}>NOTES</span>
        {activeProject && (
          <>
            <span className={s.sep}>›</span>
            <span className={s.projName}>{activeProject.name}</span>
          </>
        )}
      </div>

      {/* Tabs — only show when a project is active */}
      {activeProjectId && (
        <nav className={s.tabs}>
          {TABS.map((tab, i) => (
            <button
              key={tab.id}
              className={`${s.tab} ${activeTab === tab.id ? s.tabActive : ""}`}
              onClick={() => setTab(tab.id)}
              title={`Ctrl+${i + 1}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      <div className={s.right}>
        {/* Saving indicator */}
        {isSaving && <span className={s.saving}>SAVING…</span>}

        {/* GitHub sync */}
        {ghEnabled && (
          <span className={`${s.sync} sync-${syncState.status}`}>
            {syncState.status === "syncing" ? "↻" : syncState.status === "error" ? "⚠" : "⬆"}
          </span>
        )}

        {/* Settings */}
        {onSearchOpen && (
          <button className={s.settingsBtn} onClick={onSearchOpen} title="Global Search (Ctrl+K)">
            ⌕
          </button>
        )}
        {onShareOpen && activeProjectId && (
          <button className={s.settingsBtn} onClick={onShareOpen} title="Share / Export Project">
            ↑ Share
          </button>
        )}
        {onPomodoroToggle && (
          <button className={`${s.settingsBtn} ${pomodoroOpen ? s.pomodoroActive : ""}`}
            onClick={onPomodoroToggle} title="Pomodoro Timer">
            🍅
          </button>
        )}
        <button className={s.settingsBtn} onClick={() => setTab("settings")} title="Settings">
          ⚙
        </button>

        {/* Window controls — Tauri only */}
        {isTauri && (
          <div className={s.winBtns}>
            <button className={s.winBtn} onClick={handleMin} title="Minimise">─</button>
            <button className={s.winBtn} onClick={handleMax} title="Maximise">□</button>
            <button className={`${s.winBtn} ${s.close}`} onClick={handleClose} title="Close">✕</button>
          </div>
        )}
      </div>
    </header>
  );
}
