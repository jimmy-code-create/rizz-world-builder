/**
 * Notification aggregation for the notifications hub.
 *
 * Pure, side-effect free, and framework agnostic so it can be unit-tested on
 * its own and reused by the real feed plus the settings test panel without
 * either writing to the database.
 *
 * Grouping rule: notifications for the same `resource_id` AND the same `type`
 * that arrive within a 12h sliding window collapse into one card. The window is
 * anchored to the newest event in the group, so a 13h gap always splits.
 */

export type NotifEvent = {
  /** Notification/database row id. */
  id: string;
  /** The thing this notification is about (post id, dm thread id, room id…). */
  resource_id: string | null;
  /** dm | mention | reaction | paws_gift | voice_room (or any existing type). */
  type: string;
  /** The actor's username, without a leading @. */
  actor: string | null;
  /** Display name, when the profile row has one. */
  actor_name?: string | null;
  /** Actor avatar URL for the overlapping avatar stack. */
  actor_avatar_url?: string | null;
  created_at: string | number | Date;
  /** Shown as the body preview on cards. */
  body: string | null;
  /** Deep link to open when the card is tapped. */
  target_url: string | null;
  /** False when the underlying row is unread. */
  read?: boolean;
  /** More than one underlying row for a pre-collapsed thread (DMs). */
  weight?: number;
  /** Test-only event; never written to the database. */
  is_test?: boolean;
};

export type AggregatedCard = {
  /** id of the newest event in the group */
  id: string;
  /** Every underlying row id, for an optimistic mark-read. */
  eventIds: string[];
  resource_id: string | null;
  type: string;
  /** Total events, including a DM thread's message weight. */
  count: number;
  /** Deduped usernames, newest first. */
  actors: string[];
  /** Deduped display names aligned with `actors`. */
  actorNames: string[];
  /** Avatar URLs aligned with `actors`; null entries fall back to initials. */
  actorAvatars: Array<string | null>;
  newestAt: number;
  oldestAt: number;
  /** Deep link to open when the card is tapped (newest event's target). */
  target_url: string | null;
  /** Pre-rendered actor list text: "@a", "@a and @b", "@a, @b and N others". */
  actorList: string;
  /** One-line summary using the actor list + type-aware copy. */
  summary: string;
  /** Newest event's body, used as the row preview. */
  body: string | null;
  /** True when any event in this card is still unread. */
  unread: boolean;
  /** Whether this group came from test-only events (never written to the DB). */
  is_test: boolean;
};

const GROUP_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Build a deterministic grouping key: same resource + same type. */
function groupKey(event: NotifEvent): string {
  // A null resource is not a shared resource: keep those events separate.
  return `${event.resource_id ?? `event:${event.id}`}::${event.type}`;
}

/** Render "@a", "@a and @b", or "@a, @b and N others". */
function actorListText(actors: string[]): string {
  const uniq = actors.filter(Boolean);
  if (uniq.length === 0) return "Someone";
  if (uniq.length === 1) return `@${uniq[0]}`;
  if (uniq.length === 2) return `@${uniq[0]} and @${uniq[1]}`;
  return `@${uniq[0]}, @${uniq[1]} and ${uniq.length - 2} others`;
}

function msOf(value: string | number | Date): number {
  return new Date(value).getTime();
}

/** Short emoji-like body, used for "reacted with 🔥" copy. */
function reactionGlyph(body: string | null): string | null {
  const value = body?.trim() ?? "";
  if (!value || value.length > 16 || /\s/.test(value)) return null;
  return value;
}

/**
 * Type-aware verb for a collapsed card. The optional `typeLabel` parameter of
 * `aggregateNotifications` still overrides this for tests and custom surfaces.
 */
function notificationPhrase(type: string, body: string | null, count: number): string {
  switch (type) {
    case "reaction": {
      const glyph = reactionGlyph(body);
      return glyph ? `reacted with ${glyph} to your post` : "reacted to your post";
    }
    case "story_reaction": {
      const glyph = reactionGlyph(body);
      return glyph ? `reacted with ${glyph} to your story` : "reacted to your story";
    }
    case "like":
      return "liked your post";
    case "comment":
      return "commented on your post";
    case "follow":
      return "started following you";
    case "mention":
    case "group_mention":
      return "mentioned you";
    case "dm":
    case "message":
      return count > 1 ? `sent you ${count} messages` : "sent you a message";
    case "paws_gift":
    case "gift":
      return count > 1 ? `sent you ${count} gifts` : "sent you a gift";
    case "voice_room":
      return "invited you to a voice room";
    case "call":
      return "called you";
    case "badge":
    case "badge_unlock":
      return "unlocked a badge";
    case "bounty_paid":
    case "bounty_released":
      return "released a bounty";
    case "bounty_submitted":
      return "submitted a bounty";
    default:
      return type.replace(/_/g, " ");
  }
}

/**
 * Aggregate a flat list of notification events into collapsible cards.
 *
 * @param events - raw notification rows (newest first is assumed but not required)
 * @param nowMs - reference "now" used only to decide the 12h window; pass
 *   `Date.now()` in production, a fixed value in tests.
 * @param typeLabel - optional override for the verb portion of the summary
 *   (defaults to type-aware copy).
 */
export function aggregateNotifications(
  events: readonly NotifEvent[],
  nowMs: number = Date.now(),
  typeLabel?: string,
): AggregatedCard[] {
  void nowMs;
  const byGroup = new Map<string, NotifEvent[]>();

  for (const event of events) {
    const key = groupKey(event);
    const bucket = byGroup.get(key);
    if (bucket) bucket.push(event);
    else byGroup.set(key, [event]);
  }

  const cards: AggregatedCard[] = [];

  for (const group of byGroup.values()) {
    // Sort newest first so the window is anchored to the newest event.
    const sorted = [...group].sort(
      (a, b) => msOf(b.created_at) - msOf(a.created_at),
    );

    // Split into sub-groups where an event is more than 12h older than the
    // anchor (the newest event of the current card). The anchor resets after
    // a split, so a long thread still collapses into coherent 12h buckets.
    let current: NotifEvent[] = [sorted[0]];
    let anchorMs = msOf(sorted[0].created_at);
    const subGroups: NotifEvent[][] = [];

    for (let i = 1; i < sorted.length; i += 1) {
      const eventMs = msOf(sorted[i].created_at);
      if (anchorMs - eventMs > GROUP_WINDOW_MS) {
        subGroups.push(current);
        current = [sorted[i]];
        anchorMs = eventMs;
      } else {
        current.push(sorted[i]);
      }
    }
    subGroups.push(current);

    for (const sub of subGroups) {
      const newest = sub[0];
      const actorMap = new Map<string, { name: string; avatar: string | null }>();
      for (const event of sub) {
        if (!event.actor || actorMap.has(event.actor)) continue;
        actorMap.set(event.actor, {
          name: event.actor_name || event.actor,
          avatar: event.actor_avatar_url ?? null,
        });
      }
      const actors = [...actorMap.keys()];
      const count = sub.reduce((total, event) => {
        const weight = event.weight && event.weight > 0 ? event.weight : 1;
        return total + weight;
      }, 0);
      const label = typeLabel ?? notificationPhrase(newest.type, newest.body, count);
      cards.push({
        id: newest.id,
        eventIds: sub.map((event) => event.id),
        resource_id: newest.resource_id,
        type: newest.type,
        count,
        actors,
        actorNames: actors.map((actor) => actorMap.get(actor)?.name ?? actor),
        actorAvatars: actors.map((actor) => actorMap.get(actor)?.avatar ?? null),
        newestAt: msOf(newest.created_at),
        oldestAt: msOf(sub[sub.length - 1].created_at),
        target_url: newest.target_url ?? null,
        actorList: actorListText(actors),
        summary: actors.length ? `${actorListText(actors)} ${label}` : label,
        body: newest.body,
        unread: sub.some((event) => event.read !== true),
        is_test: sub.some((event) => event.is_test === true),
      });
    }
  }

  cards.sort((a, b) => b.newestAt - a.newestAt);
  return cards;
}

// ---------------------------------------------------------------------------
// Example fixtures used by the settings test panel's grouping preview.
// ---------------------------------------------------------------------------

const base = Date.now();

export function exampleSingle(): NotifEvent[] {
  return [
    { id: "1", resource_id: "post-1", type: "reaction", actor: "alice", created_at: base - 1000, body: "🔥", target_url: "/p/post-1" },
  ];
}

export function exampleTwo(): NotifEvent[] {
  return [
    { id: "1", resource_id: "post-1", type: "reaction", actor: "alice", created_at: base - 1000, body: "🔥", target_url: "/p/post-1" },
    { id: "2", resource_id: "post-1", type: "reaction", actor: "bob", created_at: base - 2000, body: "🔥", target_url: "/p/post-1" },
  ];
}

export function exampleThree(): NotifEvent[] {
  return [
    { id: "1", resource_id: "post-1", type: "reaction", actor: "alice", created_at: base - 1000, body: "🔥", target_url: "/p/post-1" },
    { id: "2", resource_id: "post-1", type: "reaction", actor: "bob", created_at: base - 2000, body: "🔥", target_url: "/p/post-1" },
    { id: "3", resource_id: "post-1", type: "reaction", actor: "carol", created_at: base - 3000, body: "🔥", target_url: "/p/post-1" },
  ];
}

export function exampleFifteen(): NotifEvent[] {
  const events: NotifEvent[] = [
    { id: "1", resource_id: "post-1", type: "reaction", actor: "alice", created_at: base - 1000, body: "🔥", target_url: "/p/post-1" },
    { id: "2", resource_id: "post-1", type: "reaction", actor: "bob", created_at: base - 2000, body: "🔥", target_url: "/p/post-1" },
  ];
  for (let i = 3; i <= 15; i += 1) {
    events.push({ id: String(i), resource_id: "post-1", type: "reaction", actor: `user${i}`, created_at: base - i * 1000, body: "🔥", target_url: "/p/post-1" });
  }
  return events;
}

export function exampleThirteenHourGap(): NotifEvent[] {
  const thirteenHoursMs = 13 * 60 * 60 * 1000;
  return [
    { id: "1", resource_id: "post-1", type: "reaction", actor: "alice", created_at: base - 1000, body: "🔥", target_url: "/p/post-1" },
    { id: "2", resource_id: "post-1", type: "reaction", actor: "bob", created_at: base - thirteenHoursMs - 1000, body: "🔥", target_url: "/p/post-1" },
  ];
}
