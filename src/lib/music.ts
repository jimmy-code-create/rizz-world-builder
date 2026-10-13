import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { runBotCommand, type BotCommandResult } from "@/lib/bots";

/**
 * MUSIC BOT client side. Everything except `/play` is a plain RPC the server
 * route reaches directly; `/play` resolves its query against the iTunes Search
 * API on the server (the browser never calls it) and then queues the track.
 */

export type QueueTrack = {
  id: string;
  realm_id: string;
  realm_room_id: string | null;
  position: number;
  title: string;
  artist: string | null;
  url: string | null;
  artwork_url: string | null;
  preview_url: string | null;
  duration_ms: number | null;
  requested_by: string | null;
  status: "queued" | "played" | "skipped";
  created_at: string;
};

export const musicQueueKey = (realmId: string | null | undefined, roomId: string | null | undefined) =>
  ["music-queue", realmId ?? "", roomId ?? ""] as const;

export async function fetchMusicQueue(realmId: string, roomId: string | null): Promise<QueueTrack[]> {
  const { data, error } = await (supabase.from as any)("music_queue")
    .select("*")
    .eq("realm_id", realmId)
    .eq("status", "queued")
    .order("position", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as QueueTrack[];
  // The queue is per channel: `realm_room_id` may be null for the realm's own
  // channel, and PostgREST's eq() cannot express "IS NOT DISTINCT FROM".
  return rows.filter((track) => (track.realm_room_id ?? null) === (roomId ?? null)).slice(0, 30);
}

/** Live queue for the channel on screen. */
export function useMusicQueue(realmId: string | null | undefined, roomId: string | null | undefined, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: musicQueueKey(realmId, roomId),
    enabled: enabled && !!realmId,
    staleTime: 10_000,
    queryFn: () => fetchMusicQueue(realmId!, roomId ?? null),
  });

  useEffect(() => {
    if (!realmId || !enabled) return;
    const channel = supabase
      .channel(`music-queue-${realmId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "music_queue", filter: `realm_id=eq.${realmId}` },
        () => void qc.invalidateQueries({ queryKey: musicQueueKey(realmId, roomId) }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [realmId, roomId, enabled, qc]);

  return query;
}

type MusicCommandInput = { args: string; realmId: string; roomId: string | null };

/** Every command MUSIC BOT answers to. One list, shared by the composer and the
 *  music panel, so a command can never be intercepted in one place only. */
export const MUSIC_COMMAND_NAMES = ["play", "queue", "np", "skip", "stop"] as const;

export function isMusicCommand(name: string): boolean {
  return (MUSIC_COMMAND_NAMES as readonly string[]).includes(name.trim().toLowerCase());
}

/** `/play`, `/queue`, `/np`, `/skip`, `/stop` — all through the bot route. */
export function runMusicCommand(command: "play" | "queue" | "np" | "skip" | "stop", input: MusicCommandInput): Promise<BotCommandResult> {
  return runBotCommand({ command, args: input.args, realmId: input.realmId, roomId: input.roomId });
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
