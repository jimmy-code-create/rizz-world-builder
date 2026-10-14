import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Bot as BotIcon, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { describeOptions, type RealmSlashCommand } from "@/lib/bot-commands";

/**
 * The "/" autocomplete popup above the composer.
 *
 * Presentational: the composer owns the text, the highlight index and the key
 * handling, so typing never loses focus. This component only renders the rows
 * and reports taps, and keeps the highlighted row scrolled into view.
 *
 * Laid out like Discord's: a fixed section label ("BOT COMMANDS" /
 * "FREQUENTLY USED") that stays put while the rows scroll under it, one row per
 * command with the icon leading, the command name over its description, the
 * owning app pushed to the right edge, a keyboard-hint footer, and the app strip
 * along the bottom.
 */
export function SlashCommandMenu({
  commands,
  activeIndex,
  onSelect,
  onHover,
  className = "",
  emptyHint,
}: {
  commands: RealmSlashCommand[];
  activeIndex: number;
  onSelect: (command: RealmSlashCommand) => void;
  onHover: (index: number) => void;
  className?: string;
  /** Shown instead of the rows when nothing matches, so "nothing happens" never
   *  reads as "the composer is broken". */
  emptyHint?: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, commands.length]);

  if (!commands.length && !emptyHint) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      className={`relative z-50 w-full overflow-hidden rounded-2xl border border-white/5 bg-[#1e1f22] shadow-[0_18px_48px_-20px_rgba(0,0,0,0.95)] ${className}`}
    >
      <div className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#b5bac1]">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {commands.length ? "Frequently used" : "Bot commands"}
      </div>
      {!commands.length && (
        <p className="px-3 pb-3 text-xs text-muted-foreground">{emptyHint}</p>
      )}
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Bot commands"
        className="no-scrollbar max-h-[min(44dvh,18rem)] overflow-y-auto px-1.5 pb-1.5"
      >
        {commands.map((command, index) => {
          const active = index === activeIndex;
          const initial = command.bot_name.charAt(0).toUpperCase();
          return (
            <li key={command.command_id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={active}
                data-index={index}
                // Pointer down rather than click: the composer keeps focus and
                // the menu is gone before the input loses its caret.
                onPointerDown={(event) => {
                  event.preventDefault();
                  onSelect(command);
                }}
                onMouseEnter={() => onHover(index)}
                className={`flex w-full min-h-[3.25rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                  active ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
                }`}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={command.bot_avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-bold text-primary-foreground">
                    {command.is_builtin ? <BotIcon className="h-4 w-4" aria-hidden="true" /> : initial}
                  </AvatarFallback>
                </Avatar>

                {/* Discord layout: command name over its description on the left,
                    the owning app pushed to the right edge. */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-white">/{command.name}</p>
                  <p className="truncate text-[13px] text-[#b5bac1]">{command.description}</p>
                </div>

                <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:block">
                  {describeOptions(command)}
                </span>

                <span className="shrink-0 truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-[#b5bac1]">
                  {command.bot_name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Footer: how to drive it with a keyboard, plus the app icons — the two
          things Discord puts under the list. */}
      <div className="flex items-center gap-1 border-t border-white/5 bg-black/20 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {commands.slice(0, 6).map((command, index) => (
            <button
              key={`fav-${command.command_id}`}
              type="button"
              title={`/${command.name} — ${command.bot_name}`}
              aria-label={`/${command.name} from ${command.bot_name}`}
              onPointerDown={(event) => {
                event.preventDefault();
                onSelect(command);
              }}
              onMouseEnter={() => onHover(index)}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-[11px] font-bold transition-colors ${
                index === activeIndex
                  ? "bg-primary/25 text-foreground"
                  : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
              }`}
            >
              {command.is_builtin ? (
                <BotIcon className="h-3.5 w-3.5" aria-hidden="true" />
              ) : command.bot_avatar_url ? (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={command.bot_avatar_url} alt="" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-[9px] font-bold text-primary-foreground">
                    {command.bot_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                command.bot_name.charAt(0).toUpperCase()
              )}
            </button>
          ))}
        </div>
        {commands.length > 0 && (
          <p className="hidden shrink-0 items-center gap-1.5 pl-2 text-[10px] text-muted-foreground sm:flex">
            <kbd className="rounded border border-white/10 bg-white/5 px-1 font-sans">↑↓</kbd> browse
            <kbd className="rounded border border-white/10 bg-white/5 px-1 font-sans">↵</kbd> insert
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Wraps the highlight index so ArrowUp/ArrowDown never run off either end. */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export default SlashCommandMenu;
