import React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import i18n from "./i18n/index";
import "./styles/theme.css";
import { applyResolution, type ResolutionKey } from "./utils/resolution";

// Apply resolution BEFORE first render
const saved = localStorage.getItem("devnotes_desktop_v2");
let resKey: ResolutionKey = "fhd";
if (saved) {
  try {
    const data = JSON.parse(saved);
    if (data?.settings?.resolution) resKey = data.settings.resolution;
  } catch {}
}
applyResolution(resKey);

// Apply saved theme before first render to prevent flash
try {
  const savedTheme = saved ? (JSON.parse(saved)?.settings?.theme ?? "softcurse-dark") : "softcurse-dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
} catch {}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </React.StrictMode>
);
