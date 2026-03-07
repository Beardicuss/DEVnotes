/**
 * Platform abstraction — Desktop (Tauri) only.
 * All Tauri/Capacitor imports use /* @vite-ignore *\/
 * so Vite's static analysis ignores them in browser dev mode.
 */

export type Platform = "tauri-windows" | "web";

export function getPlatform(): Platform {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window)
    return "tauri-windows";
  return "web";
}

export const platform = getPlatform();
export const isTauri  = platform === "tauri-windows";
export const isWeb    = platform === "web";

// ─── Storage ─────────────────────────────────────────────────────
// Tauri   → %APPDATA%\DevNotes\data.json
// Browser → localStorage

const STORAGE_KEY = "devnotes_desktop_v2";

export async function storageRead(): Promise<string | null> {
  if (isTauri) {
    try {
      const { readTextFile, BaseDirectory } =
        await import(/* @vite-ignore */ "@tauri-apps/plugin-fs");
      return await readTextFile("DevNotes/data.json", { baseDir: BaseDirectory.AppData });
    } catch { return null; }
  }
  return localStorage.getItem(STORAGE_KEY);
}

export async function storageWrite(json: string): Promise<void> {
  if (isTauri) {
    const { writeTextFile, mkdir, BaseDirectory } =
      await import(/* @vite-ignore */ "@tauri-apps/plugin-fs");
    await mkdir("DevNotes", { baseDir: BaseDirectory.AppData, recursive: true });
    await writeTextFile("DevNotes/data.json", json, { baseDir: BaseDirectory.AppData });
    return;
  }
  localStorage.setItem(STORAGE_KEY, json);
}

export async function storageBackup(json: string): Promise<void> {
  if (!isTauri) return;
  try {
    const { writeTextFile, mkdir, BaseDirectory } =
      await import(/* @vite-ignore */ "@tauri-apps/plugin-fs");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    await mkdir("DevNotes/backups", { baseDir: BaseDirectory.AppData, recursive: true });
    await writeTextFile(`DevNotes/backups/data-${ts}.json`, json, { baseDir: BaseDirectory.AppData });
  } catch { /* non-fatal */ }
}

export async function shellOpen(pathOrUrl: string): Promise<void> {
  if (!isTauri) { window.open(pathOrUrl, "_blank"); return; }
  const { open } = await import(/* @vite-ignore */ "@tauri-apps/plugin-shell");
  await open(pathOrUrl);
}

export async function shellCommand(cmd: string, cwd?: string): Promise<string> {
  if (!isTauri) throw new Error("shellCommand: Tauri only");
  const { Command } = await import(/* @vite-ignore */ "@tauri-apps/plugin-shell");
  const parts = cmd.split(" ");
  const child = await Command.create(parts[0], parts.slice(1), cwd ? { cwd } : undefined).execute();
  return child.stdout;
}

export async function hideWindow(): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWindow } = await import(/* @vite-ignore */ "@tauri-apps/api/window");
  await getCurrentWindow().hide();
}

export async function showWindow(): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWindow } = await import(/* @vite-ignore */ "@tauri-apps/api/window");
  const win = getCurrentWindow();
  await win.show(); await win.setFocus();
}

export async function setAutostart(enable: boolean): Promise<void> {
  if (!isTauri) return;
  try {
    const mod = await import(/* @vite-ignore */ "@tauri-apps/plugin-autostart");
    if (enable) await mod.enable(); else await mod.disable();
  } catch { /* plugin not installed */ }
}

export async function sendNotification(title: string, body: string): Promise<void> {
  if (isTauri) {
    try {
      const { sendNotification: notify } =
        await import(/* @vite-ignore */ "@tauri-apps/plugin-notification");
      await notify({ title, body });
    } catch { /* non-fatal */ }
    return;
  }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}
