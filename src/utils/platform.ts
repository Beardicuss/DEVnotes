/**
 * Platform abstraction — Desktop (Tauri) only.
 * All Tauri/Capacitor imports use /* @vite-ignore *\/
 * so Vite's static analysis ignores them in browser dev mode.
 */

export type Platform = "tauri-windows" | "web";

export function getPlatform(): Platform {
  if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window || "__TAURI_IPC__" in window))
    return "tauri-windows";
  return "web";
}

export const platform = getPlatform();
export const isTauri = platform === "tauri-windows";
export const isWeb = platform === "web";

// ─── Storage ─────────────────────────────────────────────────────
// Tauri   → %APPDATA%\DevNotes\data.json
// Browser → localStorage

const STORAGE_KEY = "devnotes_desktop_v2";

export async function storageRead(): Promise<string | null> {
  if (isTauri) {
    try {
      const { readTextFile, BaseDirectory } =
        await import("@tauri-apps/plugin-fs");
      return await readTextFile("DevNotes/data.json", { baseDir: BaseDirectory.AppData });
    } catch { return null; }
  }
  return localStorage.getItem(STORAGE_KEY);
}

export async function storageWrite(json: string): Promise<void> {
  if (isTauri) {
    const { writeTextFile, mkdir, BaseDirectory } =
      await import("@tauri-apps/plugin-fs");
    await mkdir("DevNotes", { baseDir: BaseDirectory.AppData, recursive: true });
    await writeTextFile("DevNotes/data.json", json, { baseDir: BaseDirectory.AppData });
    return;
  }
  localStorage.setItem(STORAGE_KEY, json);
}

export async function storageBackup(json: string, maxCount = 10): Promise<void> {
  if (!isTauri) return;
  try {
    const { writeTextFile, mkdir, readDir, remove, BaseDirectory } =
      await import("@tauri-apps/plugin-fs");
    const baseDir = BaseDirectory.AppData;
    await mkdir("DevNotes/backups", { baseDir, recursive: true });

    // Write new backup
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    await writeTextFile(`DevNotes/backups/data-${ts}.json`, json, { baseDir });

    // Prune oldest backups beyond maxCount
    try {
      const entries = await readDir("DevNotes/backups", { baseDir });
      const backups = entries
        .filter((e) => e.name?.endsWith(".json"))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")); // oldest first (ISO names sort lexicographically)
      if (backups.length > maxCount) {
        const toDelete = backups.slice(0, backups.length - maxCount);
        for (const entry of toDelete) {
          if (entry.name) {
            // Use the same baseDir option so Tauri resolves relative to AppData
            await remove(`DevNotes/backups/${entry.name}`, { baseDir }).catch(() => { });
          }
        }
      }
    } catch { /* pruning non-fatal */ }
  } catch { /* non-fatal */ }
}

export async function shellOpen(pathOrUrl: string): Promise<void> {
  if (!isTauri) { window.open(pathOrUrl, "_blank"); return; }
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(pathOrUrl);
}

export async function shellCommand(cmd: string, cwd?: string): Promise<string> {
  if (!isTauri) throw new Error("shellCommand: Tauri only");
  const { Command } = await import("@tauri-apps/plugin-shell");
  const parts = cmd.split(" ");
  const child = await Command.create(parts[0], parts.slice(1), cwd ? { cwd } : undefined).execute();
  return child.stdout;
}

export async function hideWindow(): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().hide();
}

export async function showWindow(): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  await win.show(); await win.setFocus();
}

export async function setAutostart(enable: boolean): Promise<void> {
  if (!isTauri) return;
  try {
    const mod = await import("@tauri-apps/plugin-autostart");
    if (enable) await mod.enable(); else await mod.disable();
  } catch { /* plugin not installed */ }
}

/** Fire a notification (Tauri or Web). */
export async function sendNotification(title: string, body?: string): Promise<void> {
  if (isTauri) {
    try {
      const { sendNotification: sn, isPermissionGranted, requestPermission } =
        await import("@tauri-apps/plugin-notification");
      let ok = await isPermissionGranted();
      if (!ok) { const p = await requestPermission(); ok = p === "granted"; }
      if (ok) await sn({ title, body });
      return;
    } catch { }
  }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}
