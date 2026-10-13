import { supabase } from "@/integrations/supabase/client";
import { realmRpc, unwrapRpc, type RpcOutcome } from "@/lib/realm-rpc";

/**
 * Custom emoji and stickers. Rows live in `realm_custom_emoji`, images in the
 * public `realm-emoji` bucket under the uploader's own folder (the storage
 * policy only allows that path), and writing anything is moderator-only — the
 * RPCs re-check it server-side.
 */

export type RealmEmoji = {
  id: string;
  realm_id: string;
  name: string;
  url: string;
  kind: "emoji" | "sticker";
  created_by: string | null;
  created_at: string;
};

export const realmEmojiKey = (realmId: string | null | undefined) => ["realm-emoji", realmId ?? ""] as const;

const EMOJI_BUCKET = "realm-emoji";

export async function fetchRealmEmoji(realmId: string): Promise<RealmEmoji[]> {
  const { data, error } = await (supabase.from as any)("realm_custom_emoji")
    .select("*")
    .eq("realm_id", realmId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RealmEmoji[];
}

/** Uploads one image to the caller's own folder and returns its public URL. */
export async function uploadRealmEmoji(file: File, userId: string, name: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${userId}/${name}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(EMOJI_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error("Couldn't upload that image");
  const { data } = supabase.storage.from(EMOJI_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function saveRealmEmoji(input: {
  realmId: string;
  name: string;
  url: string;
  kind?: "emoji" | "sticker";
}): Promise<void> {
  unwrapRpc(
    await realmRpc<RpcOutcome>("save_realm_emoji", {
      _realm_id: input.realmId,
      _name: input.name,
      _url: input.url,
      _kind: input.kind ?? "emoji",
    }),
    "Couldn't add that emoji",
  );
}

export async function deleteRealmEmoji(id: string): Promise<void> {
  unwrapRpc(await realmRpc<RpcOutcome>("delete_realm_emoji", { _id: id }), "Couldn't remove that emoji");
}

/**
 * `:name:` expansion for the message renderer: returns the segments of `body`
 * so the caller can swap known names for their image and leave the rest alone.
 */
export type EmojiSegment = { text: string; name?: string };

const EMOJI_TOKEN = /:([a-z0-9_]{2,32}):/g;

export function splitEmojiSegments(body: string, names: Set<string>): EmojiSegment[] {
  if (!names.size || !body.includes(":")) return [{ text: body }];
  const segments: EmojiSegment[] = [];
  let cursor = 0;
  EMOJI_TOKEN.lastIndex = 0;
  for (const match of body.matchAll(EMOJI_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ text: body.slice(cursor, index) });
    if (names.has(match[1])) segments.push({ text: match[0], name: match[1] });
    else segments.push({ text: match[0] });
    cursor = index + match[0].length;
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor) });
  return segments;
}
