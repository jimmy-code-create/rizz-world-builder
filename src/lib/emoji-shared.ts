import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAvailableEmojis } from "@/lib/emoji-available";
import { RIZZ_REACTIONS } from "@/lib/reactions";

/**
 * One emoji model for the whole app.
 *
 * A custom emoji is a row in `realm_custom_emoji`; everywhere it can appear it
 * is addressed by its id, never by its shortcode, because two realms may both
 * own `:cat:`. Text stores `<:cat:<id>>`; a reaction stores `ce:<id>`.
 *
 * If the emoji is removed, or the reader is no longer in its realm, the token
 * still resolves to nothing and the renderer prints `:cat:` instead. A post is
 * never broken by an emoji going away.
 */

export const EMOJI_KEY_PREFIX = "ce:";

export type SharedEmoji = {
  id: string;
  realm_id: string;
  realm_name: string;
  realm_slug: string;
  shortcode: string;
  url: string;
  animated: boolean;
  external: boolean;
};

export type EmojiRow = {
  id: string;
  realm_id: string;
  shortcode: string;
  url: string;
  animated: boolean;
  status: "active" | "removed";
};

/** A reaction key is a unicode glyph or `ce:<emoji id>`. */
export const emojiReactionKey = (id: string) => `${EMOJI_KEY_PREFIX}${id}`;

export function isCustomReactionKey(key: string): boolean {
  return key.startsWith(EMOJI_KEY_PREFIX);
}

export function customReactionId(key: string): string | null {
  return isCustomReactionKey(key) ? key.slice(EMOJI_KEY_PREFIX.length) : null;
}

export const sharedEmojiKey = (realmId?: string | null) =>
  ["shared-emoji", realmId ?? "all"] as const;

/**
 * Every emoji the viewer may use, from every realm they belong to.
 *
 * This is a view over `/api/emojis/available`, not a second query: the picker,
 * the composer and the realm screen all read the same cached answer, so an
 * emoji uploaded in one place shows up everywhere and a DM (which has no realm
 * id at all) still sees every realm's emoji. The signature is unchanged so the
 * screens that already call it keep working.
 */
export function useJoinedEmoji(_realmId?: string | null) {
  const available = useAvailableEmojis();

  const data = useMemo<SharedEmoji[]>(() => {
    const payload = available.data;
    if (!payload) return [];
    const rows: SharedEmoji[] = [];
    for (const emoji of payload.private) {
      rows.push({
        id: emoji.id,
        realm_id: "",
        realm_name: "Private",
        realm_slug: "",
        shortcode: emoji.name,
        url: emoji.url,
        animated: Boolean(emoji.animated),
        external: true,
      });
    }
    for (const realm of payload.realms) {
      for (const emoji of realm.emojis) {
        rows.push({
          id: emoji.id,
          realm_id: realm.id,
          realm_name: realm.name,
          realm_slug: "",
          shortcode: emoji.name,
          url: emoji.url,
          animated: Boolean(emoji.animated),
          external: true,
        });
      }
    }
    return rows;
  }, [available.data]);

  return {
    ...available,
    data,
    // Marked as an array query for the surfaces that only read `.data`.
    isLoading: available.isLoading,
  };
}

/**
 * Resolves the ids behind reaction keys, including emoji the viewer can no
 * longer use. Batched by the caller so a post row costs one query.
 */
export async function lookupEmoji(ids: string[]): Promise<EmojiRow[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  // `emoji_public` resolves by id with no realm-membership check, which is what
  // makes an emoji sent in a DM render for the other person. It falls back to
  // the membership-checked RPC on a database that has not run the migration.
  const pub = await (supabase.rpc as any)("emoji_public", { _ids: unique });
  if (!pub.error) return ((pub.data ?? []) as EmojiRow[]).map((row) => ({ ...row, realm_id: "" }));
  const { data, error } = await (supabase.rpc as any)("emoji_lookup", { _ids: unique });
  if (error) return [];
  return (data ?? []) as EmojiRow[];
}

export function useEmojiLookup(ids: string[], enabled = true) {
  const key = [...new Set(ids)].sort().join(",");
  return useQuery({
    queryKey: ["emoji-lookup", key],
    enabled: enabled && ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => lookupEmoji(ids),
  });
}

export type EmojiMap = Map<string, EmojiRow>;

export function emojiMapOf(rows: EmojiRow[] | undefined): EmojiMap {
  const map: EmojiMap = new Map();
  for (const row of rows ?? []) map.set(row.id, row);
  return map;
}

/* --------------------------------------------------------------- text tokens */

export type EmojiTextSegment =
  | { kind: "text"; text: string }
  | { kind: "emoji"; id: string; shortcode: string };

/** `<:shortcode:id>` (stored) and `:shortcode:` (legacy chat), one pass. */
// `<:name:uuid>` and `<a:name:uuid>` (animated), plus the legacy bare
// `:name:` shortcode older chat messages still carry.
const TOKEN = /<a?:([a-z0-9_]{2,32}):([0-9a-fA-F-]{36})>|:([a-z0-9_]{2,32}):/g;

/**
 * Splits any stored text into plain runs and emoji segments. `<:name:id>` always
 * wins; a bare `:name:` resolves only when `byShortcode` is given.
 */
export function splitEmojiText(
  text: string,
  byShortcode?: Map<string, { id: string }>,
): EmojiTextSegment[] {
  if (!text.includes(":")) return [{ kind: "text", text }];

  const pieces: EmojiTextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) pieces.push({ kind: "text", text: text.slice(cursor, index) });
    if (match[2]) {
      pieces.push({ kind: "emoji", id: match[2], shortcode: match[1] });
    } else {
      const hit = byShortcode?.get(match[3]);
      if (hit) pieces.push({ kind: "emoji", id: hit.id, shortcode: match[3] });
      else pieces.push({ kind: "text", text: match[0] });
    }
    cursor = index + match[0].length;
  }

  if (!pieces.length) return [{ kind: "text", text }];
  if (cursor < text.length) pieces.push({ kind: "text", text: text.slice(cursor) });
  return pieces;
}

/** The stored form, used whenever the composer inserts an emoji. */
export const emojiToken = (emoji: Pick<SharedEmoji, "id" | "shortcode">) =>
  `<:${emoji.shortcode}:${emoji.id}>`;

/* ------------------------------------------------------------------ recents */

const RECENT_KEY = "rizz.recent-emoji.v1";

export function readRecentEmoji(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string").slice(0, 24) : [];
  } catch {
    return [];
  }
}

export function rememberEmoji(id: string) {
  try {
    const next = [id, ...readRecentEmoji().filter((existing) => existing !== id)].slice(0, 24);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode — recents are a convenience, never a requirement */
  }
}

/* ------------------------------------------------------------------- search */

export function searchEmoji(rows: SharedEmoji[], query: string): SharedEmoji[] {
  const needle = query.trim().toLowerCase().replace(/^:+|:+$/g, "");
  if (!needle) return rows;
  return rows.filter(
    (row) =>
      row.shortcode.includes(needle) ||
      row.realm_name.toLowerCase().includes(needle) ||
      row.realm_slug.toLowerCase().includes(needle),
  );
}

export function groupByRealm(rows: SharedEmoji[]) {
  const groups = new Map<string, { id: string; name: string; slug: string; emoji: SharedEmoji[] }>();
  for (const row of rows) {
    const group = groups.get(row.realm_id) ?? {
      id: row.realm_id,
      name: row.realm_name,
      slug: row.realm_slug,
      emoji: [],
    };
    group.emoji.push(row);
    groups.set(row.realm_id, group);
  }
  return [...groups.values()];
}

/** The default tab: the app's own reaction set, deburred of duplicates. */
export const DEFAULT_EMOJI: string[] = [...new Set<string>([...RIZZ_REACTIONS])];
