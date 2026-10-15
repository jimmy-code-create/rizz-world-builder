/**
 * The BOT badge next to a bot's name: cream name plus a small FILLED tag
 * (10px caps, surface-2 background) — never green text with an outline.
 */
export function BotBadge({ className = "" }: { className?: string }) {
  return (
    <span title="This message was sent by a bot" className={`bot-tag ${className}`}>
      BOT
    </span>
  );
}

export default BotBadge;
