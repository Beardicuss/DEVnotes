import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, selTasks, selActiveProject } from "@/stores/useAppStore";
import s from "./TabGantt.module.css";

type GanttItem = {
  id: string;
  label: string;
  start: string;   // ISO date
  end: string;   // ISO date
  colour: string;
  kind: "task" | "milestone";
  status: string;
  priority?: string;
};

const PRIORITY_COLOURS: Record<string, string> = {
  critical: "var(--red)",
  high: "var(--orange, #ff8800)",
  medium: "var(--cyan)",
  low: "var(--text-dim)",
};
const STATUS_COLOURS: Record<string, string> = {
  done: "var(--green)",
  "in-progress": "var(--yellow)",
  backlog: "var(--border)",
  todo: "var(--blue)",
};

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}
function today(): string { return new Date().toISOString().slice(0, 10); }

export default function TabGantt() {
  const { t } = useTranslation();
  const project = useAppStore(selActiveProject);
  const tasks = useAppStore(selTasks);
  const plans = useAppStore((s) => s.data.plans);
  const _updateTask = useAppStore((s) => s.updateTask);

  const [zoom, setZoom] = useState<"week" | "month" | "quarter">("month");
  const [showDone, setShowDone] = useState(false);
  if (!project) return null;

  const plan = plans.find((p) => p.projectId === project.id);

  // Build items
  const items = useMemo<GanttItem[]>(() => {
    const list: GanttItem[] = [];

    // Tasks with due dates — selTasks already filtered by active project
    const projTasks = tasks.filter(
      (t) => t.dueDate && (showDone || t.status !== "done")
    );
    for (const t of projTasks) {
      list.push({
        id: t.id,
        label: t.title,
        start: t.dueDate!,
        end: t.dueDate!,
        colour: STATUS_COLOURS[t.status] ?? PRIORITY_COLOURS[t.priority] ?? "var(--cyan)",
        kind: "task",
        status: t.status,
        priority: t.priority,
      });
    }

    // Milestones from plan
    for (const ms of plan?.milestones ?? []) {
      if (!ms.date) continue;
      list.push({
        id: ms.id,
        label: ms.title,
        start: ms.date,
        end: ms.date,
        colour: ms.status === "done" ? "var(--green)" : "var(--magenta, #ff00ff)",
        kind: "milestone",
        status: ms.status,
      });
    }

    return list.sort((a, b) => a.start.localeCompare(b.start));
  }, [tasks, plan, project.id, showDone]);

  // Viewport range
  const viewDays = zoom === "week" ? 14 : zoom === "month" ? 60 : 120;
  const viewStart = useMemo(() => {
    const earliest = items[0]?.start ?? today();
    // Start a few days before earliest item; zoom changes may alter desired anchor
    return addDays(earliest, -3);
  }, [items, zoom]);
  const viewEnd = addDays(viewStart, viewDays);

  // Day columns
  const cols: string[] = [];
  let d = viewStart;
  while (d <= viewEnd) { cols.push(d); d = addDays(d, 1); }

  const pxPerDay = zoom === "week" ? 60 : zoom === "month" ? 28 : 14;
  const totalW = cols.length * pxPerDay;

  // Today marker position
  const todayOffset = Math.max(0, daysBetween(viewStart, today())) * pxPerDay;

  const getBar = (item: GanttItem) => {
    const left = Math.max(0, daysBetween(viewStart, item.start)) * pxPerDay;
    const span = Math.max(1, daysBetween(item.start, item.end) + 1);
    const width = span * pxPerDay;
    return { left, width };
  };

  // Month labels
  const months: { label: string; left: number; width: number }[] = [];
  let prevMonth = "";
  for (let i = 0; i < cols.length; i++) {
    const m = cols[i].slice(0, 7);
    if (m !== prevMonth) {
      prevMonth = m;
      const end = cols.findIndex((c, j) => j > i && !c.startsWith(m));
      const span = (end === -1 ? cols.length : end) - i;
      months.push({ label: new Date(cols[i]).toLocaleDateString(undefined, { month: "short", year: "2-digit" }), left: i * pxPerDay, width: span * pxPerDay });
    }
  }

  return (
    <div className={s.root}>
      {/* Toolbar */}
      <div className={s.toolbar}>
        <span className={s.title}>{t("gantt.title")}</span>
        <div className={s.zoomBtns}>
          {(["week", "month", "quarter"] as const).map((z) => (
            <button key={z} className={`${s.zoomBtn} ${zoom === z ? s.zoomActive : ""}`} onClick={() => setZoom(z)}>
              {t(`gantt.${z}`)}
            </button>
          ))}
        </div>
        <label className={s.toggle}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          {t("gantt.showDone")}
        </label>
        {!items.length && <span className={s.hint}>{t("gantt.addTasksHint")}</span>}
      </div>

      {items.length === 0 && (
        <div className={s.empty}>
          <div className={s.emptyIcon}>📅</div>
          <div>{t("gantt.empty.title")}</div>
          <div className={s.emptyHint}>{t("gantt.empty.hint")}</div>
        </div>
      )}

      {items.length > 0 && (
        <div className={s.ganttWrap}>
          {/* Row labels */}
          <div className={s.labels}>
            <div className={s.labelHeader}>
              <span className={s.labelHeaderText}>{t("gantt.item")}</span>
            </div>
            {/* Month spacer */}
            <div className={s.monthSpacer} />
            {/* Day header spacer */}
            <div className={s.dayHeaderSpacer} />
            {items.map((item) => (
              <div key={item.id} className={`${s.labelRow} ${item.kind === "milestone" ? s.labelMilestone : ""}`}>
                <span className={s.labelKind} style={{ color: item.colour }}>
                  {item.kind === "milestone" ? "◆" : "▬"}
                </span>
                <span className={s.labelText} title={item.label}>{item.label}</span>
                {item.priority && (
                  <span className={`chip chip-${item.priority}`} style={{ marginLeft: "auto", fontSize: "0.65em" }}>{item.priority}</span>
                )}
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className={s.chart}>
            <div className={s.chartInner} style={{ width: totalW }}>
              {/* Month row */}
              <div className={s.monthRow} style={{ width: totalW }}>
                {months.map((m) => (
                  <div key={m.label + m.left} className={s.monthCell}
                    style={{ left: m.left, width: m.width }}>
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Day header */}
              <div className={s.dayRow} style={{ width: totalW }}>
                {cols.map((col, i) => {
                  const isToday = col === today();
                  const dow = new Date(col).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <div key={col} className={`${s.dayCell} ${isToday ? s.dayCellToday : ""} ${isWeekend ? s.dayCellWeekend : ""}`}
                      style={{ width: pxPerDay }}>
                      {pxPerDay >= 24 ? new Date(col).getDate() : ""}
                    </div>
                  );
                })}
              </div>

              {/* Grid + bars */}
              <div className={s.barsArea} style={{ width: totalW }}>
                {/* Vertical grid lines */}
                {cols.map((col, i) => {
                  const dow = new Date(col).getDay();
                  return (
                    <div key={col} className={`${s.gridLine} ${(dow === 0 || dow === 6) ? s.gridWeekend : ""}`}
                      style={{ left: i * pxPerDay, width: pxPerDay }} />
                  );
                })}

                {/* Today marker */}
                <div className={s.todayLine} style={{ left: todayOffset }} />

                {/* Bars */}
                {items.map((item) => {
                  const { left, width } = getBar(item);
                  const isMilestone = item.kind === "milestone";
                  return (
                    <div key={item.id} className={`${s.barRow}`}>
                      {isMilestone ? (
                        <div className={s.milestoneMarker}
                          style={{ left: left + pxPerDay / 2, color: item.colour }}
                          title={`${item.label} — ${item.start}`}>
                          ◆
                        </div>
                      ) : (
                        <div
                          className={`${s.bar} ${item.status === "done" ? s.barDone : ""}`}
                          style={{ left, width: Math.max(width, 8), background: item.colour }}
                          title={`${item.label}\n${item.start}${item.end !== item.start ? " → " + item.end : ""}\n[${item.priority}] ${item.status}`}
                        >
                          {width > 50 && <span className={s.barLabel}>{item.label}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {items.length > 0 && (
        <div className={s.legend}>
          {Object.entries(STATUS_COLOURS).map(([k, v]) => (
            <span key={k} className={s.legendItem}>
              <span className={s.legendDot} style={{ background: v }} />
              {t(`gantt.status.${k}`)}
            </span>
          ))}
          <span className={s.legendItem}>
            <span style={{ color: "var(--magenta, #ff00ff)" }}>◆</span> {t("gantt.milestone")}
          </span>
          <span className={s.legendItem} style={{ color: "var(--red)" }}>│ {t("gantt.today")}</span>
        </div>
      )}
    </div>
  );
}
