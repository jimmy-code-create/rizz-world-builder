import { createFileRoute } from "@tanstack/react-router";
import { getAuthorizedSupabase } from "@/lib/server-supabase";
import type { RealmSlashCommand } from "@/lib/bot-commands";

/**
 * Slash command execution.
 *
 * POST /api/bot/command
 *   Body: { "command": "rizz", "args": "@sam", "realmId": "…", "roomId": "…" | null }
 *
 * A realm is mandatory: that is what makes bots realm-only, and it is checked
 * here as well as inside every RPC the request can reach. The user's own session
 * is used for the database calls, so RLS and `auth.uid()` apply unchanged.
 *
 * Commands belonging to the house bot run here. Commands belonging to an
 * external bot become an interaction row and are delivered to that bot's
 * webhook; the bot answers later through the bot API.
 */

const BOT_COMMAND_TIMEOUT_MS = 5_000;
const LLM_TIMEOUT_MS = 8_000;

/** Commands where a configured LLM may improve on the curated line bank. */
const LLM_COMMANDS = new Set(["rizz", "rizzme", "compliment", "icebreaker"]);

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function llmKey(): string | null {
  const key = process.env.RIZZ_BOT_LLM_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim();
  return key ? key : null;
}

function llmEndpoint(): string {
  return process.env.RIZZ_BOT_LLM_URL?.trim() || "https://api.groq.com/openai/v1";
}

function llmModel(): string {
  return process.env.RIZZ_BOT_LLM_MODEL?.trim() || process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
}

/**
 * One PG-13 line from an LLM, or null.
 *
 * Null is the normal, expected answer when no key is configured or the call
 * fails: the caller then falls back to the curated line bank, which is why the
 * bot never depends on an external service to work.
 */
async function llmLine(command: string, args: string, realmName: string | null): Promise<string | null> {
  const apiKey = llmKey();
  if (!apiKey) return null;

  const task =
    command === "rizzme"
      ? `The user is in this situation: "${args.slice(0, 200)}". Give one short, concrete reply suggestion they could send.`
      : command === "compliment"
        ? "Write one short, genuine, specific compliment for another person."
        : command === "icebreaker"
          ? "Write one light conversation starter for a group chat."
          : args
            ? `Write one short flirty but tasteful line aimed at the person "${args.slice(0, 60)}".`
            : "Write one short flirty but tasteful line to use in a group chat.";

  const prompt = [
    "You are RIZZ BOT inside a chat app for people 13 and over.",
    "You write exactly one line: warm, playful, confident, never mean.",
    config(realmName),
    "Hard rules: no sexual content, no innuendo, no manipulation, no pressure, no insults,",
    "no appearance-based comments, no emoji-only replies, no quotes, maximum 160 characters.",
    "Reply with the line and nothing else.",
    task,
  ].join(" ");

  try {
    const response = await fetch(`${llmEndpoint()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: llmModel(),
        messages: [{ role: "user", content: prompt }],
        max_tokens: 80,
        temperature: 0.9,
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return null;

    const cleaned = text.replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, " ").trim();
    if (!cleaned) return null;
    return cleaned.length > 280 ? `${cleaned.slice(0, 277)}…` : cleaned;
  } catch (error) {
    console.error("[bot-command] LLM line failed, falling back to the line bank", error);
    return null;
  }
}

function config(realmName: string | null): string {
  return realmName ? `You are speaking inside the realm "${realmName}".` : "";
}

export const Route = createFileRoute("/api/bot/command")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getAuthorizedSupabase(request);
        if (auth instanceof Response) return auth;
        const { client, userId } = auth;

        let body: { command?: unknown; args?: unknown; realmId?: unknown; roomId?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ ok: false, error: "Body must be JSON" }, 400);
        }

        const command = typeof body.command === "string" ? body.command.trim().toLowerCase() : "";
        const args = typeof body.args === "string" ? body.args : "";
        const realmId = typeof body.realmId === "string" ? body.realmId : "";
        const roomId = typeof body.roomId === "string" && body.roomId ? body.roomId : null;

        if (!/^[a-z0-9_-]{1,32}$/.test(command)) {
          return json({ ok: false, error: "That is not a valid command name" }, 400);
        }
        if (!realmId) {
          // Bots live in realms. A DM or a group has no realm id, so this is the
          // line that keeps them out of DMs and groups.
          return json({ ok: false, error: "Slash commands only work inside a realm" }, 400);
        }

        // Which installed, enabled command in this channel does that name map to?
        const { data: offered, error: offeredError } = await (client.rpc as any)("realm_slash_commands", {
          _realm_id: realmId,
          _realm_room_id: roomId,
        });
        if (offeredError) {
          console.error("[bot-command] realm_slash_commands failed", offeredError);
          return json({ ok: false, error: "Couldn't look up this realm's commands" }, 502);
        }

        const match = ((offered ?? []) as RealmSlashCommand[]).find(
          (entry) => entry.name.toLowerCase() === command,
        );
        if (!match) {
          return json({ ok: false, error: `/${command} is not available in this channel` }, 404);
        }

        if (match.is_builtin) {
          // Only for commands where a written line makes sense. A missing key
          // or a failed call returns null and the curated bank is used instead.
          const override = LLM_COMMANDS.has(command) ? await llmLine(command, args.trim(), null) : null;

          const { data, error } = await (client.rpc as any)("run_builtin_bot_command", {
            _command: command,
            _args: args,
            _realm_id: realmId,
            _realm_room_id: roomId,
            _override_body: override,
          });
          if (error) {
            console.error("[bot-command] run_builtin_bot_command failed", error);
            return json({ ok: false, error: "The house bot couldn't run that command" }, 502);
          }
          const result = (data ?? {}) as { ok?: boolean; error?: string };
          return json(result, result.ok === false ? 400 : 200);
        }

        // An external bot: record the interaction, then deliver it.
        const { data: interaction, error: interactionError } = await (client.rpc as any)(
          "create_bot_interaction",
          {
            _command_id: match.command_id,
            _realm_id: realmId,
            _realm_room_id: roomId,
            _args: args,
          },
        );
        if (interactionError) {
          console.error("[bot-command] create_bot_interaction failed", interactionError);
          return json({ ok: false, error: "Couldn't reach that bot" }, 502);
        }
        const created = (interaction ?? {}) as { ok?: boolean; error?: string; interaction_id?: string };
        if (created.ok === false) {
          return json(created, 400);
        }

        // The webhook URL stays server-side: it is never sent to the browser.
        const { data: botRow } = await (client as any)
          .from("bots")
          .select("id, name, delivery, webhook_url")
          .eq("id", match.bot_id)
          .maybeSingle();

        const bot = (botRow ?? null) as
          | { id: string; name: string; delivery: string; webhook_url: string | null }
          | null;

        if (!bot?.webhook_url) {
          return json(
            {
              ok: true,
              interaction_id: created.interaction_id ?? null,
              delivered: false,
              note: `${match.bot_name} does not accept commands yet`,
            },
            200,
          );
        }

        let delivered = false;
        try {
          const response = await fetch(bot.webhook_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "RIZZ-Bots/1.0",
            },
            body: JSON.stringify({
              type: "interaction",
              interaction_id: created.interaction_id ?? null,
              command: match.name,
              args,
              realm_id: realmId,
              realm_room_id: roomId,
              user_id: userId,
            }),
            signal: AbortSignal.timeout(BOT_COMMAND_TIMEOUT_MS),
          });
          delivered = response.ok;
        } catch (error) {
          // A bot that is down must never break the sender's chat.
          console.error("[bot-command] webhook delivery failed", error);
        }

        return json(
          {
            ok: true,
            interaction_id: created.interaction_id ?? null,
            delivered,
            note: delivered ? undefined : `${match.bot_name} did not answer in time`,
          },
          200,
        );
      },
    },
  },
});
