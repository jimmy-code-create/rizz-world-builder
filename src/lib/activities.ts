import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subscribeSafely } from "@/lib/realtime";
import registry from "@/data/games.json";

export type ActivityType = "multiplayer-hub" | "room-link" | "embed";

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
};

/** The whole shelf is this JSON file: one entry per game, nothing else. */
export function getGames(): GameEntry[] {
  if (!Array.isArray(registry)) return [];
  return (registry as GameEntry[]).filter(
    (entry) =>
      !!entry &&
      typeof entry.id === "string" &&
      typeof entry.name === "string" &&
      typeof entry.url === "string" &&
      (entry.type === "multiplayer-hub" || entry.type === "room-link" || entry.type === "embed"),
  );
}

export function getGame(id: string): GameEntry | null {
  return getGames().find((entry) => entry.id === id) ?? null;
}

/** Only real https URLs launch. Placeholders stay a friendly error card. */
export function isValidGameUrl(url: string): boolean {
  return /^https:\/\/[^/]+/.test(url.trim());
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
  if (entry.type === "embed" || !roomCode) return entry.url;
  if (entry.type === "room-link") return `Join my ${entry.name} game: ${launchUrl(entry, roomCode)}`;
  return `Join my ${entry.name} game at ${entry.url} with room code ${roomCode}`;
}

/** Who has the game open right now, by user id (Discord-style "N playing"). */
export type ActivityPlayers = Record<string, { gameId: string; gameName: string }>;

/**
 * Live activity state for one voice room. The launcher broadcasts start/end;
 * presence carries the current game so late joiners sync it on subscribe,
 * plus each member's playing flag for live counts.
 */
export function useRoomActivity(
  roomId: string | null,
  me: { id: string; name: string } | null,
  playing = false,
) {
  const [activity, setActivity] = useState<RoomActivity | null>(null);
  const [players, setPlayers] = useState<ActivityPlayers>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activityRef = useRef<RoomActivity | null>(null);
  activityRef.current = activity;
  const meRef = useRef(me);
  meRef.current = me;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const trackSelf = useCallback(() => {
    channelRef.current
      ?.track({ activity: activityRef.current, playing: playingRef.current })
      .catch(() => {});
  }, []);

  const readPresence = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    try {
      const state = channel.presenceState() as Record<
        string,
        Array<{ activity?: RoomActivity | null; playing?: boolean }>
      >;
      let latest: RoomActivity | null = null;
      const nextPlayers: ActivityPlayers = {};
      for (const [key, presences] of Object.entries(state)) {
        for (const tracked of presences) {
          const candidate = tracked?.activity ?? null;
          if (candidate && (!latest || candidate.startedAt > latest.startedAt)) latest = candidate;
          if (tracked?.playing && candidate && typeof candidate.gameId === "string") {
            nextPlayers[key] = { gameId: candidate.gameId, gameName: candidate.gameName };
          }
        }
      }
      if (latest) setActivity(latest);
      setPlayers(nextPlayers);
    } catch {
      /* presence is best-effort */
    }
  }, []);

  useEffect(() => {
    if (!roomId || !meRef.current) return;
    const channel = supabase.channel(`voice-activity-${roomId}`, {
      config: { presence: { key: meRef.current.id } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "activity-start" }, ({ payload }) => {
      const next = payload as RoomActivity | null;
      if (next && typeof next.gameId === "string" && typeof next.url === "string") {
        setActivity(next);
        readPresence();
      }
    });
    channel.on("broadcast", { event: "activity-end" }, () => {
      setActivity(null);
      setPlayers({});
      readPresence();
    });
    channel.on("presence", { event: "sync" }, () => {
      readPresence();
    });
    channel.on("presence", { event: "join" }, () => {
      readPresence();
    });
    channel.on("presence", { event: "leave" }, () => {
      readPresence();
    });

    subscribeSafely(channel, (status) => {
      if (status === "SUBSCRIBED") {
        trackSelf();
        readPresence();
      }
    });
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        /* already gone */
      }
      channelRef.current = null;
    };
  }, [roomId, readPresence, trackSelf]);

  // My playing flag follows the panel: open = playing, closed = not.
  useEffect(() => {
    trackSelf();
  }, [playing, trackSelf]);

  const start = useCallback(async (entry: GameEntry): Promise<RoomActivity | null> => {
    const meNow = meRef.current;
    if (!meNow) return null;
    const roomCode = entry.type === "embed" || entry.sharedCode === false ? null : makeRoomCode();
    const next: RoomActivity = {
      gameId: entry.id,
      gameName: entry.name,
      gameIcon: entry.icon,
      url: launchUrl(entry, roomCode),
      roomCode,
      startedBy: meNow.id,
      startedByName: meNow.name,
      startedAt: Date.now(),
    };
    setActivity(next);
    try {
      await channelRef.current?.track({ activity: next, playing: playingRef.current });
      await channelRef.current?.send({ type: "broadcast", event: "activity-start", payload: next });
    } catch {
      /* local state still opens the panel */
    }
    return next;
  }, []);

  const end = useCallback(async () => {
    setActivity(null);
    setPlayers({});
    try {
      await channelRef.current?.track({ activity: null, playing: playingRef.current });
      await channelRef.current?.send({ type: "broadcast", event: "activity-end", payload: {} });
    } catch {
      /* local state still clears */
    }
  }, []);

  return { activity, players, start, end };
}
