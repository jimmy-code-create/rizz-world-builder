import { supabase } from "@/integrations/supabase/client";

/**
 * Phase-5 RPCs (polls, threads, scheduling, emoji, XP, search, ratings, music)
 * ship with the phase-5 migration, so the generated Supabase types predate
 * them. Every call therefore goes through this cast — same pattern the rest of
 * the app uses for `set_realm_room_lock` and the bot RPCs.
 */
export async function realmRpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data as T;
}

/** Every phase-5 write RPC answers `{ ok, error? }`; this is its contract. */
export type RpcOutcome = { ok: boolean; error?: string } & Record<string, unknown>;

export function unwrapRpc<T extends RpcOutcome>(result: T, fallback: string): T {
  if (!result || result.ok !== true) throw new Error(result?.error || fallback);
  return result;
}
