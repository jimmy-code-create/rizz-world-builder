import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRealmBots, realmBotsKey } from "@/lib/bots";
import { musicQueueKey, runMusicCommand, useMusicQueue, type QueueTrack } from "@/lib/music";
// Type-only: the props come from the provider instead of its context, so this
// module no longer imports the provider at runtime (that cycle is avoidable and
// the audio owner has no business reading the context it is rendered by).
import type { ActiveCall } from "@/components/voice/VoiceCallProvider";

/**
 * MUSIC BOT as a call participant.
 *
 * The queue already lives on the voice room, but the bot only ever queued songs:
 * nobody heard them unless they tapped preview. This makes the bot join the call
 * — its tile sits with the other participants and its track plays for the whole
 * channel, so "/play …" really does make the bot sing.
 *
 * The audio element is mounted by the voice provider rather than by the call
 * view, so minimizing the call does not stop the song. Because browsers can
 * block audio that starts without a gesture, a blocked start is reported through
 * the store and the call view offers a "Tap to let MUSIC BOT sing" button.
 *
 * State is kept in a tiny module-level store instead of React context: the audio
 * owner (provider) and the renderer (call view) are siblings under the same
 * provider but mount in different places, and a store keeps the wiring obvious.
 */
type MusicBotState = {
  /** Track the bot is on right now, or null when nothing is queued. */
  track: QueueTrack | null;
  singing: boolean;
  blocked: boolean;
  /** True while the channel's MUSIC BOT is installed and enabled. */
  enabled: boolean;
};

let store: MusicBotState = { track: null, singing: false, blocked: false, enabled: false };
const listeners = new Set<() => void>();

function update(patch: Partial<MusicBotState>) {
  const next = { ...store, ...patch };
  if (
    next.track?.id === store.track?.id &&
    next.singing === store.singing &&
    next.blocked === store.blocked &&
    next.enabled === store.enabled
  ) {
    return;
  }
  store = next;
  listeners.forEach((listener) => listener());
}

/** Imperative controls the audio owner publishes for the call view's buttons. */
export const musicBotControls: { toggle: () => void; retry: () => void } = {
  toggle: () => {},
  retry: () => {},
};

/** Subscribes a component (the call view) to the bot's state. */
export function useMusicBotInCall(): MusicBotState {
  const [snapshot, setSnapshot] = useState(store);
  useEffect(() => {
    const sync = () => setSnapshot(store);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return snapshot;
}

/**
 * Contains MUSIC BOT so it can never blank a page again.
 *
 * The bot is an optional extra on top of a call: if its audio owner throws, the
 * user should simply not have a singing bot, not an error screen. This is a
 * safety net around the fix in `useMusicQueue`, not a substitute for it.
 */
export class MusicBotBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("MUSIC BOT in-call audio failed; continuing without it.", error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/**
 * Owns the bot's audio element and keeps it in sync with the channel queue.
 * Rendered by the voice provider, so it keeps playing when the call is
 * minimized, exactly like the other participants' audio.
 */
export function MusicBotAudio({ call }: { call: ActiveCall | null }) {
  const qc = useQueryClient();
  const realmId = call?.realmId ?? null;
  const roomId = call?.roomId ?? null;

  const bots = useQuery({
    queryKey: realmBotsKey(realmId ?? ""),
    queryFn: () => fetchRealmBots(realmId!),
    enabled: !!realmId,
  });
  const botEnabled = (bots.data?.bots ?? []).some((entry) => entry.name === "MUSIC BOT" && entry.enabled);

  const queue = useMusicQueue(realmId, roomId, botEnabled);
  const track = (queue.data ?? [])[0] ?? null;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endedRef = useRef<string | null>(null);

  useEffect(() => {
    update({ enabled: botEnabled && !!realmId, track });
    // Leaving the call clears the bot from the participant list.
    if (!realmId) update({ singing: false, blocked: false });
  }, [botEnabled, realmId, track]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const play = () => {
      void audio
        .play()
        .then(() => update({ singing: true, blocked: false }))
        .catch(() => update({ singing: false, blocked: true }));
    };
    const pause = () => {
      audio.pause();
      update({ singing: false });
    };
    musicBotControls.toggle = () => {
      if (!track?.preview_url) return;
      if (audio.paused) play();
      else pause();
    };
    musicBotControls.retry = play;
    return () => {
      musicBotControls.toggle = () => {};
      musicBotControls.retry = () => {};
    };
  }, [track?.preview_url]);

  // A newly queued track starts singing immediately for everyone in the call.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!track?.preview_url) {
      audio.pause();
      audio.removeAttribute("src");
      update({ singing: false, blocked: false });
      return;
    }
    // Media element work throws in some browsers (a seek before metadata, a
    // revoked blob URL). A bot that cannot sing must never take a page down, so
    // every one of these calls is contained and reported as "blocked" instead.
    try {
      if (audio.src !== track.preview_url) audio.src = track.preview_url;
      audio.currentTime = 0;
      endedRef.current = null;
    } catch (error) {
      console.debug("MUSIC BOT could not load that preview", error);
      update({ singing: false, blocked: true });
      return;
    }
    try {
      void audio
        .play()
        .then(() => update({ singing: true, blocked: false }))
        .catch(() => update({ singing: false, blocked: true }));
    } catch (error) {
      console.debug("MUSIC BOT could not start playback", error);
      update({ singing: false, blocked: true });
    }
  }, [track?.id, track?.preview_url]);

  /**
   * When a preview finishes, the bot moves the queue on so it keeps singing
   * instead of falling silent after 30 seconds.
   */
  const handleEnded = () => {
    if (!realmId || !track || endedRef.current === track.id) return;
    endedRef.current = track.id;
    update({ singing: false });
    void runMusicCommand("skip", { args: "", realmId, roomId })
      .then(() => qc.invalidateQueries({ queryKey: musicQueueKey(realmId, roomId) }))
      .catch(() => {
        /* The bot is best-effort here: a failed skip just leaves the queue alone. */
      });
  };

  return (
    <audio
      ref={audioRef}
      playsInline
      preload="auto"
      onEnded={handleEnded}
      onPause={() => update({ singing: false })}
      onPlay={() => update({ singing: true, blocked: false })}
      className="hidden"
    />
  );
}
