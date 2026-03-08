import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useHotkeys }  from "@/hooks/useHotkeys";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useReminders }    from "@/hooks/useReminders";
import { useFileWatcher }  from "@/hooks/useFileWatcher";
import { useGlobalHotkey } from "@/hooks/useGlobalHotkey";
import { applyResolution, type ResolutionKey } from "@/utils/resolution";
import TitleBar    from "@/components/titlebar/TitleBar";
import StatusBar   from "@/components/statusbar/StatusBar";
import ProjectPicker from "@/components/projects/ProjectPicker";
import TabDashboard  from "@/components/dashboard/TabDashboard";
import { TabPlan }   from "@/components/plan/TabPlan";
import TabNotes      from "@/components/notes/TabNotes";
import TabTodos      from "@/components/todos/TabTodos";
import TabTasks      from "@/components/tasks/TabTasks";
import TabMindMap    from "@/components/mindmap/TabMindMap";
import TabTools      from "@/components/tools/TabTools";
import TabSettings   from "@/components/settings/TabSettings";
import QuickCapture  from "@/components/quickcapture/QuickCapture";
import TabGantt      from "@/components/gantt/TabGantt";
import TabDecisions  from "@/components/decision/TabDecisions";
import TabStandup    from "@/components/standup/TabStandup";
import Onboarding    from "@/components/onboarding/Onboarding";
import Pomodoro      from "@/components/pomodoro/Pomodoro";
import GlobalSearch  from "@/components/search/GlobalSearch";
import ShareDialog   from "@/components/share/ShareDialog";

export default function App() {
  const init            = useAppStore((s) => s.init);
  const isInit          = useAppStore((s) => s.isInitialized);
  const settings        = useAppStore((s) => s.data.settings);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeTab       = useAppStore((s) => s.activeTab);
  const showOnboarding  = !(settings as any).onboardingComplete;
  const [pomodoroOpen,  setPomodoroOpen]  = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [shareOpen,     setShareOpen]     = useState(false);

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
    const resolution = (settings as any).resolution as ResolutionKey ?? "fhd";
    applyResolution(resolution);
    import("@/i18n").then((m) => m.setLocale(settings.locale ?? "en"));
    document.documentElement.setAttribute("data-theme", settings.theme);
    document.documentElement.style.setProperty(
      "--font-mono", `'${settings.uiFont}', 'Share Tech Mono', monospace`
    );
    document.documentElement.style.setProperty(
      "--font-code", `'${settings.codeFont}', 'Fira Code', monospace`
    );
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
          {!activeProjectId ? (
            <ProjectPicker />
          ) : (
            <>
              {activeTab === "dashboard" && <TabDashboard />}
              {activeTab === "plan"      && <TabPlan />}
              {activeTab === "notes"     && <TabNotes />}
              {activeTab === "todos"     && <TabTodos />}
              {activeTab === "tasks"     && <TabTasks />}
              {activeTab === "mindmap"   && <TabMindMap />}
              {activeTab === "tools"      && <TabTools />}
              {activeTab === "settings"  && <TabSettings />}
              {activeTab === "gantt"     && <TabGantt />}
              {activeTab === "decisions" && <TabDecisions />}
              {activeTab === "standup"   && <TabStandup />}
            </>
          )}
          {/* Settings accessible from anywhere via TitleBar ⚙ button */}
          {activeTab === "settings" && !activeProjectId && <TabSettings />}
        </main>

        <StatusBar />
        <QuickCapture />
      </div>
    </>
  );
}
