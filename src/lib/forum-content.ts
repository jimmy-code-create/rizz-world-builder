import { parseExternalReelLink } from "@/lib/external-reels";
import { detectMusicSource, looksLikeMusicLink } from "@/lib/music-sources";

/**
 * Forum bodies are written as light markdown, and this module is the one place
 * that decides what a block of text IS. The post page, the card preview, the
 * gallery thumbnail and the thread all read the same parse, so a code fence or
 * a YouTube link can never render one way in the list and another way in the
 * thread.
 *
 * Deliberately dependency-free: no React, no supabase, so the rules can be
 * exercised on their own.
 */

/**
 * A post template's field — the form a forum shows when someone picks "Bug
 * report". Shared by the composer, the admin editor and the server's required
 * field check, which reads the same labels.
 */
export type ForumTemplateField = {
  label: string;
  placeholder?: string;
  required?: boolean;
};

export type ForumBlock =
  | { kind: "text"; text: string }
  | { kind: "code"; language: string | null; code: string }
  | { kind: "image"; url: string; alt: string | null }
  | { kind: "video"; url: string }
  | { kind: "music"; url: string }
  | { kind: "link"; url: string };

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i;
const MARKDOWN_IMAGE = /^!\[([^\]]*)\]\((\S+)\)$/;
const BARE_URL = /^(https?:\/\/\S+)$/i;
const CODE_FENCE = /^```([A-Za-z0-9+#._-]*)\s*$/;
const MARKDOWN_LINK = /\[([^\]]+)\]\((\S+)\)/g;

/** A single URL on its own line is a block; anything else is prose. */
function classifyUrl(url: string, alt: string | null): ForumBlock {
  const reel = parseExternalReelLink(url);
  if (reel.ok && reel.value.platform === "youtube") return { kind: "video", url: reel.value.sourceUrl };
  if (looksLikeMusicLink(url)) {
    const music = detectMusicSource(url);
    if (music && music.kind !== "youtube") return { kind: "music", url: music.url };
  }
  if (IMAGE_EXTENSION.test(url)) return { kind: "image", url, alt };
  return { kind: "link", url };
}

/**
 * Splits a body into blocks: paragraphs of text, fenced code, and one block per
 * standalone link so pictures, clips and tracks can render inline.
 */
export function parseForumBody(body: string | null | undefined): ForumBlock[] {
  if (!body) return [];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: ForumBlock[] = [];
  let text: string[] = [];
  let fenceLanguage: string | null = null;
  let fenceLines: string[] = [];

  const flushText = () => {
    const joined = text.join("\n").trim();
    text = [];
    if (joined) blocks.push({ kind: "text", text: joined });
  };

  const flushCode = () => {
    blocks.push({
      kind: "code",
      language: fenceLanguage,
      code: fenceLines.join("\n").replace(/\s+$/, ""),
    });
    fenceLines = [];
    fenceLanguage = null;
  };

  for (const line of lines) {
    if (fenceLanguage !== null) {
      if (CODE_FENCE.test(line)) flushCode();
      else fenceLines.push(line);
      continue;
    }

    const fence = CODE_FENCE.exec(line);
    if (fence) {
      flushText();
      fenceLanguage = fence[1] || "";
      continue;
    }

    const image = MARKDOWN_IMAGE.exec(line.trim());
    if (image) {
      flushText();
      blocks.push({ kind: "image", url: image[2], alt: image[1] || null });
      continue;
    }

    const bare = BARE_URL.exec(line.trim());
    if (bare) {
      flushText();
      blocks.push(classifyUrl(bare[1], null));
      continue;
    }

    text.push(line);
  }

  if (fenceLanguage !== null) {
    // An unclosed fence is still a code block — better than swallowing the text.
    flushCode();
  } else {
    flushText();
  }

  return blocks;
}

/** True when the body has anything beyond whitespace. */
export function forumHasBody(body: string | null | undefined): boolean {
  return !!body && body.trim().length > 0;
}

/**
 * The plain-text preview a card shows: prose only, no fences, no bare media
 * URLs, markdown squashed to its labels.
 */
export function forumExcerpt(body: string | null | undefined, limit = 220): string {
  if (!body) return "";
  const blocks = parseForumBody(body);
  const text = blocks
    .filter((block): block is { kind: "text"; text: string } => block.kind === "text")
    .map((block) => block.text)
    .join(" ")
    .replace(MARKDOWN_LINK, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}…`;
}

/** The first picture in a post: its cover, else a gallery item, else a file. */
export function forumThumbnail(post: {
  cover_url?: string | null;
  body?: string | null;
  attachments?: string[] | null;
}): string | null {
  if (post.cover_url) return post.cover_url;
  for (const block of parseForumBody(post.body)) {
    if (block.kind === "image") return block.url;
  }
  for (const attachment of post.attachments ?? []) {
    if (IMAGE_EXTENSION.test(attachment)) return attachment;
  }
  return null;
}

/** Every picture a post carries, in reading order — the gallery's contents. */
export function forumGallery(post: {
  cover_url?: string | null;
  body?: string | null;
  attachments?: string[] | null;
}): string[] {
  const urls: string[] = [];
  const add = (url: string | null | undefined) => {
    if (url && !urls.includes(url)) urls.push(url);
  };
  add(post.cover_url);
  for (const block of parseForumBody(post.body)) {
    if (block.kind === "image") add(block.url);
  }
  for (const attachment of post.attachments ?? []) {
    if (IMAGE_EXTENSION.test(attachment)) add(attachment);
  }
  return urls;
}

/** A reply and the replies hanging off it, in the order the thread reads. */
/**
 * Owner and moderator names carry the realm's role colour. Kept here rather than
 * in a component file so the rule is shared and testable, and so the component
 * modules export nothing but components.
 */
export function forumRoleColor(role: string | null | undefined): string | undefined {
  if (role === "owner") return "var(--forum-role-owner)";
  if (role === "mod") return "var(--forum-role-mod)";
  return undefined;
}

export type ForumReplyNode<T> = {
  reply: T;
  depth: number;
  children: ForumReplyNode<T>[];
};

/**
 * Turns a flat reply list into the tree the thread draws.
 *
 * A reply whose parent is missing (deleted, or filtered out) is kept at the top
 * level rather than dropped — a thread should never lose a message because its
 * parent is gone. Indentation is capped when drawing, not here, so the tree
 * always reflects the real conversation.
 */
export function buildForumReplyTree<T extends { id: string; parent_id: string | null }>(
  replies: T[],
): ForumReplyNode<T>[] {
  const nodes = new Map<string, ForumReplyNode<T>>();
  for (const reply of replies) nodes.set(reply.id, { reply, depth: 0, children: [] });

  const roots: ForumReplyNode<T>[] = [];
  for (const reply of replies) {
    const node = nodes.get(reply.id)!;
    const parent = reply.parent_id ? nodes.get(reply.parent_id) : undefined;
    if (!parent) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  const assignDepth = (list: ForumReplyNode<T>[], depth: number) => {
    for (const node of list) {
      node.depth = depth;
      assignDepth(node.children, depth + 1);
    }
  };
  assignDepth(roots, 0);

  return roots;
}

/** "3m", "5h", "2d", "Mar 4" — how long ago something happened. */
export function forumActivityLabel(value: string | number | Date | null | undefined, now = Date.now()): string {
  if (!value) return "";
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 604_800) return `${Math.round(seconds / 86_400)}d`;
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Joined March 2024" for the author card. */
export function forumJoinLabel(value: string | null | undefined): string {
  if (!value) return "";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  return `Joined ${new Date(time).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
}

/**
 * Tag and status chips are drawn from a moderator-chosen hex color. Every chip
 * shares this one tinting rule so a tag can never look like a status.
 */
export function withAlpha(color: string | null | undefined, alpha: number): string {
  const fallback = "#38bdf8";
  const hex = (color ?? fallback).trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  const long = /^#([0-9a-f]{6})$/i.exec(hex);
  let r: number;
  let g: number;
  let b: number;
  if (long) {
    r = Number.parseInt(long[1].slice(0, 2), 16);
    g = Number.parseInt(long[1].slice(2, 4), 16);
    b = Number.parseInt(long[1].slice(4, 6), 16);
  } else if (short) {
    r = Number.parseInt(short[1][0].repeat(2), 16);
    g = Number.parseInt(short[1][1].repeat(2), 16);
    b = Number.parseInt(short[1][2].repeat(2), 16);
  } else {
    return `color-mix(in oklab, ${fallback} ${Math.round(alpha * 100)}%, transparent)`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const INK_DARK = "#0b0a12";
const INK_LIGHT = "#ffffff";

/** WCAG relative luminance of an sRGB off-value channel, 0-1. */
function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Readable ink for a solid chip of `color`: whichever of white or near-black has
 * the higher WCAG contrast, rather than a guessed brightness threshold. A chip a
 * moderator tints mid-grey is the case a threshold gets wrong — white on #808080
 * is 3.9:1, black is 5.3:1, so black is what it returns.
 */
export function readableInk(color: string | null | undefined): string {
  const hex = (color ?? "").trim();
  const long = /^#([0-9a-f]{6})$/i.exec(hex);
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  let r = 56;
  let g = 189;
  let b = 248;
  if (long) {
    r = Number.parseInt(long[1].slice(0, 2), 16);
    g = Number.parseInt(long[1].slice(2, 4), 16);
    b = Number.parseInt(long[1].slice(4, 6), 16);
  } else if (short) {
    r = Number.parseInt(short[1][0].repeat(2), 16);
    g = Number.parseInt(short[1][1].repeat(2), 16);
    b = Number.parseInt(short[1][2].repeat(2), 16);
  }
  const background = relativeLuminance(r, g, b);
  const onWhite = contrastRatio(background, relativeLuminance(11, 10, 18));
  const onBlack = contrastRatio(background, 1);
  return onWhite >= onBlack ? INK_DARK : INK_LIGHT;
}
