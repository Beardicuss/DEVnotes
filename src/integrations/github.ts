/**
 * GitHub Gist sync integration.
 *
 * Strategy: one private Gist per user, filename = "devnotes-data.json".
 * On push: update Gist content.
 * On pull: fetch Gist content → merge with local (last-write-wins per project).
 *
 * Auth: Personal Access Token (PAT) with gist scope.
 * Token stored in Tauri's secure store (or settings as encrypted string for now).
 *
 * API docs: https://docs.github.com/en/rest/gists/gists
 */

import type { AppData, SyncState } from "@/types";

const GIST_FILENAME = "devnotes-data.json";
const API_BASE = "https://api.github.com";

// ─── Types ────────────────────────────────────────────────────────

interface GistFile {
  filename: string;
  content: string;
}

interface GistResponse {
  id: string;
  files: Record<string, GistFile>;
}

// ─── Low-level API calls ─────────────────────────────────────────

async function gistFetch(
  method: "GET" | "POST" | "PATCH",
  path: string,
  token: string,
  body?: unknown
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─── Public API ───────────────────────────────────────────────────

/** Validate a GitHub token has gist scope. Returns username or throws. */
export async function validateToken(token: string): Promise<string> {
  const res = await gistFetch("GET", "/user", token);
  if (!res.ok) throw new Error(`GitHub auth failed: ${res.status}`);
  const data = await res.json();
  return data.login as string;
}

/** Create a new private Gist and return its ID. */
export async function createGist(token: string, data: AppData): Promise<string> {
  const res = await gistFetch("POST", "/gists", token, {
    description: "DevNotes backup — Softcurse Studio",
    public: false,
    files: {
      [GIST_FILENAME]: { content: JSON.stringify(redactForSync(data), null, 2) },
    },
  });
  if (!res.ok) throw new Error(`Failed to create Gist: ${res.status}`);
  const gist = (await res.json()) as GistResponse;
  return gist.id;
}

/**
 * Redact sensitive settings fields before uploading to GitHub Gist.
 * API keys, tokens, and OAuth credentials must never leave the local device.
 */
function redactForSync(data: AppData): AppData {
  return {
    ...data,
    settings: {
      ...data.settings,
      groqApiKey: null,   // never sync AI key to cloud
      geminiApiKey: null,
      githubToken: null,   // never sync the token that grants Gist access
      calendarAccessToken: null,
      calendarRefreshToken: null,
      calendarTokens: null,
    },
  };
}

/** Push local data to an existing Gist. Sensitive fields are redacted. */
export async function pushToGist(
  token: string,
  gistId: string,
  data: AppData
): Promise<void> {
  const safe = redactForSync(data);
  const res = await gistFetch("PATCH", `/gists/${gistId}`, token, {
    files: {
      [GIST_FILENAME]: { content: JSON.stringify(safe, null, 2) },
    },
  });
  if (!res.ok) throw new Error(`Failed to push to Gist: ${res.status}`);
}

/** Pull data from a Gist. Returns parsed AppData or null if not found. */
export async function pullFromGist(
  token: string,
  gistId: string
): Promise<AppData | null> {
  const res = await gistFetch("GET", `/gists/${gistId}`, token);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to pull from Gist: ${res.status}`);
  const gist = (await res.json()) as GistResponse;
  const file = gist.files[GIST_FILENAME];
  if (!file?.content) return null;
  return JSON.parse(file.content) as AppData;
}

/**
 * Merge remote data into local data.
 * Strategy: per-entity last-write-wins on updatedAt.
 * Settings always keep local (user shouldn't have settings overwritten remotely).
 */
export function mergeData(local: AppData, remote: AppData): AppData {
  const mergeArray = <T extends { id: string; updatedAt?: string }>(
    localArr: T[],
    remoteArr: T[]
  ): T[] => {
    const map = new Map<string, T>();
    // Start with local
    for (const item of localArr) map.set(item.id, item);
    // Remote wins if newer
    for (const item of remoteArr) {
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const localTs = existing.updatedAt ?? "";
        const remoteTs = item.updatedAt ?? "";
        if (remoteTs > localTs) map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  };

  // Helper for entities that have projectId as key instead of id
  const mergeByProjectId = <T extends { projectId: string; updatedAt?: string }>(
    localArr: T[], remoteArr: T[]
  ): T[] =>
    mergeArray(
      localArr.map(p => ({ ...p, id: p.projectId })),
      remoteArr.map(p => ({ ...p, id: p.projectId }))
    ).map(({ id: _id, ...rest }) => rest) as unknown as T[];

  return {
    ...local,
    projects: mergeArray(local.projects, remote.projects),
    plans: mergeByProjectId(local.plans, remote.plans ?? []),
    notes: mergeArray(local.notes, remote.notes),
    todoLists: mergeArray(local.todoLists, remote.todoLists),
    tasks: mergeArray(local.tasks, remote.tasks),
    mindMaps: remote.mindMaps ?? local.mindMaps, // mind map: remote wins (last edit)
    tools: mergeByProjectId(local.tools, remote.tools ?? []),
    // Phase 4+ entities — merge by id + updatedAt
    decisions: mergeArray(local.decisions ?? [], remote.decisions ?? []),
    standups: mergeArray(
      (local.standups ?? []).map(e => ({ ...e, updatedAt: e.createdAt })),
      (remote.standups ?? []).map(e => ({ ...e, updatedAt: e.createdAt }))
    ).map(({ updatedAt: _u, ...rest }) => rest) as typeof local.standups,
    pomodoros: mergeArray(
      (local.pomodoros ?? []).map(p => ({ ...p, updatedAt: p.startedAt })),
      (remote.pomodoros ?? []).map(p => ({ ...p, updatedAt: p.startedAt }))
    ).map(({ updatedAt: _u, ...rest }) => rest) as typeof local.pomodoros,
    // Settings: always keep local (never overwrite from remote)
    settings: local.settings,
  };
}

/** Full sync cycle: push local, then pull and merge. Returns new sync state. */
export async function syncWithGitHub(
  token: string,
  gistId: string | null,
  localData: AppData
): Promise<{ data: AppData; gistId: string; state: SyncState }> {
  const now = new Date().toISOString();

  try {
    let resolvedGistId = gistId;

    // First sync — create the Gist
    if (!resolvedGistId) {
      resolvedGistId = await createGist(token, localData);
      return {
        data: localData,
        gistId: resolvedGistId,
        state: { status: "success", lastSyncAt: now, errorMessage: null },
      };
    }

    // Pull remote
    let remote: AppData | null = null;
    try {
      remote = await pullFromGist(token, resolvedGistId);
    } catch (e: any) {
      if (e.message.includes("404")) {
        // Gist was deleted on GitHub - we must recreate it
        resolvedGistId = await createGist(token, localData);
        return {
          data: localData,
          gistId: resolvedGistId,
          state: { status: "success", lastSyncAt: now, errorMessage: null },
        };
      }
      throw e;
    }

    // Merge
    const merged = remote ? mergeData(localData, remote) : localData;

    // Push merged back
    try {
      await pushToGist(token, resolvedGistId, merged);
    } catch (e: any) {
      if (e.message.includes("404")) {
        // Edge case: deleted exactly between pull and push
        resolvedGistId = await createGist(token, merged);
      } else {
        throw e;
      }
    }

    return {
      data: merged,
      gistId: resolvedGistId,
      state: { status: "success", lastSyncAt: now, errorMessage: null },
    };
  } catch (err) {
    return {
      data: localData,
      gistId: gistId ?? "",
      state: {
        status: "error",
        lastSyncAt: null,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
