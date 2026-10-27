import type { RealmSlashCommand } from "@/lib/bot-commands";

/**
 * The two voice bots, as slash commands.
 *
 * Chat already understood `/play` and friends; inviting a bot into the call was
 * the one thing you could only do by tapping a card. These entries are offered
 * in the `/` menu of the in-call chat and of every realm channel, so
 * "/music" and "/game" bring MUSIC BOT and GAME BOT into the voice channel the
 * same way a chat bot is invoked.
 *
 * They are not backed by a database row — the realm's own bot commands are. The
 * list is merged with those, and the matcher below is what the composers use to
 * route a typed command to the call.
 */
export const VOICE_BOT_COMMANDS: RealmSlashCommand[] = [
  {
    command_id: "builtin:music-bot",
    name: "music",
    description: "Bring MUSIC BOT into the voice channel and queue a song",
    options: [{ name: "query", description: "Song, artist or link", type: "string" }],
    bot_id: "music-bot",
    bot_name: "MUSIC BOT",
    bot_avatar_url: null,
    is_builtin: true,
  },
  {
    command_id: "builtin:game-bot",
    name: "game",
    description: "Bring GAME BOT into the call and pick a game",
    options: [],
    bot_id: "game-bot",
    bot_name: "GAME BOT",
    bot_avatar_url: null,
    is_builtin: true,
  },
];

/** The bot a typed command asks for, or null when it is an ordinary command. */
export function voiceBotCommand(name: string): "music" | "game" | null {
  const clean = name.trim().toLowerCase();
  if (["music", "musicbot", "botmusic"].includes(clean)) return "music";
  if (["game", "gamebot", "botgame", "games"].includes(clean)) return "game";
  return null;
}
