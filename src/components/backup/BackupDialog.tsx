import { useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import s from "./BackupDialog.module.css";

type Tab = "backup" | "restore";

export default function BackupDialog({ onClose }: { onClose: () => void }) {
  const data           = useAppStore((s) => s.data);
  const settings       = useAppStore((s) => s.data.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const init           = useAppStore((s) => s.init);

  const [tab,     setTab]     = useState<Tab>("backup");
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isTauri = "__TAURI_INTERNALS__" in window;

  // ── Backup ─────────────────────────────────────────────────────

  const handleBackup = async () => {
    setLoading(true); setMsg(null);
    try {
      const json = JSON.stringify(data, null, 2);
      const filename = `devnotes-backup-${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.json`;

      if (isTauri) {
        const { save }          = await import(/* @vite-ignore */ "@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import(/* @vite-ignore */ "@tauri-apps/plugin-fs");
        const path = await save({ defaultPath: filename, filters: [{ name: "JSON", extensions: ["json"] }] });
        if (path) { await writeTextFile(path, json); setMsg({ text: `Saved to ${path}`, ok: true }); }
      } else {
        const blob = new Blob([json], { type: "application/json" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        setMsg({ text: "Backup downloaded.", ok: true });
      }
    } catch (e: any) {
      setMsg({ text: `Backup failed: ${e?.message}`, ok: false });
    } finally { setLoading(false); }
  };

  // ── Restore ────────────────────────────────────────────────────

  const handleRestore = async (json: string) => {
    setLoading(true); setMsg(null);
    try {
      const parsed = JSON.parse(json);
      if (!parsed.version || !parsed.projects) throw new Error("Invalid backup file.");

      // Patch missing Phase 4/5 fields
      parsed.decisions = parsed.decisions ?? [];
      parsed.standups  = parsed.standups  ?? [];
      parsed.pomodoros = parsed.pomodoros ?? [];

      // Save to storage
      if (isTauri) {
        const { writeTextFile } = await import(/* @vite-ignore */ "@tauri-apps/plugin-fs");
        const { invoke } = await import(/* @vite-ignore */ "@tauri-apps/api/core");
        const dataPath: string = await invoke("get_app_data_path");
        await writeTextFile(`${dataPath}\\data.json`, JSON.stringify(parsed));
      } else {
        localStorage.setItem("devnotes_desktop_v2", JSON.stringify(parsed));
      }

      setMsg({ text: "Restore successful! Reloading…", ok: true });
      setTimeout(() => { window.location.reload(); }, 1200);
    } catch (e: any) {
      setMsg({ text: `Restore failed: ${e?.message}`, ok: false });
    } finally { setLoading(false); }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleRestore(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleRestore(ev.target?.result as string);
    reader.readAsText(file);
  };

  // ── Auto-backup settings ───────────────────────────────────────
  const autoBackup  = settings.autoBackup ?? false;
  const backupCount = settings.backupCount ?? 5;

  const projectCount  = data.projects.length;
  const noteCount     = data.notes.length;
  const taskCount     = data.tasks.length;
  const sizeEstimate  = Math.round(JSON.stringify(data).length / 1024);

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.header}>
          <span className={s.title}>DATA & BACKUP</span>
          <button className={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className={s.tabs}>
          <button className={`${s.tab} ${tab==="backup"  ? s.tabActive:""}`} onClick={() => setTab("backup")}>Backup</button>
          <button className={`${s.tab} ${tab==="restore" ? s.tabActive:""}`} onClick={() => setTab("restore")}>Restore</button>
        </div>

        <div className={s.body}>
          {tab === "backup" && (
            <div className={s.section}>
              {/* Data summary */}
              <div className={s.summary}>
                <div className={s.summaryItem}><span className={s.summaryVal}>{projectCount}</span><span className={s.summaryKey}>projects</span></div>
                <div className={s.summaryItem}><span className={s.summaryVal}>{noteCount}</span><span className={s.summaryKey}>notes</span></div>
                <div className={s.summaryItem}><span className={s.summaryVal}>{taskCount}</span><span className={s.summaryKey}>tasks</span></div>
                <div className={s.summaryItem}><span className={s.summaryVal}>{sizeEstimate} KB</span><span className={s.summaryKey}>data size</span></div>
              </div>

              <p className={s.desc}>Export your entire DevNotes database as a JSON file. Keep a copy somewhere safe.</p>

              <button className="btn btn-primary" onClick={handleBackup} disabled={loading}>
                {loading ? "Saving…" : "⬇ Download Backup"}
              </button>

              {/* Auto-backup settings */}
              <div className={s.autoSection}>
                <div className={s.autoHeader}>Auto-Backup</div>
                <label className={s.toggle}>
                  <input type="checkbox" checked={autoBackup}
                    onChange={(e) => updateSettings({ autoBackup: e.target.checked })} />
                  Auto-backup on every save
                </label>
                <div className={s.row}>
                  <label className={s.fieldLabel}>Keep last</label>
                  <select className="input" style={{ width:"7em" }} value={backupCount}
                    onChange={(e) => updateSettings({ backupCount: Number(e.target.value) })}>
                    {[3,5,10,20,50].map((n) => <option key={n} value={n}>{n} backups</option>)}
                  </select>
                </div>
                {isTauri && (
                  <p className={s.autoPath}>
                    Auto-backups saved to: <code>%APPDATA%\DevNotes\backups\</code>
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === "restore" && (
            <div className={s.section}>
              <p className={s.desc}>
                Restore from a previously exported backup file. <strong>This will replace all current data.</strong>
              </p>

              {/* Drop zone */}
              <label
                className={`${s.dropZone} ${dragOver ? s.dropActive : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}>
                <input type="file" accept=".json" style={{ display:"none" }} onChange={handleFileInput} />
                <span className={s.dropIcon}>📂</span>
                <span className={s.dropLabel}>Drop backup .json here or click to browse</span>
                <span className={s.dropSub}>Only DevNotes backup files are accepted</span>
              </label>

              <div className={s.warning}>
                ⚠ Restoring will overwrite all current notes, tasks, and settings. Make a backup first if needed.
              </div>
            </div>
          )}

          {msg && (
            <div className={`${s.msg} ${msg.ok ? s.msgOk : s.msgErr}`}>
              {msg.ok ? "✓" : "✗"} {msg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
