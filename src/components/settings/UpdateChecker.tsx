import { useState } from "react";
import s from "./UpdateChecker.module.css";

type State = "idle" | "checking" | "up-to-date" | "available" | "error";

const CURRENT_VERSION = "1.0.0";

export default function UpdateChecker() {
  const [state,   setState]   = useState<State>("idle");
  const [newVer,  setNewVer]  = useState<string | null>(null);
  const [notes,   setNotes]   = useState<string | null>(null);
  const [err,     setErr]     = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  const checkForUpdates = async () => {
    setState("checking"); setErr(null); setNewVer(null);

    const isTauri = "__TAURI_INTERNALS__" in window;

    if (isTauri) {
      try {
        const { check } = await import(/* @vite-ignore */ "@tauri-apps/plugin-updater");
        const update = await check();
        if (update?.available) {
          setState("available");
          setNewVer(update.version ?? "unknown");
          setNotes(update.body ?? null);
        } else {
          setState("up-to-date");
        }
        return;
      } catch (e: any) {
        // Updater not configured yet — show friendly message
        setErr("Updater not configured. See INSTALLER.md to set up auto-updates.");
        setState("error");
        return;
      }
    }

    // Browser mode — simulate check
    await new Promise((r) => setTimeout(r, 800));
    setState("up-to-date");
  };

  const installUpdate = async () => {
    setInstalling(true);
    try {
      const { check } = await import(/* @vite-ignore */ "@tauri-apps/plugin-updater");
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        // App will relaunch automatically
      }
    } catch (e: any) {
      setErr(`Install failed: ${e?.message}`);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className={s.wrap}>
      <div className={s.row}>
        <div className={s.verInfo}>
          <span className={s.label}>Current version</span>
          <span className={s.ver}>v{CURRENT_VERSION}</span>
        </div>
        <button className="btn" onClick={checkForUpdates} disabled={state === "checking"}>
          {state === "checking" ? "Checking…" : "Check for Updates"}
        </button>
      </div>

      {state === "up-to-date" && (
        <div className={s.ok}>✓ You're on the latest version.</div>
      )}

      {state === "available" && newVer && (
        <div className={s.updateCard}>
          <div className={s.updateHeader}>
            <span className={s.updateLabel}>🎉 Update available: v{newVer}</span>
          </div>
          {notes && <p className={s.updateNotes}>{notes}</p>}
          <button className="btn btn-primary" onClick={installUpdate} disabled={installing}>
            {installing ? "Installing…" : "Install & Restart"}
          </button>
        </div>
      )}

      {state === "error" && err && (
        <div className={s.err}>⚠ {err}</div>
      )}
    </div>
  );
}
