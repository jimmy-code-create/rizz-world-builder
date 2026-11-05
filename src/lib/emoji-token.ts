/**
 * The custom-emoji token, in one place.
 *
 * A custom emoji is stored in message text exactly as it is typed:
 * `<:name:uuid>` (or `<a:name:uuid>` for an animated one). Everything that
 * reads or writes that format goes through this module so the composer, the
 * picker, the paste handler and the renderer can never drift.
 *
 * Nothing here touches React or the network: it is safe to import from the
 * emoji panel, from a composer and from a test.
 */

export type EmojiTokenParts = {
  animated: boolean;
  name: string;
  id: string;
  token: string;
};

/** Discord-compatible: `<:name:uuid>` and `<a:name:uuid>`. */
export const EMOJI_TOKEN_SOURCE = "<(a?):([A-Za-z0-9_]+):([0-9a-fA-F-]{36})>";

export function emojiTokenRegex(): RegExp {
  return new RegExp(EMOJI_TOKEN_SOURCE, "g");
}

export function buildEmojiToken(input: { name: string; id: string; animated?: boolean }): string {
  return `<${input.animated ? "a" : ""}:${input.name}:${input.id}>`;
}

export function parseEmojiToken(token: string): EmojiTokenParts | null {
  const match = new RegExp(`^${EMOJI_TOKEN_SOURCE}$`).exec(token);
  if (!match) return null;
  return {
    animated: match[1] === "a",
    name: match[2],
    id: match[3].toLowerCase(),
    token: `<${match[1]}:${match[2]}:${match[3].toLowerCase()}>`,
  };
}

/** `<:name:id>` is remembered as the id; recents need the name too. */
export type TokenPiece = { kind: "text"; text: string } | ({ kind: "emoji" } & EmojiTokenParts);

/**
 * Splits text on emoji tokens. Plain text between tokens keeps its whitespace,
 * because a composer must reproduce a paste byte for byte.
 */
export function splitEmojiTokens(text: string): TokenPiece[] {
  if (!text.includes(":")) return text ? [{ kind: "text", text }] : [];
  const pieces: TokenPiece[] = [];
  let cursor = 0;
  for (const match of text.matchAll(emojiTokenRegex())) {
    const index = match.index ?? 0;
    if (index > cursor) pieces.push({ kind: "text", text: text.slice(cursor, index) });
    pieces.push({
      kind: "emoji",
      animated: match[1] === "a",
      name: match[2],
      id: match[3],
      token: match[0],
    });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) pieces.push({ kind: "text", text: text.slice(cursor) });
  return pieces;
}

/** `:name:` for a token that we cannot draw — never the raw id. */
export function emojiFallbackLabel(name: string | undefined, token?: string): string {
  if (name) return `:${name}:`;
  const parsed = token ? parseEmojiToken(token) : null;
  return parsed ? `:${parsed.name}:` : ":emoji:";
}

/** The one endpoint that answers "every emoji I may use", wherever I am. */
export const AVAILABLE_EMOJIS_PATH = "/api/emojis/available";

export type AvailableEmoji = {
  id: string;
  name: string;
  url: string;
  animated?: boolean;
};

export type AvailableRealmEmojis = {
  id: string;
  name: string;
  iconUrl: string | null;
  emojis: AvailableEmoji[];
};

export type AvailableEmojiResponse = {
  private: AvailableEmoji[];
  realms: AvailableRealmEmojis[];
};

export function emptyAvailableEmojis(): AvailableEmojiResponse {
  return { private: [], realms: [] };
}

/** Flattens the response into `id -> emoji` for the message renderer. */
export function emojiIndex(response: AvailableEmojiResponse | undefined) {
  const byId = new Map<string, AvailableEmoji & { realm_id: string | null }>();
  if (!response) return byId;
  for (const emoji of response.private) byId.set(emoji.id, { ...emoji, realm_id: null });
  for (const realm of response.realms) {
    for (const emoji of realm.emojis) byId.set(emoji.id, { ...emoji, realm_id: realm.id });
  }
  return byId;
}
