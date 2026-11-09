/**
 * Notification aggregation for the notifications hub.
 *
 * Pure, side-effect free, and framework agnostic so it can be unit-tested on
 * its own and reused by the real feed plus the settings test panel without
 * either writing to the database.
 *
 * Grouping rule: notifications for the same `resource_id` AND the same `type`
 * that arrive within a 12h window collapse into one card. The window resets on
 * each new event in the group (a 13h gap always splits into two cards).
 *
 * Copy per group size:
 *   1   -> "@a reacted to your post"
 *   2   -> "@a and @b reacted to your post"
 *   3+  -> "@a, @b and N others reacted to your post"
 */

export type NotifEvent = {
  /** Notification/database row id. */
  id: string;
  /** The thing this notification is about (post id, dm thread id, room id…). */
  resource_id: string | null;
  /** dm | mention | reaction | paws_gift | voice_room (or any existing type). */
  type: string;
  /** The actor who triggered it. */
  actor: string | null;
  created_at: string | number | Date;
  /** Shown as the body preview on single-event cards. */
  body: string | null;
  /** Deep link to open when the card is tapped. */
  target_url: string | null;
};

export type AggregatedCard = {
  id: string;                  // id of the newest event in the group
  resource_id: string | null;
  type: string;
  count: number;
  actors: string[];            // deduped, newest first
  newestAt: number;            // ms epoch of the newest event
  oldestAt: number;            // ms epoch of the oldest event in the group
  /** Deep link to open when the card is tapped (newest event's target). */
  target_url: string | null;
  /** Pre-rendered actor list text: "@a", "@a and @b", "@a, @b and N others". */
  actorList: string;
  /** One-line summary using the actor list + type label. */
  summary: string;
  /** Whether this group came from test-only events (never written to the DB). */
  is_test: boolean;
};

const GROUP_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Build a deterministic grouping key: same resource + same type. */
function groupKey(event: NotifEvent): string {
  return `${event.resource_id ?? "null"}::${event.type}`;
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

/**
 * Aggregate a flat list of notification events into collapsible cards.
 *
 * @param events - raw notification rows (newest first is assumed but not required)
 * @param nowMs - reference "now" used only to decide the 12h window; pass
 *   `Date.now()` in production, a fixed value in tests.
 * @param typeLabel - optional override for the verb portion of the summary
 *   (defaults to the raw `type`).
 */
export function aggregateNotifications(
  events: readonly NotifEvent[],
  nowMs: number = Date.now(),
  typeLabel?: string,
): AggregatedCard[] {
  const byGroup = new Map<string, NotifEvent[]>();

  for (const event of events) {
    const key = groupKey(event);
    const bucket = byGroup.get(key);
    if (bucket) bucket.push(event);
    else byGroup.set(key, [event]);
  }

  const cards: AggregatedCard[] = [];

  for (const group of byGroup.values()) {
    // Sort newest first so the window boundary is measured against the newest event.
    const sorted = [...group].sort(
      (a, b) => msOf(b.created_at) - msOf(a.created_at),
    );

    // Split into sub-groups where consecutive events exceed the 12h window.
    // A 13h gap always produces two cards.
    let current: NotifEvent[] = [sorted[0]];
    const subGroups: NotifEvent[][] = [];

    for (let i = 1; i < sorted.length; i += 1) {
      const gap = msOf(sorted[i - 1].created_at) - msOf(sorted[i].created_at);
      if (gap > GROUP_WINDOW_MS) {
        subGroups.push(current);
        current = [sorted[i]];
      } else {
        current.push(sorted[i]);
      }
    }
    subGroups.push(current);

    for (const sub of subGroups) {
      const newest = sub[0];
      const actors = [...new Map(sub.map((e) => [e.actor, e.actor])).keys()].filter(Boolean);
      const count = sub.length;
      const label = typeLabel ?? newest.type;
      cards.push({
        id: newest.id,
        resource_id: newest.resource_id,
        type: newest.type,
        count,
        actors,
        newestAt: msOf(newest.created_at),
        oldestAt: msOf(sub[sub.length - 1].created_at),
        target_url: newest.target_url ?? null,
        actorList: actorListText(actors),
        summary: `${actorListText(actors)} ${label}`,
        is_test: sub.some((e) => (e as { is_test?: boolean }).is_test === true),
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
    { id: "1", resource_id: "post-1", type: "reaction", actor: "alice", created_at: base - 1000, body: null, target_url: "/p/post-1" },
  ];
}

export function exampleTwo(): NotifEvent[] {
  return [
    { id: "1", resource_id: "post-1", type: "reaction", actor: "alice", created_at: base - 1000, body: null, target_url: "/p/post-1" },
    { id: "2", resource_id: "post-1", type: "reaction", actor: "bob", created_at: base - 2000, body: null, target_url: "/p/post-1" },
  ];
}

export function exampleThree(): NotifEvent[] {
  return [
    { id: "1", resource_id: "post-1", type: "reaction", actor: "alice", created_at: base - 1000, body: null, target_url: "/p/post-1" },
    { id: "2", resource_id: "post-1", type: "reaction", actor: "bob", created_at: base - 2000, body: null, target_url: "/p/post-1" },
    { id: "3", resource_id: "post-1", type: "reaction", actor: "carol", created_at: base - 3000, body: null, target_url: "/p/post-1" },
  ];
}

export function exampleFifteen(): NotifEvent[] {
  const events: NotifEvent[] = [
    { id: "1", resource_id: "post-1", type: "reaction", actor: "alice", created_at: base - 1000, body: null, target_url: "/p/post-1" },
    { id: "2", resource_id: "post-1", type: "reaction", actor: "bob", created_at: base - 2000, body: null, target_url: "/p/post-1" },
  ];
  for (let i = 3; i <= 15; i += 1) {
    events.push({ id: String(i), resource_id: "post-1", type: "reaction", actor: `user${i}`, created_at: base - i * 1000, body: null, target_url: "/p/post-1" });
  }
  return events;
}

export function exampleThirteenHourGap(): NotifEvent[] {
  const thirteenHoursMs = 13 * 60 * 60 * 1000;
  return [
    { id: "1", resource_id: "post-1", type: "reaction", actor: "alice", created_at: base - 1000, body: null, target_url: "/p/post-1" },
    { id: "2", resource_id: "post-1", type: "reaction", actor: "bob", created_at: base - thirteenHoursMs - 1000, body: null, target_url: "/p/post-1" },
  ];
}
