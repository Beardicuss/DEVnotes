import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useAppStore } from "@/stores/useAppStore";
import { setAutostart } from "@/utils/platform";
import { RESOLUTIONS, applyResolution, type ResolutionKey } from "@/utils/resolution";

import CalendarSettings from "./CalendarSettings";
import s from "./TabSettings.module.css";
import BackupDialog from "@/components/backup/BackupDialog";
import HotkeyInput from "./HotkeyInput";
import UpdateChecker from "./UpdateChecker";

import FaqSection from "./FaqSection";

const SECTIONS = [
  "General", "Window / Resolution", "Appearance", "Fonts",
  "Language", "Calendar", "GitHub Sync", "IDE", "Hotkeys", "Data", "AI Engines", "FAQ", "About",
] as const;
type Section = typeof SECTIONS[number];

export default function TabSettings() {
  const { t } = useTranslation();
  const settings = useAppStore((st) => st.data.settings);
  const updateSettings = useAppStore((st) => st.updateSettings);
  const [active, setActive] = useState<Section>("General");
  const [tokenInput, setTokenInput] = useState(settings.githubToken ?? "");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  const set = (patch: Partial<typeof settings>) => updateSettings(patch);

  const handleResolutionChange = async (key: ResolutionKey) => {
    set({ resolution: key });
    await applyResolution(key);
  };

  const verifyToken = async () => {
    setVerifying(true);
    try {
      const r = await fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${tokenInput}` },
      });
      setVerified(r.ok);
      if (r.ok) set({ githubToken: tokenInput });
    } catch { setVerified(false); }
    setVerifying(false);
  };

  const storeSyncNow = useAppStore((st) => st.syncNow);
  const syncNow = async () => {
    setSyncing(true);
    try { await storeSyncNow(); } catch { }
    setSyncing(false);
  };

  return (
    <div className={s.root}>
      {/* Nav */}
      <nav className={s.nav}>
        {SECTIONS.map((sec) => (
          <button
            key={sec}
            className={`${s.navItem} ${active === sec ? s.navActive : ""}`}
            onClick={() => setActive(sec)}
          >
            {t(`settings.sections.${sec.toLowerCase().split(" ")[0]}`)}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className={s.content}>

        {/* ── General ── */}
        {active === "General" && (
          <>
            <h2 className={s.title}>{t("settings.general.title")}</h2>
            <Row label={t("settings.general.launchAtStartup")}>
              <Toggle checked={settings.launchAtStartup} onChange={(v) => { set({ launchAtStartup: v }); setAutostart(v); }} />
            </Row>
            <Row label={t("settings.general.minimizeToTray")}>
              <Toggle checked={settings.minimizeToTray} onChange={(v) => set({ minimizeToTray: v })} />
            </Row>
            <Row label={t("settings.general.startMinimized")}>
              <Toggle checked={settings.startMinimized} onChange={(v) => set({ startMinimized: v })} />
            </Row>
            <Row label={t("settings.general.autoDetectIDE")}>
              <Toggle checked={settings.autoDetectIDE} onChange={(v) => set({ autoDetectIDE: v })} />
            </Row>
            <Row label={t("settings.general.confirmDelete")}>
              <Toggle checked={settings.confirmDelete} onChange={(v) => set({ confirmDelete: v })} />
            </Row>
            <Row label={t("settings.general.autosaveDelay")}>
              <select className="input" style={{ width: "10em" }}
                value={settings.autosaveDelayMs}
                onChange={(e) => set({ autosaveDelayMs: Number(e.target.value) })}>
                {[500, 800, 1500, 3000].map((v) => <option key={v} value={v}>{v}ms</option>)}
              </select>
            </Row>
          </>
        )}

        {/* ── Window / Resolution ── */}
        {active === "Window / Resolution" && (
          <>
            <h2 className={s.title}>{t("settings.window.title")}</h2>
            <p className={s.desc}>
              {t("settings.window.desc")}
            </p>

            <div className={s.resGrid}>
              {RESOLUTIONS.map((r) => {
                const current = (settings.resolution ?? "fhd") === r.key;
                return (
                  <button
                    key={r.key}
                    className={`${s.resCard} ${current ? s.resCardActive : ""}`}
                    onClick={() => handleResolutionChange(r.key)}
                  >
                    <span className={s.resLabel}>{r.label}</span>
                    <span className={s.resSub}>{r.subLabel}</span>
                    <span className={s.resFontSize}>{r.fontSize}{t("settings.window.base")}</span>
                    {current && <span className={s.resCheck}>{t("settings.window.active")}</span>}
                  </button>
                );
              })}
            </div>

            <div className={s.resHint}>
              <span className={s.resHintIcon}>ℹ</span>
              {t("settings.window.hint")}
            </div>
          </>
        )}

        {/* ── Appearance ── */}
        {active === "Appearance" && (
          <>
            <h2 className={s.title}>{t("settings.appearance.title")}</h2>
            <Row label={t("settings.appearance.theme")}>
              <select className="input" style={{ width: "14em" }}
                value={settings.theme}
                onChange={(e) => set({ theme: e.target.value as import("@/types").Theme })}>
                <option value="softcurse-dark">Softcurse Dark</option>
                <option value="light">Softcurse Light</option>
              </select>
            </Row>
            <Row label={t("settings.appearance.showGridBg")}>
              <Toggle checked={settings.showGridBg} onChange={(v) => set({ showGridBg: v })} />
            </Row>
            <Row label={t("settings.appearance.glowEffects")}>
              <Toggle checked={settings.glowEffects} onChange={(v) => set({ glowEffects: v })} />
            </Row>
          </>
        )}

        {/* ── Fonts ── */}
        {active === "Fonts" && (
          <>
            <h2 className={s.title}>{t("settings.fonts.title")}</h2>
            <Row label={t("settings.fonts.uiFont")}>
              <select className="input" style={{ width: "18em" }}
                value={settings.uiFont || ""}
                onChange={(e) => set({ uiFont: e.target.value })}>
                <option value="">System Default</option>
                <option value="Share Tech Mono">Share Tech Mono</option>
                <option value="Rajdhani">Rajdhani</option>
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Orbitron">Orbitron</option>
                <option value="Courier New">Courier New</option>
              </select>
            </Row>
            <Row label={t("settings.fonts.codeFont")}>
              <select className="input" style={{ width: "18em" }}
                value={settings.codeFont || ""}
                onChange={(e) => set({ codeFont: e.target.value })}>
                <option value="">System Default</option>
                <option value="Fira Code">Fira Code</option>
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Share Tech Mono">Share Tech Mono</option>
                <option value="Courier New">Courier New</option>
                <option value="Consolas">Consolas</option>
              </select>
            </Row>
            <Row label={t("settings.fonts.lineHeight")}>
              <select className="input" style={{ width: "10em" }}
                value={settings.lineHeight}
                onChange={(e) => set({ lineHeight: e.target.value as "compact" | "normal" | "relaxed" })}>
                <option value="compact">{t("settings.fonts.compact")}</option>
                <option value="normal">{t("settings.fonts.normal")}</option>
                <option value="relaxed">{t("settings.fonts.relaxed")}</option>
              </select>
            </Row>
            <div className={s.fontPreview} style={{ fontFamily: settings.uiFont }}>
              The quick brown fox — AaBbCcDd 0123456789
            </div>
          </>
        )}

        {/* ── Language ── */}
        {active === "Language" && (
          <>
            <h2 className={s.title}>{t("settings.language.title")}</h2>
            <Row label={t("settings.language.language")}>
              <select className="input" style={{ width: "12em" }}
                value={settings.locale}
                onChange={(e) => { const loc = e.target.value; set({ locale: loc as import("@/types").Locale }); i18n.changeLanguage(loc); }}>
                <option value="en">English</option>
                <option value="ru">Русский</option>
                <option value="ge">ქართული</option>
              </select>
            </Row>
            <Row label={t("settings.language.dateFormat")}>
              <select className="input" style={{ width: "12em" }}
                value={settings.dateFormat}
                onChange={(e) => set({ dateFormat: e.target.value as import("@/types").DateFormat })}>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </Row>
            <Row label={t("settings.language.24hourClock")}>
              <Toggle checked={settings.timeFormat === "24h"} onChange={(v) => set({ timeFormat: v ? "24h" : "12h" })} />
            </Row>
          </>
        )}

        {/* ── Calendar ── */}
        {active === "Calendar" && (
          <>
            <h2 className={s.title}>{t("settings.calendar.title")}</h2>
            <CalendarSettings />
          </>
        )}

        {/* ── GitHub Sync ── */}
        {active === "GitHub Sync" && (
          <>
            <h2 className={s.title}>{t("settings.github.title")}</h2>
            <p className={s.desc}>
              {t("settings.github.desc1")}
              <strong>github.com/settings/tokens</strong> {t("settings.github.desc2")}
            </p>
            <Row label={t("settings.github.enableSync")}>
              <Toggle checked={settings.githubSyncEnabled} onChange={(v) => set({ githubSyncEnabled: v })} />
            </Row>
            <Row label={t("settings.github.pat")}>
              <div style={{ display: "flex", gap: "0.5em", flex: 1 }}>
                <input className="input" type="password" style={{ flex: 1 }}
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)} />
                <button className="btn" onClick={verifyToken} disabled={verifying}>
                  {verifying ? "…" : t("settings.github.verify")}
                </button>
              </div>
            </Row>
            {verified === true && <p style={{ color: "var(--green)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", marginTop: "0.5em" }}>✓ {t("settings.github.tokenValid")}</p>}
            {verified === false && <p style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", marginTop: "0.5em" }}>✗ {t("settings.github.tokenInvalid")}</p>}
            <Row label={t("settings.github.gistId")}>
              <input className="input"
                placeholder={t("settings.github.gistIdPlaceholder")}
                value={settings.githubGistId ?? ""}
                onChange={(e) => set({ githubGistId: e.target.value })} />
            </Row>
            <Row label={t("settings.github.syncFrequency")}>
              <select className="input" style={{ width: "12em" }}
                value={settings.githubSyncFrequency}
                onChange={(e) => set({ githubSyncFrequency: e.target.value as import("@/types").SyncFrequency })}>
                <option value="on-save">{t("settings.github.frequency.on-save")}</option>
                <option value="hourly">{t("settings.github.frequency.hourly")}</option>
                <option value="manual">{t("settings.github.frequency.manual")}</option>
              </select>
            </Row>
            <div style={{ marginTop: "1.5em" }}>
              <button className="btn btn-primary" onClick={syncNow} disabled={syncing || !settings.githubSyncEnabled}>
                {syncing ? t("sync.syncing") : "↑ " + t("settings.github.syncNow")}
              </button>
            </div>
          </>
        )}

        {/* ── IDE ── */}
        {active === "IDE" && (
          <>
            <h2 className={s.title}>{t("settings.ide.title")}</h2>
            <Row label={t("settings.ide.vscodePath")}>
              <input className="input" placeholder={t("settings.ide.placeholder.code")} value={settings.vscodePath ?? ""} onChange={(e) => set({ vscodePath: e.target.value })} />
            </Row>
            <Row label={t("settings.ide.vstudioPath")}>
              <input className="input" placeholder={t("settings.ide.placeholder.devenv")} value={settings.vstudioPath ?? ""} onChange={(e) => set({ vstudioPath: e.target.value })} />
            </Row>
            <Row label={t("settings.ide.terminal")}>
              <input className="input" placeholder={t("settings.ide.placeholder.cmd")} value={settings.terminal ?? ""} onChange={(e) => set({ terminal: e.target.value as import("@/types").TerminalType })} />
            </Row>
            <Row label={t("settings.ide.gitPath")}>
              <input className="input" placeholder={t("settings.ide.placeholder.git")} value={settings.gitPath ?? ""} onChange={(e) => set({ gitPath: e.target.value })} />
            </Row>
          </>
        )}

        {/* ── Hotkeys ── */}
        {active === "Hotkeys" && (
          <>
            <h2 className={s.title}>{t("settings.hotkeys.title")}</h2>
            <p className={s.desc} style={{ marginBottom: "1em" }}>
              {t("settings.hotkeys.desc1")}
            </p>
            <table className={s.hotkeyTable}>
              <tbody>
                {([
                  ["hotkeyGlobalShow", t("settings.hotkeys.hotkeyGlobalShow")],
                  ["hotkeyQuickCapture", t("settings.hotkeys.hotkeyQuickCapture")],
                  ["hotkeyNewNote", t("settings.hotkeys.hotkeyNewNote")],
                  ["hotkeyNewTask", t("settings.hotkeys.hotkeyNewTask")],
                ] as [keyof typeof settings, string][]).map(([field, desc]) => (
                  <tr key={field}>
                    <td className={s.keyAction}>{desc}</td>
                    <td>
                      <HotkeyInput
                        value={(settings[field] as string) ?? ""}
                        onChange={(v) => set({ [field]: v } as Partial<typeof settings>)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={s.desc} style={{ marginTop: "1em" }}>
              {t("settings.hotkeys.desc2")}
            </p>
          </>
        )}

        {/* ── Data ── */}
        {active === "Data" && (
          <>
            <h2 className={s.title}>{t("settings.data.title")}</h2>
            <Row label={t("settings.data.autoBackup")}>
              <Toggle checked={settings.autoBackup} onChange={(v) => set({ autoBackup: v })} />
            </Row>
            <Row label={t("settings.data.keepLastN")}>
              <select className="input" style={{ width: "8em" }} value={settings.backupCount}
                onChange={(e) => set({ backupCount: Number(e.target.value) })}>
                {[3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Row>
            <Row label={t("settings.data.backupRestore")}>
              <button className="btn" onClick={() => setBackupOpen(true)}>{t("settings.data.openBackupManager")}</button>
            </Row>
            <p className={s.desc} style={{ marginTop: "1em" }}>
              {t("settings.data.dataFile")}
            </p>
            {backupOpen && <BackupDialog onClose={() => setBackupOpen(false)} />}
          </>
        )}

        {/* ── AI Engines ── */}
        {active === "AI Engines" && (
          <>
            <h2 className={s.title}>{t("settings.ai.title")}</h2>
            <p className={s.desc} style={{ marginBottom: "1.5em" }}>
              {t("settings.ai.desc")}
            </p>

            <h3 style={{ fontSize: "var(--fs-xs)", color: "var(--cyan)", marginTop: "1em", marginBottom: "0.5em" }}>{t("settings.ai.primary")}</h3>
            <Row label={t("settings.ai.apiKey")}>
              <input className="input" style={{ width: "24em" }} type="password"
                placeholder="gsk_..." value={settings.groqApiKey ?? ""}
                onChange={(e) => set({ groqApiKey: e.target.value })} />
            </Row>
            <Row label={t("settings.ai.modelId")}>
              <input className="input" style={{ width: "24em" }}
                placeholder="llama-3.3-70b-versatile" value={settings.groqModel ?? ""}
                onChange={(e) => set({ groqModel: e.target.value })} />
            </Row>

            <h3 style={{ fontSize: "var(--fs-xs)", color: "var(--purple)", marginTop: "2em", marginBottom: "0.5em" }}>{t("settings.ai.fallback")}</h3>
            <Row label={t("settings.ai.apiKey")}>
              <input className="input" style={{ width: "24em" }} type="password"
                placeholder="AIza..." value={settings.geminiApiKey ?? ""}
                onChange={(e) => set({ geminiApiKey: e.target.value })} />
            </Row>
            <Row label={t("settings.ai.modelId")}>
              <input className="input" style={{ width: "24em" }}
                placeholder="gemini-1.5-flash" value={settings.geminiModel ?? ""}
                onChange={(e) => set({ geminiModel: e.target.value })} />
            </Row>
          </>
        )}

        {/* ── About ── */}
        {active === "About" && (
          <>
            <h2 className={s.title}>{t("settings.about.title")}</h2>
            <div className={s.aboutBlock}>
              <div className={s.aboutName}>DEVNOTES</div>
              <div className={s.aboutSub}>{t("settings.about.edition")} · v1.0.0</div>
              <div className={s.aboutStack}>{t("settings.about.stack1")}</div>
              <div className={s.aboutStack} style={{ marginTop: "0.4em" }}>{t("settings.about.stack2")}</div>
            </div>
            <UpdateChecker />
          </>
        )}

        {/* ── FAQ ── */}
        {active === "FAQ" && <FaqSection />}

      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1em", marginBottom: "1.1em", flexWrap: "wrap" }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)",
        color: "var(--text-dim)", minWidth: "14em", flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: "3em", height: "1.6em", position: "relative",
        background: checked ? "var(--cyan)" : "var(--bg-input)",
        border: "1px solid " + (checked ? "var(--cyan)" : "var(--border)"),
        cursor: "pointer", transition: "all var(--t-base)",
        flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: "50%", transform: `translateY(-50%) translateX(${checked ? "1.4em" : "0.2em"})`,
        width: "1em", height: "1em",
        background: checked ? "var(--text-on-accent)" : "var(--text-dim)",
        transition: "all var(--t-base)",
        display: "block",
      }} />
    </button>
  );
}
