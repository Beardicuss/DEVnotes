/**
 * AiPanel.tsx  —  DevNotes AI Assistant (Phase 7)
 *
 * Features:
 *  - Summarise a note
 *  - Suggest tags for a note
 *  - Draft standup from completed tasks
 *  - Ask anything about the current project
 *  - AI-powered task breakdown: type a goal → get subtasks
 *
 * Uses the Anthropic API via fetch (no SDK needed in browser/Tauri).
 * API key stored in AppSettings.aiApiKey (never synced to Gist).
 */

import { useState, useRef } from "react";
import { useAppStore, selActiveProject, selTasks, selNotes } from "@/stores/useAppStore";
import s from "./AiPanel.module.css";

// ─── Types ────────────────────────────────────────────────────────
type Mode = "ask" | "summarise" | "tags" | "standup" | "breakdown";

interface Message { role: "user" | "assistant"; content: string; }

// ─── API call ─────────────────────────────────────────────────────
const AI_TIMEOUT_MS = 30_000;

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  messages: Message[],
  maxTokens = 1024,
  signal?: AbortSignal
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  // Merge with any external signal
  const combined = signal
    ? (() => {
        signal.addEventListener("abort", () => controller.abort());
        return controller.signal;
      })()
    : controller.signal;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: combined,
      headers: {
        "Content-Type":         "application/json",
        "x-api-key":            apiKey,
        "anthropic-version":    "2023-06-01",
        "anthropic-dangerous-allow-browser": "true",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        system:     systemPrompt,
        messages,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.error?.message ?? `HTTP ${res.status}`);
    }
    const data = await res.json();
    return (data.content as any[]).map((b: any) => b.text ?? "").join("");
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Request timed out (30s). Try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Helper: build project context string ─────────────────────────
function buildProjectContext(
  project: any, tasks: any[], notes: any[], decisions: any[], standups: any[]
): string {
  const doneTasks   = tasks.filter(t => t.status === "done").slice(0, 20);
  const openTasks   = tasks.filter(t => t.status !== "done" && t.status !== "archived").slice(0, 20);
  const recentNotes = notes.slice(0, 5).map(n => `"${n.title}": ${(n.body ?? "").slice(0, 200)}`).join("\n");
  const recentDecs  = decisions.slice(0, 5).map(d => `[${d.status}] ${d.title}: ${d.outcome ?? ""}`).join("\n");
  const lastStandup = standups[0];

  return `Project: ${project.name}
Description: ${project.description ?? "N/A"}
Status: ${project.status}
Tech stack: ${project.techStack?.join(", ") ?? "N/A"}
Deadline: ${project.deadline ?? "N/A"}

Open tasks (${openTasks.length}): ${openTasks.map(t => `[${t.priority}] ${t.title}`).join(", ") || "none"}
Done tasks (${doneTasks.length}): ${doneTasks.map(t => t.title).join(", ") || "none"}

Recent notes:
${recentNotes || "none"}

Recent decisions:
${recentDecs || "none"}

Last standup (${lastStandup?.date ?? "N/A"}):
Yesterday: ${lastStandup?.yesterday ?? "N/A"}
Today: ${lastStandup?.today ?? "N/A"}
Blockers: ${lastStandup?.blockers ?? "none"}`;
}

// ─── Preset prompts ───────────────────────────────────────────────
const SYSTEM_BASE = `You are DevNotes AI, a concise and practical assistant embedded inside a developer project management app.
You have access to the current project's context. Be direct, clear, and formatted for a terminal-style dark UI.
Keep responses focused and practical. Use markdown formatting (bold, bullets, code blocks) where helpful.`;

// ─── Components ───────────────────────────────────────────────────

function ApiKeyPrompt({ onSave }: { onSave: (key: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className={s.keyPrompt}>
      <div className={s.keyTitle}>🔑 Anthropic API Key Required</div>
      <p className={s.keyDesc}>
        AI features use the Claude API directly. Your key is stored locally and never synced.
        Get one at <span className={s.keyLink}>console.anthropic.com</span>
      </p>
      <div className={s.keyRow}>
        <input className="input" style={{flex:1}} type="password"
          placeholder="sk-ant-..." value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key==="Enter" && val.startsWith("sk-") && onSave(val.trim())} />
        <button className="btn btn-primary" disabled={!val.startsWith("sk-")}
          onClick={() => onSave(val.trim())}>Save</button>
      </div>
    </div>
  );
}

function ModeButton({ mode: _mode, active, icon, label, onClick }: {
  mode: Mode; active: boolean; icon: string; label: string; onClick: () => void;
}) {
  return (
    <button className={`${s.modeBtn} ${active ? s.modeBtnActive : ""}`} onClick={onClick} title={label}>
      <span>{icon}</span>
      <span className={s.modeBtnLabel}>{label}</span>
    </button>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────
export default function AiPanel({ noteId }: { noteId?: string }) {
  const project   = useAppStore(selActiveProject);
  const tasks     = useAppStore(selTasks);
  const notes     = useAppStore(selNotes);
  const decisions = useAppStore(s => s.data.decisions ?? []);
  const standups  = useAppStore(s => s.data.standups  ?? []);
  const settings  = useAppStore(s => s.data.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const addTask   = useAppStore(s => s.addTask);
  const updateNote = useAppStore(s => s.updateNote);

  const cancelRef = useRef<AbortController | null>(null);
  const [mode,     setMode]     = useState<Mode>("ask");
  const [input,    setInput]    = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string|null>(null);
  const [applied,  setApplied]  = useState<string|null>(null);

  const apiKey: string = settings.aiApiKey ?? "";
  const projDecisions = decisions.filter(d => d.projectId === project?.id);
  const projStandups  = standups.filter(e => e.projectId === project?.id);

  if (!project) return null;

  const saveApiKey = (key: string) => {
    updateSettings({ aiApiKey: key });
  };

  const clearChat = () => { cancelRef.current?.abort(); cancelRef.current = null; setMessages([]); setError(null); setApplied(null); setLoading(false); };

  const ctx = buildProjectContext(project, tasks, notes, projDecisions, projStandups);

  const currentNote = noteId ? notes.find(n => n.id === noteId) : null;

  // ── Send ──────────────────────────────────────────────────────
  const send = async (overridePrompt?: string) => {
    const userText = (overridePrompt ?? input).trim();
    if (!userText || loading) return;
    cancelRef.current?.abort();
    cancelRef.current = new AbortController();
    setInput("");
    setError(null);
    setApplied(null);

    const userMsg: Message = { role: "user", content: userText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      let system = SYSTEM_BASE + "\n\n--- PROJECT CONTEXT ---\n" + ctx;

      if (mode === "summarise" && currentNote) {
        system += `\n\nThe user is viewing a note titled "${currentNote.title}".\nNote body:\n${currentNote.body ?? "(empty)"}`;
      }

      const reply = await callClaude(apiKey, system, newMessages, 1024, cancelRef.current?.signal);
      setMessages(m => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // ── Preset actions ────────────────────────────────────────────
  const presetSummarise = () => {
    if (!currentNote) return;
    send(`Please summarise this note concisely in 2-4 bullet points, then suggest any improvements or follow-up actions.`);
  };

  const presetTags = async () => {
    if (!currentNote) return;
    const prompt = `Given the note titled "${currentNote.title}" with body:\n${(currentNote.body ?? "").slice(0,600)}\n\nSuggest 3-6 concise tags for this note. Respond ONLY with a JSON array of tag strings, e.g. ["react","typescript","auth"]. No other text.`;
    setInput("");
    setError(null);
    setMessages(m => [...m, { role: "user", content: "Suggest tags for this note" }]);
    setLoading(true);
    try {
      const reply = await callClaude(apiKey, SYSTEM_BASE, [{ role:"user", content: prompt }], 256);
      const clean  = reply.replace(/```json|```/g,"").trim();
      const tags: string[] = JSON.parse(clean);
      setMessages(m => [...m, { role:"assistant", content: `Suggested tags: ${tags.map(t=>`\`${t}\``).join(", ")}` }]);
      if (noteId && Array.isArray(tags)) {
        updateNote(noteId, { tags });
        setApplied("✓ Tags applied to note");
      }
    } catch (e: any) {
      setError(e.message ?? "Tag generation failed");
    } finally { setLoading(false); }
  };

  const presetStandup = () => {
    send(`Draft today's standup update for me based on the project context. Format it as:
**Yesterday:** ...
**Today:** ...
**Blockers:** ...

Make it brief and specific to the actual tasks and progress visible in the context.`);
  };

  const presetBreakdown = async () => {
    const goal = input.trim();
    if (!goal) return;
    const prompt = `Break down this goal into 3-7 concrete subtasks for the project "${project.name}":
Goal: "${goal}"

Respond ONLY with a JSON array of task title strings, e.g. ["Set up database schema","Write API endpoints"]. No other text.`;
    setInput("");
    setMessages(m => [...m, { role:"user", content: `Break down: "${goal}"` }]);
    setLoading(true);
    setError(null);
    try {
      const reply = await callClaude(apiKey, SYSTEM_BASE, [{ role:"user", content: prompt }], 512);
      const clean  = reply.replace(/```json|```/g,"").trim();
      const subtasks: string[] = JSON.parse(clean);
      subtasks.forEach(title => addTask({ projectId: project.id, title, status:"todo", priority:"medium" }));
      setMessages(m => [...m, { role:"assistant", content: `Created ${subtasks.length} tasks:\n${subtasks.map((t,i) => `${i+1}. ${t}`).join("\n")}` }]);
      setApplied(`✓ ${subtasks.length} tasks added to project`);
    } catch (e: any) {
      setError(e.message ?? "Breakdown failed");
    } finally { setLoading(false); }
  };

  if (!apiKey) return <ApiKeyPrompt onSave={saveApiKey} />;

  return (
    <div className={s.panel}>
      {/* Mode tabs */}
      <div className={s.modes}>
        <ModeButton mode="ask"       active={mode==="ask"}       icon="💬" label="Ask"       onClick={() => { setMode("ask");       clearChat(); }} />
        <ModeButton mode="breakdown" active={mode==="breakdown"} icon="🧩" label="Breakdown"  onClick={() => { setMode("breakdown"); clearChat(); }} />
        <ModeButton mode="standup"   active={mode==="standup"}   icon="🗓" label="Standup"    onClick={() => { setMode("standup");   clearChat(); }} />
        {currentNote && <>
          <ModeButton mode="summarise" active={mode==="summarise"} icon="📋" label="Summarise" onClick={() => { setMode("summarise"); clearChat(); }} />
          <ModeButton mode="tags"      active={mode==="tags"}      icon="🏷" label="Tags"      onClick={() => { setMode("tags");      clearChat(); }} />
        </>}
      </div>

      {/* Mode hint */}
      <div className={s.hint}>
        {mode==="ask"       && "Ask anything about your project, tasks, notes, or decisions."}
        {mode==="breakdown" && "Type a goal below → AI creates subtasks in your project."}
        {mode==="standup"   && "Generate a standup draft from your recent activity."}
        {mode==="summarise" && "Summarise and get improvement suggestions for the current note."}
        {mode==="tags"      && "Auto-suggest and apply tags to the current note."}
      </div>

      {/* Message thread */}
      <div className={s.thread}>
        {messages.length === 0 && (
          <div className={s.threadEmpty}>
            {mode==="ask"       && <button className="btn" onClick={() => send("What should I focus on today based on my tasks?")}>💡 What should I focus on today?</button>}
            {mode==="ask"       && <button className="btn" onClick={() => send("Give me a quick project health summary.")}>📊 Project health summary</button>}
            {mode==="standup"   && <button className="btn btn-primary" onClick={presetStandup}>📝 Generate standup draft</button>}
            {mode==="summarise" && <button className="btn btn-primary" onClick={presetSummarise}>📋 Summarise this note</button>}
            {mode==="tags"      && <button className="btn btn-primary" onClick={presetTags}>🏷 Suggest & apply tags</button>}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`${s.bubble} ${m.role==="user" ? s.bubbleUser : s.bubbleAi}`}>
            <div className={s.bubbleLabel}>{m.role==="user" ? "You" : "✦ AI"}</div>
            <MarkdownRenderer content={m.content} />
          </div>
        ))}

        {loading && (
          <div className={`${s.bubble} ${s.bubbleAi}`}>
            <div className={s.bubbleLabel}>✦ AI</div>
            <div className={s.typing}><span/><span/><span/></div>
          </div>
        )}
        {applied && <div className={s.applied}>{applied}</div>}
        {error   && <div className={s.error}>⚠ {error}</div>}
      </div>

      {/* Input */}
      <div className={s.inputRow}>
        <textarea
          className={`input ${s.aiInput}`}
          rows={2}
          placeholder={
            mode==="breakdown" ? "Describe a goal to break into tasks…" :
            mode==="ask"       ? "Ask something about your project…" :
            "Message…"
          }
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key==="Enter" && !e.shiftKey) {
              e.preventDefault();
              mode==="breakdown" ? presetBreakdown() : send();
            }
          }}
        />
        <button className="btn btn-primary" disabled={loading || !input.trim()}
          onClick={() => mode==="breakdown" ? presetBreakdown() : send()}>
          {loading ? "…" : "↑"}
        </button>
      </div>

      <div className={s.footer}>
        <span>Claude Haiku · key saved locally</span>
        <button className={s.clearBtn} onClick={clearChat}>Clear</button>
        <button className={s.clearBtn} onClick={() => updateSettings({ aiApiKey: null })}>Remove key</button>
      </div>
    </div>
  );
}

// ─── Minimal markdown renderer ────────────────────────────────────
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("### ")) elements.push(<h4 key={i} style={{color:"var(--cyan)",fontFamily:"var(--font-display)",fontSize:"var(--fs-xs)",margin:"0.6em 0 0.2em",letterSpacing:"0.1em"}}>{line.slice(4)}</h4>);
    else if (line.startsWith("## ")) elements.push(<h3 key={i} style={{color:"var(--cyan)",fontFamily:"var(--font-display)",fontSize:"var(--fs-sm)",margin:"0.7em 0 0.3em"}}>{line.slice(3)}</h3>);
    else if (line.startsWith("**") && line.endsWith("**")) elements.push(<strong key={i} style={{color:"var(--text)",display:"block",marginTop:"0.4em"}}>{line.slice(2,-2)}</strong>);
    else if (line.startsWith("- ") || line.startsWith("* ")) elements.push(<div key={i} className={s.mdBullet}>• {inlineFormat(line.slice(2))}</div>);
    else if (/^\d+\. /.test(line)) elements.push(<div key={i} className={s.mdBullet}>{inlineFormat(line)}</div>);
    else if (line.startsWith("```")) { /* skip fence */ }
    else if (line === "") elements.push(<div key={i} style={{height:"0.4em"}}/>);
    else elements.push(<p key={i} className={s.mdP}>{inlineFormat(line)}</p>);
  }
  return <div className={s.md}>{elements}</div>;
}

function inlineFormat(text: string): React.ReactNode {
  // Bold: **text** and inline code: `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2,-2)}</strong>;
    if (p.startsWith("`")  && p.endsWith("`"))  return <code key={i} style={{fontFamily:"var(--font-mono)",background:"var(--bg-input)",padding:"0 3px",fontSize:"0.9em",color:"var(--cyan)"}}>{p.slice(1,-1)}</code>;
    return p;
  });
}
