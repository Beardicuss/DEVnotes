import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  AppData, AppSettings, Project, Plan, Note, TodoList, TodoItem,
  Task, MindMap, Tools, TaskFilter, NoteFilter,
  ProjectTab, SyncState, ID, QuickCaptureType,
} from "@/types";
import { storageRead, storageWrite, storageBackup, getPlatform } from "@/utils/platform";
import { DEFAULT_DATA, DEFAULT_SETTINGS } from "@/utils/defaults";
import { uid } from "@/utils/id";
import { nowISO } from "@/utils/date";
import { syncWithGitHub } from "@/integrations/github";
import { setLocale } from "@/i18n";

// ─── Autosave debounce ────────────────────────────────────────────
// Factory-based debounce: each store instance gets its own timer,
// so multiple instances (e.g. in tests) don't share state.
function makeScheduler() {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function scheduleSave(save: () => Promise<void>, delayMs: number) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; save(); }, delayMs);
  };
}
const scheduleSave = makeScheduler();

// ─── Store shape ──────────────────────────────────────────────────

interface AppStore {
  // ── Persisted data ──
  data: AppData;

  // ── UI state (not persisted) ──
  platform: ReturnType<typeof getPlatform>;
  activeProjectId: ID | null;
  activeTab: ProjectTab;
  selectedNoteId: ID | null;
  taskFilter: TaskFilter;
  noteFilter: NoteFilter;
  isSaving: boolean;
  isInitialized: boolean;
  syncState: SyncState;
  quickCaptureOpen: boolean;

  // ── Lifecycle ──
  init: () => Promise<void>;
  save: () => Promise<void>;

  // ── Projects ──
  openProject: (id: ID) => void;
  addProject: (partial: Partial<Project>) => ID;
  updateProject: (id: ID, patch: Partial<Project>) => void;
  deleteProject: (id: ID) => void;
  setTab: (tab: ProjectTab) => void;

  // ── Plan ──
  updatePlan: (projectId: ID, patch: Partial<Omit<Plan, "projectId">>) => void;

  // ── Notes ──
  selectNote: (id: ID | null) => void;
  addNote: () => ID;
  importNotes: (notes: import("@/types").Note[]) => void;
  updateNote: (id: ID, patch: Partial<Note>) => void;
  deleteNote: (id: ID) => void;
  archiveNote: (id: ID) => void;
  restoreNote: (id: ID) => void;
  setNoteFilter: (patch: Partial<NoteFilter>) => void;

  // ── Todos ──
  addTodoList: (name: string) => ID | undefined;
  updateTodoList: (id: ID, name: string) => void;
  deleteTodoList: (id: ID) => void;
  addTodoItem: (listId: ID, text: string, parentId?: ID) => void;
  toggleTodoItem: (listId: ID, itemId: ID) => void;
  updateTodoItem: (listId: ID, itemId: ID, patch: Partial<TodoItem>) => void;
  deleteTodoItem: (listId: ID, itemId: ID) => void;
  clearDoneTodos: (listId: ID) => void;

  // ── Tasks ──
  addTask: (partial: Partial<Task>) => ID;
  updateTask: (id: ID, patch: Partial<Task>) => void;
  deleteTask: (id: ID) => void;
  archiveTask: (id: ID) => void;
  restoreTask: (id: ID) => void;
  setTaskFilter: (patch: Partial<TaskFilter>) => void;

  // ── Decisions ──
  addDecision: (partial: Partial<import("@/types").Decision>) => string;
  updateDecision: (id: import("@/types").ID, patch: Partial<import("@/types").Decision>) => void;
  deleteDecision: (id: import("@/types").ID) => void;

  // ── Standups ──
  addStandup: (entry: Omit<import("@/types").StandupEntry, "id" | "createdAt">) => string;
  updateStandup: (id: import("@/types").ID, patch: Partial<import("@/types").StandupEntry>) => void;

  // ── Pomodoros ──
  addPomodoro: (session: Omit<import("@/types").PomodoroSession, "id">) => string;
  updatePomodoro: (id: import("@/types").ID, patch: Partial<import("@/types").PomodoroSession>) => void;

  // ── Git status (for file watcher) ──
  setGitStatus: (projectId: import("@/types").ID, status: any) => void;

  // ── Mind map ──
  updateMindMap: (projectId: ID, patch: Partial<Omit<MindMap, "projectId">>) => void;

  // ── Tools ──
  updateTools: (projectId: ID, patch: Partial<Omit<Tools, "projectId">>) => void;

  // ── Settings ──
  updateSettings: (patch: Partial<AppSettings>) => void;

  // ── GitHub sync ──
  syncNow: () => Promise<void>;

  // ── Quick capture ──
  openQuickCapture: () => void;
  closeQuickCapture: () => void;
  quickCapture: (text: string, type: QuickCaptureType) => void;
}

// ─── Selectors (memoize-safe — call in components) ────────────────

export const selProject = (id: ID | null) => (s: AppStore) =>
  s.data.projects.find((p) => p.id === id) ?? null;

export const selActiveProject = (s: AppStore) =>
  s.data.projects.find((p) => p.id === s.activeProjectId) ?? null;

export const selPlan = (id: ID | null) => (s: AppStore) =>
  s.data.plans.find((p) => p.projectId === id) ?? null;

export const selNotes = (s: AppStore) => {
  const pid = s.activeProjectId;
  const f = s.noteFilter;
  return s.data.notes
    .filter((n) => {
      if (n.projectId !== pid || n.archived) return false;
      if (f.search && !n.title.toLowerCase().includes(f.search.toLowerCase())
        && !n.body.toLowerCase().includes(f.search.toLowerCase())) return false;
      if (f.tag !== "all" && !n.tags.includes(f.tag)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
};

export const selTodoLists = (s: AppStore) =>
  s.data.todoLists.filter((l) => l.projectId === s.activeProjectId);

export const selTasks = (s: AppStore) => {
  const pid = s.activeProjectId;
  const f = s.taskFilter;
  const PRI = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  return s.data.tasks
    .filter((t) => {
      if (t.projectId !== pid || t.status === "archived") return false;
      if (f.search && !t.title.toLowerCase().includes(f.search.toLowerCase())) return false;
      if (f.priority !== "all" && t.priority !== f.priority) return false;
      if (f.tag !== "all" && t.tag !== f.tag) return false;
      if (f.status !== "all" && t.status !== f.status) return false;
      return true;
    })
    .sort((a, b) => {
      const pd = PRI[a.priority] - PRI[b.priority];
      if (pd !== 0) return pd;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
};

export const selMindMap = (s: AppStore) =>
  s.data.mindMaps.find((m) => m.projectId === s.activeProjectId) ?? null;

export const selTools = (s: AppStore) =>
  s.data.tools.find((t) => t.projectId === s.activeProjectId) ?? null;

export const selArchivedNotes = (s: AppStore) =>
  s.data.notes.filter((n) => n.archived && n.projectId === s.activeProjectId);

export const selArchivedTasks = (s: AppStore) =>
  s.data.tasks.filter((t) => t.status === "archived" && t.projectId === s.activeProjectId);

// ─── Store ────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  subscribeWithSelector((set, get) => ({
    data: DEFAULT_DATA,
    platform: getPlatform(),
    activeProjectId: null,
    activeTab: "dashboard",
    selectedNoteId: null,
    taskFilter: { search: "", priority: "all", tag: "all", status: "all" },
    noteFilter: { search: "", tag: "all" },
    isSaving: false,
    isInitialized: false,
    syncState: { status: "idle", lastSyncAt: null, errorMessage: null },
    quickCaptureOpen: false,

    // ── Init ──────────────────────────────────────────────────────
    init: async () => {
      const raw = await storageRead();
      if (raw) {
        try {
          const loaded = JSON.parse(raw) as AppData;
          // Migrate: add new fields if missing (Phase 2–5)
          if (!loaded.mindMaps) loaded.mindMaps = [];
          if (!loaded.tools) loaded.tools = [];
          if (!loaded.decisions) loaded.decisions = [];
          if (!loaded.standups) loaded.standups = [];
          if (!loaded.pomodoros) loaded.pomodoros = [];
          // Ensure every project has a plan, mindMap, and tools scaffold
          for (const proj of loaded.projects ?? []) {
            if (!loaded.plans?.find((p: any) => p.projectId === proj.id)) {
              if (!loaded.plans) loaded.plans = [];
              loaded.plans.push({ projectId: proj.id, body: "# Project Plan\n\n", milestones: [], templateId: null, updatedAt: proj.updatedAt });
            }
            if (!loaded.mindMaps.find((m: any) => m.projectId === proj.id)) {
              loaded.mindMaps.push({ projectId: proj.id, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 }, updatedAt: proj.updatedAt });
            }
            if (!loaded.tools.find((t: any) => t.projectId === proj.id)) {
              loaded.tools.push({ projectId: proj.id, links: [], commands: [], snippets: [] });
            }
          }
          const data: AppData = {
            ...DEFAULT_DATA,
            ...loaded,
            settings: { ...DEFAULT_SETTINGS, ...loaded.settings },
          };
          const activeProjectId =
            data.settings.activeProjectId ?? data.projects[0]?.id ?? null;

          set({ data, activeProjectId, isInitialized: true });

          // Apply locale from settings
          await setLocale(data.settings.locale);
          return;
        } catch {
          console.warn("[store] Corrupt data — using defaults");
        }
      }
      // First run — use defaults with demo project
      set({
        data: DEFAULT_DATA,
        activeProjectId: DEFAULT_DATA.projects[0]?.id ?? null,
        isInitialized: true,
      });
    },

    // ── Save ──────────────────────────────────────────────────────
    save: async () => {
      set({ isSaving: true });
      const { data } = get();

      // Persist locally
      const json = JSON.stringify(data, null, 2);
      await storageWrite(json);

      // Auto-backup (Windows only)
      if (data.settings.autoBackup) await storageBackup(json, data.settings.backupCount ?? 10);

      // GitHub auto-sync if configured
      const { githubSyncEnabled, githubToken, githubGistId, githubSyncFrequency } = data.settings;
      if (githubSyncEnabled && githubToken && githubSyncFrequency === "on-save") {
        const result = await syncWithGitHub(githubToken, githubGistId, data);
        if (result.gistId !== githubGistId) {
          // First sync created a new Gist — save its ID
          set((s) => ({
            data: {
              ...s.data,
              settings: { ...s.data.settings, githubGistId: result.gistId },
            },
          }));
        }
        set({ syncState: result.state });
      }

      set({ isSaving: false });
    },

    // ── Projects ──────────────────────────────────────────────────
    openProject: (id) => {
      set({ activeProjectId: id, activeTab: "dashboard", selectedNoteId: null });
      get().updateSettings({ activeProjectId: id });
    },

    addProject: (partial) => {
      const id = uid();
      const now = nowISO();
      const project: Project = {
        id, name: "New Project", description: "", colour: "#00ffff", icon: "⬡",
        status: "active", techStack: [], rootPath: null, ideType: null, idePath: null,
        repoUrl: null, deadline: null, calendarEventId: null, pinned: false,
        createdAt: now, updatedAt: now, ...partial,
      };
      // Scaffold all sub-documents for the new project
      const plan = { projectId: id, body: "# Project Plan\n\n", milestones: [], templateId: null, updatedAt: now };
      const todos = { id: uid(), projectId: id, name: "Tasks", items: [], createdAt: now };
      const mm = { projectId: id, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 }, updatedAt: now };
      const tools = { projectId: id, links: [], commands: [], snippets: [] };

      set((s) => ({
        data: {
          ...s.data,
          projects: [...s.data.projects, project],
          plans: [...s.data.plans, plan],
          todoLists: [...s.data.todoLists, todos],
          mindMaps: [...s.data.mindMaps, mm],
          tools: [...s.data.tools, tools],
        },
      }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
      return id;
    },

    updateProject: (id, patch) => {
      set((s) => ({
        data: {
          ...s.data,
          projects: s.data.projects.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: nowISO() } : p
          ),
        },
      }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    deleteProject: (id) => {
      set((s) => ({
        data: {
          ...s.data,
          projects: s.data.projects.filter((p) => p.id !== id),
          plans: s.data.plans.filter((p) => p.projectId !== id),
          notes: s.data.notes.filter((n) => n.projectId !== id),
          todoLists: s.data.todoLists.filter((l) => l.projectId !== id),
          tasks: s.data.tasks.filter((t) => t.projectId !== id),
          mindMaps: s.data.mindMaps.filter((m) => m.projectId !== id),
          tools: s.data.tools.filter((t) => t.projectId !== id),
          decisions: (s.data.decisions ?? []).filter((d) => d.projectId !== id),
          standups: (s.data.standups ?? []).filter((e) => e.projectId !== id),
          pomodoros: (s.data.pomodoros ?? []).filter((p) => p.projectId !== id),
        },
        activeProjectId: s.activeProjectId === id
          ? (s.data.projects.find((p) => p.id !== id)?.id ?? null)
          : s.activeProjectId,
      }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    setTab: (tab) => set({ activeTab: tab }),

    // ── Plan ──────────────────────────────────────────────────────
    updatePlan: (projectId, patch) => {
      set((s) => ({
        data: {
          ...s.data,
          plans: s.data.plans.map((p) =>
            p.projectId === projectId ? { ...p, ...patch, updatedAt: nowISO() } : p
          ),
        },
      }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    // ── Notes ─────────────────────────────────────────────────────
    selectNote: (id) => set({ selectedNoteId: id }),

    addNote: () => {
      const projectId = get().activeProjectId;
      if (!projectId) return "";   // guard: no active project
      const id = uid();
      const note: Note = {
        id, projectId, title: "New Note", body: "",
        tags: [], pinned: false, archived: false,
        createdAt: nowISO(), updatedAt: nowISO(),
      };
      set((s) => ({ data: { ...s.data, notes: [note, ...s.data.notes] }, selectedNoteId: id }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
      return id;
    },

    // importNotes: batch-insert notes without touching selectedNoteId
    importNotes: (notes: Note[]) => {
      set((s) => ({ data: { ...s.data, notes: [...notes, ...s.data.notes] } }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    updateNote: (id, patch) => {
      set((s) => ({
        data: {
          ...s.data,
          notes: s.data.notes.map((n) => n.id === id ? { ...n, ...patch, updatedAt: nowISO() } : n),
        },
      }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    deleteNote: (id) => { set((s) => ({ data: { ...s.data, notes: s.data.notes.filter((n) => n.id !== id) }, selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId })); scheduleSave(get().save, 400); },
    archiveNote: (id) => { get().updateNote(id, { archived: true }); set((s) => ({ selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId })); },
    restoreNote: (id) => get().updateNote(id, { archived: false }),
    setNoteFilter: (patch) => set((s) => ({ noteFilter: { ...s.noteFilter, ...patch } })),

    // ── Todos ─────────────────────────────────────────────────────
    addTodoList: (name) => {
      const projectId = get().activeProjectId;
      if (!projectId) return undefined;
      const list: TodoList = { id: uid(), projectId, name, items: [], createdAt: nowISO() };
      set((s) => ({ data: { ...s.data, todoLists: [...s.data.todoLists, list] } }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
      return list.id;
    },

    updateTodoList: (id, name) => {
      set((s) => ({ data: { ...s.data, todoLists: s.data.todoLists.map((l) => l.id === id ? { ...l, name } : l) } }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    deleteTodoList: (id) => {
      set((s) => ({ data: { ...s.data, todoLists: s.data.todoLists.filter((l) => l.id !== id) } }));
      scheduleSave(get().save, 400);
    },

    addTodoItem: (listId, text, parentId) => {
      const item: TodoItem = { id: uid(), text, done: false, dueDate: null, parentId: parentId ?? null, order: Date.now() };
      set((s) => ({
        data: {
          ...s.data,
          todoLists: s.data.todoLists.map((l) =>
            l.id === listId ? { ...l, items: [...l.items, item] } : l
          ),
        },
      }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    toggleTodoItem: (listId, itemId) => {
      set((s) => ({
        data: {
          ...s.data,
          todoLists: s.data.todoLists.map((l) =>
            l.id === listId
              ? { ...l, items: l.items.map((i) => i.id === itemId ? { ...i, done: !i.done } : i) }
              : l
          ),
        },
      }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    updateTodoItem: (listId, itemId, patch) => {
      set((s) => ({
        data: {
          ...s.data,
          todoLists: s.data.todoLists.map((l) =>
            l.id === listId
              ? { ...l, items: l.items.map((i) => i.id === itemId ? { ...i, ...patch } : i) }
              : l
          ),
        },
      }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    deleteTodoItem: (listId, itemId) => {
      set((s) => ({
        data: {
          ...s.data,
          todoLists: s.data.todoLists.map((l) =>
            l.id === listId ? { ...l, items: l.items.filter((i) => i.id !== itemId) } : l
          ),
        },
      }));
      scheduleSave(get().save, 400);
    },

    clearDoneTodos: (listId) => {
      set((s) => ({
        data: {
          ...s.data,
          todoLists: s.data.todoLists.map((l) =>
            l.id === listId ? { ...l, items: l.items.filter((i) => !i.done) } : l
          ),
        },
      }));
      scheduleSave(get().save, 400);
    },

    // ── Tasks ─────────────────────────────────────────────────────
    addTask: (partial) => {
      const projectId = partial.projectId ?? get().activeProjectId;
      if (!projectId) return "";   // guard: no active project
      const id = uid();
      const task: Task = {
        title: "New Task", description: "", priority: "medium", tag: "feature",
        status: "todo", dueDate: null, dueTime: null,
        reminder: { enabled: false, offsetMinutes: 1440, notificationId: null },
        recurring: null, linkedNoteId: null, linkedMilestoneId: null,
        calendarEventId: null, timeTrackedMinutes: 0,
        createdAt: nowISO(), updatedAt: nowISO(),
        ...partial,
        id, projectId,   // always wins — overrides anything in partial
      };
      set((s) => ({ data: { ...s.data, tasks: [task, ...s.data.tasks] } }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
      return id;
    },

    updateTask: (id, patch) => {
      set((s) => ({
        data: {
          ...s.data,
          tasks: s.data.tasks.map((t) => t.id === id ? { ...t, ...patch, updatedAt: nowISO() } : t),
        },
      }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    deleteTask: (id) => { set((s) => ({ data: { ...s.data, tasks: s.data.tasks.filter((t) => t.id !== id) } })); scheduleSave(get().save, 400); },
    archiveTask: (id) => get().updateTask(id, { status: "archived" }),
    restoreTask: (id) => get().updateTask(id, { status: "todo" }),
    setTaskFilter: (patch) => set((s) => ({ taskFilter: { ...s.taskFilter, ...patch } })),

    // ── Mind map ──────────────────────────────────────────────────
    updateMindMap: (projectId, patch) => {
      set((s) => ({
        data: {
          ...s.data,
          mindMaps: s.data.mindMaps.map((m) =>
            m.projectId === projectId ? { ...m, ...patch, updatedAt: nowISO() } : m
          ),
        },
      }));
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    // ── Tools ─────────────────────────────────────────────────────
    updateTools: (projectId, patch) => {
      set((s) => {
        const exists = s.data.tools.some((t) => t.projectId === projectId);
        const updated = exists
          ? s.data.tools.map((t) => t.projectId === projectId ? { ...t, ...patch } : t)
          // Upsert: create record if missing (e.g. race on first write)
          : [...s.data.tools, { projectId, links: [], commands: [], snippets: [], ...patch }];
        return { data: { ...s.data, tools: updated } };
      });
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    // ── Settings ──────────────────────────────────────────────────
    updateSettings: (patch) => {
      set((s) => ({
        data: { ...s.data, settings: { ...s.data.settings, ...patch } },
      }));
      // Apply locale immediately
      if (patch.locale) setLocale(patch.locale);
      scheduleSave(get().save, get().data.settings.autosaveDelayMs);
    },

    // ── Decisions ─────────────────────────────────────────────────
    addDecision: (partial) => {
      const id = uid();
      const now = nowISO();
      const proj = get().activeProjectId;
      if (!proj) return id;
      const item = { title: "New Decision", context: "", options: "", outcome: "", status: "proposed" as const, decisionDate: null, decidedBy: "", tags: [], linkedTaskId: null, createdAt: now, updatedAt: now, ...partial, projectId: proj, id };
      set((s) => ({ data: { ...s.data, decisions: [item, ...(s.data.decisions ?? [])] } }));
      scheduleSave(get().save, 800);
      return id;
    },
    updateDecision: (id, patch) => {
      set((s) => ({ data: { ...s.data, decisions: (s.data.decisions ?? []).map((d) => d.id === id ? { ...d, ...patch, updatedAt: nowISO() } : d) } }));
      scheduleSave(get().save, 800);
    },
    deleteDecision: (id) => {
      set((s) => ({ data: { ...s.data, decisions: (s.data.decisions ?? []).filter((d) => d.id !== id) } }));
      scheduleSave(get().save, 400);
    },

    // ── Standups ───────────────────────────────────────────────────
    addStandup: (entry) => {
      const id = uid();
      const item = { id, createdAt: nowISO(), ...entry };
      set((s) => ({ data: { ...s.data, standups: [item, ...(s.data.standups ?? [])] } }));
      scheduleSave(get().save, 800);
      return id;
    },
    updateStandup: (id, patch) => {
      set((s) => ({ data: { ...s.data, standups: (s.data.standups ?? []).map((e) => e.id === id ? { ...e, ...patch } : e) } }));
      scheduleSave(get().save, 800);
    },

    // ── Pomodoros ──────────────────────────────────────────────────
    addPomodoro: (session) => {
      const id = uid();
      const item = { id, ...session };
      const MAX_POMODOROS = 500; // ~8 months of daily use at 2 sessions/day
      set((s) => {
        const updated = [item, ...(s.data.pomodoros ?? [])];
        // Prune oldest sessions beyond the cap to keep data.json lean
        const pruned = updated.length > MAX_POMODOROS
          ? updated.slice(0, MAX_POMODOROS)
          : updated;
        return { data: { ...s.data, pomodoros: pruned } };
      });
      scheduleSave(get().save, 400);
      return id;
    },
    updatePomodoro: (id, patch) => {
      set((s) => ({ data: { ...s.data, pomodoros: (s.data.pomodoros ?? []).map((p) => p.id === id ? { ...p, ...patch } : p) } }));
      scheduleSave(get().save, 400);
    },

    // ── Git status cache ───────────────────────────────────────────
    setGitStatus: (_projectId, _status) => { /* stored in component state for now */ },

    // ── GitHub sync ───────────────────────────────────────────────
    syncNow: async () => {
      const { data } = get();
      const { githubToken, githubGistId, githubSyncEnabled } = data.settings;
      if (!githubSyncEnabled || !githubToken) return;

      set({ syncState: { status: "syncing", lastSyncAt: null, errorMessage: null } });
      const result = await syncWithGitHub(githubToken, githubGistId, data);

      set((s) => ({
        data: {
          // Merge remote content (notes, tasks, etc.) but always preserve
          // local settings — result.data.settings has redacted sensitive fields
          ...result.data,
          settings: {
            ...s.data.settings,                                // local settings win
            githubGistId: result.gistId || s.data.settings.githubGistId,
            githubLastSyncAt: result.state.lastSyncAt,
          },
        },
        syncState: result.state,
      }));

      await storageWrite(JSON.stringify(get().data, null, 2));
    },

    // ── Quick capture ─────────────────────────────────────────────
    openQuickCapture: () => set({ quickCaptureOpen: true }),
    closeQuickCapture: () => set({ quickCaptureOpen: false }),

    quickCapture: (text, type) => {
      const { activeProjectId, addNote, addTask, addTodoItem, data } = get();
      if (!activeProjectId || !text.trim()) return;

      if (type === "note") {
        const id = addNote();
        get().updateNote(id, { title: text.trim(), body: "" });
      } else if (type === "task") {
        addTask({ title: text.trim() });
      } else {
        const firstList = data.todoLists.find((l) => l.projectId === activeProjectId);
        if (firstList) addTodoItem(firstList.id, text.trim());
      }
      set({ quickCaptureOpen: false });
    },
  }))
);
