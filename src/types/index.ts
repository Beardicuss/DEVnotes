// ═══════════════════════════════════════════════════════════════════
//  DevNotes — Complete Type System v2
//  Target: Solo dev · Small team · Freelancers
//  Primary: Windows (Tauri 2)   Secondary: Android (Capacitor 6)
//  Sync: Local-first + optional GitHub Gist
// ═══════════════════════════════════════════════════════════════════

export type ID           = string;
export type ISODateTime  = string;  // "2025-06-01T09:00:00Z"
export type ISODate      = string;  // "2025-06-01"
export type HexColour    = string;  // "#00ffff"

export type Platform =
  | "tauri-windows"
  | "capacitor-android"
  | "capacitor-ios"
  | "web";

// ─── PROJECT ──────────────────────────────────────────────────────

export type ProjectStatus = "active" | "on-hold" | "completed" | "archived";
export type IDEType = "vscode" | "visualstudio" | "jetbrains" | "other" | null;

export interface Project {
  id:               ID;
  name:             string;
  description:      string;
  colour:           HexColour;
  icon:             string;          // emoji, e.g. "⬡" "🚀" "🔧"
  status:           ProjectStatus;
  techStack:        string[];
  rootPath:         string | null;   // "C:/dev/myproject"
  ideType:          IDEType;
  idePath:          string | null;   // relative .code-workspace / .sln path
  repoUrl:          string | null;
  deadline:         ISODate | null;
  calendarEventId:  string | null;
  pinned:           boolean;
  createdAt:        ISODateTime;
  updatedAt:        ISODateTime;
}

// ─── PLAN ─────────────────────────────────────────────────────────

export type MilestoneStatus = "todo" | "in-progress" | "done";

export interface Milestone {
  id:              ID;
  title:           string;
  description?:    string;           // optional notes on the milestone
  date:            ISODate | null;
  status:          MilestoneStatus;
  calendarEventId: string | null;
}

export interface Plan {
  projectId:  ID;
  body:       string;               // raw markdown
  milestones: Milestone[];
  templateId: string | null;
  updatedAt:  ISODateTime;
}

// ─── NOTES ────────────────────────────────────────────────────────

export interface Note {
  id:        ID;
  projectId: ID;
  title:     string;
  body:      string;               // raw markdown
  tags:      string[];
  pinned:    boolean;
  archived:  boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ─── TODOS ────────────────────────────────────────────────────────

export interface TodoItem {
  id:       ID;
  text:     string;
  done:     boolean;
  dueDate:  ISODate | null;
  parentId: ID | null;             // 1-level nesting
  order:    number;
}

export interface TodoList {
  id:        ID;
  projectId: ID;
  name:      string;
  items:     TodoItem[];
  createdAt: ISODateTime;
}

// ─── TASKS ────────────────────────────────────────────────────────

export type Priority   = "low" | "medium" | "high" | "critical";
export type TaskStatus = "backlog" | "todo" | "in-progress" | "done" | "archived";
export type TaskTag    =
  | "bug" | "feature" | "refactor" | "docs"
  | "infra" | "research" | "meeting" | "hotfix"
  | string;

export interface TaskReminder {
  enabled:        boolean;
  offsetMinutes:  number;          // minutes before due date
  notificationId: string | null;
}

export interface RecurringConfig {
  frequency: "daily" | "weekly" | "monthly";
  interval:  number;
  endDate:   ISODate | null;
}

export interface Task {
  id:                 ID;
  projectId:          ID;
  title:              string;
  description:        string;
  priority:           Priority;
  tag:                TaskTag;
  status:             TaskStatus;
  dueDate:            ISODate | null;
  dueTime:            string | null;  // "17:00"
  reminder:           TaskReminder;
  recurring:          RecurringConfig | null;
  linkedNoteId:       ID | null;
  linkedMilestoneId:  ID | null;
  calendarEventId:    string | null;
  timeTrackedMinutes: number;
  createdAt:          ISODateTime;
  updatedAt:          ISODateTime;
}

// ─── MIND MAP ─────────────────────────────────────────────────────

export type MapNodeType = "root" | "idea" | "task" | "note" | "decision" | "risk";

export interface MapNode {
  id:       ID;
  text:     string;
  x:        number;
  y:        number;
  type:     MapNodeType;
  colour:   HexColour;
  parentId: ID | null;
}

export interface MapEdge {
  id:     ID;
  fromId: ID;
  toId:   ID;
  label:  string | null;
}

export interface MindMap {
  projectId: ID;
  nodes:     MapNode[];
  edges:     MapEdge[];
  viewport:  { x: number; y: number; zoom: number };
  updatedAt: ISODateTime;
}

// ─── TOOLS ────────────────────────────────────────────────────────

export interface ProjectLink {
  id:    ID;
  label: string;
  url:   string;
  icon:  "git" | "web" | "docs" | "staging" | "prod" | "custom";
}

export interface ProjectCommand {
  id:             ID;
  label:          string;
  command:        string;    // supports {projectRoot} and {projectName}
  cwd?:           string;
  icon?:          string;
  runInTerminal?: boolean;
}

export interface Snippet {
  id:        ID;
  label:     string;           // display name (was "title" in early drafts)
  title?:    string;           // legacy alias — kept for backup restore compat
  content:   string;
  language:  string;
  tags?:     string[];
  createdAt?: ISODateTime;
}

export interface Tools {
  projectId: ID;
  links:     ProjectLink[];
  commands:  ProjectCommand[];
  snippets:  Snippet[];
}

// ─── SETTINGS ─────────────────────────────────────────────────────

export type Theme              = "softcurse-dark" | "light" | "system";
export type NoteViewMode       = "edit" | "split" | "preview";
export type DateFormat         = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type TimeFormat         = "24h" | "12h";
export type Locale             = "en" | "ru" | "ge" | string;
export type CalendarProvider   = "google" | "outlook" | "ics" | null;
export type CalendarSyncScope  = "all" | "high-and-critical" | "none";
export type TerminalType       = "windows-terminal" | "powershell" | "cmd";
export type SyncFrequency      = "on-save" | "hourly" | "manual";

export interface CustomIDE {
  id:             ID;
  name:           string;
  executablePath: string;
  args:           string;
}

export interface AppSettings {
  // ── General ──
  launchAtStartup:   boolean;
  minimizeToTray:    boolean;
  startMinimized:    boolean;
  defaultProjectId:  ID | null;
  autoDetectIDE:     boolean;
  confirmDelete:     boolean;

  // ── Appearance ──
  theme:             Theme;
  accentColour:      HexColour;
  windowOpacity:     number;
  showGridBg:        boolean;
  glowEffects:       boolean;
  animations:        boolean;

  // ── Fonts ──
  uiFont:            string;
  editorFont:        string;
  codeFont:          string;
  fontSize:          number;
  lineHeight:        "compact" | "normal" | "relaxed";

  // ── Language / i18n ──
  locale:            Locale;
  dateFormat:        DateFormat;
  timeFormat:        TimeFormat;
  firstDayOfWeek:    "monday" | "sunday";

  // ── Notifications ──
  notificationsEnabled:          boolean;
  defaultReminderOffsetMinutes:  number;
  dailyDigest:                   boolean;
  dailyDigestTime:               string;   // "09:00"
  dndStart:                      string;   // "22:00"
  dndEnd:                        string;   // "08:00"
  overdueAlert:                  boolean;
  notificationSound:             boolean;

  // ── Calendar ──
  calendarProvider:        CalendarProvider;
  calendarAccessToken:     string | null;
  calendarRefreshToken:    string | null;
  calendarSyncScope:       CalendarSyncScope;
  calendarSyncMilestones:  boolean;
  calendarSyncFrequency:   SyncFrequency;

  // ── IDE integration ──
  vscodePath:  string | null;
  vstudioPath: string | null;
  customIDEs:  CustomIDE[];
  terminal:    TerminalType;
  gitPath:     string | null;

  // ── GitHub Gist sync ──
  githubSyncEnabled:    boolean;
  githubToken:          string | null;   // stored encrypted
  githubGistId:         string | null;
  githubSyncFrequency:  SyncFrequency;
  githubLastSyncAt:     ISODateTime | null;

  // ── Hotkeys ──
  hotkeyGlobalShow:    string;   // "Ctrl+Shift+D"
  hotkeyQuickCapture:  string;   // "Ctrl+Shift+Space"
  hotkeyNewProject:    string;
  hotkeyNewTask:       string;
  hotkeyNewNote:       string;
  hotkeySwitchProject: string;

  // ── Data ──
  dataPath:    string | null;
  autoBackup:  boolean;
  backupCount: number;

  // ── UI state (persisted) ──
  autosaveDelayMs:  number;
  noteViewMode:     NoteViewMode;
  sidebarWidth:     number;
  activeProjectId:  ID | null;

  // Pomodoro
  pomodoroDurationMins: number;

  // AI
  aiApiKey:         string | null;

  // Appearance extras (persisted)
  resolution:       string;

  // Onboarding
  onboardingComplete: boolean;

  // Calendar OAuth (stored locally only)
  calendarTokens:     { access_token: string; refresh_token: string; expires_at: number } | null;
  googleClientId:     string;
  googleClientSecret: string;
  calendarAutoPush:   boolean;
}

// ─── ROOT DATA SHAPE ──────────────────────────────────────────────
// Serialised to: %APPDATA%\DevNotes\data.json  (Windows)
//                @capacitor/preferences         (Android)
//                GitHub Gist (optional sync)

// ─── DECISION LOG ─────────────────────────────────────────────────

export type DecisionStatus = "proposed" | "accepted" | "rejected" | "deferred";

export interface Decision {
  id:          ID;
  projectId:   ID;
  title:       string;
  context:     string;       // what problem we are solving
  options:     string;       // options considered
  outcome:     string;       // decision taken + rationale
  status:      DecisionStatus;
  decisionDate: ISODate | null;
  decidedBy:   string;
  tags:        string[];
  linkedTaskId: ID | null;
  createdAt:   ISODateTime;
  updatedAt:   ISODateTime;
}

// ─── DAILY STANDUP ────────────────────────────────────────────────

export interface StandupEntry {
  id:        ID;
  projectId: ID;
  date:      ISODate;         // "YYYY-MM-DD"
  yesterday: string;
  today:     string;
  blockers:  string;
  mood:      1 | 2 | 3 | 4 | 5;
  createdAt: ISODateTime;
}

// ─── POMODORO ─────────────────────────────────────────────────────

export interface PomodoroSession {
  id:        ID;
  projectId: ID;
  taskId:    ID | null;
  startedAt: ISODateTime;
  endedAt:   ISODateTime | null;
  duration:  number;           // minutes (usually 25)
  completed: boolean;
}

// ─── ROOT DATA SHAPE ──────────────────────────────────────────────

export interface AppData {
  version:   2;
  projects:  Project[];
  plans:     Plan[];
  notes:     Note[];
  todoLists: TodoList[];
  tasks:     Task[];
  mindMaps:  MindMap[];
  tools:     Tools[];
  decisions: Decision[];
  standups:  StandupEntry[];
  pomodoros: PomodoroSession[];
  settings:  AppSettings;
}

// ─── UI STATE (never persisted) ───────────────────────────────────

export type ProjectTab =
  | "dashboard" | "plan"     | "notes"    | "todos"
  | "tasks"     | "mindmap"  | "tools"
  | "gantt"     | "standup"  | "decisions"
  | "settings";

export interface TaskFilter {
  search:   string;
  priority: Priority | "all";
  tag:      TaskTag  | "all";
  status:   TaskStatus | "all";
}

export interface NoteFilter {
  search: string;
  tag:    string | "all";
}

// ─── GITHUB SYNC STATE ────────────────────────────────────────────

export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface SyncState {
  status:        SyncStatus;
  lastSyncAt:    ISODateTime | null;
  errorMessage:  string | null;
}

// ─── QUICK CAPTURE ────────────────────────────────────────────────

export type QuickCaptureType = "note" | "task" | "todo";
