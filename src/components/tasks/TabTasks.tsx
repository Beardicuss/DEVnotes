import { useState } from "react";
import { useAppStore, selTasks, selActiveProject } from "@/stores/useAppStore";
import { isOverdue, shortDate } from "@/utils/date";
import { createEvent, taskToGCalEvent, updateEvent, deleteEvent } from "@/integrations/calendar/google";
import { generateICS, exportICS } from "@/integrations/calendar/ics";
import type { Task, Priority, TaskStatus } from "@/types";
import s from "./TabTasks.module.css";
import ExportDialog from "@/components/export/ExportDialog";

type ViewMode = "list" | "kanban";
const STATUSES: TaskStatus[] = ["backlog","todo","in-progress","done","archived"];
const PRIORITIES: Priority[] = ["critical","high","medium","low"];
const FREQ_LABELS: Record<string,string> = {
  daily:"Daily", weekly:"Weekly", biweekly:"Every 2 weeks", monthly:"Monthly", yearly:"Yearly"
};
const KANBAN_COLS = [
  { status: "backlog"     as TaskStatus, label: "Backlog",     colour: "var(--text-dim)" },
  { status: "todo"        as TaskStatus, label: "To Do",       colour: "var(--blue)" },
  { status: "in-progress" as TaskStatus, label: "In Progress", colour: "var(--yellow)" },
  { status: "done"        as TaskStatus, label: "Done",        colour: "var(--green)" },
];

export default function TabTasks() {
  const project    = useAppStore(selActiveProject);
  const tasks      = useAppStore(selTasks);
  const addTask    = useAppStore((s) => s.addTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const settings   = useAppStore((s) => s.data.settings);
  const taskFilter = useAppStore((s) => s.taskFilter);
  const setFilter  = useAppStore((s) => s.setTaskFilter);
  const [view, setView]         = useState<ViewMode>("list");
  const [editId, setEditId]     = useState<string | null>(null);
  const [calPushing, setCalPushing] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  if (!project) return null;

  // selTasks already applies all taskFilter criteria (search, priority, status, projectId)
  // so `tasks` here is the correctly filtered list — no memo needed
  const visible = tasks;

  const handleExportICS = async () => {
    const content = generateICS({ tasks: visible });
    await exportICS(content, `${project.name}-tasks.ics`);
  };

  const handlePushGCal = async (task: Task) => {
    const token = settings.calendarAccessToken;
    if (!token) { alert("Connect Google Calendar in Settings → Calendar first."); return; }
    setCalPushing(task.id);
    try {
      const event = taskToGCalEvent(task);
      if (task.calendarEventId) {
        await updateEvent(token, task.calendarEventId, "primary", event);
      } else {
        const created = await createEvent(token, "primary", event);
        updateTask(task.id, { calendarEventId: created.id ?? null });
      }
    } catch (e: any) { alert(`Calendar sync failed: ${e.message}`); }
    setCalPushing(null);
  };

  const handleUnlinkGCal = async (task: Task) => {
    const token = settings.calendarAccessToken;
    if (token && task.calendarEventId) { try { await deleteEvent(token, task.calendarEventId); } catch {} }
    updateTask(task.id, { calendarEventId: null });
  };

  const editTask = tasks.find((t) => t.id === editId);

  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        <button className="btn" onClick={() => setExportOpen(true)} title="Export tasks">⬇ Export</button>
        <button className="btn btn-primary" onClick={() => { const id = addTask({}); setEditId(id); }}>+ New Task</button>
        <div className={s.filters}>
          <input className={`input ${s.search}`} placeholder="Search tasks…"
            value={taskFilter.search} onChange={(e) => setFilter({ search: e.target.value })} />
          <select className="input" value={taskFilter.status} onChange={(e) => setFilter({ status: e.target.value as import("@/types").TaskStatus | "all" })}>
            <option value="all">All statuses</option>
            {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
          <select className="input" value={taskFilter.priority} onChange={(e) => setFilter({ priority: e.target.value as import("@/types").Priority | "all" })}>
            <option value="all">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className={s.viewToggle}>
          <button className={`${s.viewBtn} ${view==="list"   ? s.viewActive:""}`} onClick={() => setView("list")}>☰ List</button>
          <button className={`${s.viewBtn} ${view==="kanban" ? s.viewActive:""}`} onClick={() => setView("kanban")}>⊞ Kanban</button>
        </div>
        <button className="btn" onClick={handleExportICS} title="Export as .ics">↓ .ics</button>
      </div>

      {view === "list" ? (
        <div className={s.list}>
          {!visible.length && <div className={s.empty}>No tasks match the current filter.</div>}
          {visible.map((task) => {
            const overdue = isOverdue(task.dueDate) && task.status !== "done";
            return (
              <div key={task.id} className={`${s.row} ${overdue?s.rowOverdue:""} ${task.status==="done"?s.rowDone:""}`}>
                <input type="checkbox" className={s.cb}
                  checked={task.status === "done"}
                  onChange={() => updateTask(task.id, { status: task.status==="done"?"todo":"done" })} />
                <span className={`${s.rowTitle} ${task.status==="done"?s.strikethrough:""}`}
                  onClick={() => setEditId(task.id)}>{task.title}</span>
                <div className={s.rowMeta}>
                  {task.dueDate && (
                    <span className={`${s.due} ${overdue?s.dueOverdue:""}`}>
                      {overdue?"⚠ ":"📅 "}{shortDate(task.dueDate)}{task.dueTime?` ${task.dueTime}`:""}
                    </span>
                  )}
                  {task.reminder?.enabled && <span className={s.badge} title="Reminder set">🔔</span>}
                  {task.recurring && <span className={s.badge} title={FREQ_LABELS[task.recurring.frequency]}>↻</span>}
                  <span className={`chip chip-${task.priority}`}>{task.priority}</span>
                  <span className={`chip chip-status-${task.status}`}>{task.status}</span>
                </div>
                <div className={s.rowActions}>
                  {task.calendarEventId
                    ? <button className={s.actionBtn} onClick={() => handleUnlinkGCal(task)} title="Unlink calendar">📅✕</button>
                    : <button className={s.actionBtn} onClick={() => handlePushGCal(task)} disabled={calPushing===task.id} title="Push to Google Calendar">
                        {calPushing===task.id?"…":"📅"}
                      </button>}
                  <button className={s.actionBtn} onClick={() => setEditId(task.id)} title="Edit">✏</button>
                  <button className={`${s.actionBtn} ${s.deleteBtn}`} onClick={() => deleteTask(task.id)} title="Delete">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={s.kanban}>
          {KANBAN_COLS.map((col) => {
            const colTasks = visible.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className={s.kanbanCol}>
                <div className={s.kanbanColHeader} style={{ borderTopColor: col.colour }}>
                  <span style={{ color: col.colour }}>{col.label}</span>
                  <span className={s.kanbanCount}>{colTasks.length}</span>
                </div>
                <div className={s.kanbanCards}>
                  {colTasks.map((task) => (
                    <div key={task.id} className={`${s.kanbanCard} ${isOverdue(task.dueDate)&&task.status!=="done"?s.kanbanOverdue:""}`}
                      onClick={() => setEditId(task.id)}>
                      <div className={s.kanbanTitle}>{task.title}</div>
                      <div className={s.kanbanCardMeta}>
                        {task.dueDate && <span className={s.due}>📅 {shortDate(task.dueDate)}</span>}
                        <span className={`chip chip-${task.priority}`}>{task.priority}</span>
                      </div>
                      <div className={s.kanbanMove}>
                        {KANBAN_COLS.filter((c) => c.status !== col.status).map((c) => (
                          <button key={c.status} className={s.moveBtn} style={{ color: c.colour }}
                            onClick={(e) => { e.stopPropagation(); updateTask(task.id, { status: c.status }); }}>
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editId && editTask && (
        <div className={s.overlay} onClick={() => setEditId(null)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <span className={s.modalTitle}>EDIT TASK</span>
              <button className="btn-icon" onClick={() => setEditId(null)}>✕</button>
            </div>
            <TaskEditorFields task={editTask} onUpdate={(p) => updateTask(editId, p)}
              onPushGCal={() => handlePushGCal(editTask)} calPushing={calPushing===editId} />
          </div>
        </div>
      )}
      {exportOpen && <ExportDialog target="tasks" onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function TaskEditorFields({ task, onUpdate, onPushGCal, calPushing }: {
  task: Task; onUpdate: (p: Partial<Task>) => void; onPushGCal: () => void; calPushing: boolean;
}) {
  const u = onUpdate;
  return (
    <div className={s.editorFields}>
      <div className={s.field}><label className={s.fieldLabel}>Title</label>
        <input className="input" value={task.title} onChange={(e) => u({ title: e.target.value })} autoFocus /></div>
      <div className={s.field}><label className={s.fieldLabel}>Description</label>
        <textarea className="input" rows={3} value={task.description} onChange={(e) => u({ description: e.target.value })} /></div>
      <div className={s.row2}>
        <div className={s.field}><label className={s.fieldLabel}>Priority</label>
          <select className="input" value={task.priority} onChange={(e) => u({ priority: e.target.value as import("@/types").Priority })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select></div>
        <div className={s.field}><label className={s.fieldLabel}>Status</label>
          <select className="input" value={task.status} onChange={(e) => u({ status: e.target.value as import("@/types").TaskStatus })}>
            {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select></div>
      </div>
      <div className={s.row2}>
        <div className={s.field}><label className={s.fieldLabel}>Due date</label>
          <input className="input" type="date" value={task.dueDate ?? ""} onChange={(e) => u({ dueDate: e.target.value || null })} /></div>
        <div className={s.field}><label className={s.fieldLabel}>Due time</label>
          <input className="input" type="time" value={task.dueTime ?? ""} onChange={(e) => u({ dueTime: e.target.value || null })} /></div>
      </div>
      <div className={s.field}><label className={s.fieldLabel}>Reminder</label>
        <div className={s.reminderRow}>
          <label className={s.toggle}>
            <input type="checkbox" checked={task.reminder?.enabled??false}
              onChange={(e) => u({ reminder: { ...task.reminder, enabled: e.target.checked } })} />
            Enable
          </label>
          {task.reminder?.enabled && (
            <select className="input" style={{ flex:1 }} value={task.reminder.offsetMinutes}
              onChange={(e) => u({ reminder: { ...task.reminder, offsetMinutes: Number(e.target.value) } })}>
              {[[5,"5 min"],[15,"15 min"],[30,"30 min"],[60,"1 hour"],[120,"2 hours"],[480,"8 hours"],[1440,"1 day"],[2880,"2 days"]]
                .map(([v,l]) => <option key={v} value={v}>{l} before</option>)}
            </select>
          )}
        </div>
      </div>
      <div className={s.field}><label className={s.fieldLabel}>Repeat</label>
        <select className="input" value={task.recurring?.frequency ?? ""}
          onChange={(e) => u({ recurring: e.target.value ? { frequency: e.target.value as import("@/types").RecurringConfig["frequency"], interval: 1, endDate: null } : null })}>
          <option value="">No repeat</option>
          {Object.entries(FREQ_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className={s.field}><label className={s.fieldLabel}>Google Calendar</label>
        <div className={s.calRow}>
          {task.calendarEventId
            ? <span className={s.calLinked}>✓ Linked</span>
            : <span className={s.calUnlinked}>Not synced</span>}
          <button className="btn" onClick={onPushGCal} disabled={calPushing || !task.dueDate}>
            {calPushing ? "Pushing…" : task.calendarEventId ? "↑ Update" : "↑ Push"}
          </button>
          {!task.dueDate && <span className={s.calHint}>Set due date first</span>}
        </div>
      </div>
    </div>
  );
}
