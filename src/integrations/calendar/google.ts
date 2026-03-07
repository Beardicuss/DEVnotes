/**
 * Google Calendar integration — Phase 2
 *
 * Flow:
 *  1. User clicks "Connect Google Calendar" in Settings
 *  2. We open the OAuth consent screen in the default browser via Tauri shell
 *  3. We start a local HTTP server on port 42813 to catch the redirect
 *  4. Exchange code → access_token + refresh_token → stored in settings
 *  5. From then on: create/update/delete events for tasks + milestones
 *
 * Scopes needed:  https://www.googleapis.com/auth/calendar.events
 *
 * NOTE: You must register an OAuth 2.0 client in Google Cloud Console:
 *   - Application type: Desktop app
 *   - Redirect URI:     http://localhost:42813/oauth/callback
 *   Then paste Client ID + Client Secret into Settings → Calendar.
 */

import { shellOpen } from "@/utils/platform";

// ─── Types ───────────────────────────────────────────────────────

export interface GoogleTokens {
  access_token:  string;
  refresh_token: string;
  expires_at:    number;   // Unix ms
}

export interface GCalEvent {
  id?:          string;
  summary:      string;
  description?: string;
  start:        { date?: string; dateTime?: string; timeZone?: string };
  end:          { date?: string; dateTime?: string; timeZone?: string };
  reminders?:   { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
  recurrence?:  string[];
}

// ─── Constants ───────────────────────────────────────────────────

const REDIRECT_URI  = "http://localhost:42813/oauth/callback";
const SCOPE         = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_URL     = "https://oauth2.googleapis.com/token";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

// ─── OAuth2 ──────────────────────────────────────────────────────

/**
 * Step 1: Open browser to Google OAuth consent page.
 * Returns a state token for CSRF protection.
 */
export async function startOAuthFlow(clientId: string): Promise<string> {
  const state = Math.random().toString(36).slice(2);
  const url   = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id",     clientId);
  url.searchParams.set("redirect_uri",  REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope",         SCOPE);
  url.searchParams.set("access_type",   "offline");
  url.searchParams.set("prompt",        "consent");
  url.searchParams.set("state",         state);
  await shellOpen(url.toString());
  return state;
}

/**
 * Step 2: Exchange authorization code for tokens.
 * Called after the local redirect server receives the callback.
 */
export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  REDIRECT_URI,
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const json = await res.json();
  return {
    access_token:  json.access_token,
    refresh_token: json.refresh_token,
    expires_at:    Date.now() + json.expires_in * 1000,
  };
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const json = await res.json();
  return {
    access_token:  json.access_token,
    refresh_token: refreshToken,   // refresh token doesn't change
    expires_at:    Date.now() + json.expires_in * 1000,
  };
}

/**
 * Get a valid access token — refreshes automatically if expired.
 */
export async function getValidToken(
  tokens: GoogleTokens,
  clientId: string,
  clientSecret: string,
  onRefresh: (t: GoogleTokens) => void
): Promise<string> {
  if (Date.now() < tokens.expires_at - 60_000) return tokens.access_token;
  const fresh = await refreshAccessToken(tokens.refresh_token, clientId, clientSecret);
  onRefresh(fresh);
  return fresh.access_token;
}

// ─── Calendar API ─────────────────────────────────────────────────

async function gcalFetch(
  path: string,
  method: string,
  token: string,
  body?: unknown
): Promise<any> {
  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `GCal error ${res.status}`);
  return json;
}

export async function createEvent(
  token: string,
  calendarId: string = "primary",
  event: GCalEvent
): Promise<GCalEvent> {
  return gcalFetch(`/calendars/${calendarId}/events`, "POST", token, event);
}

export async function updateEvent(
  token: string,
  eventId: string,
  calendarId: string = "primary",
  event: Partial<GCalEvent>
): Promise<GCalEvent> {
  return gcalFetch(`/calendars/${calendarId}/events/${eventId}`, "PATCH", token, event);
}

export async function deleteEvent(
  token: string,
  eventId: string,
  calendarId: string = "primary"
): Promise<void> {
  await gcalFetch(`/calendars/${calendarId}/events/${eventId}`, "DELETE", token);
}

export async function listUpcomingEvents(
  token: string,
  calendarId: string = "primary",
  days: number = 7
): Promise<GCalEvent[]> {
  const now  = new Date().toISOString();
  const then = new Date(Date.now() + days * 86_400_000).toISOString();
  const data = await gcalFetch(
    `/calendars/${calendarId}/events?timeMin=${now}&timeMax=${then}&singleEvents=true&orderBy=startTime`,
    "GET", token
  );
  return data?.items ?? [];
}

// ─── Task → GCal event conversion ────────────────────────────────

export function taskToGCalEvent(task: {
  title: string;
  description: string;
  dueDate: string | null;
  dueTime: string | null;
  reminder: { enabled: boolean; offsetMinutes: number };
}): GCalEvent {
  const hasTime = !!task.dueTime;
  const date    = task.dueDate ?? new Date().toISOString().slice(0, 10);

  const event: GCalEvent = {
    summary:     task.title,
    description: task.description || undefined,
    start: hasTime
      ? { dateTime: `${date}T${task.dueTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      : { date },
    end: hasTime
      ? { dateTime: `${date}T${task.dueTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      : { date },
  };

  if (task.reminder.enabled) {
    event.reminders = {
      useDefault: false,
      overrides:  [{ method: "popup", minutes: task.reminder.offsetMinutes }],
    };
  }

  return event;
}

// ─── Local OAuth callback server (Tauri only) ────────────────────
// Spins up a tiny HTTP listener on port 42813 for exactly one request.
// Falls back gracefully in browser mode.

export async function waitForOAuthCallback(): Promise<{ code: string; state: string } | null> {
  try {
    // Use Tauri's HTTP listener plugin (plugin-http or direct Rust command)
    // In browser dev mode: prompt the user to paste the code manually
    const isTauri = "__TAURI_INTERNALS__" in window;
    if (!isTauri) {
      const code = prompt(
        "Paste the authorization code from the browser URL\n" +
        "(after ?code= in the redirect URL):"
      );
      if (!code) return null;
      return { code: code.trim(), state: "" };
    }

    // In Tauri: invoke the Rust command that starts the local listener
    const { invoke } = await import(/* @vite-ignore */ "@tauri-apps/api/core");
    const result = await invoke<{ code: string; state: string }>("wait_oauth_callback");
    return result;
  } catch (e) {
    console.error("OAuth callback failed:", e);
    return null;
  }
}
