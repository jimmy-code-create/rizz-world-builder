import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  Flame,
  Hand,
  Loader2,
  MessageCircle,
  Mic,
  RefreshCw,
  Tv,
  Users,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RizzCat } from "@/components/RizzCat";
import { StatusEmoji } from "@/lib/cat-emoji-text";
import { sendKnock } from "@/lib/knock";
import { toast } from "@/lib/toast";
import { OPEN_LIVE_STUDIO_EVENT } from "@/components/live/LiveNowChip";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { useLiveAndVibing, type LivePerson, type VoiceGroup } from "@/lib/live-and-vibing";

/**
 * "Live & vibing" — the list behind the chip.
 *
 * Phone: bottom sheet, max 85dvh, one close button. Desktop: a 400px card
 * (see `.live-vibing-sheet` in styles.css). Radix owns the focus trap, Esc and
 * returning focus to the chip.
 */

type Filter = "all" | "friends" | "voice";

type JoinTarget =
  | { kind: "live"; roomId: string; title: string }
  | { kind: "voice"; group: VoiceGroup }
  | { kind: "party"; id: string };

const PAGE = 30;

export function LiveAndVibingSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError, refetch } = useLiveAndVibing({ open });
  const { call, joinChannel, joinLiveRoom, leaveCall } = useVoiceCallContext();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<JoinTarget | null>(null);
  /** A join queued behind "Leave current call?"; runs when `call` turns null. */
  const afterLeave = useRef<JoinTarget | null>(null);

  // Reset transient state on open, never while the previous close is animating.
  useEffect(() => {
    if (!open) return;
    setFilter("all");
    setExpanded({});
    setConfirm(null);
    afterLeave.current = null;
  }, [open]);

  const runJoin = async (target: JoinTarget) => {
    onOpenChange(false);
    if (target.kind === "live") {
      await joinLiveRoom(target.roomId);
      return;
    }
    if (target.kind === "party") {
      void navigate({ to: "/reels", search: { party: target.id } });
      return;
    }
    joinChannel({
      id: target.group.channelId,
      realmId: target.group.realmId,
      name: target.group.channelName,
    });
  };

  const requestJoin = (target: JoinTarget) => {
    if (call) {
      setConfirm(target);
      return;
    }
    void runJoin(target);
  };

  // Leaving is asynchronous in the provider; join once the call is really gone
  // instead of racing the old room with a timeout.
  useEffect(() => {
    if (call || !afterLeave.current) return;
    const target = afterLeave.current;
    afterLeave.current = null;
    void runJoin(target as JoinTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call]);

  const hasFriends = useMemo(
    () =>
      data.streams.some((stream) => stream.host.friend) ||
      data.voiceGroups.some((group) => group.people.some((person) => person.friend)) ||
      data.parties.some((party) => party.host.friend) ||
      data.vibing.some((person) => person.friend),
    [data],
  );
  const hasVoice = data.voiceGroups.length > 0;

  // A realtime change can remove the last row that justified a filter chip;
  // never leave the sheet stranded on a filter the user can no longer see.
  useEffect(() => {
    if (filter === "friends" && !hasFriends) setFilter("all");
    if (filter === "voice" && !hasVoice) setFilter("all");
  }, [filter, hasFriends, hasVoice]);

  const friendsOnly = filter === "friends";
  const voiceOnly = filter === "voice";

  const streams = friendsOnly
    ? data.streams.filter((stream) => stream.host.friend)
    : voiceOnly
      ? []
      : data.streams;

  const voiceGroups =
    voiceOnly || friendsOnly
      ? data.voiceGroups
          .map((group) => ({
            ...group,
            people: friendsOnly ? group.people.filter((person) => person.friend) : group.people,
            count: friendsOnly
              ? group.people.filter((person) => person.friend).length
              : group.count,
          }))
          .filter((group) => group.count > 0)
      : data.voiceGroups;

  const vibing = voiceOnly
    ? []
    : friendsOnly
      ? data.vibing.filter((person) => person.friend)
      : data.vibing;

  const parties = voiceOnly
    ? []
    : friendsOnly
      ? data.parties.filter((party) => party.host.friend)
      : data.parties;

  const everythingEmpty =
    !isLoading &&
    !isError &&
    !streams.length &&
    !voiceGroups.length &&
    !parties.length &&
    !vibing.length;

  const startVoiceRoom = () => {
    // Voice rooms live inside realms; discovery is the honest entry point.
    onOpenChange(false);
    void navigate({ to: "/realms" });
  };

  const goLive = () => {
    onOpenChange(false);
    window.dispatchEvent(new Event(OPEN_LIVE_STUDIO_EVENT));
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="live-vibing-sheet flex max-h-[85dvh] flex-col gap-0 p-0"
        >
          <div className="sheet-drag-handle mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-white/25" />

          <header className="shrink-0 px-5 pb-3 pt-3">
            <SheetTitle className="font-display text-lg">Live &amp; vibing</SheetTitle>
            <SheetDescription className="mt-0.5 text-xs">
              Streams, voice rooms, watch parties and friends who are around.
            </SheetDescription>

            <div className="mt-3 flex items-center gap-1.5" role="group" aria-label="Filters">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
                All
              </FilterChip>
              {hasFriends && (
                <FilterChip active={filter === "friends"} onClick={() => setFilter("friends")}>
                  Friends
                </FilterChip>
              )}
              {hasVoice && (
                <FilterChip active={filter === "voice"} onClick={() => setFilter("voice")}>
                  Voice
                </FilterChip>
              )}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {isLoading && (
              <div className="space-y-2 py-2">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-16 w-full rounded-2xl" />
                ))}
              </div>
            )}

            {isError && !isLoading && (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Couldn&apos;t load who&apos;s around.
                </p>
                <Button
                  variant="outline"
                  className="mt-3 h-10 gap-2"
                  onClick={() => void refetch()}
                >
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              </div>
            )}

            {everythingEmpty && (
              <div className="py-8 text-center">
                <RizzCat mood="peek" size={104} className="mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">No one is live right now.</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button variant="outline" className="h-10" onClick={startVoiceRoom}>
                    Start a voice room
                  </Button>
                  <Button className="h-10 bg-primary text-primary-foreground" onClick={goLive}>
                    Go live
                  </Button>
                </div>
              </div>
            )}

            {!isLoading && !isError && !everythingEmpty && (
              <div className="space-y-5 py-1">
                {!!streams.length && (
                  <Section
                    title="Live now"
                    icon={<Flame className="h-3.5 w-3.5" />}
                    count={streams.length}
                  >
                    {streams.slice(0, expanded.live ? Infinity : PAGE).map((stream) => (
                      <button
                        key={stream.roomId}
                        type="button"
                        onClick={() =>
                          requestJoin({ kind: "live", roomId: stream.roomId, title: stream.title })
                        }
                        aria-label={`Watch ${stream.title} by ${stream.host.name}`}
                        className="lv-row flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      >
                        <UserAvatar
                          src={stream.host.avatarUrl ?? undefined}
                          fallback={stream.host.name}
                          size={44}
                          presence={stream.host.presence}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {stream.host.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {stream.title}
                          </span>
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3" aria-hidden="true" />
                            {stream.viewers} watching
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                          Watch
                        </span>
                      </button>
                    ))}
                    <ShowMore
                      shown={streams.length > (expanded.live ? Infinity : PAGE)}
                      onClick={() => setExpanded((value) => ({ ...value, live: true }))}
                    />
                  </Section>
                )}

                {!!voiceGroups.length && (
                  <Section title="In voice" icon={<Mic className="h-3.5 w-3.5" />}>
                    {voiceGroups.slice(0, expanded.voice ? Infinity : PAGE).map((group) => (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => requestJoin({ kind: "voice", group })}
                        aria-label={`Join ${group.channelName}, ${group.count} in call`}
                        className="lv-row flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      >
                        <AvatarStack people={group.people} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {group.realmName
                              ? `${group.realmName} · ${group.channelName}`
                              : group.channelName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {group.count} in call
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full border border-primary/50 px-3 py-1.5 text-xs font-bold text-primary">
                          Join
                        </span>
                      </button>
                    ))}
                    <ShowMore
                      shown={voiceGroups.length > (expanded.voice ? Infinity : PAGE)}
                      onClick={() => setExpanded((value) => ({ ...value, voice: true }))}
                    />
                  </Section>
                )}

                {!!parties.length && (
                  <Section title="Watching together" icon={<Tv className="h-3.5 w-3.5" />}>
                    {parties.slice(0, expanded.parties ? Infinity : PAGE).map((party) => (
                      <button
                        key={party.id}
                        type="button"
                        onClick={() => requestJoin({ kind: "party", id: party.id })}
                        aria-label={`Join ${party.title}`}
                        className="lv-row flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      >
                        <UserAvatar
                          src={party.host.avatarUrl ?? undefined}
                          fallback={party.host.name}
                          size={44}
                          presence={party.host.presence}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {party.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {party.host.name} · {party.people} watching
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full border border-primary/50 px-3 py-1.5 text-xs font-bold text-primary">
                          Join
                        </span>
                      </button>
                    ))}
                    <ShowMore
                      shown={parties.length > (expanded.parties ? Infinity : PAGE)}
                      onClick={() => setExpanded((value) => ({ ...value, parties: true }))}
                    />
                  </Section>
                )}

                {!!vibing.length && (
                  <Section title="Vibing now" icon={<Users className="h-3.5 w-3.5" />}>
                    {vibing.slice(0, expanded.vibing ? Infinity : PAGE).map((person) => (
                      <VibingRow
                        key={person.id}
                        person={person}
                        onMessage={() => {
                          onOpenChange(false);
                          void navigate({ to: "/dm/$userId", params: { userId: person.id } });
                        }}
                        onKnock={() => {
                          void sendKnock(person.id)
                            .then(() => toast.success(`Knocked ${person.name}`))
                            .catch((error: unknown) =>
                              toast.error(
                                error instanceof Error ? error.message : "Couldn't knock",
                              ),
                            );
                        }}
                      />
                    ))}
                    <ShowMore
                      shown={vibing.length > (expanded.vibing ? Infinity : PAGE)}
                      onClick={() => setExpanded((value) => ({ ...value, vibing: true }))}
                    />
                  </Section>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(next) => {
          if (!next) setConfirm(null);
        }}
        title="Leave current call and join?"
        description={
          confirm?.kind === "live"
            ? "You'll leave your current call to watch this live room."
            : confirm?.kind === "voice"
              ? "You'll leave your current call to join this voice channel."
              : "You'll leave your current call to join this watch party."
        }
        confirmLabel="Leave and join"
        onConfirm={async () => {
          const target = confirm;
          if (!target) return;
          afterLeave.current = target;
          setConfirm(null);
          leaveCall();
        }}
      />
    </>
  );
}

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {title}
        {typeof count === "number" && count > 0 ? (
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-normal">
            {count}
          </span>
        ) : null}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ShowMore({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  if (!shown) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 flex min-h-9 w-full items-center justify-center gap-1 rounded-xl text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
    >
      Show more <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

function AvatarStack({ people }: { people: LivePerson[] }) {
  return (
    <span className="flex shrink-0 items-center" aria-hidden="true">
      {people.slice(0, 5).map((person, index) => (
        <UserAvatar
          key={person.id}
          src={person.avatarUrl ?? undefined}
          fallback={person.name}
          size={32}
          presence={person.presence}
          className={index === 0 ? "" : "-ml-2.5 ring-2 ring-background"}
        />
      ))}
    </span>
  );
}

function VibingRow({
  person,
  onMessage,
  onKnock,
}: {
  person: LivePerson;
  onMessage: () => void;
  onKnock: () => void;
}) {
  const statusLine = person.activityLine
    ? person.activityLine
    : person.statusText || person.statusEmoji
      ? person.statusText
        ? `${person.statusEmoji ? `${person.statusEmoji} ` : ""}${person.statusText}`
        : person.statusEmoji
      : null;

  return (
    <div className="lv-row flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
      <UserAvatar
        src={person.avatarUrl ?? undefined}
        fallback={person.name}
        size={40}
        presence={person.presence}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
        {statusLine && (
          <p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
            {person.statusEmoji && !person.activityLine && (
              <StatusEmoji emoji={person.statusEmoji} size={14} />
            )}
            <span className="truncate">{statusLine}</span>
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onMessage}
          aria-label={`Message ${person.name}`}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onKnock}
          aria-label={`Knock ${person.name}`}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <Hand className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function LiveAndVibingLoadingRow() {
  return (
    <div className="flex items-center gap-3">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
