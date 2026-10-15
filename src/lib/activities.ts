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

/**
 * Live activity state for one voice room. The launcher broadcasts start/end;
 * presence carries the current game so late joiners sync it on subscribe.
 */
export function useRoomActivity(roomId: string | null, me: { id: string; name: string } | null) {
  const [activity, setActivity] = useState<RoomActivity | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activityRef = useRef<RoomActivity | null>(null);
  activityRef.current = activity;
  const meRef = useRef(me);
  meRef.current = me;

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
      }
    });
    channel.on("broadcast", { event: "activity-end" }, () => {
      setActivity(null);
    });
    channel.on("presence", { event: "sync" }, () => {
      try {
        const state = channel.presenceState() as Record<string, Array<{ activity?: RoomActivity | null }>>;
        let latest: RoomActivity | null = null;
        for (const presences of Object.values(state)) {
          for (const tracked of presences) {
            const candidate = tracked?.activity ?? null;
            if (candidate && (!latest || candidate.startedAt > latest.startedAt)) latest = candidate;
          }
        }
        if (latest) setActivity(latest);
      } catch {
        /* presence is best-effort */
      }
    });

    subscribeSafely(channel, (status) => {
      if (status === "SUBSCRIBED") {
        channel.track({ activity: activityRef.current }).catch(() => {});
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
  }, [roomId]);

  const start = useCallback(async (entry: GameEntry): Promise<RoomActivity | null> => {
    const meNow = meRef.current;
    if (!meNow) return null;
    const roomCode = entry.type === "embed" ? null : makeRoomCode();
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
      await channelRef.current?.track({ activity: next });
      await channelRef.current?.send({ type: "broadcast", event: "activity-start", payload: next });
    } catch {
      /* local state still opens the panel */
    }
    return next;
  }, []);

  const end = useCallback(async () => {
    setActivity(null);
    try {
      await channelRef.current?.track({ activity: null });
      await channelRef.current?.send({ type: "broadcast", event: "activity-end", payload: {} });
    } catch {
      /* local state still clears */
    }
  }, []);

  return { activity, start, end };
}
