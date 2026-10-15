# Bot architecture — how the bot option works

## TL;DR
Bots are a realm-only slash-command layer. Users type `/command args` in a realm
channel, the composer shows an autocomplete menu, and the matching command is run
either by the built-in house bot (Rizz Bot, Music Bot) or by an external bot
through a webhook. Realm members can also author their own bots and expose them
to other realms.

## Where the code is
- Shared command shapes/parsing: `src/lib/bot-commands.ts`
- Bot RPC client + "my bots" authoring: `src/lib/bots.ts`
- Music bot client (queue, providers): `src/lib/music.ts`, `src/lib/music-sources.ts`, `src/lib/music-resolve.ts`
- Composer autocomplete UI: `src/components/bots/SlashCommandMenu.tsx`
- Built-in command execution route: `src/routes/api.bot.command.ts`
- External bot interaction endpoint: `src/routes/api.bot.ts`

## What "bot" means in this app
1. Built-in bots
   - Rizz Bot answers `rizz`, `rizzme`, `compliment`, `icebreaker` with a
    curated line bank and, when configured, an LLM override.
   - Music Bot answers `/play`, `/queue`, `/np`, `/skip`, `/stop` using Apple
    Music search + YouTube/oEmbed + direct audio links.
2. External bots
   - An installed bot can have a webhook URL. When a user runs its command, the
    app records an interaction and POSTs it to the bot's webhook.
3. Custom user bots
   - Users can create bots in the UI via `createCustomBot(...)`.
   - Tokens are generated client-side, shown once, and only the SHA-256 hash is
    stored.
   - Commands are registered with `registerBotCommand(...)`.

## How a slash command flows
1. Composer detects `/...` via `isSlashCommandText(...)` and `parseSlashCommand(...)`.
2. It queries `useRealmSlashCommands(...)` for the current realm/channel.
3. The menu renders `SlashCommandMenu` with `RealmSlashCommand[]`.
4. On select, the composer replaces the text with `/name ` via
   `insertSlashCommand(...)`.
5. Execution posts to `/api/bot/command` with `{ command, args, realmId, roomId }`.
6. The route:
   - Requires a realm id (that blocks DMs/groups).
   - Looks up `realm_slash_commands` for an installed, enabled command.
   - If `is_builtin`:
     - Music Bot `/play` resolves the query server-side, then calls `music_add`.
     - Other built-ins optionally call the LLM, then `run_builtin_bot_command`.
   - If external bot:
     - Creates an interaction via `create_bot_interaction`.
     - Delivers it to `bot.webhook_url` with a timeout; delivery failure does not
       break the chat.

## The bot API for external bots
- `src/routes/api.bot.ts` is the bot's entry point.
- Auth: `Authorization: Bearer <token>` or `x-bot-token`.
- Token is hashed server-side and checked by `public.bot_api()`.
- Actions: `list_commands`, `send_message`, `edit_message`, `delete_message`,
   `add_reaction`, `remove_reaction`, `respond`, `poll_interactions`.

## Realm permission model for bots
- `fetchRealmBots(realmId)` returns installed bots + per-channel command enable state.
- Install/uninstall/enable/disable are separate RPC calls in `src/lib/bots.ts`.
- Member-bot allow setting and per-member manage-bots permission exist too
  (`setRealmAllowMemberBots`, `setRealmMemberManageBots`).
- Channel permissions sheet (`src/components/realms/ChannelPermissionsSheet.tsx`)
  handles message-write and reaction permissions for members; bot commands are
  gated separately from that sheet.

## Music bot specifically
- Provider registry: `MUSIC_PROVIDERS` in `src/lib/music-sources.ts`.
- Detection: `detectMusicSource(...)` classifies links into apple / youtube / audio.
- `/play` resolves the query on the server through `resolveMusicQuery(...)`.
- Queue is per-realm and per-room, with its own realtime subscriptions.

## Important limits baked in
- Bots are realm-only, never DM or group.
- Token is never stored in plaintext.
- Webhook delivery is best-effort with a timeout.
- LLM output is optional; missing keys fall back to curated lines.
