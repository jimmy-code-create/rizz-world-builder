import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subscribeSafely } from "@/lib/realtime";
import registry from "@/data/games.json";
import { BUILTIN_GAMES } from "@/lib/builtin-games";

/**
 * ACTIVITIES — Discord-style games inside a voice channel.
 *
 * Two kinds of game live in one registry:
 *
 * - `builtin`: shipped with the app (see `builtin-games.ts`). Instant, no
 *   account, works as a screen-sized layer behind the voice controls.
 * - `web`: an external site from `src/data/games.json`, opened in a sandboxed
 *   frame. These carry their own room codes, so the launcher copies an invite
 *   instead of generating one.
 *
 * Live state is ephemeral: one realtime channel per voice room carries start/end
 * broadcasts, presence carries the current activity so late joiners sync, and
 * nothing is written to the database. That channel is shared by every consumer
 * (the call view, the hub, the room) through the store below, because two
 * supabase-js `channel()` calls with the same topic return the *same* instance —
 * subscribing it twice throws, and removing it from one consumer kills it for
 * all of them.
 */

export type ActivityType = "multiplayer-hub" | "room-link" | "embed";
export type GameSource = "builtin" | "web";
export type GameCategory = "arcade" | "party" | "solo" | "board" | "puzzle";

export type GameEntry = {
  id: string;
  name: string;
  icon: string;
  description: string;
  players: string;
  url: string;
  type: ActivityType;
  roomParam?: string;
  /**
   * True (default) when the game honors a launcher-generated room code:
   * self-hosted hubs and room-link clones that auto-create `?room=CODE`.
   * False for third-party sites (Jackbox, skribbl) where the room code
   * lives on their side — the launcher opens the site and skips our code.
   */
  sharedCode?: boolean;
  source: GameSource;
  category: GameCategory;
  /** Plays in-app with no sign-up: a card can promise "tap and you're playing". */
  instant: boolean;
  /** Game art accent, used by the hub cards and the overlay chrome. */
  accent?: string;
  hook?: string;
  controls?: string;
  howTo?: string[];
};

/** The live game state for one voice room. Ephemeral: broadcast to members,
 *  tracked in presence so late joiners sync it. No database table needed. */
export type RoomActivity = {
  gameId: string;
  gameName: string;
  gameIcon: string;
  url: string;
  roomCode: string | null;
  startedBy: string;
  startedByName: string;
  startedAt: number;
  source: GameSource;
};

const WEB_CATEGORY: Record<ActivityType, GameCategory> = {
  "multiplayer-hub": "party",
  "room-link": "party",
  embed: "solo",
};

function builtinEntries(): GameEntry[] {
  return BUILTIN_GAMES.map((game) => ({
    id: game.id,
    name: game.name,
    icon: game.icon,
    description: game.tagline,
    players: game.players,
    url: "",
    type: "embed" as ActivityType,
    source: "builtin" as GameSource,
    category: game.category,
    instant: true,
    accent: game.accent,
    hook: game.hook,
    controls: game.controls.keys,
    howTo: game.howTo,
  }));
}

function webEntries(): GameEntry[] {
  if (!Array.isArray(registry)) return [];
  return (registry as Array<Partial<GameEntry>>)
    .filter(
      (entry) =>
        !!entry &&
        typeof entry.id === "string" &&
        typeof entry.name === "string" &&
        typeof entry.url === "string" &&
        (entry.type === "multiplayer-hub" || entry.type === "room-link" || entry.type === "embed"),
    )
    .map((entry) => {
      const type = entry.type as ActivityType;
      return {
        id: entry.id as string,
        name: entry.name as string,
        icon: entry.icon ?? ":cat_hype:",
        description: entry.description ?? "",
        players: entry.players ?? "1+",
        url: entry.url as string,
        type,
        roomParam: entry.roomParam,
        sharedCode: entry.sharedCode,
        source: "web" as GameSource,
        category: WEB_CATEGORY[type],
        // A web game can still be fullscreen and account-free, but it cannot
        // promise instant play: its own site decides that.
        instant: false,
        accent: entry.accent,
        hook: entry.hook,
        howTo: entry.howTo,
      };
    });
}

/** Built-ins first: they are the ones that always work. */
export function getGames(): GameEntry[] {
  return [...builtinEntries(), ...webEntries()];
}

export function getGame(id: string): GameEntry | null {
  return getGames().find((entry) => entry.id === id) ?? null;
}

/** Only real https URLs launch. Placeholders stay a friendly error card. */
export function isValidGameUrl(url: string): boolean {
  return /^https:\/\/[^/]+/.test(url.trim());
}

/** Can this entry actually be played right now? Built-ins always can. */
export function isPlayable(entry: GameEntry | null | undefined): boolean {
  if (!entry) return false;
  if (entry.source === "builtin") return true;
  return isValidGameUrl(entry.url);
}

/** Short unambiguous room code (no 0/O, 1/I) shared with the whole room. */
export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = new Uint32Array(6);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) code += alphabet[byte % alphabet.length];
  } else {
    for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** Final iframe URL: room-link games get `?room=CODE` so everyone lands together. */
export function launchUrl(entry: GameEntry, roomCode: string | null): string {
  if (entry.type === "room-link" && roomCode) {
    const param = entry.roomParam || "room";
    const separator = entry.url.includes("?") ? "&" : "?";
    return `${entry.url}${separator}${param}=${encodeURIComponent(roomCode)}`;
  }
  return entry.url;
}

/** Copy-paste invite text for the room. */
export function inviteText(entry: GameEntry, roomCode: string | null): string {
  if (entry.source === "builtin") return `${entry.name} — launched in your RIZZ voice channel.`;
  const target = launchUrl(entry, roomCode);
  // A site served from our own origin (e.g. /draw-party.html) is useless as a
  // pasted invite unless the link is absolute.
  const absolute =
    typeof window !== "undefined" && target.startsWith("/")
      ? `${window.location.origin}${target}`
      : target;
  if (entry.type === "embed" || !roomCode) return absolute;
  if (entry.type === "room-link") return `Join my ${entry.name} game: ${absolute}`;
  return `Join my ${entry.name} game at ${entry.url} with room code ${roomCode}`;
}

/** Who has the game open right now, by user id (Discord-style "N playing"). */
export type ActivityPlayers = Record<string, { gameId: string; gameName: string }>;

type ActivityState = { activity: RoomActivity | null; players: ActivityPlayers };
type Listener = () => void;

type RoomStore = {
  roomId: string;
  topic: string;
  channel: ReturnType<typeof supabase.channel> | null;
  state: ActivityState;
  listeners: Set<Listener>;
  me: { id: string; name: string } | null;
  /** "I am in the game" flags, one per consumer — the store ORs them. */
  playingFlags: Map<number, boolean>;
  playing: boolean;
  refs: number;
};

/** Stable per-hook-instance ids for the playing flags above. */
let instanceSeq = 0;

const EMPTY_STATE: ActivityState = { activity: null, players: {} };
const stores = new Map<string, RoomStore>();

function getStore(roomId: string): RoomStore {
  let store = stores.get(roomId);
  if (!store) {
    store = {
      roomId,
      topic: `voice-activity-${roomId}`,
      channel: null,
      state: EMPTY_STATE,
      listeners: new Set(),
      me: null,
      playingFlags: new Map(),
      playing: false,
      refs: 0,
    };
    stores.set(roomId, store);
  }
  return store;
}

function publish(store: RoomStore, next: ActivityState) {
  if (next.activity === store.state.activity && next.players === store.state.players) return;
  store.state = next;
  for (const listener of store.listeners) listener();
}

function readPresence(store: RoomStore) {
  const channel = store.channel;
  if (!channel) return;
  try {
    const presence = channel.presenceState() as Record<
      string,
      Array<{ activity?: RoomActivity | null; playing?: boolean }>
    >;
    let latest: RoomActivity | null = null;
    const players: ActivityPlayers = {};
    for (const [key, entries] of Object.entries(presence)) {
      for (const tracked of entries) {
        const candidate = tracked?.activity ?? null;
        if (
          candidate &&
          typeof candidate.gameId === "string" &&
          (!latest || candidate.startedAt > latest.startedAt)
        ) {
          latest = candidate;
        }
        if (tracked?.playing && candidate?.gameId) {
          players[key] = { gameId: candidate.gameId, gameName: candidate.gameName };
        }
      }
    }
    // Nobody in presence carries this activity any more — unless it is *ours*
    // and our own track() has not landed yet (that flicker would close the game
    // the moment it opened), clear it.
    const mine = store.state.activity?.startedBy === store.me?.id;
    const activity = latest ?? (mine ? store.state.activity : null);

    const samePlayers =
      Object.keys(players).length === Object.keys(store.state.players).length &&
      Object.keys(players).every((id) => store.state.players[id]?.gameId === players[id].gameId);

    publish(store, {
      activity,
      players: samePlayers ? store.state.players : players,
    });
  } catch (error) {
    console.debug("[activities] presence read failed", error);
  }
}

function track(store: RoomStore) {
  const channel = store.channel;
  if (!channel || !store.me) return;
  void channel.track({ activity: store.state.activity, playing: store.playing }).catch(() => {});
}

function connect(store: RoomStore) {
  if (store.channel || !store.me) return;
  const channel = supabase.channel(store.topic, {
    config: { presence: { key: store.me.id } },
  });
  store.channel = channel;

  channel.on("broadcast", { event: "activity-start" }, ({ payload }) => {
    const next = payload as RoomActivity | null;
    if (next && typeof next.gameId === "string" && typeof next.url === "string") {
      publish(store, {
        activity: { ...next, source: next.source === "builtin" ? "builtin" : "web" },
        players: store.state.players,
      });
      readPresence(store);
    }
  });
  channel.on("broadcast", { event: "activity-end" }, () => {
    publish(store, EMPTY_STATE);
    readPresence(store);
  });
  channel.on("presence", { event: "sync" }, () => readPresence(store));
  channel.on("presence", { event: "join" }, () => readPresence(store));
  channel.on("presence", { event: "leave" }, () => readPresence(store));

  subscribeSafely(channel, (status) => {
    if (status === "SUBSCRIBED") {
      track(store);
      readPresence(store);
    }
  });
}

function disconnect(store: RoomStore) {
  const channel = store.channel;
  store.channel = null;
  if (channel) {
    try {
      supabase.removeChannel(channel);
    } catch {
      /* already gone */
    }
  }
  store.playingFlags.clear();
  store.playing = false;
  publish(store, EMPTY_STATE);
}

async function startActivity(store: RoomStore, entry: GameEntry): Promise<RoomActivity | null> {
  const me = store.me;
  if (!me) return null;
  const roomCode =
    entry.source === "builtin" || entry.type === "embed" || entry.sharedCode === false
      ? null
      : makeRoomCode();
  const next: RoomActivity = {
    gameId: entry.id,
    gameName: entry.name,
    gameIcon: entry.icon,
    url: launchUrl(entry, roomCode),
    roomCode,
    startedBy: me.id,
    startedByName: me.name,
    startedAt: Date.now(),
    source: entry.source,
  };
  publish(store, { activity: next, players: store.state.players });
  try {
    await store.channel?.track({ activity: next, playing: store.playing });
    await store.channel?.send({ type: "broadcast", event: "activity-start", payload: next });
  } catch {
    /* local state still opens the game */
  }
  readPresence(store);
  return next;
}

async function endActivity(store: RoomStore) {
  publish(store, EMPTY_STATE);
  try {
    await store.channel?.track({ activity: null, playing: store.playing });
    await store.channel?.send({ type: "broadcast", event: "activity-end", payload: {} });
  } catch {
    /* local state still clears */
  }
}

/**
 * Live activity state for one voice room, shared by every consumer in the app.
 *
 * `playing` marks *this* client as "in the game", which is what the "N playing"
 * count and the participant tiles read.
 */
export function useRoomActivity(
  roomId: string | null,
  me: { id: string; name: string } | null,
  /**
   * "I have the game open." Leave it undefined from screens that merely *watch*
   * the activity (the hub) — the flags are per consumer and the store ORs them,
   * otherwise a watcher would clear the flag of the window that is really
   * playing.
   */
  playing?: boolean,
) {
  const store = roomId ? getStore(roomId) : null;
  // Depend on the identity *values*, not the object: callers build `me` inline
  // on every render, and an object dependency would re-track presence per render.
  const meId = me?.id ?? null;
  const meName = me?.name ?? null;
  const instanceRef = useRef(0);
  if (!instanceRef.current) instanceRef.current = ++instanceSeq;

  // Identity + playing flag. Runs before the ref-count effect below, so the
  // store knows who "me" is before the channel is created.
  useEffect(() => {
    if (!store) return;
    const id = instanceRef.current;
    store.me = meId ? { id: meId, name: meName ?? "Someone" } : null;
    if (playing !== undefined) store.playingFlags.set(id, playing);
    store.playing = [...store.playingFlags.values()].some(Boolean);
    connect(store);
    track(store);
    return () => {
      store.playingFlags.delete(id);
      store.playing = [...store.playingFlags.values()].some(Boolean);
      track(store);
    };
  }, [store, meId, meName, playing]);

  useEffect(() => {
    if (!store) return;
    store.refs += 1;
    connect(store);
    return () => {
      store.refs -= 1;
      if (store.refs <= 0) disconnect(store);
    };
  }, [store]);

  const subscribe = useCallback(
    (listener: Listener) => {
      if (!store) return () => {};
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    [store],
  );
  const getSnapshot = useCallback(() => (store ? store.state : EMPTY_STATE), [store]);
  const getServerSnapshot = useCallback(() => EMPTY_STATE, []);
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const start = useCallback(
    async (entry: GameEntry) => (store ? startActivity(store, entry) : null),
    [store],
  );
  const end = useCallback(async () => {
    if (store) await endActivity(store);
  }, [store]);

  return { activity: state.activity, players: state.players, start, end };
}
