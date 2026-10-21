import type { GameBotState, GameEntry } from "./game-library.ts";

/**
 * PER-USER GAME SESSIONS
 *
 * A voice channel no longer has one shared GAME BOT. Each person can launch
 * their own game, and everyone else can join any session they like. The map is
 * keyed by the host's user id, because one person can only host one game at a
 * time; relaunching replaces that host's session and leaves everyone else's
 * untouched.
 *
 * Everything in this module is pure and DB-free so the session rules are
 * cheap to test without a browser or Supabase connection.
 */
export type GameSession = {
  /** Unique per launch, so a stale "end" cannot remove a newer session. */
  sessionId: string;
  hostId: string;
  hostName: string;
  game: GameEntry;
  startedAt: number;
  paused: boolean;
  /** Optional room / team code the host can paste from the game itself. */
  roomCode: string | null;
  /** Optional full invite link; viewers open this instead of the base URL. */
  joinUrl: string | null;
};

export type GameSessionMap = Record<string, GameSession>;

/** Never let a host-supplied "invite link" become javascript:/data:. */
export function isSafeJoinUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\/[^/]+/i.test(url.trim());
}

export const EMPTY_GAME_SESSION_VIEW: GameBotState = {
  activeGame: null,
  isPlaying: false,
  isPaused: false,
  launchedAt: null,
  launchedBy: null,
  hostName: null,
  sessionId: null,
  roomCode: null,
  joinUrl: null,
};

/** The session a user is currently hosting, if any. */
export function mySession(
  sessions: GameSessionMap,
  userId: string | null | undefined,
): GameSession | null {
  if (!userId) return null;
  return sessions[userId] ?? null;
}

/**
 * What this client should render.
 *
 * `viewingHostId` is the host whose game I opened. It falls back to my own
 * session, then to nothing. Returning the host's session (rather than a copy)
 * means pausing or ending it updates every viewer without extra syncing.
 */
export function viewFor(
  sessions: GameSessionMap,
  userId: string | null | undefined,
  viewingHostId: string | null | undefined,
): GameBotState {
  const target =
    (viewingHostId ? sessions[viewingHostId] : null) ??
    (userId ? sessions[userId] : null) ??
    null;
  if (!target) return EMPTY_GAME_SESSION_VIEW;
  // A viewer lands directly in the host's room/team when an invite link was
  // shared. The host keeps the base game URL, so setting the link does not
  // reload their own session.
  const joining = !!userId && target.hostId !== userId;
  const game =
    joining && isSafeJoinUrl(target.joinUrl)
      ? { ...target.game, url: target.joinUrl }
      : target.game;
  return {
    activeGame: game,
    isPlaying: !target.paused,
    isPaused: target.paused,
    launchedAt: target.startedAt,
    launchedBy: target.hostId,
    hostName: target.hostName,
    sessionId: target.sessionId,
    roomCode: target.roomCode,
    joinUrl: target.joinUrl,
  };
}

/** Newest first — the order the VC strip and the Games menu show sessions in. */
export function sessionList(sessions: GameSessionMap): GameSession[] {
  return Object.values(sessions).sort((a, b) => b.startedAt - a.startedAt);
}

/** Insert or replace one host's session without touching anybody else's. */
export function upsertSession(
  sessions: GameSessionMap,
  session: GameSession,
): GameSessionMap {
  return { ...sessions, [session.hostId]: session };
}

/**
 * Remove a session. A joiner ending their own view must not remove the host's
 * game, so the caller passes only the host id it means to stop.
 */
export function removeSession(
  sessions: GameSessionMap,
  hostId: string,
  sessionId?: string | null,
): GameSessionMap {
  const current = sessions[hostId];
  if (!current) return sessions;
  if (sessionId && current.sessionId !== sessionId) return sessions;
  const next = { ...sessions };
  delete next[hostId];
  return next;
}

/** Pause/resume only the given session; viewers see the change immediately. */
export function setSessionPaused(
  sessions: GameSessionMap,
  hostId: string,
  paused: boolean,
): GameSessionMap {
  const current = sessions[hostId];
  if (!current) return sessions;
  return { ...sessions, [hostId]: { ...current, paused } };
}

/** Invite link: only http(s), trimmed, or cleared. */
export function setSessionJoinUrl(
  sessions: GameSessionMap,
  hostId: string,
  joinUrl: string | null,
): GameSessionMap {
  const current = sessions[hostId];
  if (!current) return sessions;
  const clean = (joinUrl ?? "").trim().slice(0, 500);
  return { ...sessions, [hostId]: { ...current, joinUrl: isSafeJoinUrl(clean) ? clean : null } };
}

/** Room / team code: trimmed, uppercase-ish, capped, or cleared. */
export function setSessionRoomCode(
  sessions: GameSessionMap,
  hostId: string,
  roomCode: string | null,
): GameSessionMap {
  const current = sessions[hostId];
  if (!current) return sessions;
  const clean = (roomCode ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
  return { ...sessions, [hostId]: { ...current, roomCode: clean || null } };
}

/** Stable per-launch id; no database and no server round trip needed. */
export function makeSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `game-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type StopIntent =
  | { kind: "none" }
  | { kind: "leave" }
  | { kind: "stop"; hostId: string; sessionId: string };

/**
 * What the overlay's X should do right now.
 *
 * A viewer who still has their own session running in the background must
 * leave the viewed game, not stop their own game. Only a host's X stops a
 * session for everyone who joined it.
 */
export function stopIntent(
  sessions: GameSessionMap,
  userId: string | null | undefined,
  viewingHostId: string | null | undefined,
): StopIntent {
  if (viewingHostId && viewingHostId !== userId) return { kind: "leave" };
  const mine = mySession(sessions, userId);
  if (mine) return { kind: "stop", hostId: mine.hostId, sessionId: mine.sessionId };
  if (viewingHostId) return { kind: "leave" };
  return { kind: "none" };
}

/**
 * Should this user's "playing" badge count them as part of the session?
 * The host is always in it; a joiner must be viewing that host.
 */
export function isInSession(
  session: GameSession,
  userId: string | null | undefined,
  viewingHostId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return session.hostId === userId || viewingHostId === session.hostId;
}
