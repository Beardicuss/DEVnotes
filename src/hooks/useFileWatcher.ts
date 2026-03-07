import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { watchProject, unwatchProject, onProjectChanged } from "@/integrations/watcher/fileWatcher";
import { getGitStatus } from "@/integrations/ide/detector";

/**
 * Watches active project directories for filesystem changes.
 * When a change is detected:
 *   1. Re-runs git status for that project
 *   2. Triggers a UI refresh via a store signal
 *
 * Run once at App root level.
 */
export function useFileWatcher() {
  const projects   = useAppStore((s) => s.data.projects);
  const activeId   = useAppStore((s) => s.activeProjectId);
  const settings   = useAppStore((s) => s.data.settings);
  const setGit     = useAppStore((s) => s.setGitStatus);

  // Track which projects we're currently watching
  const watching = useRef<Set<string>>(new Set());

  // Start/stop watchers as active project changes
  useEffect(() => {
    if (!settings.autoDetectIDE) return;

    const project = projects.find((p) => p.id === activeId);
    if (!project?.rootPath) return;

    watchProject(project.id, project.rootPath);
    watching.current.add(project.id);

    return () => {
      unwatchProject(project.id);
      watching.current.delete(project.id);
    };
  }, [activeId, projects, settings.autoDetectIDE]);

  // React to file change events
  useEffect(() => {
    const cleanup = onProjectChanged(async (projectId, _path) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project?.rootPath) return;

      // Refresh git status
      const git = await getGitStatus(project.rootPath);
      if (git && setGit) setGit(projectId, git);
    });

    return cleanup;
  }, [projects, setGit]);
}
