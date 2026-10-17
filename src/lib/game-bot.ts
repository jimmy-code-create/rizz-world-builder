import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { GAME_BOT_CHANNEL, type GameBotState, type GameEntry } from "@/lib/game-library";

export const EMPTY_GAME_BOT: GameBotState = {
  activeGame: null,
  isPlaying: false,
  isPaused: false,
  launchedAt: null,
  launchedBy: null,
};

/**
 * Shared GAME BOT state for one voice channel.
 *
 * Launches, pauses and stops are broadcast on `vc-game-bot:<channelId>` so the
 * dedicated Games menu behaves the same whether it was opened from the realm
 * voice bar, the VC header, or the Games page while in a call.
 */
export function useGameBot(channelId: string | null | undefined, enabled = true) {
  const { user } = useAuth();
  const [state, setState] = useState<GameBotState>(EMPTY_GAME_BOT);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled || !channelId || !user) return;
    const channel = supabase.channel(GAME_BOT_CHANNEL(channelId));
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "game-bot-state" }, ({ payload }) => {
        if (payload?.userId === user.id) return; // own updates are already applied
        const s = payload?.state;
        if (!s) return;
        setState({
          activeGame: (s.activeGame as GameEntry | null) ?? null,
          isPlaying: !!s.isPlaying && !s.isPaused,
          isPaused: !!s.isPaused,
          launchedAt: (s.launchedAt as number | null) ?? null,
          launchedBy: (s.launchedBy as string | null) ?? null,
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelId, enabled, user]);

  const send = useCallback(
    (next: GameBotState) => {
      setState(next);
      if (!channelRef.current || !user) return;
      channelRef.current.send({
        type: "broadcast",
        event: "game-bot-state",
        payload: { userId: user.id, state: next },
      });
    },
    [user],
  );

  const launch = useCallback(
    (game: GameEntry) =>
      send({
        activeGame: game,
        isPlaying: true,
        isPaused: false,
        launchedAt: Date.now(),
        launchedBy: user?.id ?? null,
      }),
    [send, user],
  );

  const pause = useCallback(
    () => send({ ...state, isPlaying: false, isPaused: true }),
    [send, state],
  );

  const resume = useCallback(
    () => send({ ...state, isPlaying: true, isPaused: false }),
    [send, state],
  );

  const stop = useCallback(() => send(EMPTY_GAME_BOT), [send]);

  return { state, launch, pause, resume, stop };
}
