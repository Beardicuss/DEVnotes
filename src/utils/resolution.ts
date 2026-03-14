/**
 * Resolution presets for DevNotes Desktop.
 * 
 * Each preset defines:
 *  - The Tauri window size (logical pixels)
 *  - The base font size (px) so the UI fills the window correctly
 *  - Layout constants (titlebar height, sidebar width, etc.)
 */

export type ResolutionKey = "hd" | "hd_plus" | "fhd" | "qhd";

export interface ResolutionPreset {
  key:          ResolutionKey;
  label:        string;
  subLabel:     string;
  width:        number;
  height:       number;
  fontSize:     number;   // html base font-size in px
  titlebarH:    number;
  statusbarH:   number;
  sidebarW:     number;
  tabH:         number;
}

export const RESOLUTIONS: ResolutionPreset[] = [
  {
    key:       "hd",
    label:     "HD",
    subLabel:  "1280 × 720",
    width:     1280, height:   720,
    fontSize:  13,
    titlebarH: 38, statusbarH: 30, sidebarW: 210, tabH: 38,
  },
  {
    key:       "hd_plus",
    label:     "HD+",
    subLabel:  "1600 × 900",
    width:     1600, height:   900,
    fontSize:  15,
    titlebarH: 42, statusbarH: 34, sidebarW: 230, tabH: 42,
  },
  {
    key:       "fhd",
    label:     "Full HD",
    subLabel:  "1920 × 1080",
    width:     1920, height:  1080,
    fontSize:  16,
    titlebarH: 46, statusbarH: 36, sidebarW: 248, tabH: 46,
  },
  {
    key:       "qhd",
    label:     "QHD",
    subLabel:  "2560 × 1440",
    width:     2560, height:  1440,
    fontSize:  20,
    titlebarH: 54, statusbarH: 42, sidebarW: 290, tabH: 54,
  },
];

export const DEFAULT_RESOLUTION: ResolutionKey = "fhd";

export function getPreset(key: ResolutionKey): ResolutionPreset {
  return RESOLUTIONS.find((r) => r.key === key) ?? RESOLUTIONS[2];
}

/**
 * Apply a resolution preset to the document:
 *  1. Sets html font-size so all em/rem values scale up/down
 *  2. Sets CSS custom properties for layout dimensions
 *  3. If running inside Tauri, resizes the window to match
 */
export async function applyResolution(key: ResolutionKey): Promise<void> {
  const p    = getPreset(key);
  const root = document.documentElement;

  // 1. Base font size — everything in the UI scales off this
  root.style.fontSize = `${p.fontSize}px`;

  // 2. Layout tokens
  root.style.setProperty("--titlebar-h",  `${p.titlebarH}px`);
  root.style.setProperty("--statusbar-h", `${p.statusbarH}px`);
  root.style.setProperty("--sidebar-w",   `${p.sidebarW}px`);
  root.style.setProperty("--tab-h",       `${p.tabH}px`);

  // 3. Resize Tauri window (desktop only — silently skipped in browser)
  try {
    const { getCurrentWindow, LogicalSize } =
      await import(/* @vite-ignore */ "@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.setSize(new LogicalSize(p.width, p.height));
    await win.center();
  } catch {
    // Running in browser — no-op
  }
}
