import { useEffect } from "react";
import { isTauri } from "@/utils/platform";

/**
 * Registers the global hotkey Ctrl+Shift+D to show/hide the DevNotes window.
 * The actual toggle logic lives in Rust (lib.rs `register_global_hotkey`).
 * This hook just invokes that command once on mount and cleans up on unmount.
 */
export function useGlobalHotkey() {
  useEffect(() => {
    if (!isTauri) return;

    let mounted = true;

    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        if (mounted) await invoke("register_global_hotkey");
      } catch (e) {
        console.warn("Global hotkey registration failed:", e);
      }
    })();

    return () => {
      mounted = false;
      (async () => {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("unregister_global_hotkey");
        } catch {}
      })();
    };
  }, []);
}
