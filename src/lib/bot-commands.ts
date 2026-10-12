/**
 * Slash commands: the shared shape and the parsing the composer, the
 * autocomplete menu and the API route all agree on.
 *
 * A command is typed as `/name optional args`. Bots live in realms only, so
 * nothing here is ever used from a DM or a group.
 */

export type SlashCommandOptionType = "string" | "user" | "number" | "boolean";

export type SlashCommandOption = {
  name: string;
  description?: string;
  type?: SlashCommandOptionType;
  required?: boolean;
};

/** One command offered by an installed, enabled bot in one realm channel. */
export type RealmSlashCommand = {
  command_id: string;
  name: string;
  description: string;
  options: SlashCommandOption[];
  bot_id: string;
  bot_name: string;
  bot_avatar_url: string | null;
  is_builtin: boolean;
};

export const SLASH_PREFIX = "/";

/** True when the composer text is a slash command rather than a chat message. */
export function isSlashCommandText(text: string): boolean {
  return text.trimStart().startsWith(SLASH_PREFIX);
}

/**
 * The command name the user is still typing, or the full name once a space has
 * been typed. `null` means "not a slash command".
 */
export type SlashQuery = {
  /** The whole command word being typed, without the slash. */
  name: string;
  /** Everything after the first space, untouched. */
  args: string;
  /** True while the command word is still being typed (no space yet). */
  typingName: boolean;
};

export function parseSlashCommand(text: string): SlashQuery | null {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith(SLASH_PREFIX)) return null;

  const rest = trimmed.slice(SLASH_PREFIX.length);
  if (rest === "") return { name: "", args: "", typingName: true };

  const match = /^([a-zA-Z0-9_-]*)(?:[ \t]+([\s\S]*))?$/.exec(rest);
  if (!match) {
    // Something like "/foo bar" where foo has odd characters: treat the whole
    // line as the command word so nothing is silently swallowed.
    return { name: rest.trim().toLowerCase(), args: "", typingName: true };
  }

  const name = (match[1] ?? "").toLowerCase();
  const args = match[2] ?? "";
  return { name, args, typingName: match[2] === undefined };
}

/** Filters the installed commands for the menu. */
export function filterSlashCommands(commands: RealmSlashCommand[], query: string): RealmSlashCommand[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return commands;
  const starts = commands.filter((command) => command.name.toLowerCase().startsWith(needle));
  if (starts.length) return starts;
  return commands.filter(
    (command) =>
      command.name.toLowerCase().includes(needle) ||
      command.bot_name.toLowerCase().includes(needle) ||
      command.description.toLowerCase().includes(needle),
  );
}

/**
 * Replaces the command word in the composer with the chosen command and exactly
 * one trailing space. No leading space is ever added, which is what caused the
 * extra gap around inserted tokens.
 */
export function insertSlashCommand(text: string, name: string): string {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith(SLASH_PREFIX)) return `${SLASH_PREFIX}${name} `;
  return `${SLASH_PREFIX}${name} `;
}

/** The argument hints shown under a command in the menu. */
export function describeOptions(command: RealmSlashCommand): string {
  const options = command.options ?? [];
  if (!options.length) return "No arguments";
  return options
    .map((option) => {
      const required = option.required === false ? `[${option.name}]` : `<${option.name}>`;
      return option.type === "user" ? `${required}:user` : required;
    })
    .join(" ");
}

/** A one-line summary of what the command does, for toasts and errors. */
export function commandLabel(command: Pick<RealmSlashCommand, "name" | "bot_name">): string {
  return `/${command.name} · ${command.bot_name}`;
}
