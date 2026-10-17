import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { GAME_BOT_CHANNEL, type GameBotState, type GameEntry } from "@/lib/game-library";

export const EMPTY_GAME_BOT: GameBotState = {
  activeGame: null,
  isPlaying: false,
  isPaused: false,
  launchedAt: null,
  launchedBy: null,
};

/* ────────────────────────────────────────────────────────────────────────────
 * Shared GAME BOT store (one per voice channel).
 *
 * Launches, pauses and stops are broadcast on `vc-game-bot:<channelId>` and
 * mirrored into a module-level store, so the overlay host, the Games menu, the
 * Games page and the VC view all read the same state. Late joiners ask for the
 * current state on subscribe ("game-bot-request"), so a session started before
 * someone joined still reaches them.
 * ──────────────────────────────────────────────────────────────────────────── */

type Listener = () => void;

let state: GameBotState = EMPTY_GAME_BOT;
const listeners = new Set<Listener>();

let channel: ReturnType<typeof supabase.channel> | null = null;
let channelId: string | null = null;
let attachCount = 0;
let meId: string | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(cb: Listener) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return state;
}

function normalize(raw: unknown): GameBotState {
  const value = raw as Partial<GameBotState> | null | undefined;
  return {
    activeGame: (value?.activeGame as GameEntry | null) ?? null,
    isPlaying: !!value?.isPlaying && !value?.isPaused,
    isPaused: !!value?.isPaused,
    launchedAt: (value?.launchedAt as number | null) ?? null,
    launchedBy: (value?.launchedBy as string | null) ?? null,
  };
}

function setState(next: GameBotState) {
  state = next;
  emit();
}

function broadcast(next: GameBotState) {
  void channel?.send({
    type: "broadcast",
    event: "game-bot-state",
    payload: { userId: meId, state: next },
  });
}

function attach(id: string, userId: string) {
  if (channelId === id) {
    attachCount += 1;
    return;
  }
  detachAll();
  channelId = id;
  meId = userId;
  setState(EMPTY_GAME_BOT);

  const next = supabase.channel(GAME_BOT_CHANNEL(id));
  next
    .on("broadcast", { event: "game-bot-state" }, ({ payload }) => {
      if (payload?.userId === meId) return; // own updates are already applied
      if (!payload?.state) return;
      setState(normalize(payload.state));
    })
    .on("broadcast", { event: "game-bot-request" }, ({ payload }) => {
      // Someone joined mid-session: answer with the current state so the
      // overlay pops for them too, no matter who launched.
      if (payload?.userId === meId) return;
      if (state.activeGame) broadcast(state);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void next.send({ type: "broadcast", event: "game-bot-request", payload: { userId: meId } });
      }
    });
  channel = next;
  attachCount = 1;
}

function release(id: string) {
  if (channelId !== id) return;
  attachCount = Math.max(0, attachCount - 1);
  if (attachCount === 0) {
    detachAll();
    if (state.activeGame) setState(EMPTY_GAME_BOT);
  }
}

function detachAll() {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  channelId = null;
  meId = null;
}

/**
 * The shared GAME BOT for one voice channel.
 *
 * Mount anywhere that needs the state (overlay host, Games menu, Games page).
 * Pass the current call's channel id; `enabled` lets sheets subscribe lazily.
 */
export function useGameBot(channelIdInput: string | null | undefined, enabled = true) {
  const { user } = useAuth();
  const active = enabled && !!channelIdInput && !!user;

  useEffect(() => {
    if (!active || !channelIdInput || !user) return;
    attach(channelIdInput, user.id);
    return () => release(channelIdInput);
  }, [active, channelIdInput, user]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const launch = useCallback((game: GameEntry) => {
    const next: GameBotState = {
      activeGame: game,
      isPlaying: true,
      isPaused: false,
      launchedAt: Date.now(),
      launchedBy: meId,
    };
    setState(next);
    broadcast(next);
  }, []);

  const pause = useCallback(() => {
    const next: GameBotState = { ...getSnapshot(), isPlaying: false, isPaused: true };
    setState(next);
    broadcast(next);
  }, []);

  const resume = useCallback(() => {
    const next: GameBotState = { ...getSnapshot(), isPlaying: true, isPaused: false };
    setState(next);
    broadcast(next);
  }, []);

  const stop = useCallback(() => {
    setState(EMPTY_GAME_BOT);
    broadcast(EMPTY_GAME_BOT);
  }, []);

  return { state: snapshot, launch, pause, resume, stop, ready: active };
}

/* ── Overlay view state (local per user: minimize / expand) ──────────────── */

let minimized = false;
let uiSnapshot = { minimized: false };
const uiListeners = new Set<Listener>();

function emitUI() {
  uiSnapshot = { minimized };
  for (const listener of uiListeners) listener();
}

function subscribeUI(cb: Listener) {
  uiListeners.add(cb);
  return () => {
    uiListeners.delete(cb);
  };
}

function getUISnapshot() {
  return uiSnapshot;
}

/** Minimize / expand the GAME BOT overlay. Local to this user, like Discord. */
export function useGameOverlayUI() {
  const snapshot = useSyncExternalStore(subscribeUI, getUISnapshot, getUISnapshot);
  const minimize = useCallback(() => {
    minimized = true;
    emitUI();
  }, []);
  const expand = useCallback(() => {
    minimized = false;
    emitUI();
  }, []);
  return { minimized: snapshot.minimized, minimize, expand };
}
