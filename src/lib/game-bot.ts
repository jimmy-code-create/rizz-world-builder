import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { GAME_BOT_CHANNEL, type GameBotState, type GameEntry } from "@/lib/game-library";
import {
  EMPTY_GAME_SESSION_VIEW,
  isSafeJoinUrl,
  makeSessionId,
  mySession as findMySession,
  removeSession,
  sessionList,
  setSessionJoinUrl,
  setSessionPaused,
  setSessionRoomCode,
  stopIntent,
  upsertSession,
  viewFor,
  type GameSession,
  type GameSessionMap,
} from "@/lib/game-sessions";

export const EMPTY_GAME_BOT: GameBotState = EMPTY_GAME_SESSION_VIEW;

/* ────────────────────────────────────────────────────────────────────────────
 * PER-USER GAME BOT STORE (one session per person, shared by every surface).
 *
 * Unlike the old single "channel game", this store keeps a map of sessions keyed
 * by the host's user id. Jimmy can play Krunker while Bob plays Skribbl, and each
 * client only auto-opens its own game or a game it explicitly joined. Everyone
 * else sees the live sessions in the VC and can press Join game.
 *
 * Launches, pauses, room codes and ends travel on `vc-game-bot:<channelId>`;
 * who is viewing whose game travels in Supabase presence, so late joiners get
 * both the sessions and the current team without a database table.
 * ──────────────────────────────────────────────────────────────────────────── */

type GameBotSnapshot = {
  state: GameBotState;
  sessions: GameSession[];
  sessionsById: GameSessionMap;
  mySession: GameSession | null;
  /** The host whose game this client is watching, if it explicitly joined one. */
  viewingHostId: string | null;
  joined: boolean;
  isHost: boolean;
  /** Host id -> user ids in that session (host included). */
  viewersByHost: Record<string, string[]>;
  ready: boolean;
};

type Listener = () => void;

let sessions: GameSessionMap = {};
let viewersByHost: Record<string, string[]> = {};

const listeners = new Set<Listener>();

let channel: ReturnType<typeof supabase.channel> | null = null;
let activeChannelId: string | null = null;
let attachCount = 0;
let meId: string | null = null;
let meName = "Someone";
let viewingHostId: string | null = null;
/** Session ids that already ended, so a delayed broadcast cannot revive them. */
let endedSessions = new Set<string>();

/**
 * Declared after the state it reads: `buildSnapshot` touches `meId` and
 * `viewingHostId`, so initialising this above them threw a temporal-dead-zone
 * ReferenceError during SSR and blanked every page.
 */
let snapshot: GameBotSnapshot = buildSnapshot();

function buildSnapshot(): GameBotSnapshot {
  const state = viewFor(sessions, meId, viewingHostId);
  const mine = findMySession(sessions, meId);
  const viewedHost = state.launchedBy;
  return {
    state,
    sessions: sessionList(sessions),
    sessionsById: sessions,
    mySession: mine,
    viewingHostId,
    joined: !!viewingHostId && viewingHostId !== meId,
    isHost: !!viewedHost && viewedHost === meId,
    viewersByHost,
    ready: !!activeChannelId,
  };
}

function emit() {
  snapshot = buildSnapshot();
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

/** A session from the wire is only used if the game can actually open. */
function normalizeSession(raw: unknown): GameSession | null {
  const value = raw as Partial<GameSession> | null | undefined;
  const game = value?.game as Partial<GameEntry> | null | undefined;
  if (
    !value ||
    typeof value.hostId !== "string" ||
    typeof value.sessionId !== "string" ||
    !game ||
    typeof game.id !== "string" ||
    typeof game.name !== "string" ||
    typeof game.url !== "string" ||
    typeof value.startedAt !== "number"
  ) {
    return null;
  }
  return {
    sessionId: value.sessionId,
    hostId: value.hostId,
    hostName: typeof value.hostName === "string" && value.hostName ? value.hostName : "Someone",
    game: game as GameEntry,
    startedAt: value.startedAt,
    paused: !!value.paused,
    roomCode: typeof value.roomCode === "string" && value.roomCode ? value.roomCode : null,
    joinUrl:
      typeof value.joinUrl === "string" && isSafeJoinUrl(value.joinUrl)
        ? value.joinUrl
        : null,
  };
}

function broadcastSession(session: GameSession, to?: string) {
  void channel
    ?.send({
      type: "broadcast",
      event: "game-bot-state",
      payload: { userId: meId, to, session },
    })
    .catch(() => {});
}

function broadcastEnd(hostId: string, sessionId: string) {
  void channel
    ?.send({
      type: "broadcast",
      event: "game-bot-end",
      payload: { userId: hostId, sessionId },
    })
    .catch(() => {});
}

function trackPresence() {
  if (!channel || !meId) return;
  void channel
    .track({ userId: meId, name: meName, viewing: viewingHostId })
    .catch(() => {});
}

/**
 * Read who is watching whose game. The host is always counted as inside their
 * own session; joiners appear only while their presence says they are viewing
 * that host. If presence is unavailable the map simply stays empty.
 */
function readPresence() {
  if (!channel) return;
  const next: Record<string, string[]> = {};
  for (const hostId of Object.keys(sessions)) next[hostId] = [hostId];
  try {
    const presence = channel.presenceState() as Record<
      string,
      Array<{ userId?: string; viewing?: string | null }>
    >;
    for (const [key, entries] of Object.entries(presence)) {
      for (const tracked of entries) {
        const viewerId = typeof tracked?.userId === "string" ? tracked.userId : key;
        const viewing = tracked?.viewing;
        if (!viewing || !sessions[viewing]) continue;
        const list = (next[viewing] ??= []);
        if (!list.includes(viewerId)) list.push(viewerId);
      }
    }
  } catch (error) {
    console.debug("[game-bot] presence read failed", error);
  }
  viewersByHost = next;
  emit();
}

function attach(id: string, userId: string, name: string) {
  if (activeChannelId === id && meId === userId) {
    attachCount += 1;
    meName = name;
    trackPresence();
    return;
  }
  if (activeChannelId) detachAll();

  activeChannelId = id;
  meId = userId;
  meName = name;
  viewingHostId = null;
  endedSessions = new Set();
  sessions = {};
  viewersByHost = {};
  attachCount = 1;
  emit();

  const next = supabase.channel(GAME_BOT_CHANNEL(id), {
    config: { presence: { key: userId } },
  });
  channel = next;
  next
    .on("broadcast", { event: "game-bot-state" }, ({ payload }) => {
      if (payload?.userId === meId) return; // already applied locally
      if (payload?.to && payload.to !== meId) return;
      const session = normalizeSession(payload?.session);
      if (!session || endedSessions.has(session.sessionId)) return;
      const current = sessions[session.hostId];
      // Ignore a delayed older launch that lost the race with a newer one.
      if (current && current.sessionId !== session.sessionId && current.startedAt > session.startedAt) {
        return;
      }
      sessions = upsertSession(sessions, session);
      readPresence();
    })
    .on("broadcast", { event: "game-bot-end" }, ({ payload }) => {
      if (!payload || payload.userId === meId) return;
      if (typeof payload.userId !== "string") return;
      if (typeof payload.sessionId === "string") endedSessions.add(payload.sessionId);
      sessions = removeSession(sessions, payload.userId, payload.sessionId);
      if (viewingHostId === payload.userId) viewingHostId = null;
      readPresence();
    })
    .on("broadcast", { event: "game-bot-request" }, ({ payload }) => {
      if (!payload || payload.userId === meId) return;
      // Answer with only my own session. With many independent sessions this
      // fans in naturally instead of one client trying to own the whole map.
      const mine = findMySession(sessions, meId);
      if (mine) broadcastSession(mine, payload.userId);
    })
    .on("presence", { event: "sync" }, () => readPresence())
    .on("presence", { event: "join" }, () => readPresence())
    .on("presence", { event: "leave" }, ({ key }) => {
      if (key && key !== meId && sessions[key]) {
        sessions = removeSession(sessions, key);
        if (viewingHostId === key) viewingHostId = null;
      }
      readPresence();
    })
    .subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      trackPresence();
      // Re-announce my own session when the channel reconnects; peers may have
      // pruned it while presence was down.
      const mine = findMySession(sessions, meId);
      if (mine) broadcastSession(mine);
      void next
        .send({ type: "broadcast", event: "game-bot-request", payload: { userId: meId } })
        .catch(() => {});
      readPresence();
    });
}

function detachAll() {
  const mine = findMySession(sessions, meId);
  // Leaving the call / switching channels must not leave a ghost game behind.
  if (mine) broadcastEnd(mine.hostId, mine.sessionId);
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  activeChannelId = null;
  meId = null;
  meName = "Someone";
  viewingHostId = null;
  endedSessions = new Set();
  sessions = {};
  viewersByHost = {};
  emit();
}

function release(id: string) {
  if (activeChannelId !== id) return;
  attachCount = Math.max(0, attachCount - 1);
  if (attachCount === 0) detachAll();
}

/* ── Actions ─────────────────────────────────────────────────────────────── */

function launch(game: GameEntry): GameSession | null {
  if (!meId) return null;
  const session: GameSession = {
    sessionId: makeSessionId(),
    hostId: meId,
    hostName: meName,
    game,
    startedAt: Date.now(),
    paused: false,
    roomCode: null,
    joinUrl: null,
  };
  sessions = upsertSession(sessions, session);
  viewingHostId = meId;
  emit();
  trackPresence();
  broadcastSession(session);
  return session;
}

function join(hostId: string): boolean {
  if (!meId || !sessions[hostId]) return false;
  viewingHostId = hostId;
  emit();
  trackPresence();
  return true;
}

function leave() {
  viewingHostId = null;
  emit();
  trackPresence();
}

function stop() {
  const intent = stopIntent(sessions, meId, viewingHostId);
  if (intent.kind === "none") return;
  // Watching somebody else: stop only ends *my* view, never their game — and
  // never my own still-running session in the background.
  if (intent.kind === "leave") {
    leave();
    return;
  }
  sessions = removeSession(sessions, intent.hostId, intent.sessionId);
  endedSessions.add(intent.sessionId);
  if (viewingHostId === intent.hostId) viewingHostId = null;
  emit();
  trackPresence();
  broadcastEnd(intent.hostId, intent.sessionId);
}

function setPaused(paused: boolean) {
  if (!meId || viewingHostId !== meId) return;
  const updated = setSessionPaused(sessions, meId, paused);
  const mine = updated[meId];
  if (!mine) return;
  sessions = updated;
  emit();
  broadcastSession(mine);
}

function updateRoomCode(roomCode: string | null) {
  if (!meId || viewingHostId !== meId) return;
  const updated = setSessionRoomCode(sessions, meId, roomCode);
  const mine = updated[meId];
  if (!mine) return;
  sessions = updated;
  emit();
  broadcastSession(mine);
}

function updateJoinUrl(joinUrl: string | null) {
  if (!meId || viewingHostId !== meId) return;
  const updated = setSessionJoinUrl(sessions, meId, joinUrl);
  const mine = updated[meId];
  if (!mine) return;
  sessions = updated;
  emit();
  broadcastSession(mine);
}

/* ── Hook ────────────────────────────────────────────────────────────────── */

function fallbackName(user: { user_metadata?: Record<string, unknown>; email?: string } | null) {
  const metadata = user?.user_metadata ?? {};
  for (const key of ["display_name", "full_name", "name", "username"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const email = user?.email?.split("@")[0];
  return email || "Someone";
}

/**
 * The per-user GAME BOT for one voice channel.
 *
 * Mount anywhere that needs the state (overlay, Games menu, Games page, VC).
 * `name` lets the UI show the display name people know instead of an email.
 */
export function useGameBot(
  channelIdInput: string | null | undefined,
  enabled = true,
  name?: string | null,
) {
  const { user } = useAuth();
  const active = enabled && !!channelIdInput && !!user;
  const displayName = name?.trim() || fallbackName(user);

  useEffect(() => {
    if (!active || !channelIdInput || !user?.id) return;
    attach(channelIdInput, user.id, displayName);
    return () => release(channelIdInput);
  }, [active, channelIdInput, user?.id, displayName]);

  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const start = useCallback((game: GameEntry) => launch(game), []);
  const joinSession = useCallback((hostId: string) => join(hostId), []);
  const leaveSession = useCallback(() => leave(), []);
  const stopSession = useCallback(() => stop(), []);
  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);
  const setRoomCode = useCallback((code: string | null) => updateRoomCode(code), []);
  const setJoinUrl = useCallback((url: string | null) => updateJoinUrl(url), []);

  return {
    ...current,
    launch: start,
    join: joinSession,
    leave: leaveSession,
    stop: stopSession,
    pause,
    resume,
    setRoomCode,
    setJoinUrl,
  };
}

/* ── Overlay view state (local per user: minimize / expand) ──────────────── */

let minimized = false;
let uiSnapshot = { minimized: false };
const uiListeners = new Set<Listener>();

function emitUI() {
  uiSnapshot = { minimized };
  for (const listener of uiListeners) listener();
}

function subscribeUI(listener: Listener) {
  uiListeners.add(listener);
  return () => {
    uiListeners.delete(listener);
  };
}

function getUISnapshot() {
  return uiSnapshot;
}

/** Minimize / expand the GAME BOT overlay. Local to this user, like Discord. */
export function useGameOverlayUI() {
  const current = useSyncExternalStore(subscribeUI, getUISnapshot, getUISnapshot);
  const minimize = useCallback(() => {
    minimized = true;
    emitUI();
  }, []);
  const expand = useCallback(() => {
    minimized = false;
    emitUI();
  }, []);
  return { minimized: current.minimized, minimize, expand };
}
