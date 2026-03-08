import { useState, useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useGitStatus } from "@/hooks/useGitStatus";
import { getPreset } from "@/utils/resolution";
import s from "./StatusBar.module.css";

export default function StatusBar() {
  const projects       = useAppStore((st) => st.data.projects);
  const activeId       = useAppStore((st) => st.activeProjectId);
  const syncState      = useAppStore((st) => st.syncState);
  const ghEnabled      = useAppStore((st) => st.data.settings.githubSyncEnabled);
  const locale         = useAppStore((st) => st.data.settings.locale);
  const resolution     = useAppStore((st) => st.data.settings.resolution ?? "fhd");
  const git            = useGitStatus();

  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 8));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toTimeString().slice(0, 8)), 1000);
    return () => clearInterval(t);
  }, []);

  const project = projects.find((p) => p.id === activeId);
  const preset  = getPreset(resolution);

  return (
    <footer className={s.bar}>
      <div className={s.left}>
        {project ? (
          <span className={s.projLabel}>
            <span className={s.dot} style={{ color: project.colour }}>●</span>
            <span className={s.projName}>{project.name}</span>
            {project.status !== "active" && (
              <span className={s.statusTag}>{project.status}</span>
            )}
          </span>
        ) : (
          <span className={s.noProj}>No project selected</span>
        )}

        {git && (
          <span className={`${s.gitInfo} ${git.dirty ? s.gitDirty : ""}`}>
            ⎇ {git.branch}{git.dirty ? " ●" : " ✓"}
          </span>
        )}
      </div>

      <div className={s.right}>
        {ghEnabled && (
          <span className={`${s.syncStatus} sync-${syncState.status}`}>
            {syncState.status === "syncing" ? "↻ syncing" :
             syncState.status === "success" ? "✓ synced"  :
             syncState.status === "error"   ? "⚠ sync err": "⬡ gist"}
          </span>
        )}
        <span className={s.resolution}>{preset.label} {preset.subLabel}</span>
        <span className={s.locale}>{locale.toUpperCase()}</span>
        <span className={s.clock}>{time}</span>
      </div>
    </footer>
  );
}
