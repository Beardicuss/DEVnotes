import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n/index";
import "./styles/theme.css";
import { applyResolution, type ResolutionKey } from "./utils/resolution";

// Apply resolution BEFORE first render so layout dimensions are correct
// from frame 1 — no layout shift.
const saved = localStorage.getItem("devnotes_desktop_v2");
let resKey: ResolutionKey = "fhd"; // default
if (saved) {
  try {
    const data = JSON.parse(saved);
    if (data?.settings?.resolution) resKey = data.settings.resolution;
  } catch {}
}
applyResolution(resKey); // sync part runs instantly (CSS vars); Tauri window resize is async

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
