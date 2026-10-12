import { createFileRoute } from "@tanstack/react-router";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Preview-image proxy. Cards point their <img> here, so the linked site never
 * sees the reader's IP address (an <img> tag cannot send our auth header, hence
 * this endpoint is public — it compensates by allowing images only).
 *
 * Same SSRF rules as /api/link-preview: http(s) only, no private/internal
 * address (checked after DNS and on every redirect hop), no redirects, short
 * timeout, hard size cap, image content types only.
 */
const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 2 * 1024 * 1024;
const CACHE_SECONDS = 60 * 60 * 24;

const INTERNAL_HOSTNAMES = [/^localhost$/i, /\.local$/i, /\.internal$/i, /\.lan$/i];

function isPrivateAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }
  if (family === 6) {
    const value = address.toLowerCase();
    if (value === "::1" || value === "::") return true;
    if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80")) return true;
    if (value.startsWith("::ffff:")) return isPrivateAddress(value.slice(7));
    return false;
  }
  return true;
}

async function assertPublicImageUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("bad url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad protocol");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!hostname || INTERNAL_HOSTNAMES.some((pattern) => pattern.test(hostname))) throw new Error("internal host");
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("private address");
    return url;
  }
  const addresses = await lookup(hostname, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("private address");
  }
  return url;
}

export const Route = createFileRoute("/api/link-preview/image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("url")?.trim() ?? "";
        if (!raw) return new Response("Missing url", { status: 400 });

        let url: URL;
        try {
          url = await assertPublicImageUrl(raw);
        } catch {
          return new Response("Blocked", { status: 400 });
        }

        let upstream: Response;
        try {
          upstream = await fetch(url.toString(), {
            redirect: "error",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: { "user-agent": "RIZZBot/1.0 (+link previews)", accept: "image/*" },
          });
        } catch {
          return new Response("Upstream failed", { status: 502 });
        }

        const contentType = (upstream.headers.get("content-type") ?? "").toLowerCase();
        if (!upstream.ok || !contentType.startsWith("image/")) {
          await upstream.body?.cancel().catch(() => {});
          return new Response("Not an image", { status: 415 });
        }

        const declaredLength = Number(upstream.headers.get("content-length") ?? "0");
        if (declaredLength > MAX_BYTES) {
          await upstream.body?.cancel().catch(() => {});
          return new Response("Image too large", { status: 413 });
        }

        // Stream through with the cap applied so a huge image can't exhaust memory.
        const reader = upstream.body?.getReader();
        if (!reader) return new Response("Empty image", { status: 502 });
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let total = 0;
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!value) continue;
                total += value.byteLength;
                if (total > MAX_BYTES) {
                  await reader.cancel().catch(() => {});
                  controller.error(new Error("too large"));
                  return;
                }
                controller.enqueue(value);
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
          cancel: () => void reader.cancel().catch(() => {}),
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "content-type": contentType,
            "cache-control": `public, max-age=${CACHE_SECONDS}, immutable`,
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'none'; sandbox",
          },
        });
      },
    },
  },
});
