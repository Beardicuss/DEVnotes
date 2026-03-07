import { useState, useEffect } from "react";
import { getGitStatus } from "@/integrations/ide/detector";
import { useAppStore, selActiveProject } from "@/stores/useAppStore";

interface GitStatus {
  branch:     string;
  dirty:      boolean;
  lastCommit: string;
}

/** Returns git status for the active project, refreshes every 30s. */
export function useGitStatus(): GitStatus | null {
  const project = useAppStore(selActiveProject);
  const [status, setStatus] = useState<GitStatus | null>(null);

  useEffect(() => {
    if (!project?.rootPath) { setStatus(null); return; }

    let cancelled = false;
    const fetch = async () => {
      const s = await getGitStatus(project.rootPath!);
      if (!cancelled) setStatus(s);
    };

    fetch();
    const id = setInterval(fetch, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [project?.rootPath]);

  return status;
}
