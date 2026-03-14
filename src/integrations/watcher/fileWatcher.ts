/**
 * File watcher — Phase 3
 *
 * Calls the Rust `watch_project_dir` command which polls the filesystem
 * every 2 seconds and emits "project-file-changed" events.
 *
 * The frontend side subscribes to those events and updates the git status
 * and IDE auto-detect info automatically.
 */

import { isTauri } from "@/utils/platform";

type ChangeHandler = (projectId: string, path: string) => void;

const activeWatchers = new Set<string>();
let unlisten: (() => void) | null = null;
const handlers: ChangeHandler[] = [];

/**
 * Start watching a project directory.
 * Safe to call multiple times — deduplicates by projectId.
 */
export async function watchProject(
  projectId: string,
  dirPath: string
): Promise<void> {
  if (!isTauri || !dirPath) return;
  if (activeWatchers.has(projectId)) return;
  activeWatchers.add(projectId);

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("watch_project_dir", { projectId, dirPath });

    // Subscribe to events once (shared listener for all watchers)
    if (!unlisten) {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<{ projectId: string; path: string }>(
        "project-file-changed",
        (event) => {
          handlers.forEach((h) => h(event.payload.projectId, event.payload.path));
        }
      );
    }
  } catch (e) {
    console.warn("File watcher start failed:", e);
    activeWatchers.delete(projectId);
  }
}

/**
 * Stop watching a project directory.
 */
export async function unwatchProject(projectId: string): Promise<void> {
  if (!isTauri) return;
  activeWatchers.delete(projectId);
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("stop_watching", { dirPath: "" });
  } catch {}
}

/**
 * Register a handler to be called when any watched project changes.
 * Returns a cleanup function.
 */
export function onProjectChanged(handler: ChangeHandler): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.indexOf(handler);
    if (i !== -1) handlers.splice(i, 1);
  };
}

/**
 * Stop all watchers and clean up.
 */
export async function stopAllWatchers(): Promise<void> {
  activeWatchers.clear();
  if (unlisten) { unlisten(); unlisten = null; }
  handlers.length = 0;
}
