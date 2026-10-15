import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizeWebhookBody } from "@/lib/embeds";
import { untypedFrom } from "@/lib/untyped-db";

/**
 * Realm webhook-bot delivery.
 *
 * External services post here — no user session, just the bot id and secret
 * from the webhook URL shown once at creation:
 *
 *   POST /api/bot-webhook/{botId}/{secret}
 *   { "content"?: "hello", "username"?: "Override", "avatar_url"?: "https://…",
 *     "embeds"?: [ {title, description, color, fields, …} ], "room_id"?: "…" }
 *
 * The route verifies sha256(secret) against realm_bots.token_hash, rejects
 * revoked bots, rate-limits to 30 messages/minute per bot, validates +
 * sanitizes everything (plain text only, https images, embed limits), then
 * inserts into messages with webhook_bot_id. The realm's realtime channel
 * delivers it — nothing else to wire up.
 */

export const Route = createFileRoute("/api/bot-webhook/$botId/$secret")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { botId, secret } = params as { botId: string; secret: string };
        if (!botId || !secret) {
          return json({ ok: false, error: "Unknown webhook" }, 404);
        }

        let body: unknown;
        try {
          const raw = await request.text();
          if (raw.length > 64 * 1024) {
            return json({ ok: false, error: "Request body is too large" }, 413);
          }
          body = raw ? (JSON.parse(raw) as unknown) : {};
        } catch {
          return json({ ok: false, error: "Body must be JSON" }, 400);
        }

        const clean = sanitizeWebhookBody(body);
        if (clean.error) return json({ ok: false, error: clean.error }, 400);

        let admin: typeof supabaseAdmin;
        try {
          admin = supabaseAdmin;
          // Touch the client so missing env fails here with a clear 503.
          void (admin as { from: unknown }).from;
        } catch {
          return json({ ok: false, error: "The bot service is not configured." }, 503);
        }

        // Verify the secret against the stored hash.
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
        const secretHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
        const { data: bot, error: botError } = await untypedFrom(admin)("realm_bots")
          .select("id, realm_id, name, avatar_url, token_hash, created_by, default_room_id, revoked")
          .eq("id", botId)
          .maybeSingle();
        const row = bot as {
          id: string; realm_id: string; name: string; avatar_url: string | null;
          token_hash: string; created_by: string; default_room_id: string | null; revoked: boolean;
        } | null;
        if (botError || !row || row.token_hash !== secretHash) {
          return json({ ok: false, error: "Unknown webhook" }, 404);
        }
        if (row.revoked) {
          return json({ ok: false, error: "This bot was revoked" }, 403);
        }

        // 30 messages/minute per bot.
        const windowStart = new Date(Date.now() - 60_000).toISOString();
        const { data: usage } = await untypedFrom(admin)("realm_bot_rate_limits")
          .select("window_started_at, used")
          .eq("bot_id", row.id)
          .maybeSingle();
        const usageRow = usage as { window_started_at: string; used: number } | null;
        const inWindow = usageRow && usageRow.window_started_at >= windowStart;
        if (inWindow && usageRow.used >= 30) {
          return json({ ok: false, error: "Rate limited: 30 messages per minute" }, 429);
        }
        await untypedFrom(admin)("realm_bot_rate_limits")
          .upsert({
            bot_id: row.id,
            window_started_at: inWindow ? usageRow.window_started_at : new Date().toISOString(),
            used: inWindow ? usageRow.used + 1 : 1,
          });

        // Resolve the target room: explicit room_id wins, else the bot's
        // channel, else the realm's main channel (no room = realm root).
        let roomId: string | null = clean.room_id ?? row.default_room_id;
        let realmId = row.realm_id;
        if (roomId) {
          const { data: room } = await admin
            .from("realm_rooms")
            .select("id, realm_id, kind")
            .eq("id", roomId)
            .maybeSingle();
          if (!room || room.realm_id !== row.realm_id || (room as { kind: string }).kind === "voice") {
            return json({ ok: false, error: "That channel doesn't take bot messages" }, 400);
          }
          realmId = (room as { realm_id: string }).realm_id;
        }

        // `messages` is typed, but these three columns arrive with the same
        // pending migration the bots do, so the insert goes through the untyped
        // accessor instead of one @ts-expect-error per column.
        const { error: insertError } = await untypedFrom(admin)("messages").insert({
          realm_id: realmId,
          realm_room_id: roomId,
          sender_id: row.created_by,
          webhook_bot_id: row.id,
          body: clean.content ?? "",
          embeds: clean.embeds ?? null,
          webhook_meta:
            clean.username || clean.avatar_url
              ? { ...(clean.username ? { name: clean.username } : {}), ...(clean.avatar_url ? { avatar_url: clean.avatar_url } : {}) }
              : null,
        });
        if (insertError) {
          return json({ ok: false, error: "Couldn't deliver that message" }, 502);
        }
        return json({ ok: true });
      },
    },
  },
});

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
