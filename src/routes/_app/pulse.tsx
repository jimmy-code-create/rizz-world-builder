import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Bell, ChevronRight, Hash, MessageCircle, Mic, Radio, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatRelativeTime, useI18n } from "@/lib/i18n";
import { useUnreadCounts } from "@/lib/use-unread-counts";
import { UserAvatar } from "@/components/ui/avatar";

export const Route = createFileRoute("/_app/pulse")({
  head: () => ({ meta: [{ title: "What's happening · RIZZ" }] }),
  component: PulsePage,
});

type RealmRef = {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
  accent_color: string | null;
  member_count: number | null;
};

type LivePerson = {
  room_id: string;
  user: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

type LiveRoom = {
  id: string;
  title: string | null;
  realm_id: string;
  realm_room_id: string | null;
  started_at: string;
  host: { username: string; display_name: string | null; avatar_url: string | null } | null;
  participants: LivePerson[];
};

/**
 * What's happening — the "continue / join" view.
 *
 * Everything here comes from data the app already reads elsewhere: unread
 * counts (same React Query keys as the shell), live voice rooms across the
 * realms you belong to, and the realms themselves as one-tap open targets.
 * Music and game sessions are ephemeral per-room state over realtime, so they
 * are not enumerable from a global page without a backend change: the voice
 * rooms are the durable "live" signal.
 */
function PulsePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const counts = useUnreadCounts();

  const myRealms = useQuery({
    queryKey: ["my-realms", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<RealmRef[]> => {
      const { data, error } = await supabase
        .from("realm_members")
        .select(
          "realm_id, realm:realms!realm_members_realm_id_fkey(id,slug,name,icon_url,accent_color,member_count)",
        )
        .eq("user_id", user!.id);
      if (error) throw error;
      return ((data ?? []) as Array<{ realm: RealmRef | null }>)
        .map((row) => row.realm)
        .filter((realm): realm is RealmRef => !!realm);
    },
  });

  const realmIds = (myRealms.data ?? []).map((realm) => realm.id);
  const realmKey = realmIds.slice().sort().join(",");

  const liveRooms = useQuery({
    queryKey: ["pulse-live-rooms", realmKey],
    enabled: realmIds.length > 0,
    refetchInterval: 30_000,
    queryFn: async (): Promise<LiveRoom[]> => {
      const { data, error } = await supabase
        .from("voice_rooms")
        .select(
          "id,title,realm_id,realm_room_id,started_at,host:profiles!voice_rooms_host_id_fkey(username,display_name,avatar_url)",
        )
        .in("realm_id", realmIds)
        .eq("is_live", true)
        .order("started_at", { ascending: false });
      if (error) throw error;
      const rooms = (data ?? []) as Array<Omit<LiveRoom, "participants">>;
      if (rooms.length === 0) return [];
      const { data: people, error: peopleError } = await supabase
        .from("voice_participants")
        .select(
          "room_id, user:profiles!voice_participants_user_id_fkey(username,display_name,avatar_url)",
        )
        .in(
          "room_id",
          rooms.map((room) => room.id),
        );
      if (peopleError) throw peopleError;
      const byRoom = (people ?? []) as LivePerson[];
      return rooms.map((room) => ({
        ...room,
        participants: byRoom.filter((person) => person.room_id === room.id),
      }));
    },
  });

  const realmById = new Map((myRealms.data ?? []).map((realm) => [realm.id, realm]));
  const realms = myRealms.data ?? [];
  const rooms = liveRooms.data ?? [];
  const nothingUnread = counts.messages === 0 && counts.notifications === 0;

  return (
    <div>
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-display text-xl sm:text-2xl font-bold tracking-tight mb-0.5 text-foreground"
      >
        {t("whats_happening")}
      </motion.h1>
      <p className="text-xs text-muted-foreground mb-4">{t("pulse_subtitle")}</p>

      {/* Catch up */}
      <section className="mb-5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("catch_up")}
        </h2>
        {!counts.loaded ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="h-20 animate-pulse rounded-2xl bg-surface-2" />
            <div className="h-20 animate-pulse rounded-2xl bg-surface-2" />
          </div>
        ) : nothingUnread ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {t("caught_up")}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {counts.messages > 0 && (
              <CatchUpCard
                to="/dms"
                icon={MessageCircle}
                count={counts.messages}
                label={t("unread_messages")}
                cta={t("messages")}
              />
            )}
            {counts.notifications > 0 && (
              <CatchUpCard
                to="/notifications"
                icon={Bell}
                count={counts.notifications}
                label={t("unread_notifications")}
                cta={t("inbox")}
              />
            )}
          </div>
        )}
      </section>

      {/* Live now */}
      <section className="mb-5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("live_now")}
        </h2>
        {liveRooms.isLoading ? (
          <div className="space-y-2">
            <div className="h-16 animate-pulse rounded-2xl bg-surface-2" />
            <div className="h-16 animate-pulse rounded-2xl bg-surface-2" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <Radio className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("no_live_rooms")}</p>
            <Link
              to="/realms"
              className="mt-3 inline-flex min-h-[36px] items-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("realms")}
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {rooms.map((room) => {
              const realm = realmById.get(room.realm_id);
              if (!realm) return null;
              const detail = [realm.name, room.host ? `@${room.host.username}` : null]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={room.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <RealmBadge realm={realm} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {room.title || realm.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {detail}
                      {room.started_at ? ` · ${formatRelativeTime(room.started_at)}` : ""}
                    </p>
                  </div>
                  {room.participants.length > 0 && (
                    <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                      <span className="flex -space-x-2">
                        {room.participants.slice(0, 3).map((person, index) => (
                          <UserAvatar
                            key={`${room.id}-${person.user?.username ?? index}`}
                            src={person.user?.avatar_url}
                            fallback={(person.user?.display_name || person.user?.username || "?")
                              .charAt(0)
                              .toUpperCase()}
                            size="xs"
                            className="ring-2 ring-card"
                          />
                        ))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {room.participants.length}
                      </span>
                    </div>
                  )}
                  <Link
                    to="/r/$slug"
                    params={{ slug: realm.slug }}
                    search={room.realm_room_id ? { room: room.realm_room_id } : {}}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Mic className="h-3.5 w-3.5" /> {t("join")}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Your realms */}
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("your_realms")}
        </h2>
        {myRealms.isLoading ? (
          <div className="space-y-2">
            <div className="h-14 animate-pulse rounded-2xl bg-surface-2" />
            <div className="h-14 animate-pulse rounded-2xl bg-surface-2" />
          </div>
        ) : realms.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t("public_realms_desc")}</p>
            <Link
              to="/realms"
              className="mt-3 inline-flex min-h-[36px] items-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("discover_realms")}
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {realms.slice(0, 5).map((realm) => (
              <div
                key={realm.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <RealmBadge realm={realm} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{realm.name}</p>
                  {typeof realm.member_count === "number" && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> {realm.member_count}
                    </p>
                  )}
                </div>
                <Link
                  to="/r/$slug"
                  params={{ slug: realm.slug }}
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full border border-border px-3.5 text-xs font-bold text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("open")} <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CatchUpCard({
  to,
  icon: Icon,
  count,
  label,
  cta,
}: {
  to: "/dms" | "/notifications";
  icon: LucideIcon;
  count: number;
  label: string;
  cta: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-bold text-foreground">{count}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
      <span className="shrink-0 text-xs font-bold text-primary">{cta}</span>
    </Link>
  );
}

function RealmBadge({ realm }: { realm: RealmRef }) {
  return realm.icon_url ? (
    <img
      src={realm.icon_url}
      alt=""
      loading="lazy"
      className="h-10 w-10 shrink-0 rounded-xl border border-border object-cover"
    />
  ) : (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-2 text-muted-foreground"
      style={realm.accent_color ? { color: realm.accent_color } : undefined}
    >
      <Hash className="h-5 w-5" />
    </span>
  );
}
