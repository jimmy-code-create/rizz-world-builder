import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { realmRpc, unwrapRpc, type RpcOutcome } from "@/lib/realm-rpc";

/**
 * XP and levels. The trigger on `messages` does the awarding (+20 per minute
 * at most), so this module only reads the standings and flips the two
 * moderator settings: XP on/off and the welcome line.
 */

export type LeaderboardRow = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  xp: number;
  messages: number;
  level: number;
  rank: number;
  is_me: boolean;
};

export type MyXp = {
  ok: boolean;
  xp: number;
  messages: number;
  rank: number | null;
  level: number;
};

export const leaderboardKey = (realmId: string | null | undefined) => ["realm-leaderboard", realmId ?? ""] as const;
export const myXpKey = (realmId: string | null | undefined) => ["realm-my-xp", realmId ?? ""] as const;

export async function fetchLeaderboard(realmId: string, limit = 25): Promise<LeaderboardRow[]> {
  const data = await realmRpc<LeaderboardRow[]>("realm_leaderboard", { _realm_id: realmId, _limit: limit });
  return Array.isArray(data) ? data : [];
}

export async function fetchMyXp(realmId: string): Promise<MyXp> {
  const data = await realmRpc<MyXp>("my_realm_xp", { _realm_id: realmId });
  return data ?? { ok: true, xp: 0, messages: 0, rank: null, level: 1 };
}

export function useLeaderboard(realmId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: leaderboardKey(realmId),
    enabled: enabled && !!realmId,
    staleTime: 30_000,
    queryFn: () => fetchLeaderboard(realmId!),
  });
}

/** My standing, kept live while the levels sheet is open. */
export function useMyXp(realmId: string | null | undefined, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: myXpKey(realmId),
    enabled: enabled && !!realmId,
    staleTime: 15_000,
    queryFn: () => fetchMyXp(realmId!),
  });

  useEffect(() => {
    if (!realmId || !enabled) return;
    const channel = supabase
      .channel(`realm-xp-${realmId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_xp", filter: `realm_id=eq.${realmId}` },
        () => {
          void qc.invalidateQueries({ queryKey: leaderboardKey(realmId) });
          void qc.invalidateQueries({ queryKey: myXpKey(realmId) });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [realmId, enabled, qc]);

  return query;
}

export async function setRealmXpEnabled(realmId: string, enabled: boolean): Promise<void> {
  unwrapRpc(
    await realmRpc<RpcOutcome>("set_realm_xp_enabled", { _realm_id: realmId, _enabled: enabled }),
    "Couldn't change the XP setting",
  );
}

export async function setRealmWelcome(input: {
  realmId: string;
  enabled: boolean;
  message?: string;
}): Promise<void> {
  unwrapRpc(
    await realmRpc<RpcOutcome>("set_realm_welcome", {
      _realm_id: input.realmId,
      _enabled: input.enabled,
      _message: input.message ?? null,
    }),
    "Couldn't save the welcome message",
  );
}

/** Level N needs 50·(N−1)² XP — mirrors realm_level_for() for progress bars. */
export function levelProgress(xp: number): { level: number; intoLevel: number; needed: number } {
  const safe = Math.max(0, xp);
  const level = Math.max(1, Math.floor(Math.sqrt(safe / 50)) + 1);
  const currentFloor = 50 * (level - 1) ** 2;
  const nextFloor = 50 * level ** 2;
  return {
    level,
    intoLevel: safe - currentFloor,
    needed: Math.max(1, nextFloor - currentFloor),
  };
}
