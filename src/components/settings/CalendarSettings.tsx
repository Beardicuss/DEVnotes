import { useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import {
  startOAuthFlow, exchangeCode, waitForOAuthCallback,
  listUpcomingEvents,
} from "@/integrations/calendar/google";
import { generateICS, exportICS } from "@/integrations/calendar/ics";
import s from "./CalendarSettings.module.css";

export default function CalendarSettings() {
  const settings    = useAppStore((st) => st.data.settings);
  const updateSettings = useAppStore((st) => st.updateSettings);
  const tasks       = useAppStore((st) => st.data.tasks);
  const plans       = useAppStore((st) => st.data.plans);
  const projects    = useAppStore((st) => st.data.projects);

  const [connecting, setConnecting] = useState(false);
  const [events, setEvents]         = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [exportingICS, setExportingICS] = useState(false);

  const set = (p: Partial<typeof settings>) => updateSettings(p);
  const tokens = settings.calendarTokens;
  const isConnected = !!tokens?.access_token;
  const clientId     = settings.googleClientId     ?? "";
  const clientSecret = settings.googleClientSecret ?? "";

  /* ── Connect ── */
  const handleConnect = async () => {
    if (!clientId || !clientSecret) {
      setError("Enter your Google OAuth Client ID and Secret first.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      await startOAuthFlow(clientId);
      const result = await waitForOAuthCallback();
      if (!result) { setError("OAuth cancelled or timed out."); setConnecting(false); return; }
      const { code } = result;
      const { exchangeCode: exchange } = await import("@/integrations/calendar/google");
      const newTokens = await exchange(code, clientId, clientSecret);
      set({ calendarTokens: newTokens });
    } catch (e: any) { setError(e.message); }
    setConnecting(false);
  };

  /* ── Disconnect ── */
  const handleDisconnect = () => {
    set({ calendarTokens: null });
    setEvents([]);
  };

  /* ── Load upcoming ── */
  const handleLoadEvents = async () => {
    if (!tokens) return;
    setLoadingEvents(true);
    try {
      const evts = await listUpcomingEvents(tokens.access_token, "primary", 14);
      setEvents(evts);
    } catch (e: any) { setError(e.message); }
    setLoadingEvents(false);
  };

  /* ── ICS export ── */
  const handleExportICS = async () => {
    setExportingICS(true);
    const allPlans = plans.map((plan) => ({
      plan,
      projectName: projects.find((p) => p.id === plan.projectId)?.name ?? "Project",
    }));
    const content = generateICS({
      tasks: tasks.filter((t) => t.dueDate && t.status !== "done"),
      plans: allPlans,
      calName: "DevNotes",
    });
    await exportICS(content, "devnotes-all.ics");
    setExportingICS(false);
  };

  return (
    <div className={s.root}>
      {/* Status */}
      <div className={`${s.statusBanner} ${isConnected ? s.connected : s.disconnected}`}>
        <span className={s.statusDot}>{isConnected ? "●" : "○"}</span>
        <span>{isConnected ? "Connected to Google Calendar" : "Not connected"}</span>
      </div>

      {/* OAuth credentials */}
      {!isConnected && (
        <div className={s.section}>
          <div className={s.sectionTitle}>Google OAuth Credentials</div>
          <p className={s.hint}>
            Create a project at <strong>console.cloud.google.com</strong> →
            APIs &amp; Services → Credentials → OAuth 2.0 Client ID (Desktop app).
            Redirect URI: <code>http://localhost:42813/oauth/callback</code>
          </p>
          <div className={s.field}>
            <label className={s.label}>Client ID</label>
            <input className="input" placeholder="xxxx.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => set({ googleClientId: e.target.value })} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Client Secret</label>
            <input className="input" type="password" placeholder="GOCSPX-xxxx"
              value={clientSecret}
              onChange={(e) => set({ googleClientSecret: e.target.value })} />
          </div>
          {error && <p className={s.error}>⚠ {error}</p>}
          <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
            {connecting ? "Opening browser…" : "↗ Connect Google Calendar"}
          </button>
        </div>
      )}

      {/* Connected controls */}
      {isConnected && (
        <>
          <div className={s.section}>
            <div className={s.sectionTitle}>Sync Settings</div>
            <Row label="Auto-push tasks to Google Calendar">
              <Toggle
                checked={settings.calendarAutoPush ?? false}
                onChange={(v) => set({ calendarAutoPush: v })} />
            </Row>
            <Row label="Sync plan milestones">
              <Toggle
                checked={settings.calendarSyncMilestones}
                onChange={(v) => set({ calendarSyncMilestones: v })} />
            </Row>
            <Row label="Sync frequency">
              <select className="input" style={{ width: "12em" }}
                value={settings.calendarSyncFrequency}
                onChange={(e) => set({ calendarSyncFrequency: e.target.value as import("@/types").SyncFrequency })}>
                <option value="on-save">On every save</option>
                <option value="hourly">Hourly</option>
                <option value="manual">Manual only</option>
              </select>
            </Row>
          </div>

          <div className={s.section}>
            <div className={s.sectionTitle}>Upcoming Events (next 14 days)</div>
            <button className="btn" onClick={handleLoadEvents} disabled={loadingEvents}>
              {loadingEvents ? "Loading…" : "↻ Load Events"}
            </button>
            {events.length > 0 && (
              <div className={s.eventList}>
                {events.map((ev) => (
                  <div key={ev.id} className={s.event}>
                    <span className={s.eventDate}>
                      {ev.start?.date ?? ev.start?.dateTime?.slice(0,10)}
                    </span>
                    <span className={s.eventTitle}>{ev.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={s.section}>
            <button className="btn btn-danger" onClick={handleDisconnect}>✕ Disconnect</button>
          </div>
        </>
      )}

      {/* ICS export — always available */}
      <div className={s.section}>
        <div className={s.sectionTitle}>Export Calendar File (.ics)</div>
        <p className={s.hint}>
          Export all tasks with due dates and plan milestones as a standard .ics file.
          Import into any calendar app (Google, Outlook, Apple Calendar).
        </p>
        <button className="btn" onClick={handleExportICS} disabled={exportingICS}>
          {exportingICS ? "Exporting…" : "↓ Export devnotes-all.ics"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"1em", marginBottom:"0.9em", flexWrap:"wrap" }}>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:"var(--fs-xs)", color:"var(--text-dim)", minWidth:"18em", flexShrink:0 }}>{label}</span>
      <div style={{ flex:1 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      width:"3em", height:"1.6em", position:"relative",
      background: checked ? "var(--cyan)" : "var(--bg-input)",
      border:"1px solid "+(checked?"var(--cyan)":"var(--border)"),
      cursor:"pointer", transition:"all var(--t-base)", flexShrink:0,
    }}>
      <span style={{
        position:"absolute", top:"50%",
        transform:`translateY(-50%) translateX(${checked?"1.4em":"0.2em"})`,
        width:"1em", height:"1em",
        background: checked ? "var(--text-on-accent)" : "var(--text-dim)",
        transition:"all var(--t-base)", display:"block",
      }} />
    </button>
  );
}
