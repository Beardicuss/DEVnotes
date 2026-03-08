import { useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { RESOLUTIONS, applyResolution, type ResolutionKey } from "@/utils/resolution";
import s from "./Onboarding.module.css";

const STEPS = ["Welcome", "Resolution", "Theme", "First Project", "Done"] as const;
type Step = typeof STEPS[number];

const THEMES = [
  { id: "dark",    label: "Dark",     preview: "#020202" },
  { id: "darker",  label: "Darker",   preview: "#000000" },
  { id: "dracula", label: "Dracula",  preview: "#282a36" },
  { id: "nord",    label: "Nord",     preview: "#2e3440" },
] as const;

const PROJECT_TEMPLATES = [
  { id: "blank",    label: "Blank",         icon: "◻", desc: "Empty project, you decide the structure." },
  { id: "webapp",   label: "Web App",        icon: "🌐", desc: "Frontend/backend, sprints, deployment tasks." },
  { id: "mobile",   label: "Mobile App",     icon: "📱", desc: "iOS/Android, QA checklists, store releases." },
  { id: "library",  label: "Library / SDK",  icon: "📦", desc: "Versioning, changelog, docs, package publishing." },
  { id: "personal", label: "Personal",       icon: "🧑", desc: "Side project or solo dev work." },
];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const updateSettings = useAppStore((s) => s.updateSettings);
  const addProject     = useAppStore((s) => s.addProject);
  const addTask        = useAppStore((s) => s.addTask);
  const openProject    = useAppStore((s) => s.openProject);

  const [step,         setStep]         = useState<Step>("Welcome");
  const [resolution,   setResolution]   = useState<ResolutionKey>("fhd");
  const [theme,        setTheme]        = useState("dark");
  const [projectName,  setProjectName]  = useState("");
  const [template,     setTemplate]     = useState("blank");
  const [githubToken,  setGithubToken]  = useState("");
  const [skipGithub,   setSkipGithub]   = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const progress  = (stepIndex / (STEPS.length - 1)) * 100;

  const handleResolutionChange = (key: ResolutionKey) => {
    setResolution(key);
    applyResolution(key);
  };

  const handleNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const handleBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handleFinish = () => {
    // Apply all settings
    updateSettings({
      resolution,
      theme: theme as any,
      githubToken: (skipGithub || !githubToken) ? null : githubToken,
      githubSyncEnabled: !skipGithub && !!githubToken,
      onboardingComplete: true,
    } as any);
    applyResolution(resolution);

    // Create first project from template
    if (projectName.trim()) {
      const projectId = addProject({
        name: projectName.trim(),
        icon: PROJECT_TEMPLATES.find((t) => t.id === template)?.icon ?? "◻",
        status: "active",
      });
      openProject(projectId);

      // Seed template tasks
      if (template === "webapp") {
        const seeds = ["Set up dev environment", "Design API schema", "Build auth flow", "Write first tests"];
        seeds.forEach((title) => addTask({ projectId, title, priority: "medium" }));
      } else if (template === "mobile") {
        const seeds = ["Set up project", "Design screens", "Implement core flow", "Test on device"];
        seeds.forEach((title) => addTask({ projectId, title, priority: "medium" }));
      }
    }

    onComplete();
  };

  return (
    <div className={s.overlay}>
      <div className={s.wizard}>
        {/* Progress bar */}
        <div className={s.progressBar}>
          <div className={s.progressFill} style={{ width: `${progress}%` }} />
        </div>

        {/* Step indicators */}
        <div className={s.stepNav}>
          {STEPS.map((st, i) => (
            <div key={st} className={`${s.stepDot} ${i <= stepIndex ? s.stepDotActive : ""}`}>
              <span className={s.stepNum}>{i + 1}</span>
              <span className={s.stepLabel}>{st}</span>
            </div>
          ))}
        </div>

        {/* ── Welcome ── */}
        {step === "Welcome" && (
          <div className={s.stepContent}>
            <div className={s.bigIcon}>⌨</div>
            <h1 className={s.heading}>Welcome to DevNotes</h1>
            <p className={s.subheading}>
              Your local-first developer workspace. Let's get you set up in about 60 seconds.
            </p>
            <div className={s.featureGrid}>
              {[
                ["📋", "Tasks & Kanban", "Track work with priorities, due dates, and reminders"],
                ["📝", "Notes",          "Markdown notes linked to your projects"],
                ["🗺", "Mind Maps",      "Visual brainstorming canvas"],
                ["📅", "Calendar",       "Sync to Google Calendar or export .ics"],
                ["🍅", "Pomodoro",       "Focus timer with session tracking"],
                ["📊", "Gantt",          "Timeline view of tasks and milestones"],
              ].map(([icon, label, desc]) => (
                <div key={label} className={s.featureCard}>
                  <span className={s.featureIcon}>{icon}</span>
                  <span className={s.featureLabel}>{label}</span>
                  <span className={s.featureDesc}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Resolution ── */}
        {step === "Resolution" && (
          <div className={s.stepContent}>
            <h2 className={s.heading}>Choose Your Screen Resolution</h2>
            <p className={s.subheading}>This scales the entire UI to fit your monitor perfectly.</p>
            <div className={s.resGrid}>
              {(Object.entries(RESOLUTIONS) as [ResolutionKey, typeof RESOLUTIONS[ResolutionKey]][]).map(([key, preset]) => (
                <button key={key}
                  className={`${s.resCard} ${resolution === key ? s.resActive : ""}`}
                  onClick={() => handleResolutionChange(key)}>
                  <span className={s.resLabel}>{preset.label}</span>
                  <span className={s.resDim}>{preset.width}×{preset.height}</span>
                  <span className={s.resNote}>{key === "fhd" ? "Recommended" : key === "hd" ? "Laptop" : key === "qhd" ? "Hi-DPI" : "Large"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Theme ── */}
        {step === "Theme" && (
          <div className={s.stepContent}>
            <h2 className={s.heading}>Pick a Theme</h2>
            <p className={s.subheading}>You can change this any time in Settings → Appearance.</p>
            <div className={s.themeGrid}>
              {THEMES.map((t) => (
                <button key={t.id}
                  className={`${s.themeCard} ${theme === t.id ? s.themeActive : ""}`}
                  onClick={() => setTheme(t.id)}>
                  <div className={s.themePreview} style={{ background: t.preview }}>
                    <div className={s.previewTitlebar} />
                    <div className={s.previewSidebar} />
                    <div className={s.previewContent}>
                      <div className={s.previewLine} />
                      <div className={s.previewLine} style={{ width: "60%" }} />
                      <div className={s.previewLine} style={{ width: "80%" }} />
                    </div>
                  </div>
                  <span className={s.themeLabel}>{t.label}</span>
                  {theme === t.id && <span className={s.themeCheck}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── First Project ── */}
        {step === "First Project" && (
          <div className={s.stepContent}>
            <h2 className={s.heading}>Create Your First Project</h2>
            <p className={s.subheading}>You can always add more later.</p>

            <div className={s.field}>
              <label className={s.fieldLabel}>Project Name</label>
              <input className="input" style={{ fontSize: "var(--fs-md)", padding: "0.6em 0.9em" }}
                placeholder="My Awesome App"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                autoFocus />
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>Template</label>
              <div className={s.templateGrid}>
                {PROJECT_TEMPLATES.map((t) => (
                  <button key={t.id}
                    className={`${s.templateCard} ${template === t.id ? s.templateActive : ""}`}
                    onClick={() => setTemplate(t.id)}>
                    <span className={s.templateIcon}>{t.icon}</span>
                    <span className={s.templateLabel}>{t.label}</span>
                    <span className={s.templateDesc}>{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={s.optionalSection}>
              <div className={s.optionalHeader}>
                <span className={s.optionalLabel}>GitHub Gist Sync (optional)</span>
                <button className={s.skipBtn} onClick={() => setSkipGithub(true)}>Skip for now</button>
              </div>
              {!skipGithub && (
                <input className="input"
                  placeholder="GitHub Personal Access Token (gist scope)"
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)} />
              )}
              {skipGithub && (
                <span className={s.skipped}>Skipped — configure in Settings → GitHub Sync</span>
              )}
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {step === "Done" && (
          <div className={s.stepContent}>
            <div className={s.bigIcon} style={{ color: "var(--green)" }}>✓</div>
            <h1 className={s.heading}>You're all set!</h1>
            <p className={s.subheading}>DevNotes is ready. Here are a few tips to get started:</p>
            <div className={s.tipsList}>
              {[
                ["Ctrl+Shift+D",       "Show / hide DevNotes from anywhere"],
                ["Ctrl+Shift+Space",   "Quick Capture — add a task or note instantly"],
                ["Ctrl+1 through 7",   "Switch between tabs"],
                ["Ctrl+S",             "Force save"],
                ["Settings → Calendar","Connect Google Calendar or export .ics"],
                ["Tools → Pomodoro",   "Start a focus session"],
              ].map(([key, desc]) => (
                <div key={key} className={s.tip}>
                  <kbd className={s.kbd}>{key}</kbd>
                  <span className={s.tipDesc}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className={s.nav}>
          {stepIndex > 0 && (
            <button className="btn" onClick={handleBack}>← Back</button>
          )}
          <div style={{ flex: 1 }} />
          {step !== "Done" ? (
            <button className="btn btn-primary" onClick={handleNext}
              disabled={step === "First Project" && !projectName.trim()}>
              {step === "First Project" ? "Create Project →" : "Next →"}
            </button>
          ) : (
            <button className="btn btn-primary" style={{ padding: "0.7em 2.5em" }} onClick={handleFinish}>
              Launch DevNotes →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
