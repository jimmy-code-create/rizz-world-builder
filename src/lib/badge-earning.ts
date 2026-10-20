import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { untypedRpc } from "@/lib/untyped-db";
import { canonicalFor } from "@/lib/badge-set";
import { toast } from "@/lib/toast";
import { tf } from "@/lib/i18n";

/**
 * Badge awarding.
 *
 * Progress bars live in `@/lib/badge-progress` (client-measured, and the only
 * way to know about device-local arcade wins). Actually *unlocking* a badge is
 * a server decision: `sync_my_badges()` re-measures the rules in
 * supabase/migrations/20261025000000_badge_earning.sql and awards whatever is
 * already earned, returning only the slugs that were new. A client cannot ask
 * for a badge by slug, and it cannot act for anybody but itself.
 *
 * Best-effort throughout: while the migration is pending the call is a no-op
 * instead of an error on every app load.
 */

/** Refocus syncs are cheap but not free; this caps them at one per 5 minutes. */
const SYNC_GAP_MS = 5 * 60_000;

/** PostgREST's wording for "this function isn't deployed yet". */
const MISSING_RPC = /could not find the function|schema cache|does not exist/i;

/** Award everything already earned; returns only the slugs that were new. */
export async function syncMyBadges(): Promise<string[]> {
  const { data, error } = await untypedRpc(supabase)("sync_my_badges");
  if (error) {
    if (MISSING_RPC.test(error.message)) return [];
    throw error;
  }
  return Array.isArray(data) ? data.filter((slug): slug is string => typeof slug === "string") : [];
}

/**
 * Keeps the collection current without a page visit: syncs once on mount and
 * again when the tab regains focus. New unlocks are celebrated once, then the
 * owned-badges and progress queries refresh so every surface (collection,
 * profile, name rows, hover card) picks them up.
 */
export function useBadgeSync(userId?: string | null) {
  const qc = useQueryClient();
  const lastRun = useRef(0);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (!userId || running.current) return;
    if (Date.now() - lastRun.current < SYNC_GAP_MS) return;
    running.current = true;
    lastRun.current = Date.now();
    try {
      const fresh = await syncMyBadges();
      if (fresh.length) {
        await qc.invalidateQueries({ queryKey: ["badges-mine", userId] });
        await qc.invalidateQueries({ queryKey: ["badge-progress", userId] });
        await qc.invalidateQueries({ queryKey: ["featured-badge"] });
        const names = fresh.map((slug) => canonicalFor(slug)?.name ?? slug);
        if (names.length === 1) {
          toast.success(tf("badge_unlocked_one", { name: names[0]! }));
        } else {
          toast.success(tf("badge_unlocked_many", { count: names.length }), {
            description: names.join(" · "),
          });
        }
      }
    } catch {
      // Best-effort: earning must never break the shell or a chat surface.
    } finally {
      running.current = false;
    }
  }, [userId, qc]);

  useEffect(() => {
    if (!userId) return;
    void run();
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [userId, run]);

  return { syncNow: run };
}
