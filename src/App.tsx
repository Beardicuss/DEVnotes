import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useReminders } from "@/hooks/useReminders";
import { useFileWatcher } from "@/hooks/useFileWatcher";
import { useGlobalHotkey } from "@/hooks/useGlobalHotkey";
import i18n from "@/i18n";
import { applyResolution, type ResolutionKey } from "@/utils/resolution";
import TitleBar from "@/components/titlebar/TitleBar";
import StatusBar from "@/components/statusbar/StatusBar";
import ProjectPicker from "@/components/projects/ProjectPicker";
import TabDashboard from "@/components/dashboard/TabDashboard";
import { TabPlan } from "@/components/plan/TabPlan";
import TabNotes from "@/components/notes/TabNotes";
import TabTodos from "@/components/todos/TabTodos";
import TabTasks from "@/components/tasks/TabTasks";
import TabMindMap from "@/components/mindmap/TabMindMap";
import TabTools from "@/components/tools/TabTools";
import TabSettings from "@/components/settings/TabSettings";
import QuickCapture from "@/components/quickcapture/QuickCapture";
import TabGantt from "@/components/gantt/TabGantt";
import TabDecisions from "@/components/decision/TabDecisions";
import TabStandup from "@/components/standup/TabStandup";
import Onboarding from "@/components/onboarding/Onboarding";
import Pomodoro from "@/components/pomodoro/Pomodoro";
import GlobalSearch from "@/components/search/GlobalSearch";
import ShareDialog from "@/components/share/ShareDialog";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function App() {
  const init = useAppStore((s) => s.init);
  const isInit = useAppStore((s) => s.isInitialized);
  const settings = useAppStore((s) => s.data.settings);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeTab = useAppStore((s) => s.activeTab);
  const showOnboarding = !settings.onboardingComplete;
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const handleOnboardingComplete = useCallback(() => {
    useAppStore.getState().updateSettings({ onboardingComplete: true });
  }, []);

  useHotkeys();
  useAutoSync();

  // Global search hotkey: Ctrl+F or Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "k")) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useReminders();
  useFileWatcher();
  useGlobalHotkey();

  // Load data from disk
  useEffect(() => { init(); }, [init]);

  // Apply resolution + theme whenever settings change
  useEffect(() => {
    const resolution = (settings.resolution ?? "fhd") as ResolutionKey;
    applyResolution(resolution);
    i18n.changeLanguage(settings.locale ?? "en");
    document.documentElement.setAttribute("data-theme", settings.theme);
    if (settings.uiFont) {
      document.documentElement.style.setProperty(
        "--font-mono", `'${settings.uiFont}', 'Share Tech Mono', monospace`
      );
      document.documentElement.style.setProperty(
        "--font-ui", `'${settings.uiFont}', sans-serif`
      );
    } else {
      document.documentElement.style.removeProperty("--font-mono");
      document.documentElement.style.removeProperty("--font-ui");
    }

    if (settings.codeFont) {
      document.documentElement.style.setProperty(
        "--font-code", `'${settings.codeFont}', 'Fira Code', monospace`
      );
    } else {
      document.documentElement.style.removeProperty("--font-code");
    }
    const lh = { compact: "1.4", normal: "1.65", relaxed: "2.0" };
    document.documentElement.style.setProperty("--lh", lh[settings.lineHeight]);
  }, [settings]);

  if (!isInit) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#020202",
      }}>
        <span style={{
          fontFamily: "'Orbitron', monospace", fontSize: "1em",
          color: "#00ffff", letterSpacing: "0.3em",
          animation: "loadpulse 1s ease-in-out infinite",
        }}>
          LOADING…
        </span>
      </div>
    );
  }

  return (
    <>
      {settings.showGridBg && <div className="grid-bg" />}
      <div style={{
        display: "flex", flexDirection: "column",
        height: "100vh", width: "100vw", overflow: "hidden",
        position: "relative", zIndex: 1,
      }}>
        <TitleBar onPomodoroToggle={() => setPomodoroOpen((o) => !o)} pomodoroOpen={pomodoroOpen} onSearchOpen={() => setSearchOpen(true)} onShareOpen={() => setShareOpen(true)} />

        <main style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {activeTab === "settings" ? (
            <ErrorBoundary tabName="settings" key="settings">
              <TabSettings />
            </ErrorBoundary>
          ) : !activeProjectId ? (
            <ProjectPicker />
          ) : (
            <>
              <ErrorBoundary tabName="dashboard" key="dashboard">
                {activeTab === "dashboard" && <TabDashboard />}
              </ErrorBoundary>
              <ErrorBoundary tabName="plan" key="plan">
                {activeTab === "plan" && <TabPlan />}
              </ErrorBoundary>
              <ErrorBoundary tabName="notes" key="notes">
                {activeTab === "notes" && <TabNotes />}
              </ErrorBoundary>
              <ErrorBoundary tabName="todos" key="todos">
                {activeTab === "todos" && <TabTodos />}
              </ErrorBoundary>
              <ErrorBoundary tabName="tasks" key="tasks">
                {activeTab === "tasks" && <TabTasks />}
              </ErrorBoundary>
              <ErrorBoundary tabName="mindmap" key="mindmap">
                {activeTab === "mindmap" && <TabMindMap />}
              </ErrorBoundary>
              <ErrorBoundary tabName="tools" key="tools">
                {activeTab === "tools" && <TabTools />}
              </ErrorBoundary>
              <ErrorBoundary tabName="gantt" key="gantt">
                {activeTab === "gantt" && <TabGantt />}
              </ErrorBoundary>
              <ErrorBoundary tabName="decisions" key="decisions">
                {activeTab === "decisions" && <TabDecisions />}
              </ErrorBoundary>
              <ErrorBoundary tabName="standup" key="standup">
                {activeTab === "standup" && <TabStandup />}
              </ErrorBoundary>
            </>
          )}
        </main>

        <StatusBar />
        <QuickCapture />
        {pomodoroOpen && <ErrorBoundary tabName="pomodoro"><Pomodoro onClose={() => setPomodoroOpen(false)} /></ErrorBoundary>}
        {showOnboarding && <ErrorBoundary tabName="onboarding"><Onboarding onComplete={handleOnboardingComplete} /></ErrorBoundary>}
        {searchOpen && <ErrorBoundary tabName="search"><GlobalSearch onClose={() => setSearchOpen(false)} /></ErrorBoundary>}
        {shareOpen && <ErrorBoundary tabName="share"><ShareDialog onClose={() => setShareOpen(false)} /></ErrorBoundary>}
      </div>
    </>
  );
}