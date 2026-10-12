import { Bot } from "lucide-react";

/**
 * The BOT badge next to a bot's name, so nobody mistakes a bot for a person.
 * Kept deliberately tiny: it sits inline with the author name in every chat.
 */
export function BotBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="This message was sent by a bot"
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--rizz-violet)]/45 bg-[var(--rizz-violet)]/15 px-1.5 py-[1px] text-[9px] font-bold uppercase leading-none tracking-wider text-[var(--rizz-violet)] ${className}`}
    >
      <Bot className="h-2.5 w-2.5" aria-hidden="true" strokeWidth={2.4} />
      BOT
    </span>
  );
}

export default BotBadge;
