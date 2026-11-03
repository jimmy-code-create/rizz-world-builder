import { supabase } from "@/integrations/supabase/client";

/** In-app only: Paws have no cash value and never leave RIZZ. */
export const PAWS_TIP_PRESETS = [10, 50, 100, 250] as const;

export type PawsTip = {
  to: string;
  amount: number;
  note?: string | null;
};

/**
 * Sends Paws to another member.
 *
 * The move happens in `send_paws_tip` (20261116000000_paws_tips.sql), which
 * debits and credits in one function and writes both ledger rows. A database
 * that has not received the migration reports a missing function, which is
 * shown as the usual "apply the backend setup" message instead of a raw
 * Postgres error.
 */
export async function sendPawsTip({ to, amount, note }: PawsTip): Promise<number> {
  if (!to) throw new Error("Pick someone to tip.");
  if (!Number.isFinite(amount) || amount < 1) throw new Error("Tips start at 1 Paw.");
  const { data, error } = await (supabase.rpc as any)("send_paws_tip", {
    _to: to,
    _amount: Math.round(amount),
    _note: note?.trim() || null,
  });
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (
      message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("could not find the function")
    ) {
      throw new Error("Paws tips need the backend setup in BACKEND_REQUIREMENTS.md.");
    }
    throw new Error(error.message);
  }
  return Number(data ?? 0);
}
