/**
 * tauri-stub.ts — no-op stubs for ALL Tauri packages.
 * Used only in browser dev mode. Tauri runtime provides real implementations.
 * Every export is a silent async no-op so nothing throws in browser mode.
 */

const noop   = async (..._args: any[]) => {};
const noopFn = (..._args: any[]) => {};

// @tauri-apps/plugin-autostart
export const enable   = noop;
export const disable  = noop;
export const isEnabled = async () => false;

// @tauri-apps/plugin-notification
export const sendNotification    = noop;
export const isPermissionGranted = async () => false;
export const requestPermission   = async () => "denied";

// @tauri-apps/plugin-global-shortcut
export const register   = noop;
export const unregister = noop;
export const schedule   = noop;

// @tauri-apps/plugin-updater
export const checkUpdate   = async () => ({ available: false });
export const installUpdate = noop;

// @tauri-apps/plugin-dialog  (save/open file dialogs)
export const save = async (..._args: any[]) => null;
export const open = async (..._args: any[]) => null;
export const message = noop;
export const ask  = async () => false;
export const confirm = async () => false;

// @tauri-apps/plugin-fs
export const readTextFile  = async () => "";
export const writeTextFile = noop;
export const mkdir         = noop;
export const exists        = async () => false;
export const remove        = noop;
export const rename        = noop;
export const readDir       = async () => [];
export const BaseDirectory = { AppData: 0, Home: 1, Download: 2 };

// @tauri-apps/plugin-shell
export const Command  = { create: () => ({ execute: async () => ({ stdout: "", stderr: "" }) }) };
// open is already exported above (reuse for shell open)

// @tauri-apps/api/window
export const getCurrentWindow = () => ({
  hide:           noop,
  show:           noop,
  setFocus:       noop,
  minimize:       noop,
  toggleMaximize: noop,
  setSize:        noop,
  center:         noop,
  setZoom:        noop,
  isVisible:      async () => true,
  onCloseRequested: noopFn,
});
export const WebviewWindow = class { constructor() {} };

// @tauri-apps/api/core
export const invoke = async (_cmd: string, _args?: any) => null;
export const convertFileSrc = (path: string) => path;
export const isTauri = () => false;

export default {};
