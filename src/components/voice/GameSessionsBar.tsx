import { useState } from "react";
import { LogOut, MonitorPlay, Play, Radio, Users } from "lucide-react";
import type { GameSession } from "@/lib/game-sessions";

/**
 * "GAMES IN THIS CALL" — one card per person, not one shared channel game.
 *
 * Jimmy's card opens Jimmy's Krunker session; Bob's card opens Bob's Skribbl.
 * Join game puts you in that host's session immediately, and the same card is
 * where the host starts a game-only stream.
 */
export function GameSessionsBar({
  sessions,
  viewersByHost,
  meId,
  viewingHostId,
  streamingIds,
  onOpen,
  onJoin,
  onLeave,
  onStream,
}: {
  sessions: GameSession[];
  viewersByHost: Record<string, string[]>;
  meId: string | null | undefined;
  viewingHostId: string | null;
  streamingIds: string[];
  onOpen: (session: GameSession) => void;
  onJoin: (session: GameSession) => void;
  onLeave: (session: GameSession) => void;
  onStream: (session: GameSession) => void;
}) {
  if (sessions.length === 0) return null;

  return (
    <div className="relative shrink-0 px-3 pt-3 sm:px-4">
      <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary/80">
          Games in call
        </span>
        {sessions.map((session) => {
          const mine = session.hostId === meId;
          const joined = viewingHostId === session.hostId;
          const count = Math.max(1, viewersByHost[session.hostId]?.length ?? 1);
          const streaming = streamingIds.includes(session.hostId);
          return (
            <div
              key={session.sessionId}
              className={`flex min-w-[240px] shrink-0 items-center gap-2 rounded-2xl border p-2 ${
                joined || mine
                  ? "border-primary/50 bg-primary/10"
                  : "border-white/10 bg-card/80"
              }`}
            >
              <SessionLogo session={session} />
              <button
                type="button"
                onClick={() => onOpen(session)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-xs font-bold">
                  {session.game.name}
                </span>
                <span className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                  {mine ? "Your game" : `${session.hostName}'s game`}
                  <span className="inline-flex items-center gap-0.5">
                    <Users className="h-3 w-3" /> {count}
                  </span>
                  {streaming && (
                    <span className="inline-flex items-center gap-0.5 text-primary">
                      <Radio className="h-3 w-3" /> live
                    </span>
                  )}
                  {session.paused && <span className="text-amber-300">paused</span>}
                </span>
              </button>

              {mine ? (
                <button
                  type="button"
                  onClick={() => onStream(session)}
                  aria-label={streaming ? "Stop streaming your game" : "Stream only your game"}
                  title={streaming ? "Stop streaming your game" : "Stream only your game"}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition ${
                    streaming
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {streaming ? <Radio className="h-4 w-4" /> : <MonitorPlay className="h-4 w-4" />}
                </button>
              ) : joined ? (
                <button
                  type="button"
                  onClick={() => onLeave(session)}
                  aria-label={`Leave ${session.hostName}'s game`}
                  title="Leave this game (the host keeps playing)"
                  className="flex h-9 shrink-0 items-center gap-1 rounded-xl border border-white/10 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-3.5 w-3.5" /> Leave
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onJoin(session)}
                  className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-primary px-2.5 text-[10px] font-bold text-primary-foreground active:scale-95"
                >
                  <Play className="h-3.5 w-3.5" /> Join game
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionLogo({ session }: { session: GameSession }) {
  const [broken, setBroken] = useState(false);
  const icon = session.game.icon;
  const isUrl = /^https?:\/\//i.test(icon);
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-primary/30 bg-primary/15">
      {isUrl && !broken ? (
        <img
          src={icon}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="text-base leading-none">{session.game.emoji || "🎮"}</span>
      )}
    </span>
  );
}
