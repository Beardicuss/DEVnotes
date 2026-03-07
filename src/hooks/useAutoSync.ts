import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";

/** Runs hourly GitHub sync if configured. Mount once in App.tsx. */
export function useAutoSync() {
  const syncNow  = useAppStore((s) => s.syncNow);
  const settings = useAppStore((s) => s.data.settings);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    const { githubSyncEnabled, githubToken, githubSyncFrequency } = settings;

    if (githubSyncEnabled && githubToken && githubSyncFrequency === "hourly") {
      timerRef.current = setInterval(() => syncNow(), 60 * 60 * 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    settings.githubSyncEnabled,
    settings.githubToken,
    settings.githubSyncFrequency,
    syncNow,
  ]);
}
