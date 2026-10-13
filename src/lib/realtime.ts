import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Realtime helpers for the one hazard that keeps biting this app: two parts of
 * the same client subscribing to the same topic.
 *
 * supabase-js keeps one channel per topic *per client*: `channel("x")` returns
 * the existing instance when "x" is already in use, and calling `subscribe()` on
 * an instance that has already joined throws "tried to subscribe multiple times.
 * 'subscribe' can only be called a single time per channel instance". Because
 * that throw happens inside effects and event handlers, React escalates it to a
 * route error boundary and the whole page reads "This page didn't load".
 *
 * The channel is already live in that case and every handler attached before the
 * call still receives events, so the safe behaviour is to carry on rather than
 * throw.
 */
export function subscribeSafely(
  channel: RealtimeChannel,
  onStatus?: (status: string) => void,
): void {
  try {
    channel.subscribe((status) => onStatus?.(status));
  } catch (error) {
    console.debug("Realtime channel was already subscribed; reusing it.", error);
  }
}

/**
 * The already-joined channel for a topic on this client, if one exists.
 * Callers use it to reuse the live channel and, importantly, to leave cleanup
 * alone — removing a channel someone else is using would break their session.
 */
export function findJoinedChannel(client: SupabaseClient, topic: string): RealtimeChannel | null {
  try {
    const channels = typeof client.getChannels === "function" ? client.getChannels() : [];
    return (
      (channels as RealtimeChannel[]).find(
        (channel) => channel.topic === `realtime:${topic}` && channel.state === "joined",
      ) ?? null
    );
  } catch (error) {
    console.debug("Could not inspect existing realtime channels", error);
    return null;
  }
}

/** `call:<a>_<b>` — the signalling topic shared by one 1:1 conversation. */
export function callTopic(roomId: string) {
  return `call:${roomId}`;
}
