import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRealmBots, realmBotsKey } from "@/lib/bots";
import { musicQueueKey, runMusicCommand, useMusicQueue, type QueueTrack } from "@/lib/music";
import {
  elementSourceOf,
  MusicPlayer,
  queueTrackToMusic,
  sourceKindOf,
  type MusicPlayerController,
} from "@/components/music/MusicPlayer";
import { MUSIC_PROVIDERS, type MusicIssue } from "@/lib/music-sources";
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
 * Playback goes through the SAME unified player the channel panel uses, so a
 * YouTube link, a direct audio file and an Apple preview all sing in a call.
 * Before this, the bot owned a bare `<audio preload>` pointed at
 * `preview_url`, which is why only Apple's 30-second clips were ever audible.
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
  /** Why the bot is quiet, in the user's words — null while it is singing. */
  note: string | null;
};

let store: MusicBotState = { track: null, singing: false, blocked: false, enabled: false, note: null };
const listeners = new Set<() => void>();

function update(patch: Partial<MusicBotState>) {
  const next = { ...store, ...patch };
  if (
    next.track?.id === store.track?.id &&
    next.singing === store.singing &&
    next.blocked === store.blocked &&
    next.enabled === store.enabled &&
    next.note === store.note
  ) {
    return;
  }
  store = next;
  listeners.forEach((listener) => listener());
}

/** Imperative controls the audio owner publishes for the call view's buttons. */
export const musicBotControls: { toggle: () => void; retry: () => void; seek: (seconds: number) => void } = {
  toggle: () => {},
  retry: () => {},
  seek: () => {},
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
 * user should simply not have a singing bot, not an error screen.
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
 * Owns the bot's playback and keeps it in sync with the channel queue.
 * Rendered by the voice provider, so it keeps playing when the call is
 * minimized, exactly like the other participants' audio.
 */
export function MusicBotAudio({ call }: { call: ActiveCall | null }) {
  const qc = useQueryClient();
  const realmId = call?.realmId ?? null;
  // The queue is keyed by the REALM CHANNEL id, while `call.roomId` is the
  // voice_rooms row. Using the voice-room id made every lookup miss, so the bot
  // stood in the call with an empty queue and never made a sound.
  const roomId = call?.channelId ?? null;

  const bots = useQuery({
    queryKey: realmBotsKey(realmId ?? ""),
    queryFn: () => fetchRealmBots(realmId!),
    enabled: !!realmId,
  });
  const botEnabled = (bots.data?.bots ?? []).some((entry) => entry.name === "MUSIC BOT" && entry.enabled);

  const queue = useMusicQueue(realmId, roomId, botEnabled);
  const track = (queue.data ?? [])[0] ?? null;
  const input = queueTrackToMusic(track);

  const controller = useRef<MusicPlayerController | null>(null);
  const endedRef = useRef<string | null>(null);

  // Whether this track has anything to play at all: a YouTube link uses the
  // embed, everything else needs a playable URL.
  const kind = sourceKindOf(input);
  const playable = kind === "youtube" ? true : !!elementSourceOf(input);

  useEffect(() => {
    update({ enabled: botEnabled && !!realmId, track });
    if (!realmId) update({ singing: false, blocked: false, note: null });
  }, [botEnabled, realmId, track]);

  useEffect(() => {
    if (track && !playable) {
      update({
        singing: false,
        blocked: false,
        note: `No playable audio for this ${MUSIC_PROVIDERS[kind].label} track — skip to the next song.`,
      });
      return;
    }
    if (playable) update({ note: null });
  }, [track, playable, kind]);

  const handleIssue = useCallback((issue: MusicIssue | null) => {
    if (!issue) {
      update({ blocked: false, note: null });
      return;
    }
    const blocked = issue.title === "Tap to start the music";
    update({ blocked, singing: false, note: `${issue.title} — ${issue.detail}` });
  }, []);

  const handlePlayingChange = useCallback((playing: boolean) => {
    update(playing ? { singing: true, blocked: false, note: null } : { singing: false });
  }, []);

  /**
   * When a track finishes, the bot moves the queue on so it keeps singing
   * instead of falling silent after one song.
   */
  const handleEnded = useCallback(() => {
    if (!realmId || !track || endedRef.current === track.id) return;
    endedRef.current = track.id;
    update({ singing: false });
    void runMusicCommand("skip", { args: "", realmId, roomId })
      .then(() => qc.invalidateQueries({ queryKey: musicQueueKey(realmId, roomId) }))
      .catch(() => {
        /* The bot is best-effort here: a failed skip just leaves the queue alone. */
      });
  }, [realmId, roomId, track, qc]);

  /**
   * Autoplay policy: a track queued by someone else starts with no gesture of
   * mine, which browsers refuse. Instead of leaving it silent until the user
   * finds a button, the first tap or key press anywhere — the call's own mic,
   * camera or tile buttons included — starts the song.
   */
  useEffect(() => {
    const resume = () => {
      if (store.blocked) controller.current?.play();
    };
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
    return () => {
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
    };
  }, []);

  useEffect(() => {
    musicBotControls.toggle = () => {
      if (!playable) return;
      if (store.singing) controller.current?.pause();
      else controller.current?.play();
    };
    musicBotControls.retry = () => controller.current?.play();
    musicBotControls.seek = (seconds: number) => controller.current?.seekTo(seconds);
    return () => {
      musicBotControls.toggle = () => {};
      musicBotControls.retry = () => {};
      musicBotControls.seek = () => {};
    };
  }, [playable]);

  return (
    <MusicPlayer
      chromeless
      autoPlay
      track={playable ? input : null}
      realmId={realmId}
      onEnded={handleEnded}
      onIssue={handleIssue}
      onPlayingChange={handlePlayingChange}
      controllerRef={(next) => {
        controller.current = next;
      }}
    />
  );
}
