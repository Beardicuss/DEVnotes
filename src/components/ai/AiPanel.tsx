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
import { isTauri } from "@/utils/platform";
import s from "./AiPanel.module.css";

// ─── Types ────────────────────────────────────────────────────────
type Mode = "ask" | "summarise" | "tags" | "standup" | "breakdown";

interface Message { role: "user" | "assistant"; content: string; }

// ─── API call ─────────────────────────────────────────────────────
const AI_TIMEOUT_MS = 30_000;

async function callGroq(
  apiKey: string,
  systemPrompt: string,
  messages: Message[],
  maxTokens = 1024,
  signal?: AbortSignal
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const combined = signal
    ? (() => { signal.addEventListener("abort", () => controller.abort()); return controller.signal; })()
    : controller.signal;

  try {
    const fetchFn = isTauri ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch;
    const res = await fetchFn("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: combined,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: maxTokens,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        const retry = res.headers.get("retry-after");
        throw new Error(`GROQ_RATE_LIMIT:${retry || "60"}`);
      }
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.error?.message ?? `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Request timed out (30s). Try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  messages: Message[],
  maxTokens = 1024,
  signal?: AbortSignal
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const combined = signal
    ? (() => { signal.addEventListener("abort", () => controller.abort()); return controller.signal; })()
    : controller.signal;

  try {
    const fetchFn = isTauri ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch;

    const formattedMessages = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      signal: combined,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: formattedMessages,
        generationConfig: { maxOutputTokens: maxTokens }
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.error?.message ?? `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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
  const doneTasks = tasks.filter(t => t.status === "done").slice(0, 20);
  const openTasks = tasks.filter(t => t.status !== "done" && t.status !== "archived").slice(0, 20);
  const recentNotes = notes.slice(0, 5).map(n => `"${n.title}": ${(n.body ?? "").slice(0, 200)}`).join("\n");
  const recentDecs = decisions.slice(0, 5).map(d => `[${d.status}] ${d.title}: ${d.outcome ?? ""}`).join("\n");
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

function ApiKeyPrompt({ onSave }: { onSave: (groqKey: string, geminiKey: string) => void }) {
  const [groqVal, setGroqVal] = useState("");
  const [geminiVal, setGeminiVal] = useState("");

  const isValid = groqVal.startsWith("gsk_") && geminiVal.length > 30;

  return (
    <div className={s.keyPrompt} style={{ paddingBottom: "3em" }}>
      <div className={s.keyTitle} style={{ marginBottom: "0.25em" }}>⚙️ AI Engine Setup</div>
      <p className={s.keyDesc}>
        DevNotes uses a highly optimized dual-processor design to maximize performance completely for free.
        All API keys are encrypted and stored purely locally on your device.
      </p>

      <div style={{ marginTop: "1em", display: "flex", flexDirection: "column", gap: "0.5em" }}>
        <div style={{ fontSize: "var(--fs-xxs)", color: "var(--cyan)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "1px" }}>1. Primary Engine: Groq Llama 3</div>
        <div className={s.keyDesc}>Powers instant local execution. Get a free key at <a href="https://console.groq.com/keys" target="_blank" className={s.keyLink}>console.groq.com</a></div>
        <input className="input" type="password" placeholder="gsk_..." value={groqVal} onChange={e => setGroqVal(e.target.value)} />
      </div>

      <div style={{ marginTop: "1em", display: "flex", flexDirection: "column", gap: "0.5em" }}>
        <div style={{ fontSize: "var(--fs-xxs)", color: "var(--purple, #9900bb)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "1px" }}>2. Secondary Engine: Google Gemini</div>
        <div className={s.keyDesc}>High capacity fallback for large context queries. Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" className={s.keyLink}>aistudio.google.com</a></div>
        <input className="input" type="password" placeholder="AIza..." value={geminiVal} onChange={e => setGeminiVal(e.target.value)} />
      </div>

      <button className="btn btn-primary" style={{ marginTop: "1.5em", padding: "0.75em" }} disabled={!isValid} onClick={() => onSave(groqVal.trim(), geminiVal.trim())}>
        Initialize AI Engines
      </button>
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
export default function AiPanel({ noteId, onClose }: { noteId?: string, onClose?: () => void }) {
  const project = useAppStore(selActiveProject);
  const tasks = useAppStore(selTasks);
  const notes = useAppStore(selNotes);
  const decisions = useAppStore(s => s.data.decisions ?? []);
  const standups = useAppStore(s => s.data.standups ?? []);
  const settings = useAppStore(s => s.data.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const addTask = useAppStore(s => s.addTask);
  const updateNote = useAppStore(s => s.updateNote);

  const cancelRef = useRef<AbortController | null>(null);
  const [mode, setMode] = useState<Mode>("ask");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const groqApiKey: string = settings.groqApiKey ?? "";
  const geminiApiKey: string = settings.geminiApiKey ?? "";
  const projDecisions = decisions.filter(d => d.projectId === project?.id);
  const projStandups = standups.filter(e => e.projectId === project?.id);

  // Fallback cooldown ref (Unix timestamp when Groq becomes available again)
  const groqCooldownUntil = useRef<number>(0);

  if (!project) return null;

  const saveApiKeys = (groqKey: string, geminiKey: string) => {
    updateSettings({ groqApiKey: groqKey, geminiApiKey: geminiKey });
  };

  const clearChat = () => { cancelRef.current?.abort(); cancelRef.current = null; setMessages([]); setError(null); setApplied(null); setLoading(false); };

  const ctx = buildProjectContext(project, tasks, notes, projDecisions, projStandups);

  const currentNote = noteId ? notes.find(n => n.id === noteId) : null;

  // ── Smart Engine Dispatcher ─────────────────────────────────────
  const dispatchAiRequest = async (system: string, userMessages: Message[], tokens: number): Promise<{ text: string, engine: "groq" | "gemini" }> => {
    const isGroqCooling = Date.now() < groqCooldownUntil.current;

    if (!isGroqCooling) {
      try {
        const reply = await callGroq(groqApiKey, system, userMessages, tokens, cancelRef.current?.signal);
        return { text: reply, engine: "groq" };
      } catch (e: any) {
        if (e.message?.startsWith("GROQ_RATE_LIMIT:")) {
          // Trap 429, parse timeout, and fallback to Gemini
          const retrySeconds = parseInt(e.message.split(":")[1]) || 60;
          groqCooldownUntil.current = Date.now() + (retrySeconds * 1000);
          console.warn(`Groq rate limited. Falling back to Gemini for ${retrySeconds}s...`);
        } else {
          throw e; // Unrelated error, let it surface
        }
      }
    }

    // Fallback path
    const reply = await callGemini(geminiApiKey, system, userMessages, tokens, cancelRef.current?.signal);
    return { text: reply, engine: "gemini" };
  };

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

      const result = await dispatchAiRequest(system, newMessages, 1024);
      const prefix = result.engine === "groq" ? "⚡ " : "✨ ";
      setMessages(m => [...m, { role: "assistant", content: prefix + result.text }]);
    } catch (e: any) {
      setError(e?.message ? e.message : `Raw Err: ${String(e)} | JSON: ${JSON.stringify(e)}`);
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
    const prompt = `Given the note titled "${currentNote.title}" with body:\n${(currentNote.body ?? "").slice(0, 600)}\n\nSuggest 3-6 concise tags for this note. Respond ONLY with a JSON array of tag strings, e.g. ["react","typescript","auth"]. No other text.`;
    setInput("");
    setError(null);
    setMessages(m => [...m, { role: "user", content: "Suggest tags for this note" }]);
    setLoading(true);
    try {
      const result = await dispatchAiRequest(SYSTEM_BASE, [{ role: "user", content: prompt }], 256);
      const clean = result.text.replace(/```json|```/g, "").trim();
      const tags: string[] = JSON.parse(clean);
      const prefix = result.engine === "groq" ? "⚡ " : "✨ ";
      setMessages(m => [...m, { role: "assistant", content: prefix + `Suggested tags: ${tags.map(t => `\`${t}\``).join(", ")}` }]);
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
    setMessages(m => [...m, { role: "user", content: `Break down: "${goal}"` }]);
    setLoading(true);
    setError(null);
    try {
      const result = await dispatchAiRequest(SYSTEM_BASE, [{ role: "user", content: prompt }], 512);
      const clean = result.text.replace(/```json|```/g, "").trim();
      const subtasks: string[] = JSON.parse(clean);
      subtasks.forEach(title => addTask({ projectId: project.id, title, status: "todo", priority: "medium" }));
      setMessages(m => [...m, { role: "assistant", content: `Created ${subtasks.length} tasks:\n${subtasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}` }]);
      setApplied(`✓ ${subtasks.length} tasks added to project`);
    } catch (e: any) {
      setError(e.message ?? "Breakdown failed");
    } finally { setLoading(false); }
  };

  if (!groqApiKey || !geminiApiKey) return <ApiKeyPrompt onSave={saveApiKeys} />;

  return (
    <div className={s.panel}>
      {/* Mode tabs */}
      <div className={s.modes} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", position: "relative" }}>
        <ModeButton mode="ask" active={mode === "ask"} icon="💬" label="Ask" onClick={() => { setMode("ask"); clearChat(); }} />
        <ModeButton mode="breakdown" active={mode === "breakdown"} icon="🧩" label="Breakdown" onClick={() => { setMode("breakdown"); clearChat(); }} />
        <ModeButton mode="standup" active={mode === "standup"} icon="🗓" label="Standup" onClick={() => { setMode("standup"); clearChat(); }} />
        {currentNote && <>
          <ModeButton mode="summarise" active={mode === "summarise"} icon="📋" label="Summarise" onClick={() => { setMode("summarise"); clearChat(); }} />
          <ModeButton mode="tags" active={mode === "tags"} icon="🏷" label="Tags" onClick={() => { setMode("tags"); clearChat(); }} />
        </>}
        {onClose && (
          <button onClick={onClose} title="Close AI Panel" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--cyan)", cursor: "pointer", fontSize: "16px", padding: "0 8px" }}>✕</button>
        )}
      </div>

      {/* Mode hint */}
      <div className={s.hint}>
        {mode === "ask" && "Ask anything about your project, tasks, notes, or decisions."}
        {mode === "breakdown" && "Type a goal below → AI creates subtasks in your project."}
        {mode === "standup" && "Generate a standup draft from your recent activity."}
        {mode === "summarise" && "Summarise and get improvement suggestions for the current note."}
        {mode === "tags" && "Auto-suggest and apply tags to the current note."}
      </div>

      {/* Message thread */}
      <div className={s.thread}>
        {messages.length === 0 && (
          <div className={s.threadEmpty}>
            {mode === "ask" && <button className="btn" onClick={() => send("What should I focus on today based on my tasks?")}>💡 What should I focus on today?</button>}
            {mode === "ask" && <button className="btn" onClick={() => send("Give me a quick project health summary.")}>📊 Project health summary</button>}
            {mode === "standup" && <button className="btn btn-primary" onClick={presetStandup}>📝 Generate standup draft</button>}
            {mode === "summarise" && <button className="btn btn-primary" onClick={presetSummarise}>📋 Summarise this note</button>}
            {mode === "tags" && <button className="btn btn-primary" onClick={presetTags}>🏷 Suggest & apply tags</button>}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`${s.bubble} ${m.role === "user" ? s.bubbleUser : s.bubbleAi}`}>
            <div className={s.bubbleLabel}>{m.role === "user" ? "You" : "✦ AI"}</div>
            <MarkdownRenderer content={m.content} />
          </div>
        ))}

        {loading && (
          <div className={`${s.bubble} ${s.bubbleAi}`}>
            <div className={s.bubbleLabel}>✦ AI</div>
            <div className={s.typing}><span /><span /><span /></div>
          </div>
        )}
        {applied && <div className={s.applied}>{applied}</div>}
        {error && <div className={s.error}>⚠ {error}</div>}
      </div>

      {/* Input */}
      <div className={s.inputRow}>
        <textarea
          className={`input ${s.aiInput}`}
          rows={2}
          placeholder={
            mode === "breakdown" ? "Describe a goal to break into tasks…" :
              mode === "ask" ? "Ask something about your project…" :
                "Message…"
          }
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              mode === "breakdown" ? presetBreakdown() : send();
            }
          }}
        />
        <button className="btn btn-primary" disabled={loading || !input.trim()}
          onClick={() => mode === "breakdown" ? presetBreakdown() : send()}>
          {loading ? "…" : "↑"}
        </button>
      </div>

      <div className={s.footer}>
        <span>⚡ Groq Llama 3 · ✨ Gemini 1.5 Flash</span>
        <button className={s.clearBtn} onClick={clearChat}>Clear</button>
        <button className={s.clearBtn} onClick={() => updateSettings({ groqApiKey: null, geminiApiKey: null })}>Remove keys</button>
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
    if (line.startsWith("### ")) elements.push(<h4 key={i} style={{ color: "var(--cyan)", fontFamily: "var(--font-display)", fontSize: "var(--fs-xs)", margin: "0.6em 0 0.2em", letterSpacing: "0.1em" }}>{line.slice(4)}</h4>);
    else if (line.startsWith("## ")) elements.push(<h3 key={i} style={{ color: "var(--cyan)", fontFamily: "var(--font-display)", fontSize: "var(--fs-sm)", margin: "0.7em 0 0.3em" }}>{line.slice(3)}</h3>);
    else if (line.startsWith("**") && line.endsWith("**")) elements.push(<strong key={i} style={{ color: "var(--text)", display: "block", marginTop: "0.4em" }}>{line.slice(2, -2)}</strong>);
    else if (line.startsWith("- ") || line.startsWith("* ")) elements.push(<div key={i} className={s.mdBullet}>• {inlineFormat(line.slice(2))}</div>);
    else if (/^\d+\. /.test(line)) elements.push(<div key={i} className={s.mdBullet}>{inlineFormat(line)}</div>);
    else if (line.startsWith("```")) { /* skip fence */ }
    else if (line === "") elements.push(<div key={i} style={{ height: "0.4em" }} />);
    else elements.push(<p key={i} className={s.mdP}>{inlineFormat(line)}</p>);
  }
  return <div className={s.md}>{elements}</div>;
}

function inlineFormat(text: string): React.ReactNode {
  // Bold: **text** and inline code: `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} style={{ fontFamily: "var(--font-mono)", background: "var(--bg-input)", padding: "0 3px", fontSize: "0.9em", color: "var(--cyan)" }}>{p.slice(1, -1)}</code>;
    return p;
  });
}
