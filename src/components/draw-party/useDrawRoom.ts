import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subscribeSafely } from "@/lib/realtime";

export type Stroke = {
  id: string;
  color: string;
  size: number;
  eraser?: boolean;
  points: Array<{ x: number; y: number }>;
};

export type RoomEvent =
  | { kind: "stroke"; stroke: Stroke }
  | { kind: "clear" }
  | { kind: "undo"; strokeId: string }
  | { kind: "guess"; id: string; name: string; text: string; at: number }
  | {
      kind: "round";
      word: string;
      drawerId: string;
      drawerName: string;
      round: number;
      endsAt: number;
      totalRounds?: number;
      durationS?: number;
      mode?: string;
      mult?: number;
    }
  | { kind: "correct"; userId: string; name: string; points: number }
  | { kind: "reveal"; word: string }
  | { kind: "react"; id: string; name: string; emoji: string }
  | { kind: "rematch"; userId: string; name: string }
  | { kind: "hello"; userId: string; name: string };

/**
 * Ephemeral room sync. No DB tables, no persistence:
 * - Supabase broadcast for cross-device (same room code)
 * - BroadcastChannel for same-browser multi-tab instant sync
 * Both are best-effort; the game is fully playable solo offline.
 */
export function useDrawRoom(roomCode: string | null, onEvent: (e: RoomEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    let closed = false;

    try {
      const bc = new BroadcastChannel(`rizz-draw-party-${roomCode}`);
      bcRef.current = bc;
      bc.onmessage = (msg) => {
        const ev = msg.data as RoomEvent | null;
        if (ev && typeof ev === "object" && "kind" in ev) onEventRef.current(ev);
      };
    } catch {
      bcRef.current = null;
    }

    try {
      const channel = supabase.channel(`draw-party-${roomCode}`);
      channelRef.current = channel;
      channel.on("broadcast", { event: "draw-event" }, ({ payload }) => {
        const ev = payload as RoomEvent | null;
        if (ev && typeof ev === "object" && "kind" in ev) onEventRef.current(ev);
      });
      subscribeSafely(channel, () => {});
    } catch {
      channelRef.current = null;
    }

    return () => {
      closed = true;
      void closed;
      try {
        bcRef.current?.close();
      } catch {
        /* noop */
      }
      bcRef.current = null;
      try {
        if (channelRef.current) supabase.removeChannel(channelRef.current);
      } catch {
        /* noop */
      }
      channelRef.current = null;
    };
  }, [roomCode]);

  const sendRef = useRef((ev: RoomEvent) => {
    if (!roomCode) return;
    try {
      bcRef.current?.postMessage(ev);
    } catch {
      /* local broadcast unavailable */
    }
    try {
      void channelRef.current?.send({ type: "broadcast", event: "draw-event", payload: ev });
    } catch {
      /* remote sync is best-effort */
    }
  });

  return sendRef.current;
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}
