import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, ExternalLink, Gamepad2, Play } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { GameIcon } from "@/components/GameIcon";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import {
  getGames,
  inviteText,
  isValidGameUrl,
  useRoomActivity,
  type GameEntry,
} from "@/lib/activities";

export const Route = createFileRoute("/_app/games")({
  head: () => ({ meta: [{ title: "Games · RIZZ" }] }),
  component: GamesPage,
});

const TYPE_LABEL: Record<GameEntry["type"], string> = {
  "multiplayer-hub": "Party hub",
  "room-link": "Same room",
  embed: "Solo",
};

function GamesPage() {
  const { user, profile } = useAuth();
  const { call, openView } = useVoiceCallContext();
  const me = user ? { id: user.id, name: profile?.display_name || profile?.username || "Someone" } : null;
  const roomActivity = useRoomActivity(call?.roomId ?? null, me);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const games = getGames();
  const live = roomActivity.activity;

  const copyInvite = async (entry: GameEntry) => {
    try {
      // No live room code on this page — share the game link itself.
      await navigator.clipboard.writeText(inviteText(entry, null));
      setCopiedId(entry.id);
      window.setTimeout(() => setCopiedId((current) => (current === entry.id ? null : current)), 1500);
    } catch {
      toast.error("Couldn't copy the invite");
    }
  };

  const play = async (entry: GameEntry) => {
    if (!isValidGameUrl(entry.url)) {
      toast.error(`${entry.name} has no link yet`, {
        description: "Paste its URL into src/data/games.json.",
      });
      return;
    }
    if (call?.roomId && user) {
      await roomActivity.start(entry);
      toast.success(`${entry.name} started in ${call.channelName}`, {
        description: "Opening the call — tap Join game to play.",
      });
      openView();
      return;
    }
    if (entry.type === "embed") {
      window.open(entry.url, "_blank", "noopener,noreferrer");
      return;
    }
    await copyInvite(entry);
    toast.info("Invite copied", {
      description: "Join a voice room first, then launch it there to play together.",
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-4 md:py-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8A8E]">Activities</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#f2efe6]">Games</h1>
        {call ? (
          <span className="shrink-0 rounded-full border border-[#c8ff3d]/40 bg-[#c8ff3d]/10 px-3 py-1 text-xs font-bold text-[#c8ff3d]">
            In call · {call.channelName}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-[#2E2E32] px-3 py-1 text-xs font-semibold text-muted-foreground">
            No call
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {call
          ? "Pick a game to launch it into your voice room — everyone gets a Join banner."
          : "Join a voice room to play together, or open a solo game right here."}
      </p>

      {live && (
        <button
          type="button"
          onClick={openView}
          className="mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-[#c8ff3d]/40 bg-[#c8ff3d]/10 p-3 text-left"
        >
          <GameIcon icon={live.gameIcon} size={26} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-[#f2efe6]">Live now: {live.gameName}</span>
            <span className="block truncate text-xs text-muted-foreground">
              Started by {live.startedByName} · tap to jump back in
            </span>
          </span>
        </button>
      )}

      <ul className="mt-3 space-y-2">
        {games.map((game) => (
          <li
            key={game.id}
            className="rounded-2xl border border-[#262629] bg-[#141416] p-3"
            style={{ borderRadius: 18 }}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[#2a2a2e] bg-[#1c1c1f]"
              >
                <GameIcon icon={game.icon} size={34} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-bold text-[#f2efe6]">{game.name}</h2>
                  <span className="shrink-0 rounded-full border border-[#2E2E32] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {game.players}
                  </span>
                  <span className="shrink-0 rounded-full border border-[#2E2E32] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {TYPE_LABEL[game.type]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{game.description}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void play(game)}
                className="flex h-11 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-[#c8ff3d] text-sm font-bold text-[#0b0b0c] transition-transform hover:bg-[#c8ff3d]/90 active:scale-95"
              >
                {call?.roomId ? <Play className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                {call?.roomId ? "Play in call" : game.type === "embed" ? "Play now" : "Copy invite"}
              </button>
              <button
                type="button"
                onClick={() => void copyInvite(game)}
                aria-label={`Copy invite for ${game.name}`}
                className="grid h-11 w-11 min-h-[44px] shrink-0 place-items-center rounded-full border border-[#2E2E32] text-muted-foreground transition-colors hover:text-[#f2efe6]"
              >
                {copiedId === game.id ? (
                  <span className="text-xs font-bold text-[#c8ff3d]">✓</span>
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {games.length === 0 && (
        <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-muted-foreground">
          No games yet. Add one entry to <span className="font-mono text-xs">src/data/games.json</span>.
        </p>
      )}

      <Link
        to="/bots/developer"
        className="mt-3 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/10 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <Gamepad2 className="h-4 w-4" /> Build your own? See developer tools
      </Link>
    </div>
  );
}
