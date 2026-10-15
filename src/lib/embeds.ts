/**
 * Discord-style embed cards for realm webhook bots.
 *
 * One definition shared by the webhook route (server validation) and the
 * embed builder (client preview + preflight checks), so both sides enforce
 * exactly the same limits:
 *   10 embeds/message · title 256 · description 4096 · 25 fields ·
 *   field name 256 / value 1024 · footer 2048 · author name 256 ·
 *   6000 total chars/message · https-only images · plain text (no HTML).
 */

export type EmbedField = { name: string; value: string; inline?: boolean };

/**
 * Optional action row under an embed. Only the built-in bots use it today
 * (the welcome card's "Say hi"): tapping waves at the message and opens the
 * member's card. Webhook bodies never reach this — see sanitizeEmbed options.
 */
export type EmbedButton = {
  /** Button text, e.g. "👋 Say hi" (max 40 chars). */
  label?: string;
  /** Only "wave" exists today: toggles a 👋 on the message. */
  action?: "wave";
  /** Member id whose card opens on tap; {token} in bot templates. */
  user_id?: string;
};

export type EmbedData = {
  title?: string;
  url?: string;
  description?: string;
  /** Hex like "#c8ff3d". */
  color?: string;
  author?: { name?: string; icon_url?: string; url?: string };
  thumbnail?: { url?: string };
  image?: { url?: string };
  fields?: EmbedField[];
  footer?: { text?: string; icon_url?: string };
  timestamp?: string;
  /** Optional action button (built-in bots only today). */
  button?: EmbedButton;
};

export const EMBED_LIMITS = {
  perMessage: 10,
  title: 256,
  description: 4096,
  fields: 25,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  authorName: 256,
  total: 6000,
  content: 2000,
} as const;

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Plain text only: strip tags, keep the words. */
export function plainText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, "").replace(/\0/g, "").trim().slice(0, max);
}

function httpsOrEmpty(value: unknown): string | undefined {
  return isHttpsUrl(value) ? (value as string) : undefined;
}

/**
 * Validate + sanitize one raw embed. Returns the clean embed or a friendly
 * error message naming the exact field that broke a limit.
 */
export function sanitizeEmbed(
  raw: unknown,
  options?: { allowButton?: boolean },
): { embed?: EmbedData; error?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Each embed must be an object" };
  }
  const input = raw as Record<string, unknown>;
  const embed: EmbedData = {};
  let total = 0;
  const take = (text: string) => {
    total += text.length;
    return text;
  };

  const title = plainText(input.title, EMBED_LIMITS.title + 1);
  if (typeof input.title === "string" && title.length > EMBED_LIMITS.title) {
    return { error: `Embed titles can be up to ${EMBED_LIMITS.title} characters` };
  }
  if (title) embed.title = take(title);
  if (typeof input.url === "string" && input.url && !isHttpsUrl(input.url)) {
    return { error: "Embed URLs must be https links" };
  }
  if (isHttpsUrl(input.url)) embed.url = input.url;

  const description = plainText(input.description, EMBED_LIMITS.description + 1);
  if (typeof input.description === "string" && description.length > EMBED_LIMITS.description) {
    return { error: `Embed descriptions can be up to ${EMBED_LIMITS.description} characters` };
  }
  if (description) embed.description = take(description);

  if (input.color !== undefined && !isHexColor(input.color)) {
    return { error: "Embed color must be a hex like #c8ff3d" };
  }
  if (isHexColor(input.color)) embed.color = input.color;

  if (input.author !== undefined) {
    if (!input.author || typeof input.author !== "object" || Array.isArray(input.author)) {
      return { error: "Embed author must be an object" };
    }
    const author = input.author as Record<string, unknown>;
    const name = plainText(author.name, EMBED_LIMITS.authorName + 1);
    if (typeof author.name === "string" && name.length > EMBED_LIMITS.authorName) {
      return { error: `Author names can be up to ${EMBED_LIMITS.authorName} characters` };
    }
    const icon = httpsOrEmpty(author.icon_url);
    if (author.icon_url && !icon) return { error: "Author icons must be https image URLs" };
    if (author.url && !isHttpsUrl(author.url)) return { error: "Author URLs must be https links" };
    if (name || icon || isHttpsUrl(author.url)) {
      embed.author = {
        ...(name ? { name: take(name) } : {}),
        ...(icon ? { icon_url: icon } : {}),
        ...(isHttpsUrl(author.url) ? { url: author.url } : {}),
      };
    }
  }

  const thumbnail = httpsOrEmpty((input.thumbnail as Record<string, unknown> | undefined)?.url);
  if (input.thumbnail !== undefined && !thumbnail) {
    return { error: "Thumbnails must be https image URLs" };
  }
  if (thumbnail) embed.thumbnail = { url: thumbnail };

  const image = httpsOrEmpty((input.image as Record<string, unknown> | undefined)?.url);
  if (input.image !== undefined && !image) {
    return { error: "Embed images must be https image URLs" };
  }
  if (image) embed.image = { url: image };

  if (input.fields !== undefined) {
    if (!Array.isArray(input.fields)) return { error: "Embed fields must be a list" };
    if (input.fields.length > EMBED_LIMITS.fields) {
      return { error: `Embeds carry at most ${EMBED_LIMITS.fields} fields` };
    }
    const fields: EmbedField[] = [];
    for (const rawField of input.fields) {
      if (!rawField || typeof rawField !== "object") return { error: "Each field needs a name and a value" };
      const field = rawField as Record<string, unknown>;
      const name = plainText(field.name, EMBED_LIMITS.fieldName + 1);
      const value = plainText(field.value, EMBED_LIMITS.fieldValue + 1);
      if (!name || !value) return { error: "Each field needs a name and a value" };
      if (name.length > EMBED_LIMITS.fieldName) {
        return { error: `Field names can be up to ${EMBED_LIMITS.fieldName} characters` };
      }
      if (value.length > EMBED_LIMITS.fieldValue) {
        return { error: `Field values can be up to ${EMBED_LIMITS.fieldValue} characters` };
      }
      fields.push({ name: take(name), value: take(value), ...(field.inline === true ? { inline: true } : {}) });
    }
    if (fields.length > 0) embed.fields = fields;
  }

  if (input.footer !== undefined) {
    if (!input.footer || typeof input.footer !== "object" || Array.isArray(input.footer)) {
      return { error: "Embed footer must be an object" };
    }
    const footer = input.footer as Record<string, unknown>;
    const text = plainText(footer.text, EMBED_LIMITS.footer + 1);
    if (typeof footer.text === "string" && text.length > EMBED_LIMITS.footer) {
      return { error: `Footers can be up to ${EMBED_LIMITS.footer} characters` };
    }
    const icon = httpsOrEmpty(footer.icon_url);
    if (footer.icon_url && !icon) return { error: "Footer icons must be https image URLs" };
    if (text || icon) {
      embed.footer = { ...(text ? { text: take(text) } : {}), ...(icon ? { icon_url: icon } : {}) };
    }
  }

  if (typeof input.timestamp === "string" && input.timestamp) {
    const time = new Date(input.timestamp);
    if (Number.isNaN(time.getTime())) return { error: "Embed timestamp must be a valid date" };
    embed.timestamp = time.toISOString();
  }

  // Action buttons ride along only for callers that opt in (built-in bot
  // templates). Webhook bodies never reach this branch, so they cannot ask
  // for a button.
  if (input.button !== undefined && options?.allowButton) {
    if (!input.button || typeof input.button !== "object" || Array.isArray(input.button)) {
      return { error: "Embed button must be an object" };
    }
    const button = input.button as Record<string, unknown>;
    const label = plainText(button.label, 41);
    if (typeof button.label === "string" && label.length > 40) {
      return { error: "Button labels can be up to 40 characters" };
    }
    const action = button.action === undefined ? "wave" : button.action;
    if (action !== "wave") return { error: "Buttons only support the wave action" };
    const userId = typeof button.user_id === "string" ? button.user_id : undefined;
    if (userId && !/^\{[a-zA-Z]+\}$/.test(userId) && !/^[0-9a-fA-F-]{36}$/.test(userId)) {
      return { error: "Button user must be a member id or {token}" };
    }
    embed.button = {
      label: take(label || "👋 Say hi"),
      action: "wave",
      ...(userId ? { user_id: userId } : {}),
    };
  }

  if (total > EMBED_LIMITS.total) {
    return { error: `Embeds carry at most ${EMBED_LIMITS.total} characters per message` };
  }
  if (Object.keys(embed).length === 0) {
    return { error: "Embeds can't be empty — add a title, description or field" };
  }
  return { embed };
}

/** Validate a whole message payload; returns clean content + embeds or an error. */
export function sanitizeWebhookBody(body: unknown): {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: EmbedData[];
  room_id?: string;
  error?: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Body must be JSON" };
  }
  const input = body as Record<string, unknown>;
  const content = plainText(input.content, EMBED_LIMITS.content + 1);
  if (typeof input.content === "string" && content.length > EMBED_LIMITS.content) {
    return { error: `Messages can be up to ${EMBED_LIMITS.content} characters` };
  }

  let embeds: EmbedData[] | undefined;
  if (input.embeds !== undefined) {
    if (!Array.isArray(input.embeds)) return { error: "Embeds must be a list" };
    if (input.embeds.length > EMBED_LIMITS.perMessage) {
      return { error: `At most ${EMBED_LIMITS.perMessage} embeds per message` };
    }
    embeds = [];
    let total = 0;
    for (const raw of input.embeds) {
      const clean = sanitizeEmbed(raw);
      if (clean.error) return { error: clean.error };
      total += JSON.stringify(clean.embed).length;
      embeds.push(clean.embed!);
    }
    void total;
  }

  if (!content && (!embeds || embeds.length === 0)) {
    return { error: "Send some text or at least one embed" };
  }

  const username = plainText(input.username, 33).slice(0, 32) || undefined;
  const avatar = httpsOrEmpty(input.avatar_url);
  if (input.avatar_url && !avatar) return { error: "Avatar must be an https image URL" };
  const roomId = typeof input.room_id === "string" && input.room_id ? input.room_id : undefined;

  return {
    ...(content ? { content } : {}),
    ...(username ? { username } : {}),
    ...(avatar ? { avatar_url: avatar } : {}),
    ...(embeds ? { embeds } : {}),
    ...(roomId ? { room_id: roomId } : {}),
  };
}

export function emptyEmbed(): EmbedData {
  return { title: "", description: "", fields: [] };
}
