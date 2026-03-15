/**
 * DevNotes VS Code Extension v2 — Phase 3
 *
 * Features:
 *  - Sidebar panel: active project tasks, notes, todos
 *  - Status bar: task count + overdue indicator
 *  - Commands: New Task, New Note, Toggle Done, Open App
 *  - Auto-refresh when data.json changes (file watcher)
 *  - Quick Pick for jumping to any task/note
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Types (inline subset of DevNotes types) ──────────────────────

interface Task {
  id: string; projectId: string; title: string;
  status: string; priority: string; dueDate: string | null;
}
interface Note { id: string; projectId: string; title: string; tags: string[]; }
interface TodoItem { id: string; text: string; done: boolean; }
interface TodoList { id: string; projectId: string; name: string; items: TodoItem[]; }
interface Project { id: string; name: string; icon: string; status: string; rootPath: string | null; }
interface AppData {
  version: number;
  projects: Project[];
  tasks: Task[];
  notes: Note[];
  todoLists: TodoList[];
  settings: { defaultProjectId: string | null };
}

// ─── Data path ───────────────────────────────────────────────────

function getDataPath(): string {
  // DevNotes now runs in Portable Mode. It saves data geometrically adjacent to the .exe.
  // Assuming default installer path. Users installing to D:\ will need to edit this extension setting in the future.
  const pf = process.env.PROGRAMFILES || "C:\\Program Files";
  return path.join(pf, "devnotes", "DevNotes", "data.json");
}

function readData(): AppData | null {
  try {
    const raw = fs.readFileSync(getDataPath(), "utf-8");
    return JSON.parse(raw);
  } catch { return null; }
}

function writeData(data: AppData): void {
  fs.writeFileSync(getDataPath(), JSON.stringify(data, null, 2), "utf-8");
}

function getActiveProject(data: AppData): Project | null {
  if (data.settings.defaultProjectId) {
    return data.projects.find((p) => p.id === data.settings.defaultProjectId) ?? null;
  }
  // Heuristic: find project whose rootPath matches the open workspace
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (ws) {
    const match = data.projects.find((p) => p.rootPath && ws.startsWith(p.rootPath));
    if (match) return match;
  }
  return data.projects[0] ?? null;
}

// ─── Tree data provider ───────────────────────────────────────────

class DevNotesItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly kind: "section" | "task" | "note" | "todo",
    public readonly itemId: string,
    public readonly projectId: string,
    collapsible = vscode.TreeItemCollapsibleState.None,
    description?: string,
    iconPath?: vscode.ThemeIcon,
  ) {
    super(label, collapsible);
    this.description = description;
    this.iconPath = iconPath;
    this.tooltip = label;
    if (kind !== "section") {
      this.command = {
        command: "devnotes.selectItem",
        title: "Open",
        arguments: [this],
      };
    }
  }
}

class DevNotesProvider implements vscode.TreeDataProvider<DevNotesItem> {
  private _onDidChange = new vscode.EventEmitter<DevNotesItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private data: AppData | null = null;

  refresh() {
    this.data = readData();
    this._onDidChange.fire(undefined);
  }

  getTreeItem(el: DevNotesItem) { return el; }

  getChildren(element?: DevNotesItem): DevNotesItem[] {
    if (!this.data) return [new DevNotesItem("DevNotes data not found", "section", "", "", undefined, getDataPath())];
    const project = getActiveProject(this.data);
    if (!project) return [new DevNotesItem("No active project", "section", "", "")];

    if (!element) {
      // Root: section headers
      const tasks = this.data.tasks.filter((t) => t.projectId === project.id && t.status !== "done" && t.status !== "archived");
      const overdue = tasks.filter((t) => t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10));
      const notes = this.data.notes.filter((n) => n.projectId === project.id);
      const todos = this.data.todoLists.filter((l) => l.projectId === project.id)
        .flatMap((l) => l.items.filter((i) => !i.done));

      return [
        new DevNotesItem(
          `${project.icon} ${project.name}`, "section", project.id, project.id,
          vscode.TreeItemCollapsibleState.Expanded,
          project.status, new vscode.ThemeIcon("folder-opened")
        ),
        new DevNotesItem(
          `Tasks (${tasks.length}${overdue.length ? ` ⚠${overdue.length}` : ""})`,
          "section", "tasks", project.id,
          vscode.TreeItemCollapsibleState.Expanded,
          undefined, new vscode.ThemeIcon("checklist")
        ),
        new DevNotesItem(
          `Notes (${notes.length})`, "section", "notes", project.id,
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined, new vscode.ThemeIcon("notebook")
        ),
        new DevNotesItem(
          `Todos (${todos.length})`, "section", "todos", project.id,
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined, new vscode.ThemeIcon("list-unordered")
        ),
      ];
    }

    const project2 = getActiveProject(this.data)!;

    if (element.itemId === "tasks") {
      const tasks = this.data.tasks.filter(
        (t) => t.projectId === project2.id && t.status !== "done" && t.status !== "archived"
      );
      tasks.sort((a, b) => {
        const pri = { critical: 0, high: 1, medium: 2, low: 3 };
        return (pri[a.priority as keyof typeof pri] ?? 9) - (pri[b.priority as keyof typeof pri] ?? 9);
      });
      return tasks.map((t) => {
        const overdue = t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10);
        const icon = overdue ? new vscode.ThemeIcon("warning", new vscode.ThemeColor("errorForeground"))
          : new vscode.ThemeIcon("circle-outline");
        return new DevNotesItem(t.title, "task", t.id, t.projectId,
          undefined, `[${t.priority}]${t.dueDate ? " 📅" + t.dueDate : ""}`, icon);
      });
    }

    if (element.itemId === "notes") {
      return this.data.notes
        .filter((n) => n.projectId === project2.id)
        .map((n) => new DevNotesItem(n.title, "note", n.id, n.projectId,
          undefined, n.tags.join(", "), new vscode.ThemeIcon("file-text")));
    }

    if (element.itemId === "todos") {
      return this.data.todoLists
        .filter((l) => l.projectId === project2.id)
        .flatMap((l) => l.items.filter((i) => !i.done).map((i) =>
          new DevNotesItem(i.text, "todo", i.id, project2.id,
            undefined, l.name, new vscode.ThemeIcon("circle-outline"))
        ));
    }

    return [];
  }
}

// ─── Status bar ───────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem;

function updateStatusBar(data: AppData | null) {
  if (!data || !statusBarItem) return;
  const project = getActiveProject(data);
  if (!project) { statusBarItem.hide(); return; }
  const today = new Date().toISOString().slice(0, 10);
  const tasks = data.tasks.filter((t) => t.projectId === project.id && t.status !== "done" && t.status !== "archived");
  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today);
  statusBarItem.text = overdue.length
    ? `$(warning) DevNotes: ${tasks.length} tasks, ${overdue.length} overdue`
    : `$(checklist) DevNotes: ${tasks.length} tasks`;
  statusBarItem.backgroundColor = overdue.length
    ? new vscode.ThemeColor("statusBarItem.warningBackground") : undefined;
  statusBarItem.show();
}

// ─── Extension entry point ────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  const provider = new DevNotesProvider();
  provider.refresh();

  // Tree view
  const treeView = vscode.window.createTreeView("devnotesExplorer", {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  statusBarItem.command = "devnotes.openApp";
  context.subscriptions.push(statusBarItem);
  updateStatusBar(readData());

  // File watcher on data.json
  const dataPath = getDataPath();
  if (fs.existsSync(path.dirname(dataPath))) {
    const watcher = fs.watch(path.dirname(dataPath), (event: string, filename: string | null) => {
      if (filename === "data.json") {
        provider.refresh();
        updateStatusBar(readData());
      }
    });
    context.subscriptions.push({ dispose: () => watcher.close() });
  }

  // ── Commands ──

  // New task
  context.subscriptions.push(vscode.commands.registerCommand("devnotes.newTask", async () => {
    const title = await vscode.window.showInputBox({ prompt: "Task title", placeHolder: "What needs to be done?" });
    if (!title) return;
    const priority = await vscode.window.showQuickPick(["medium", "high", "critical", "low"], { placeHolder: "Priority" });
    const data = readData();
    if (!data) { vscode.window.showErrorMessage("DevNotes data not found."); return; }
    const project = getActiveProject(data);
    if (!project) { vscode.window.showErrorMessage("No active project."); return; }
    data.tasks.unshift({
      id: `task_${Date.now()}`, projectId: project.id, title,
      status: "todo", priority: priority ?? "medium", dueDate: null,
    } as Task);
    writeData(data);
    provider.refresh();
    vscode.window.showInformationMessage(`DevNotes: Task "${title}" added.`);
  }));

  // New note
  context.subscriptions.push(vscode.commands.registerCommand("devnotes.newNote", async () => {
    const title = await vscode.window.showInputBox({ prompt: "Note title" });
    if (!title) return;
    const data = readData();
    if (!data) { vscode.window.showErrorMessage("DevNotes data not found."); return; }
    const project = getActiveProject(data);
    if (!project) { vscode.window.showErrorMessage("No active project."); return; }
    data.notes.unshift({
      id: `note_${Date.now()}`, projectId: project.id, title,
      body: `# ${title}\n\n`, tags: [], pinned: false, archived: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as any);
    writeData(data);
    provider.refresh();
    vscode.window.showInformationMessage(`DevNotes: Note "${title}" added.`);
  }));

  // Toggle task done
  context.subscriptions.push(vscode.commands.registerCommand("devnotes.toggleDone", (item: DevNotesItem) => {
    if (item.kind !== "task") return;
    const data = readData();
    if (!data) return;
    const task = data.tasks.find((t) => t.id === item.itemId);
    if (!task) return;
    task.status = task.status === "done" ? "todo" : "done";
    writeData(data);
    provider.refresh();
  }));

  // Quick pick: jump to task or note
  context.subscriptions.push(vscode.commands.registerCommand("devnotes.quickJump", async () => {
    const data = readData();
    if (!data) { vscode.window.showErrorMessage("DevNotes data not found."); return; }
    const project = getActiveProject(data);
    if (!project) return;

    const items: vscode.QuickPickItem[] = [
      ...data.tasks.filter((t) => t.projectId === project.id && t.status !== "done")
        .map((t) => ({ label: `$(checklist) ${t.title}`, description: `[${t.priority}]`, detail: t.status })),
      ...data.notes.filter((n) => n.projectId === project.id)
        .map((n) => ({ label: `$(file-text) ${n.title}`, description: "note" })),
    ];

    await vscode.window.showQuickPick(items, { placeHolder: "Jump to task or note…", matchOnDescription: true });
  }));

  // Refresh
  context.subscriptions.push(vscode.commands.registerCommand("devnotes.refresh", () => {
    provider.refresh();
    updateStatusBar(readData());
  }));

  // Open app (just shows a message in browser mode; real Tauri IPC in future)
  context.subscriptions.push(vscode.commands.registerCommand("devnotes.openApp", () => {
    vscode.window.showInformationMessage("DevNotes: Switch to the DevNotes Desktop window.", "OK");
  }));

  context.subscriptions.push(vscode.commands.registerCommand("devnotes.selectItem", (item: DevNotesItem) => {
    if (item.kind === "task") {
      vscode.commands.executeCommand("devnotes.toggleDone", item);
    }
  }));

  context.subscriptions.push(treeView);
}

export function deactivate() { }
