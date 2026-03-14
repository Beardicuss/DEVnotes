/**
 * IDE project detector — Phase 3 (upgraded)
 * - Auto-scans a folder for IDE project markers
 * - Opens projects in VS Code, Visual Studio, JetBrains, terminal
 * - Git status (branch, dirty, last commit, ahead/behind)
 * - Auto-detect IDE from common install paths on Windows
 */

import { isTauri, shellCommand } from "@/utils/platform";
import type { IDEType } from "@/types";

export interface DetectedProject {
  name:     string;
  rootPath: string;
  ideType:  IDEType;
  idePath:  string | null;
}

export interface GitStatus {
  branch:     string;
  dirty:      boolean;
  lastCommit: string;
  ahead:      number;
  behind:     number;
}

// ─── Project detection ────────────────────────────────────────────

export async function detectProjectAtPath(folderPath: string): Promise<DetectedProject | null> {
  if (!isTauri) return null;
  try {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    const entries = await readDir(folderPath);
    const names   = entries.map((e: any) => e.name ?? "");
    const folder  = folderPath.split(/[\\/]/).pop() ?? folderPath;

    const wsFile = names.find((n: string) => n.endsWith(".code-workspace"));
    if (wsFile) return { name: folder, rootPath: folderPath, ideType: "vscode",       idePath: wsFile };
    if (names.includes(".vscode"))
                  return { name: folder, rootPath: folderPath, ideType: "vscode",       idePath: ".vscode" };
    const sln = names.find((n: string) => n.endsWith(".sln"));
    if (sln)      return { name: sln.replace(".sln",""), rootPath: folderPath, ideType: "visualstudio", idePath: sln };
    if (names.includes(".idea"))
                  return { name: folder, rootPath: folderPath, ideType: "jetbrains",    idePath: ".idea" };
    const markers = ["package.json","Cargo.toml","pyproject.toml","go.mod","pom.xml","build.gradle"];
    if (markers.some((m) => names.includes(m)))
                  return { name: folder, rootPath: folderPath, ideType: "other",        idePath: null };
    return null;
  } catch { return null; }
}

// ─── Auto-detect IDE paths from Windows registry / common locations ─

export async function autoDetectIDEPaths(): Promise<{
  vscode: string | null;
  visualstudio: string | null;
  jetbrains: string | null;
  terminal: string | null;
}> {
  if (!isTauri) return { vscode: null, visualstudio: null, jetbrains: null, terminal: null };

  const candidates: Record<string, string[]> = {
    vscode: [
      "C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
      "C:\\Program Files\\Microsoft VS Code\\Code.exe",
    ],
    visualstudio: [
      "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\IDE\\devenv.exe",
      "C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\Common7\\IDE\\devenv.exe",
      "C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\Common7\\IDE\\devenv.exe",
    ],
    jetbrains: [
      "C:\\Program Files\\JetBrains\\IntelliJ IDEA Community Edition\\bin\\idea64.exe",
      "C:\\Program Files\\JetBrains\\Rider\\bin\\rider64.exe",
    ],
    terminal: [
      "C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminal_*\\wt.exe",
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    ],
  };

  const result: Record<string, string | null> = {
    vscode: null, visualstudio: null, jetbrains: null, terminal: null,
  };

  try {
    const { exists } = await import("@tauri-apps/plugin-fs");
    for (const [key, paths] of Object.entries(candidates)) {
      for (const p of paths) {
        try {
          if (await exists(p)) { result[key] = p; break; }
        } catch {}
      }
    }
  } catch {}

  // Fallback: assume commands are on PATH
  if (!result.vscode)       result.vscode       = "code";
  if (!result.terminal)     result.terminal     = "wt";

  return result as any;
}

// ─── Open in IDE ──────────────────────────────────────────────────

export async function openInVSCode(folderPath: string, vscodePath?: string | null): Promise<void> {
  const exe = vscodePath || "code";
  if (isTauri) await shellCommand(`"${exe}" "${folderPath}"`);
  else console.log(`open vscode: ${exe} "${folderPath}"`);
}

export async function openInVisualStudio(slnPath: string, vstudioPath?: string | null): Promise<void> {
  const exe = vstudioPath || "devenv";
  if (isTauri) await shellCommand(`"${exe}" "${slnPath}"`);
}

export async function openInJetBrains(path: string, jbPath?: string | null): Promise<void> {
  const exe = jbPath || "idea64";
  if (isTauri) await shellCommand(`"${exe}" "${path}"`);
}

export async function openInExplorer(folderPath: string): Promise<void> {
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_path_in_explorer", { path: folderPath });
  } catch {
    await shellCommand(`explorer "${folderPath}"`);
  }
}

export async function openTerminal(
  folderPath: string,
  terminal: string = "wt"
): Promise<void> {
  if (!isTauri) return;
  const cmds: Record<string, string> = {
    wt:          `wt -d "${folderPath}"`,
    powershell:  `powershell -NoExit -Command "Set-Location '${folderPath}'"`,
    cmd:         `cmd /K "cd /d ${folderPath}"`,
    "git-bash":  `"C:\\Program Files\\Git\\bin\\bash.exe" --cd="${folderPath}"`,
  };
  await shellCommand(cmds[terminal] ?? cmds["wt"]);
}

// ─── Git status (enhanced) ────────────────────────────────────────

export async function getGitStatus(rootPath: string): Promise<GitStatus | null> {
  if (!isTauri) return null;
  try {
    const [branch, statusOut, lastCommit, aheadBehind] = await Promise.all([
      shellCommand("git rev-parse --abbrev-ref HEAD",         rootPath),
      shellCommand("git status --porcelain",                  rootPath),
      shellCommand("git log -1 --format=%s",                  rootPath),
      shellCommand("git rev-list --left-right --count @{u}...HEAD", rootPath).catch(() => "0\t0"),
    ]);
    const [behind, ahead] = aheadBehind.trim().split("\t").map(Number);
    return {
      branch:     branch.trim(),
      dirty:      statusOut.trim().length > 0,
      lastCommit: lastCommit.trim().slice(0, 72),
      ahead:      ahead || 0,
      behind:     behind || 0,
    };
  } catch { return null; }
}

// ─── Scan workspace for projects ─────────────────────────────────

export async function scanWorkspaceForProjects(
  rootPath: string,
  depth: number = 2
): Promise<DetectedProject[]> {
  if (!isTauri || depth < 0) return [];
  const results: DetectedProject[] = [];
  try {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    const entries = await readDir(rootPath);
    for (const entry of entries as any[]) {
      if (!entry.children && entry.name && !entry.name.startsWith(".")) {
        const sub = `${rootPath}\\${entry.name}`;
        const proj = await detectProjectAtPath(sub);
        if (proj) results.push(proj);
        else if (depth > 1) {
          const nested = await scanWorkspaceForProjects(sub, depth - 1);
          results.push(...nested);
        }
      }
    }
  } catch {}
  return results;
}
