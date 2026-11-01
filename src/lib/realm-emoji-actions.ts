import { supabase } from "@/integrations/supabase/client";

/**
 * Report / remove for a custom emoji that is now used app-wide.
 *
 * Removal never deletes the row: text that already carries `<:cat:id>` must
 * keep working, and a removed emoji degrades to `:cat:` everywhere. The RPC
 * re-checks the moderator role server-side.
 */

export async function reportRealmEmoji(emojiId: string, reason?: string): Promise<void> {
  const { error } = await (supabase.rpc as any)("report_realm_emoji", {
    _emoji_id: emojiId,
    _reason: reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function removeSharedEmoji(emojiId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)("remove_realm_emoji", { _id: emojiId });
  if (error) throw new Error(error.message);
}
