/**
 * Shared chat appearance helpers, used by DMs, groups and realm chat so an
 * author's name and media read the same everywhere.
 *
 * Author names used to inherit the default link colour (or nothing at all),
 * which left them a low-contrast blue on the dark surface. Every value here
 * comes from the `--chat-name-*` palette in styles.css, which is tuned per
 * theme/mode to clear 4.5:1 against the chat background.
 */

const NAME_TOKENS = [
  "var(--chat-name-1)",
  "var(--chat-name-2)",
  "var(--chat-name-3)",
  "var(--chat-name-4)",
  "var(--chat-name-5)",
  "var(--chat-name-6)",
] as const;

/**
 * Stable author colour. A profile's own `accent_color` wins when set (the user
 * picked it on purpose); otherwise the seed hashes to a fixed palette entry so
 * the same person is always the same colour on every screen.
 */
export function nameColorFor(seed?: string | null, accent?: string | null): string {
  if (accent) return accent;
  if (!seed) return NAME_TOKENS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return NAME_TOKENS[hash % NAME_TOKENS.length];
}
