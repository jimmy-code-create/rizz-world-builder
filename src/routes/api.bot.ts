import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * The bot API.
 *
 * External bots talk to this endpoint only. They present their token in an
 * `Authorization: Bearer …` header (or `x-bot-token`); the plaintext token is
 * hashed here and the hash is what `public.bot_api()` compares against, so the
 * token itself is never stored anywhere.
 *
 * Every permission rule that matters lives in `public.bot_api()`: valid token,
 * the bot installed and enabled in the target realm, the scope the action needs,
 * and the per-bot rate limit. This route is a transport, not a gate.
 *
 * POST /api/bot
 *   Body: { "action": "send_message", "payload": { "realm_id": "…", "body": "…" } }
 *   Actions: list_commands | send_message | edit_message | delete_message |
 *            add_reaction | remove_reaction | respond | poll_interactions
 */

const MAX_BODY_BYTES = 16 * 1024;
const ACTIONS = new Set([
  "list_commands",
  "send_message",
  "edit_message",
  "delete_message",
  "add_reaction",
  "remove_reaction",
  "respond",
  "poll_interactions",
]);

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readBotToken(request: Request): string | null {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const header = bearer ?? request.headers.get("x-bot-token");
  const token = header?.trim();
  return token ? token : null;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function handleBotRequest(request: Request): Promise<Response> {
  const token = readBotToken(request);
  if (!token) {
    return json({ ok: false, error: "Missing bot token" }, 401);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Request body is too large" }, 413);
  }

  let body: { action?: unknown; payload?: unknown };
  try {
    body = raw ? (JSON.parse(raw) as { action?: unknown; payload?: unknown }) : {};
  } catch {
    return json({ ok: false, error: "Body must be JSON" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) {
    return json({ ok: false, error: "Unknown action" }, 400);
  }

  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("[bot-api] Supabase is not configured");
    return json({ ok: false, error: "The bot service is not configured." }, 503);
  }

  // An anonymous client: bots have no user session, and bot_api() is the only
  // thing they are allowed to call.
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tokenHash = await sha256Hex(token);
  const { data, error } = await (client.rpc as any)("bot_api", {
    _token_hash: tokenHash,
    _action: action,
    _payload: payload,
  });

  if (error) {
    console.error("[bot-api] bot_api failed", error);
    return json({ ok: false, error: "Could not process that bot request" }, 502);
  }

  const result = (data ?? {}) as { ok?: boolean; error?: string };
  if (result.ok === false) {
    return json(result, 400);
  }
  return json(data ?? { ok: true });
}

export const Route = createFileRoute("/api/bot")({
  server: {
    handlers: {
      POST: async ({ request }) => handleBotRequest(request),
    },
  },
});
