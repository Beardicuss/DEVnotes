import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore, selTasks, selActiveProject } from "@/stores/useAppStore";
import { sendNotification } from "@/utils/platform";
import s from "./Pomodoro.module.css";

type Mode = "work" | "short-break" | "long-break";

const DURATIONS: Record<Mode, number> = {
  "work":        25 * 60,
  "short-break":  5 * 60,
  "long-break":  15 * 60,
};

const MODE_LABELS: Record<Mode, string> = {
  "work":        "Focus",
  "short-break": "Short Break",
  "long-break":  "Long Break",
};

const MODE_COLOURS: Record<Mode, string> = {
  "work":        "var(--cyan)",
  "short-break": "var(--green)",
  "long-break":  "var(--blue)",
};

export default function Pomodoro({ onClose: _onClose }: { onClose?: () => void }) {
  const project      = useAppStore(selActiveProject);
  const tasks        = useAppStore(selTasks);
  const addPomodoro    = useAppStore((s) => s.addPomodoro);
  const pomodoros      = useAppStore((s) => s.data.pomodoros ?? []);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const savedDuration  = useAppStore((s) => s.data.settings.pomodoroDurationMins ?? 25);

  const [mode,       setMode]       = useState<Mode>("work");
  const [timeLeft,   setTimeLeft]   = useState(DURATIONS["work"]);
  const [running,    setRunning]    = useState(false);
  const [cycle,      setCycle]      = useState(1);   // pomodoro number
  const [taskId,     setTaskId]     = useState<string | null>(null);
  const [minimised,  setMinimised]  = useState(false);
  const [customWork, setCustomWork] = useState<number>(savedDuration);
  const [showSettings, setShowSettings] = useState(false);

  const startedAt = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // selTasks already filters by active project and excludes archived
  const projectTasks = tasks.filter(
    (t) => t.status !== "done"
  );

  // Today's stats
  const today        = new Date().toISOString().slice(0, 10);
  const todaySessions = pomodoros.filter(
    (p) => p.projectId === project?.id && p.startedAt.slice(0, 10) === today && p.completed
  );

  const tick = useCallback(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        // Timer finished
        setRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);

        // Record completed pomodoro
        if (mode === "work" && project) {
          addPomodoro({
            projectId: project.id,
            taskId,
            startedAt: startedAt.current ?? new Date().toISOString(),
            endedAt:   new Date().toISOString(),
            duration:  customWork,
            completed: true,
          });
          sendNotification("🍅 Pomodoro complete!", `${customWork} min focus session done. Take a break.`);

          // Auto-advance cycle
          if (cycle % 4 === 0) {
            setMode("long-break");
            setTimeLeft(DURATIONS["long-break"]);
          } else {
            setMode("short-break");
            setTimeLeft(DURATIONS["short-break"]);
          }
          setCycle((c) => c + 1);
        } else {
          sendNotification("⏰ Break over!", "Time to focus.");
          setMode("work");
          setTimeLeft(customWork * 60);
        }
        return 0;
      }
      return prev - 1;
    });
  }, [mode, project, taskId, cycle, customWork, addPomodoro]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, tick]);

  const handleStart = () => {
    startedAt.current = new Date().toISOString();
    setRunning(true);
  };

  const handlePause  = () => setRunning(false);

  const handleReset  = () => {
    setRunning(false);
    setTimeLeft(mode === "work" ? customWork * 60 : DURATIONS[mode]);
  };

  const switchMode = (m: Mode) => {
    setRunning(false);
    setMode(m);
    setTimeLeft(m === "work" ? customWork * 60 : DURATIONS[m]);
  };

  const applyCustomWork = () => {
    if (mode === "work") setTimeLeft(customWork * 60);
    updateSettings({ pomodoroDurationMins: customWork });
    setShowSettings(false);
  };

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");
  const total    = mode === "work" ? customWork * 60 : DURATIONS[mode];
  const progress = ((total - timeLeft) / total) * 100;

  const colour = MODE_COLOURS[mode];

  if (minimised) {
    return (
      <div className={s.mini} onClick={() => setMinimised(false)}>
        <span className={s.miniTimer} style={{ color: colour }}>
          {running ? "🍅" : "⏸"} {mins}:{secs}
        </span>
      </div>
    );
  }

  return (
    <div className={s.root}>
      {/* Header */}
      <div className={s.header}>
        <span className={s.title}>POMODORO</span>
        <div className={s.headerRight}>
          <button className={s.iconBtn} onClick={() => setShowSettings(!showSettings)} title="Settings">⚙</button>
          <button className={s.iconBtn} onClick={() => setMinimised(true)} title="Minimise">─</button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className={s.modes}>
        {(["work", "short-break", "long-break"] as Mode[]).map((m) => (
          <button key={m}
            className={`${s.modeBtn} ${mode === m ? s.modeBtnActive : ""}`}
            style={mode === m ? { borderBottomColor: MODE_COLOURS[m], color: MODE_COLOURS[m] } : {}}
            onClick={() => switchMode(m)}>
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Timer ring */}
      <div className={s.timerWrap}>
        <svg className={s.ring} viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle cx="60" cy="60" r="54" fill="none"
            stroke={colour} strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 54}`}
            strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s linear", transformOrigin: "center", transform: "rotate(-90deg)" }}
          />
        </svg>
        <div className={s.timerInner}>
          <span className={s.time} style={{ color: colour }}>{mins}:{secs}</span>
          <span className={s.modeLabel}>{MODE_LABELS[mode]}</span>
          <span className={s.cycleLabel}>#{cycle}</span>
        </div>
      </div>

      {/* Controls */}
      <div className={s.controls}>
        {!running ? (
          <button className={s.startBtn} style={{ borderColor: colour, color: colour }} onClick={handleStart}>
            ▶ Start
          </button>
        ) : (
          <button className={s.startBtn} style={{ borderColor: colour, color: colour }} onClick={handlePause}>
            ⏸ Pause
          </button>
        )}
        <button className={s.resetBtn} onClick={handleReset}>↺ Reset</button>
      </div>

      {/* Task selector */}
      <div className={s.taskSel}>
        <label className={s.taskLabel}>FOCUSING ON</label>
        <select className="input" value={taskId ?? ""}
          onChange={(e) => setTaskId(e.target.value || null)}>
          <option value="">— No specific task —</option>
          {projectTasks.map((t) => (
            <option key={t.id} value={t.id}>[{t.priority}] {t.title}</option>
          ))}
        </select>
      </div>

      {/* Today's stats */}
      <div className={s.stats}>
        <div className={s.statItem}>
          <span className={s.statVal} style={{ color: colour }}>{todaySessions.length}</span>
          <span className={s.statKey}>today</span>
        </div>
        <div className={s.statItem}>
          <span className={s.statVal} style={{ color: colour }}>
            {todaySessions.reduce((acc, p) => acc + p.duration, 0)}
          </span>
          <span className={s.statKey}>min focused</span>
        </div>
        <div className={s.statItem}>
          <span className={s.statVal} style={{ color: colour }}>
            {pomodoros.filter((p) => p.projectId === project?.id && p.completed).length}
          </span>
          <span className={s.statKey}>total</span>
        </div>
      </div>

      {/* Custom duration settings */}
      {showSettings && (
        <div className={s.settings}>
          <label className={s.taskLabel}>WORK DURATION (MIN)</label>
          <div style={{ display: "flex", gap: "0.5em", alignItems: "center" }}>
            <input className="input" type="number" min={1} max={90}
              value={customWork}
              onChange={(e) => setCustomWork(Number(e.target.value))}
              style={{ width: "5em" }} />
            <button className="btn btn-primary" onClick={applyCustomWork}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
