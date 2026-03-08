import { useState, useEffect, useCallback } from "react";
import { useAppStore, selTools, selActiveProject } from "@/stores/useAppStore";
import {
  openInVSCode, openInVisualStudio, openInJetBrains,
  openInExplorer, openTerminal, getGitStatus, scanWorkspaceForProjects,
  autoDetectIDEPaths, type DetectedProject, type GitStatus,
} from "@/integrations/ide/detector";
import { isTauri } from "@/utils/platform";
import { uid } from "@/utils/id";
import s from "./TabTools.module.css";

export default function TabTools() {
  const project  = useAppStore(selActiveProject);
  const tools    = useAppStore(selTools);
  const settings = useAppStore((s) => s.data.settings);
  const updateTools    = useAppStore((s) => s.updateTools);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const updateProject  = useAppStore((s) => s.updateProject);

  const [git,        setGit]       = useState<GitStatus | null>(null);
  const [gitLoading, setGitLoading]= useState(false);
  const [cmdOut,     setCmdOut]    = useState<Record<string, string>>({});
  const [runningCmd, setRunning]   = useState<string | null>(null);
  const [copiedId,   setCopied]    = useState<string | null>(null);
  const [scanning,   setScanning]  = useState(false);
  const [scanResults,setScanResults] = useState<DetectedProject[]>([]);
  const [autoDetected, setAutoDetected] = useState(false);
  const [activeSection, setSection] = useState<"ide"|"git"|"cmds"|"links"|"snippets">("ide");

  if (!project) return null;
  const t = tools ?? { projectId: project.id, links: [], commands: [], snippets: [] };

  // ── Load git status ──
  const refreshGit = useCallback(async () => {
    if (!project.rootPath) return;
    setGitLoading(true);
    const status = await getGitStatus(project.rootPath);
    setGit(status);
    setGitLoading(false);
  }, [project.id, project.rootPath]);
  useEffect(() => { refreshGit(); }, [refreshGit]);

  // ── Auto-detect IDE paths ──
  const handleAutoDetect = async () => {
    const paths = await autoDetectIDEPaths();
    updateSettings({
      vscodePath:  paths.vscode  ?? settings.vscodePath,
      vstudioPath: paths.visualstudio ?? settings.vstudioPath,
      terminal:    (paths.terminal ?? settings.terminal) as import("@/types").TerminalType,
    });
    setAutoDetected(true);
    setTimeout(() => setAutoDetected(false), 2500);
  };

  // ── Scan workspace ──
  const handleScan = async () => {
    if (!project.rootPath) return;
    setScanning(true);
    const found = await scanWorkspaceForProjects(project.rootPath, 2);
    setScanResults(found);
    setScanning(false);
  };

  // ── Run command ──
  const runCmd = async (id: string, cmd: string) => {
    if (!isTauri || !project.rootPath) return;
    setRunning(id);
    try {
      const { invoke } = await import(/* @vite-ignore */ "@tauri-apps/api/core");
      const resolved = cmd.replace("{projectRoot}", project.rootPath).replace("{projectName}", project.name);
      const out = await invoke<string>("run_shell_command", { command: resolved, cwd: project.rootPath });
      setCmdOut((p) => ({ ...p, [id]: (out || "(no output)").trim().slice(0, 500) }));
    } catch (e: any) {
      setCmdOut((p) => ({ ...p, [id]: `Error: ${e.message}` }));
    }
    setRunning(null);
  };

  const copySnippet = (id: string, content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const addLink    = () => updateTools(project.id, { links:    [...t.links,    { id: uid(), label: "New Link",    url: "https://"                }] });
  const addCmd     = () => updateTools(project.id, { commands: [...t.commands, { id: uid(), label: "New Command", command: "echo {projectRoot}", runInTerminal: false }] });
  const addSnippet = () => updateTools(project.id, { snippets: [...t.snippets, { id: uid(), label: "New Snippet", content: "", language: "bash"  }] });

  const SECTIONS = [
    { id: "ide",      label: "Open In" },
    { id: "git",      label: "Git" },
    { id: "cmds",     label: "Commands" },
    { id: "links",    label: "Links" },
    { id: "snippets", label: "Snippets" },
  ] as const;

  return (
    <div className={s.root}>
      {/* Section nav */}
      <div className={s.sectionNav}>
        {SECTIONS.map((sec) => (
          <button key={sec.id}
            className={`${s.secBtn} ${activeSection === sec.id ? s.secActive : ""}`}
            onClick={() => setSection(sec.id)}>
            {sec.label}
          </button>
        ))}
        {project.rootPath && (
          <span className={s.rootPath} title={project.rootPath}>
            📁 {project.rootPath.split(/[\\/]/).slice(-2).join("/")}
          </span>
        )}
      </div>

      <div className={s.content}>
        {/* ── IDE Open In ── */}
        {activeSection === "ide" && (
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <span className={s.sectionTitle}>OPEN PROJECT IN</span>
              <button className="btn" onClick={handleAutoDetect}>
                {autoDetected ? "✓ Detected" : "⚡ Auto-detect IDE paths"}
              </button>
            </div>

            {!project.rootPath && (
              <div className={s.warn}>⚠ Set a Root Path for this project in the project settings to enable IDE buttons.</div>
            )}

            <div className={s.ideGrid}>
              <IDEButton
                label="VS Code"
                icon="⬡"
                colour="var(--blue)"
                disabled={!project.rootPath}
                onClick={() => openInVSCode(project.rootPath!, settings.vscodePath)}
              />
              <IDEButton
                label="Visual Studio"
                icon="⬢"
                colour="var(--purple)"
                disabled={!project.rootPath}
                onClick={() => openInVisualStudio(project.rootPath!, settings.vstudioPath)}
              />
              <IDEButton
                label="JetBrains"
                icon="◈"
                colour="var(--magenta)"
                disabled={!project.rootPath}
                onClick={() => openInJetBrains(project.rootPath!)}
              />
              <IDEButton
                label="Explorer"
                icon="📁"
                colour="var(--yellow)"
                disabled={!project.rootPath}
                onClick={() => openInExplorer(project.rootPath!)}
              />
              <IDEButton
                label="Terminal"
                icon=">"
                colour="var(--green)"
                disabled={!project.rootPath}
                onClick={() => openTerminal(project.rootPath!, settings.terminal as string)}
              />
            </div>

            {/* Workspace scanner */}
            <div className={s.scanSection}>
              <div className={s.sectionTitle}>WORKSPACE SCANNER</div>
              <p className={s.hint}>Scan the project root to detect sub-projects and IDE files automatically.</p>
              <button className="btn" onClick={handleScan} disabled={scanning || !project.rootPath}>
                {scanning ? "Scanning…" : "🔍 Scan for Projects"}
              </button>
              {scanResults.length > 0 && (
                <div className={s.scanResults}>
                  {scanResults.map((r) => (
                    <div key={r.rootPath} className={s.scanRow}>
                      <span className={s.scanIcon}>{r.ideType === "vscode" ? "⬡" : r.ideType === "visualstudio" ? "⬢" : "◈"}</span>
                      <span className={s.scanName}>{r.name}</span>
                      <span className={s.scanPath}>{r.rootPath.split(/[\\/]/).slice(-2).join("/")}</span>
                      <span className={s.scanType}>{r.ideType}</span>
                      <button className="btn" onClick={() => openInVSCode(r.rootPath, settings.vscodePath)}>Open</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Git status ── */}
        {activeSection === "git" && (
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <span className={s.sectionTitle}>GIT STATUS</span>
              <button className="btn" onClick={refreshGit} disabled={gitLoading}>
                {gitLoading ? "…" : "↻ Refresh"}
              </button>
            </div>
            {!project.rootPath && <div className={s.warn}>⚠ Set a Root Path to enable git status.</div>}
            {!git && project.rootPath && !gitLoading && <div className={s.empty}>Not a git repository or git not found.</div>}
            {git && (
              <div className={s.gitPanel}>
                <div className={s.gitRow}>
                  <span className={s.gitLabel}>BRANCH</span>
                  <span className={s.gitValue} style={{ color: "var(--cyan)" }}>⎇ {git.branch}</span>
                </div>
                <div className={s.gitRow}>
                  <span className={s.gitLabel}>STATUS</span>
                  <span className={s.gitValue} style={{ color: git.dirty ? "var(--yellow)" : "var(--green)" }}>
                    {git.dirty ? "● uncommitted changes" : "✓ clean"}
                  </span>
                </div>
                <div className={s.gitRow}>
                  <span className={s.gitLabel}>LAST COMMIT</span>
                  <span className={s.gitValue}>{git.lastCommit || "—"}</span>
                </div>
                <div className={s.gitRow}>
                  <span className={s.gitLabel}>AHEAD / BEHIND</span>
                  <span className={s.gitValue}>
                    <span style={{ color: "var(--green)" }}>↑{git.ahead}</span>
                    {" / "}
                    <span style={{ color: git.behind > 0 ? "var(--red)" : "var(--text-dim)" }}>↓{git.behind}</span>
                  </span>
                </div>
              </div>
            )}
            {/* Quick git commands */}
            <div className={s.sectionTitle} style={{ marginTop: "1.5em" }}>QUICK GIT COMMANDS</div>
            <div className={s.quickCmds}>
              {[
                { label: "git pull",           cmd: "git pull" },
                { label: "git fetch",          cmd: "git fetch" },
                { label: "git status",         cmd: "git status" },
                { label: "git log --oneline",  cmd: "git log --oneline -10" },
                { label: "git diff --stat",    cmd: "git diff --stat" },
              ].map((item) => (
                <button key={item.cmd} className={s.quickCmdBtn}
                  disabled={!project.rootPath || runningCmd === item.cmd}
                  onClick={() => runCmd(item.cmd, item.cmd)}>
                  {runningCmd === item.cmd ? "…" : item.label}
                </button>
              ))}
            </div>
            {Object.entries(cmdOut).map(([id, out]) => (
              <div key={id} className={s.cmdOutput}>
                <span className={s.cmdLabel}>{id}</span>
                <pre className={s.cmdPre}>{out}</pre>
              </div>
            ))}
          </div>
        )}

        {/* ── Custom commands ── */}
        {activeSection === "cmds" && (
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <span className={s.sectionTitle}>CUSTOM COMMANDS</span>
              <button className="btn btn-primary" onClick={addCmd}>+ Add</button>
            </div>
            <p className={s.hint}>Use <code>{"{projectRoot}"}</code> and <code>{"{projectName}"}</code> as placeholders.</p>
            {t.commands.map((cmd) => (
              <div key={cmd.id} className={s.itemRow}>
                <div className={s.itemFields}>
                  <input className="input" value={cmd.label} placeholder="Label"
                    onChange={(e) => updateTools(project.id, {
                      commands: t.commands.map((c) => c.id===cmd.id ? {...c, label: e.target.value} : c)
                    })} />
                  <input className="input" value={cmd.command} placeholder="command {projectRoot}"
                    style={{ flex: 2, fontFamily: "var(--font-code)" }}
                    onChange={(e) => updateTools(project.id, {
                      commands: t.commands.map((c) => c.id===cmd.id ? {...c, command: e.target.value} : c)
                    })} />
                </div>
                <button className="btn btn-primary" style={{ flexShrink: 0 }}
                  disabled={runningCmd===cmd.id || !project.rootPath}
                  onClick={() => runCmd(cmd.id, cmd.command)}>
                  {runningCmd===cmd.id ? "…" : "▶ Run"}
                </button>
                <button className={`btn btn-danger`} style={{ flexShrink: 0 }}
                  onClick={() => updateTools(project.id, { commands: t.commands.filter((c) => c.id!==cmd.id) })}>
                  ✕
                </button>
                {cmdOut[cmd.id] && (
                  <div className={s.cmdOutput} style={{ gridColumn: "1/-1" }}>
                    <pre className={s.cmdPre}>{cmdOut[cmd.id]}</pre>
                  </div>
                )}
              </div>
            ))}
            {!t.commands.length && <div className={s.empty}>No custom commands yet. Click + Add.</div>}
          </div>
        )}

        {/* ── Links ── */}
        {activeSection === "links" && (
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <span className={s.sectionTitle}>PROJECT LINKS</span>
              <button className="btn btn-primary" onClick={addLink}>+ Add</button>
            </div>
            {t.links.map((link) => (
              <div key={link.id} className={s.itemRow}>
                <input className="input" value={link.label} placeholder="Label" style={{ width: "10em" }}
                  onChange={(e) => updateTools(project.id, {
                    links: t.links.map((l) => l.id===link.id ? {...l, label: e.target.value} : l)
                  })} />
                <input className="input" value={link.url} placeholder="https://" style={{ flex:1 }}
                  onChange={(e) => updateTools(project.id, {
                    links: t.links.map((l) => l.id===link.id ? {...l, url: e.target.value} : l)
                  })} />
                <button className="btn" onClick={async () => { const { shellOpen } = await import("@/utils/platform"); shellOpen(link.url); }}>
                  ↗ Open
                </button>
                <button className="btn btn-danger"
                  onClick={() => updateTools(project.id, { links: t.links.filter((l) => l.id!==link.id) })}>
                  ✕
                </button>
              </div>
            ))}
            {!t.links.length && <div className={s.empty}>No links yet. Click + Add.</div>}
          </div>
        )}

        {/* ── Snippets ── */}
        {activeSection === "snippets" && (
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <span className={s.sectionTitle}>CODE SNIPPETS</span>
              <button className="btn btn-primary" onClick={addSnippet}>+ Add</button>
            </div>
            {t.snippets.map((sn) => (
              <div key={sn.id} className={s.snippetRow}>
                <div className={s.snippetHeader}>
                  <input className="input" value={sn.label} placeholder="Snippet name" style={{ flex:1 }}
                    onChange={(e) => updateTools(project.id, {
                      snippets: t.snippets.map((s) => s.id===sn.id ? {...s, label: e.target.value} : s)
                    })} />
                  <select className="input" style={{ width:"9em" }} value={sn.language}
                    onChange={(e) => updateTools(project.id, {
                      snippets: t.snippets.map((s) => s.id===sn.id ? {...s, language: e.target.value} : s)
                    })}>
                    {["bash","powershell","typescript","javascript","python","rust","sql","json","markdown"].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <button className="btn" onClick={() => copySnippet(sn.id, sn.content)}>
                    {copiedId===sn.id ? "✓ Copied" : "⎘ Copy"}
                  </button>
                  <button className="btn btn-danger"
                    onClick={() => updateTools(project.id, { snippets: t.snippets.filter((s) => s.id!==sn.id) })}>
                    ✕
                  </button>
                </div>
                <textarea className={`input ${s.snippetBody}`} rows={5} value={sn.content}
                  placeholder="Paste your snippet here…"
                  onChange={(e) => updateTools(project.id, {
                    snippets: t.snippets.map((s) => s.id===sn.id ? {...s, content: e.target.value} : s)
                  })} />
              </div>
            ))}
            {!t.snippets.length && <div className={s.empty}>No snippets yet. Click + Add.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function IDEButton({ label, icon, colour, disabled, onClick }: {
  label: string; icon: string; colour: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button className={s.ideBtn} style={{ "--ide-colour": colour } as React.CSSProperties} disabled={disabled} onClick={onClick}>
      <span className={s.ideBtnIcon} style={{ color: colour }}>{icon}</span>
      <span className={s.ideBtnLabel}>{label}</span>
    </button>
  );
}
