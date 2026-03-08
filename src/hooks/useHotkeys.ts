import { useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";
import type { ProjectTab } from "@/types";

const TAB_ORDER: ProjectTab[] = ["dashboard","plan","notes","todos","tasks","mindmap","tools"];

export function useHotkeys() {
  const setTab            = useAppStore((s) => s.setTab);
  const addNote           = useAppStore((s) => s.addNote);
  const selectNote        = useAppStore((s) => s.selectNote);
  const openQuickCapture  = useAppStore((s) => s.openQuickCapture);
  const closeQuickCapture = useAppStore((s) => s.closeQuickCapture);
  const addProject        = useAppStore((s) => s.addProject);
  const save              = useAppStore((s) => s.save);
  const activeProjectId   = useAppStore((s) => s.activeProjectId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      // Ctrl+1–7 → switch tabs
      const num = parseInt(e.key);
      if (num >= 1 && num <= 7 && TAB_ORDER[num - 1]) {
        e.preventDefault();
        if (activeProjectId) setTab(TAB_ORDER[num - 1]);
        return;
      }

      switch (e.key) {
        case "n":
          e.preventDefault();
          if (activeProjectId) { setTab("notes"); const id = addNote(); selectNote(id); }
          break;
        case "t":
          if (!e.shiftKey) { e.preventDefault(); if (activeProjectId) setTab("tasks"); }
          break;
        case " ":
          if (e.shiftKey) { e.preventDefault(); openQuickCapture(); }
          break;
        case "N":
          if (e.shiftKey) { e.preventDefault(); addProject({}); }
          break;
        case "s":
          e.preventDefault();
          save();
          break;
        case "Escape":
          closeQuickCapture();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeProjectId, setTab, addNote, selectNote, openQuickCapture, closeQuickCapture, addProject, save]);
}
