import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAuthorizedSupabase } from "@/lib/server-supabase";

/**
 * The picture behind one custom emoji.
 *
 * GET /api/emojis/:id/image  →  302 to the stored file (or the bytes, proxied)
 *
 * Why this exists: an emoji's file lives in a public storage bucket, but the
 * *row* that names it is only readable by members of its realm. A message in a
 * DM is read by somebody who is not in that realm, so resolving `<:rizy:id>` by
 * the RPC returned nothing and the picture never appeared.
 *
 * This endpoint resolves the id **without a realm check**. That is safe and
 * deliberate: an emoji is already visible to everyone who can see a message
 * that carries it, the row is public data, and the response is an image — no
 * membership, message or profile is exposed. Removed emoji still resolve so
 * old messages keep their picture; unknown ids answer 404 so the renderer can
 * fall back to `:name:` instead of printing a uuid.
 */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export const Route = createFileRoute("/api/emojis/$id/image")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const id = String(params.id ?? "").toLowerCase();
        if (!/^[0-9a-f-]{36}$/.test(id)) {
          return new Response("Not an emoji id", { status: 400 });
        }

        // A signed-in caller uses their own client; anyone else falls back to
        // the service key, which this endpoint alone uses for this one read.
        const auth = await getAuthorizedSupabase(request);
        const client = auth instanceof Response ? serviceClient() : auth.client;
        if (!client) {
          return new Response("Emoji image is not configured", { status: 503 });
        }

        const { data: row, error } = await client
          .from("realm_custom_emoji")
          .select("id,url")
          .eq("id", id)
          .maybeSingle();

        if (error) {
          console.error("[/api/emojis/:id/image] lookup failed", error);
          return new Response("Couldn't load that emoji", { status: 500 });
        }
        if (!row?.url) {
          return new Response("Unknown emoji", {
            status: 404,
            headers: { "Cache-Control": "no-store" },
          });
        }

        // Redirect rather than stream: the storage CDN already serves the bytes
        // with its own long cache, and this server stays out of the hot path.
        const url = new URL(row.url);
        return new Response(null, {
          status: 302,
          headers: {
            Location: url.toString(),
            "Cache-Control": CACHE_CONTROL,
          },
        });
      },
    },
  },
});

function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
