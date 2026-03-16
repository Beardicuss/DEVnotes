import type { AppData, AppSettings, Project } from "@/types";
import { nowISO } from "./date";

export const DEFAULT_SETTINGS: AppSettings = {
  // General
  launchAtStartup: false,
  minimizeToTray: true,
  startMinimized: false,
  autostart: false,
  defaultProjectId: null,
  autoDetectIDE: true,
  confirmDelete: true,

  // Appearance
  theme: "softcurse-dark",
  accentColour: "#00ffff",
  windowOpacity: 0.97,
  showGridBg: true,
  glowEffects: true,
  animations: true,

  // Fonts
  uiFont: "Share Tech Mono",
  editorFont: "Share Tech Mono",
  codeFont: "Fira Code",
  fontSize: 13,
  lineHeight: "normal",

  // Language
  locale: "en",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
  firstDayOfWeek: "monday",

  // Notifications
  notificationsEnabled: true,
  defaultReminderOffsetMinutes: 1440, // 1 day
  dailyDigest: true,
  dailyDigestTime: "09:00",
  dndStart: "22:00",
  dndEnd: "08:00",
  overdueAlert: true,
  notificationSound: true,

  // Calendar
  calendarProvider: null,
  calendarAccessToken: null,
  calendarRefreshToken: null,
  calendarSyncScope: "high-and-critical",
  calendarSyncMilestones: true,
  calendarSyncFrequency: "on-save",

  // IDE
  vscodePath: null,
  vstudioPath: null,
  customIDEs: [],
  terminal: "windows-terminal",
  gitPath: null,

  // GitHub sync
  githubSyncEnabled: false,
  githubToken: null,
  githubGistId: null,
  githubSyncFrequency: "manual",
  githubLastSyncAt: null,

  // Hotkeys
  hotkeyGlobalShow: "Ctrl+Shift+D",
  hotkeyQuickCapture: "Ctrl+Shift+Space",
  hotkeyNewProject: "Ctrl+Shift+N",
  hotkeyNewTask: "Ctrl+T",
  hotkeyNewNote: "Ctrl+N",
  hotkeySwitchProject: "Ctrl+Tab",

  // Data
  dataPath: null,
  autoBackup: true,
  backupCount: 10,

  // UI state
  autosaveDelayMs: 800,
  noteViewMode: "edit",
  sidebarWidth: 220,
  activeProjectId: null,

  // Pomodoro
  pomodoroDurationMins: 25,

  // AI
  groqApiKey: null,
  groqModel: "llama-3.3-70b-versatile",
  geminiApiKey: null,
  geminiModel: "gemini-1.5-flash",

  // Appearance extras
  resolution: "fhd",

  // Onboarding
  onboardingComplete: false,

  // Calendar OAuth
  calendarTokens: null,
  googleClientId: "",
  googleClientSecret: "",
  calendarAutoPush: false,
};

export const DEMO_PROJECT: Project = {
  id: "demo",
  name: "My First Project",
  description: "Get started with DevNotes",
  colour: "#00ffff",
  icon: "⬡",
  status: "active",
  techStack: ["Softcurse Lab"],
  rootPath: null,
  ideType: null,
  idePath: null,
  repoUrl: null,
  deadline: null,
  calendarEventId: null,
  pinned: true,
  createdAt: nowISO(),
  updatedAt: nowISO(),
};

export const DEFAULT_DATA: AppData = {
  version: 2,
  projects: [DEMO_PROJECT],
  plans: [
    {
      projectId: "demo",
      body: "# Project Plan\n\n## Goals\n\nDefine your project goals here.\n\n## Tech Stack\n\n- List your technologies\n\n## Milestones\n\nAdd milestones below.\n",
      milestones: [],
      templateId: null,
      updatedAt: nowISO(),
    },
  ],
  notes: [
    {
      id: "demo-note-1",
      projectId: "demo",
      title: "Welcome to DevNotes",
      body: "# Welcome to DevNotes\n\nThis is your first note. Markdown is fully supported.\n\n## Features\n\n- **Bold** and *italic* text\n- `Code blocks`\n- Checklists: [ ] todo  [x] done\n- Links and more\n",
      tags: ["welcome"],
      pinned: true,
      archived: false,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
  ],
  todoLists: [
    {
      id: "demo-todos",
      projectId: "demo",
      name: "Getting Started",
      items: [
        { id: "ti-1", text: "Create your first project", done: true, dueDate: null, parentId: null, order: 0 },
        { id: "ti-2", text: "Write a project plan", done: false, dueDate: null, parentId: null, order: 1 },
        { id: "ti-3", text: "Add tasks and deadlines", done: false, dueDate: null, parentId: null, order: 2 },
        { id: "ti-4", text: "Connect to VS Code", done: false, dueDate: null, parentId: null, order: 3 },
      ],
      createdAt: nowISO(),
    },
  ],
  tasks: [
    {
      id: "demo-task-1",
      projectId: "demo",
      title: "Set up your first project",
      description: "Link DevNotes to your development project folder",
      priority: "high",
      tag: "feature",
      status: "todo",
      dueDate: null,
      dueTime: null,
      reminder: { enabled: false, offsetMinutes: 1440, notificationId: null },
      recurring: null,
      linkedNoteId: null,
      linkedMilestoneId: null,
      calendarEventId: null,
      timeTrackedMinutes: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
  ],
  mindMaps: [
    {
      projectId: "demo",
      nodes: [
        { id: "n-root", text: "My Project", x: 400, y: 300, type: "root", colour: "#00ffff", parentId: null },
        { id: "n-1", text: "Frontend", x: 200, y: 180, type: "idea", colour: "#0088ff", parentId: "n-root" },
        { id: "n-2", text: "Backend", x: 600, y: 180, type: "idea", colour: "#0088ff", parentId: "n-root" },
        { id: "n-3", text: "Design", x: 150, y: 380, type: "decision", colour: "#ff00ff", parentId: "n-root" },
        { id: "n-4", text: "Deploy", x: 640, y: 400, type: "task", colour: "#00ff88", parentId: "n-root" },
      ],
      edges: [
        { id: "e-1", fromId: "n-root", toId: "n-1", label: null },
        { id: "e-2", fromId: "n-root", toId: "n-2", label: null },
        { id: "e-3", fromId: "n-root", toId: "n-3", label: null },
        { id: "e-4", fromId: "n-root", toId: "n-4", label: null },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
      updatedAt: nowISO(),
    },
  ],
  tools: [
    {
      projectId: "demo",
      links: [
        { id: "l-1", label: "GitHub Repo", url: "https://github.com", icon: "git" },
        { id: "l-2", label: "Docs", url: "https://docs.example.com", icon: "docs" },
      ],
      commands: [
        { id: "c-1", label: "Dev Server", command: "npm run dev", cwd: "{projectRoot}", icon: "▶" },
        { id: "c-2", label: "Build", command: "npm run build", cwd: "{projectRoot}", icon: "⚙" },
      ],
      snippets: [],
    },
  ],
  decisions: [],
  standups: [],
  pomodoros: [],
  settings: DEFAULT_SETTINGS,
};
