import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// ALL Tauri-only packages that Vite must not try to resolve in browser mode.
// Any dynamic import of these — even with /* @vite-ignore */ — gets aliased
// to a harmless no-op stub. Real Tauri runtime injects the real modules.
const TAURI_STUBS = [
  "@tauri-apps/plugin-autostart",
  "@tauri-apps/plugin-notification",
  "@tauri-apps/plugin-global-shortcut",
  "@tauri-apps/plugin-updater",
  "@tauri-apps/plugin-dialog",
  "@tauri-apps/plugin-fs",
  "@tauri-apps/plugin-shell",
  "@tauri-apps/api/window",
  "@tauri-apps/api/core",
];

export default defineConfig(({ command }) => ({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ...Object.fromEntries(
        TAURI_STUBS.map((pkg) => [
          pkg,
          path.resolve(__dirname, "./src/utils/tauri-stub.ts"),
        ])
      ),
    },
  },

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },

  build: {
    target: command === "build" ? ["es2021", "chrome100", "safari13"] : "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: "dist",
    emptyOutDir: true,
  },

  envPrefix: ["VITE_", "TAURI_"],
}));
