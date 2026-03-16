import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { watchProject, unwatchProject, onProjectChanged } from "@/integrations/watcher/fileWatcher";
import { getGitStatus, detectProjectAtPath } from "@/integrations/ide/detector";

/**
 * Watches active project directories for filesystem changes & polls background state.
 * When a change is detected:
 *   1. Re-runs git status for that project
 *   2. Triggers a UI refresh via a store signal
 *
 * Run once at App root level.
 */
export function useFileWatcher() {
  const activeId = useAppStore((s) => s.activeProjectId);
  const autoDetect = useAppStore((s) => s.data.settings.autoDetectIDE);
  const setGit = useAppStore((s) => s.setGitStatus);
  const updateProject = useAppStore((s) => s.updateProject);

  const watching = useRef<Set<string>>(new Set());

  // Start/stop watchers & polling as active project changes
  useEffect(() => {
    if (!autoDetect || !activeId) return;

    // Get fresh project state
    const project = useAppStore.getState().data.projects.find((p) => p.id === activeId);
    if (!project?.rootPath) return;

    // 1. Native File Watcher (Tauri fs plugin)
    watchProject(project.id, project.rootPath);
    watching.current.add(project.id);

    // 2. Background Polling (Git + IDE detection)
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      // Always get fresh state in the closure so we have the latest `idePath`
      const p = useAppStore.getState().data.projects.find((pr) => pr.id === activeId);
      if (!p?.rootPath) return;

      // Refresh git status (happens regardless of IDE path existing)
      const git = await getGitStatus(p.rootPath);
      if (git && setGit) setGit(p.id, git);

      // Auto-detect IDE if not already bound
      if (!p.idePath) {
        const detected = await detectProjectAtPath(p.rootPath);
        if (detected?.ideType && detected.ideType !== p.ideType) {
          updateProject(p.id, { ideType: detected.ideType, idePath: detected.idePath });
        }
      }
    };

    poll(); // Initial run
    interval = setInterval(poll, 30_000);

    return () => {
      unwatchProject(project.id);
      watching.current.delete(project.id);
      if (interval) clearInterval(interval);
    };
  }, [activeId, autoDetect, setGit, updateProject]);

  // React to file change events (instant git refresh)
  useEffect(() => {
    const cleanup = onProjectChanged(async (projectId, _path) => {
      const project = useAppStore.getState().data.projects.find((p) => p.id === projectId);
      if (!project?.rootPath) return;

      const git = await getGitStatus(project.rootPath);
      if (git && setGit) setGit(projectId, git);
    });
    return cleanup;
  }, [setGit]);
}
