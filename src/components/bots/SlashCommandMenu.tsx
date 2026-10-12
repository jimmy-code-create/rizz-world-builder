import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Bot as BotIcon, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { describeOptions, type RealmSlashCommand } from "@/lib/bot-commands";

/**
 * The "/" autocomplete popup above the composer.
 *
 * Presentational: the composer owns the text, the highlight index and the key
 * handling, so typing never loses focus. This component only renders the rows
 * and reports taps, and keeps the highlighted row scrolled into view.
 */
export function SlashCommandMenu({
  commands,
  activeIndex,
  onSelect,
  onHover,
  className = "",
}: {
  commands: RealmSlashCommand[];
  activeIndex: number;
  onSelect: (command: RealmSlashCommand) => void;
  onHover: (index: number) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, commands.length]);

  if (!commands.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      className={`glass-strong z-50 w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_48px_-20px_rgba(0,0,0,0.95)] ${className}`}
    >
      <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3 w-3 text-[var(--rizz-pink)]" aria-hidden="true" />
        Bot commands
      </div>
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Bot commands"
        className="no-scrollbar max-h-[min(46dvh,19rem)] overflow-y-auto p-1.5"
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
                className={`flex w-full min-h-12 items-center gap-3 rounded-xl px-2.5 text-left transition-colors ${
                  active ? "bg-[var(--rizz-pink)]/12" : "hover:bg-white/[0.06]"
                }`}
              >
                <Avatar className="h-8 w-8 shrink-0 ring-1 ring-white/10">
                  <AvatarImage src={command.bot_avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-gradient-primary text-[11px] font-bold text-primary-foreground">
                    {command.is_builtin ? <BotIcon className="h-4 w-4" aria-hidden="true" /> : initial}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold">
                    <span className={active ? "text-[var(--rizz-pink)]" : "text-foreground"}>
                      /{command.name}
                    </span>
                    <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {command.bot_name}
                    </span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{command.description}</p>
                </div>

                <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:block">
                  {describeOptions(command)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

/** Wraps the highlight index so ArrowUp/ArrowDown never run off either end. */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export default SlashCommandMenu;
