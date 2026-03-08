import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Tauri sets TAURI_ENV_PLATFORM during `tauri build` / `tauri dev`
const isTauriBuild = !!process.env.TAURI_ENV_PLATFORM;

// Only stub Tauri packages when running plain `vite dev` in browser mode.
// During actual Tauri builds, the real packages must resolve normally.
const TAURI_STUBS = isTauriBuild ? [] : [
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
    target: isTauriBuild ? ["es2021", "chrome105", "safari13"] : "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: "dist",
    emptyOutDir: true,
  },

  envPrefix: ["VITE_", "TAURI_"],
}));
