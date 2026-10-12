import { createFileRoute } from "@tanstack/react-router";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getAuthorizedSupabase } from "@/lib/server-supabase";

/**
 * Server-side link preview fetch. The browser never touches the linked site.
 *
 * Safety rules enforced here:
 *  * only http/https
 *  * localhost, private, link-local and internal names are refused, and every
 *    redirect hop is re-validated (so a public URL can't bounce you inward)
 *  * ~5s timeout and a hard response size limit
 *  * fetched HTML is never injected: only title/description text is extracted,
 *    stripped of tags and control characters, and clamped in length
 *  * preview images are returned through /api/link-preview/image, so the reader's
 *    IP is never exposed to the linked site
 *  * results are cached in public.link_previews so each URL is fetched once
 */
const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;

export type LinkPreviewKind = "link" | "image" | "video";

type PreviewPayload = {
  ok: boolean;
  url: string;
  domain: string;
  kind: LinkPreviewKind;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
};

const INTERNAL_HOSTNAMES = [/^localhost$/i, /\.local$/i, /\.internal$/i, /\.lan$/i, /^\[?::1\]?$/];
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|dailymotion\.com)$/i;

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(address: string) {
  const normalised = address.toLowerCase();
  if (normalised === "::1" || normalised === "::") return true;
  if (normalised.startsWith("fc") || normalised.startsWith("fd")) return true; // unique local
  if (normalised.startsWith("fe80")) return true; // link local
  if (normalised.startsWith("::ffff:")) return isPrivateIpv4(normalised.slice(7));
  return false;
}

function isPrivateAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

/** Throws when the URL is unusable or points somewhere we must not fetch. */
async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) links can be previewed.");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!hostname || INTERNAL_HOSTNAMES.some((pattern) => pattern.test(hostname))) {
    throw new Error("That link points inside the network.");
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("That link points inside the network.");
    return url;
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error("That site couldn't be reached.");
  }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("That link points inside the network.");
  }
  return url;
}

async function readCapped(response: Response, limit: number) {
  const body = response.body;
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(Math.min(total, limit));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= merged.length) break;
    const slice = chunk.subarray(0, merged.length - offset);
    merged.set(slice, offset);
    offset += slice.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

/** Manual redirects so every hop is re-validated (a redirect must not reach inside). */
async function fetchGuarded(startUrl: string) {
  let current = await assertPublicHttpUrl(startUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "user-agent": "RIZZBot/1.0 (+link previews; contact: support@rizz.app)",
        accept: "text/html,image/*;q=0.9,*/*;q=0.5",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      if (!location) throw new Error("That site sent an unusable redirect.");
      current = await assertPublicHttpUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new Error(`That site answered ${response.status}.`);
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.startsWith("image/")) {
      await response.body?.cancel().catch(() => {});
      return { finalUrl: current, contentType, body: "" };
    }
    if (!contentType.includes("html") && !contentType.includes("text/plain") && contentType !== "") {
      await response.body?.cancel().catch(() => {});
      throw new Error("That link isn't a page we can preview.");
    }
    return { finalUrl: current, contentType, body: await readCapped(response, MAX_BYTES) };
  }
  throw new Error("That link redirected too many times.");
}

/** Text from fetched HTML is treated as untrusted plain text: tags stripped, clamped. */
function cleanText(raw: string | undefined, max: number) {
  if (!raw) return null;
  const text = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[2] ?? match[3] ?? match[4] ?? "") : "";
}

function extractMeta(html: string, baseUrl: URL) {
  const meta: Record<string, string> = {};
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const key = (attribute(tag, "property") || attribute(tag, "name")).toLowerCase();
    if (!key) continue;
    const content = attribute(tag, "content");
    if (content && !(key in meta)) meta[key] = content;
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawImage = meta["og:image"] || meta["og:image:url"] || meta["twitter:image"];
  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      imageUrl = new URL(rawImage, baseUrl).toString();
    } catch {
      imageUrl = null;
    }
  }
  return {
    title: cleanText(meta["og:title"] || meta["twitter:title"] || titleMatch?.[1], 140),
    description: cleanText(meta["og:description"] || meta["twitter:description"] || meta.description, 240),
    siteName: cleanText(meta["og:site_name"] || baseUrl.hostname.replace(/^www\./, ""), 80),
    imageUrl,
    ogType: (meta["og:type"] ?? "").toLowerCase(),
  };
}

function proxiedImage(url: string) {
  return `/api/link-preview/image?url=${encodeURIComponent(url)}`;
}

async function buildPreview(rawUrl: string): Promise<PreviewPayload> {
  const { finalUrl, contentType, body } = await fetchGuarded(rawUrl);
  const domain = finalUrl.hostname.replace(/^www\./, "");
  const base: PreviewPayload = {
    ok: true,
    url: finalUrl.toString(),
    domain,
    kind: "link",
    title: null,
    description: null,
    siteName: domain,
    imageUrl: null,
  };

  if (contentType.startsWith("image/")) {
    return { ...base, kind: "image", imageUrl: proxiedImage(finalUrl.toString()) };
  }

  const meta = extractMeta(body, finalUrl);
  const isVideo = meta.ogType.startsWith("video") || VIDEO_HOSTS.test(finalUrl.hostname);
  const extensionIsImage = IMAGE_EXTENSIONS.test(finalUrl.pathname);
  const kind: LinkPreviewKind = isVideo ? "video" : extensionIsImage && !meta.imageUrl ? "image" : "link";

  return {
    ...base,
    kind,
    title: meta.title,
    description: meta.description,
    siteName: meta.siteName,
    imageUrl: meta.imageUrl ? proxiedImage(meta.imageUrl) : kind === "image" ? proxiedImage(finalUrl.toString()) : null,
  };
}

/**
 * The generated Supabase types predate the link_previews table (it ships in
 * supabase/migrations/20261013020000_link_previews.sql), so these two calls are
 * described here by hand instead of leaning on stale generated types.
 */
type PreviewCache = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => { maybeSingle: <T>() => Promise<{ data: T | null }> };
    };
    upsert: (values: Record<string, unknown>, options: { onConflict: string }) => Promise<unknown>;
  };
};

function previewCache(client: unknown) {
  return client as PreviewCache;
}

type CacheRow = {
  url: string;
  domain: string;
  kind: string;
  title: string | null;
  description: string | null;
  site_name: string | null;
  image_url: string | null;
  failed: boolean;
  fetched_at: string;
};

function toPayload(row: CacheRow): PreviewPayload {
  return {
    ok: !row.failed,
    url: row.url,
    domain: row.domain,
    kind: (row.kind as LinkPreviewKind) ?? "link",
    title: row.title,
    description: row.description,
    siteName: row.site_name,
    imageUrl: row.image_url,
  };
}

export const Route = createFileRoute("/api/link-preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuthorizedSupabase(request);
        if (auth instanceof Response) return auth;

        const raw = new URL(request.url).searchParams.get("url")?.trim() ?? "";
        if (!raw) return Response.json({ error: "Missing url" }, { status: 400 });

        let url: URL;
        try {
          url = await assertPublicHttpUrl(raw);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "That link can't be previewed." },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
        const cacheKey = url.toString();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cache = previewCache(supabaseAdmin);
        const { data: cached } = await cache
          .from("link_previews")
          .select("url, domain, kind, title, description, site_name, image_url, failed, fetched_at")
          .eq("url", cacheKey)
          .maybeSingle<CacheRow>();

        if (cached) {
          const age = Date.now() - new Date(cached.fetched_at).getTime();
          if (age < (cached.failed ? FAILURE_TTL_MS : CACHE_TTL_MS)) {
            return Response.json(toPayload(cached), {
              headers: { "Cache-Control": "private, max-age=300" },
            });
          }
        }

        try {
          const preview = await buildPreview(cacheKey);
          await cache.from("link_previews").upsert(
            {
              url: cacheKey,
              domain: preview.domain,
              kind: preview.kind,
              title: preview.title,
              description: preview.description,
              site_name: preview.siteName,
              image_url: preview.imageUrl,
              failed: false,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: "url" },
          );
          return Response.json(preview, { headers: { "Cache-Control": "private, max-age=300" } });
        } catch (error) {
          // Failures are cached briefly so a broken link isn't refetched on every render.
          await cache.from("link_previews").upsert(
            {
              url: cacheKey,
              domain: url.hostname.replace(/^www\./, ""),
              kind: "link",
              title: null,
              description: null,
              site_name: url.hostname.replace(/^www\./, ""),
              image_url: null,
              failed: true,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: "url" },
          );
          console.warn("[link-preview] fetch failed", cacheKey, error instanceof Error ? error.message : error);
          return Response.json(
            { ok: false, error: "That link can't be previewed right now." },
            { status: 200, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
