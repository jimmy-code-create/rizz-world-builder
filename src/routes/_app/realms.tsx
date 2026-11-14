import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  createRealmSecure,
  joinRealmPublic,
  previewRealmInvite,
  acceptRealmInvite,
  extractRealmInviteCode,
} from "@/lib/realms";
import { updateRealmDetails } from "@/lib/realms.functions";
import { realmCoverProblem, uploadRealmCover } from "@/lib/realm-cover";
import { OFFICIAL_REALMS, type OfficialRealm } from "@/lib/official-realms";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  Compass,
  Crown,
  Globe,
  Hash,
  ImagePlus,
  KeyRound,
  Loader2,
  Lock,
  Megaphone,
  Mic,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { RealmCoverPicker } from "@/components/realms/RealmCoverPicker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/realms")({
  head: () => ({ meta: [{ title: "Realms · RIZZ" }] }),
  component: RealmsPage,
});

const KIND_ICON = { text: Hash, announcement: Megaphone, voice: Mic };

type RealmRow = {
  id: string;
  slug: string;
  name: string;
  topic: string | null;
  icon_url: string | null;
  cover_url: string | null;
  accent_color: string | null;
  kind: "text" | "announcement" | "voice" | "drops";
  is_public: boolean;
  member_count: number;
  created_at?: string | null;
  owner?: { username: string };
};

type Membership = {
  realm_id: string;
  role: "owner" | "mod" | "member";
  realm: RealmRow | null;
};

const MY_SCOPES = [
  { key: "all", label: "All" },
  { key: "public", label: "Public" },
  { key: "private", label: "Private" },
  { key: "owned", label: "Yours" },
] as const;

type MyScope = (typeof MY_SCOPES)[number]["key"];

const DISCOVER_CATEGORIES = [
  { key: "all", label: "All", Icon: Compass },
  { key: "official", label: "Official", Icon: BadgeCheck },
  { key: "text", label: "Text", Icon: Hash },
  { key: "voice", label: "Voice", Icon: Mic },
  { key: "announcement", label: "News", Icon: Megaphone },
] as const;

type DiscoverCategory = (typeof DISCOVER_CATEGORIES)[number]["key"];

const ROLE_LABEL: Record<Membership["role"], string> = {
  owner: "Owner",
  mod: "Mod",
  member: "Member",
};

const KIND_LABEL: Record<RealmRow["kind"], string> = {
  text: "Text room",
  announcement: "News room",
  voice: "Voice room",
  drops: "Drops room",
};

/** Official realms keep their own cover colour; everything else uses its accent. */
function realmAccent(realm: RealmRow, official?: OfficialRealm | null) {
  if (!official) return realm.accent_color || "#c9ff3d";
  return official.key === "official" ? "#e5484d" : official.accent;
}

function roomCount(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "room" : "rooms"}`;
}

function memberLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "member" : "members"}`;
}

function isFreshRealm(realm: RealmRow) {
  if (!realm.created_at) return false;
  const created = Date.parse(realm.created_at);
  return Number.isFinite(created) && Date.now() - created < 7 * 24 * 60 * 60 * 1000;
}

function RealmArt({
  realm,
  official = null,
  size = "md",
  className,
}: {
  realm: RealmRow;
  official?: OfficialRealm | null;
  size?: "md" | "lg";
  className?: string;
}) {
  const accent = realmAccent(realm, official);
  const initial = (realm.name || official?.name || "?").charAt(0).toUpperCase();
  const image = realm.icon_url ?? realm.cover_url;

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[8px] border border-border",
        className,
      )}
      style={{ backgroundColor: `color-mix(in srgb, ${accent} 22%, #0a0a0b)` }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className={cn(
            "font-display font-extrabold",
            size === "lg" ? "text-[20px]" : "text-[16px]",
          )}
          style={{ color: accent }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}

function MetaDot() {
  return (
    <span aria-hidden className="h-[3px] w-[3px] shrink-0 rounded-full bg-current opacity-50" />
  );
}

function RealmMeta({
  realm,
  official = null,
  role,
  joined = false,
  fresh = false,
  className,
}: {
  realm: RealmRow;
  official?: OfficialRealm | null;
  role?: Membership["role"];
  joined?: boolean;
  fresh?: boolean;
  className?: string;
}) {
  const kind = KIND_LABEL[realm.kind] ?? "Room";
  const hasLead = Boolean(role || official || joined || fresh);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] font-medium leading-4 text-muted-foreground",
        className,
      )}
    >
      {role ? (
        <span className="font-semibold text-primary">{ROLE_LABEL[role]}</span>
      ) : official ? (
        <span className="inline-flex items-center gap-1 font-semibold text-primary">
          <BadgeCheck className="h-3 w-3" />
          {official.label}
        </span>
      ) : joined ? (
        <span className="inline-flex items-center gap-1 font-semibold text-primary">
          <Check className="h-3 w-3" />
          Joined
        </span>
      ) : fresh ? (
        <span className="font-semibold text-primary">New</span>
      ) : null}
      {hasLead ? <MetaDot /> : null}
      {!realm.is_public ? (
        <>
          <span className="inline-flex items-center gap-1">
            <Lock className="h-2.5 w-2.5" />
            Private
          </span>
          <MetaDot />
        </>
      ) : null}
      <span>{kind}</span>
    </div>
  );
}

function JoinButton({
  joining,
  onJoin,
  compact = false,
}: {
  joining: boolean;
  onJoin: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onJoin}
      disabled={joining}
      className={cn(
        "pointer-events-auto relative z-20 inline-flex shrink-0 items-center justify-center gap-1 rounded-[6px] font-bold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact
          ? "h-10 border border-primary/40 px-2.5 text-[11px] text-primary hover:bg-primary/10"
          : "h-11 bg-primary px-4 text-[12px] text-primary-foreground hover:bg-primary/90",
      )}
    >
      {joining ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Plus className="h-3 w-3 stroke-[2.6]" />
      )}
      {joining ? "Joining" : compact ? "Join" : "Join room"}
    </button>
  );
}

function RealmSpotlight({
  realm,
  official = null,
  role,
  joined = false,
  fresh = false,
  joining = false,
  onJoin,
}: {
  realm: RealmRow;
  official?: OfficialRealm | null;
  role?: Membership["role"];
  joined?: boolean;
  fresh?: boolean;
  joining?: boolean;
  onJoin?: () => void;
}) {
  const accent = realmAccent(realm, official);
  const initial = (realm.name || official?.name || "?").charAt(0).toUpperCase();
  const description = official?.blurb ?? realm.topic;

  return (
    <article className="group relative">
      <Link
        to="/r/$slug"
        params={{ slug: realm.slug }}
        aria-label={`Open ${realm.name}`}
        className="absolute inset-0 z-10 rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="relative h-[190px] overflow-hidden rounded-[12px] border border-border bg-secondary transition-colors group-hover:border-white/25 sm:h-[248px]">
        {realm.cover_url ? (
          <img
            src={realm.cover_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `color-mix(in srgb, ${accent} 24%, #0a0a0b)` }}
          >
            <span
              aria-hidden
              className="absolute inset-0 grid place-items-center font-display text-[8rem] font-extrabold leading-none"
              style={{ color: accent, opacity: 0.24 }}
            >
              {initial}
            </span>
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1.5"
              style={{ backgroundColor: accent }}
            />
          </div>
        )}
      </div>

      <div className="pointer-events-none relative z-20 mt-3 flex items-start gap-3">
        <RealmArt realm={realm} official={official} size="lg" className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <RealmMeta realm={realm} official={official} role={role} joined={joined} fresh={fresh} />
          <h3 className="mt-1 truncate font-display text-[24px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[30px]">
            {official?.name ?? realm.name}
          </h3>
          {description ? (
            <p className="mt-1 line-clamp-2 max-w-[46ch] text-[12px] leading-snug text-muted-foreground">
              {description}
            </p>
          ) : null}
          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Users className="h-3 w-3" />
            {memberLabel(realm.member_count)}
          </p>
        </div>
        <div className="shrink-0 pl-1">
          {onJoin && !joined ? (
            <JoinButton joining={joining} onJoin={onJoin} />
          ) : (
            <span
              aria-hidden
              className="grid h-10 w-10 place-items-center rounded-[8px] border border-border text-muted-foreground transition-colors group-hover:border-white/25 group-hover:text-foreground"
            >
              <ArrowUpRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function RealmRow({
  realm,
  official = null,
  role,
  joined = false,
  fresh = false,
  joining = false,
  onJoin,
}: {
  realm: RealmRow;
  official?: OfficialRealm | null;
  role?: Membership["role"];
  joined?: boolean;
  fresh?: boolean;
  joining?: boolean;
  onJoin?: () => void;
}) {
  return (
    <article className="group relative -mx-2 flex items-center gap-3 border-b border-border px-2 py-3 transition-colors hover:bg-white/[0.025]">
      <Link
        to="/r/$slug"
        params={{ slug: realm.slug }}
        aria-label={`Open ${realm.name}`}
        className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <RealmArt realm={realm} official={official} className="h-14 w-14" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-[17px] font-bold leading-tight tracking-[-0.02em]">
          {official?.name ?? realm.name}
        </h3>
        <RealmMeta
          realm={realm}
          official={official}
          role={role}
          joined={joined}
          fresh={fresh}
          className="mt-1"
        />
      </div>
      {onJoin && !joined ? (
        <JoinButton joining={joining} onJoin={onJoin} compact />
      ) : (
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
      )}
    </article>
  );
}

function SectionHeading({ title, count, note }: { title: string; count?: number; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[15px] font-bold tracking-[-0.01em]">{title}</h2>
      {note ? (
        <span className="text-[10.5px] font-medium text-muted-foreground">{note}</span>
      ) : count !== undefined ? (
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{count}</span>
      ) : null}
    </div>
  );
}

function RealmsEmpty({
  Icon,
  title,
  body,
  children,
}: {
  Icon: typeof Compass;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-y border-border py-8">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-border text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-[20px] font-bold tracking-[-0.02em]">{title}</h2>
          <p className="mt-1.5 max-w-[36ch] text-[12.5px] leading-relaxed text-muted-foreground">
            {body}
          </p>
          {children ? <div className="mt-4 flex flex-wrap gap-2">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

function EmptyButton({
  children,
  onClick,
  variant = "quiet",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "quiet" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-[6px] px-3.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border text-foreground hover:border-white/30",
      )}
    >
      {children}
    </button>
  );
}

function RealmsSkeleton() {
  return (
    <div className="mt-4 animate-pulse" aria-hidden>
      <div className="h-[190px] rounded-[12px] border border-border bg-white/[0.04] sm:h-[248px]" />
      <div className="mt-3 flex gap-3">
        <div className="h-12 w-12 rounded-[8px] border border-border bg-white/[0.04]" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-2.5 w-24 rounded-full bg-white/[0.06]" />
          <div className="h-5 w-40 rounded-[4px] bg-white/[0.06]" />
          <div className="h-2.5 w-28 rounded-full bg-white/[0.04]" />
        </div>
      </div>
      <div className="mt-7 border-t border-border">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-3 border-b border-border py-3">
            <div className="h-14 w-14 rounded-[8px] bg-white/[0.04]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 rounded-[4px] bg-white/[0.06]" />
              <div className="h-2.5 w-24 rounded-full bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RealmsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState<"text" | "announcement" | "voice">("text");
  const [accent, setAccent] = useState("#c9ff3d");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewRealmInvite>> | null>(
    null,
  );

  const [view, setView] = useState<"mine" | "discover">("mine");
  const [realmScope, setRealmScope] = useState<MyScope>("all");
  const [category, setCategory] = useState<DiscoverCategory>("all");
  const [search, setSearch] = useState("");
  const [quickJoining, setQuickJoining] = useState<string | null>(null);

  const realms = useQuery({
    queryKey: ["realms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("realms")
        // `*` keeps the list readable on a database that has not run the cover
        // migration yet: the column is simply absent, not a broken query.
        .select("*, owner:profiles!realms_owner_id_fkey(username)")
        .order("member_count", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as RealmRow[];
    },
  });

  const myMemberships = useQuery({
    queryKey: ["my-realms", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("realm_members")
        .select("realm_id, role, realm:realms!realm_members_realm_id_fkey(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const myRealmIds = useMemo(
    () => new Set((myMemberships.data ?? []).map((membership) => membership.realm_id)),
    [myMemberships.data],
  );

  const myRows = useMemo(
    () =>
      (myMemberships.data ?? []).filter(
        (row): row is Membership & { realm: RealmRow } => !!row.realm,
      ),
    [myMemberships.data],
  );
  const scopeCounts = useMemo(
    () => ({
      all: myRows.length,
      public: myRows.filter((row) => row.realm.is_public).length,
      private: myRows.filter((row) => !row.realm.is_public).length,
      owned: myRows.filter((row) => row.role === "owner").length,
    }),
    [myRows],
  );
  const myShown = useMemo(() => {
    const rank: Record<Membership["role"], number> = { owner: 0, mod: 1, member: 2 };
    return myRows
      .filter((row) => {
        if (realmScope === "owned") return row.role === "owner";
        if (realmScope === "public") return row.realm.is_public;
        if (realmScope === "private") return !row.realm.is_public;
        return true;
      })
      .sort(
        (a, b) =>
          rank[a.role] - rank[b.role] ||
          b.realm.member_count - a.realm.member_count ||
          a.realm.name.localeCompare(b.realm.name),
      );
  }, [myRows, realmScope]);

  const term = search.trim().toLowerCase();
  const matchesSearch = (realm: RealmRow) =>
    !term || `${realm.name} ${realm.topic ?? ""} ${realm.slug}`.toLowerCase().includes(term);

  // The two RIZZ-run realms are matched from the same rows everyone else is,
  // then lifted into their own strip. Matching by name too means a row created
  // by hand before the slug rule still gets featured.
  const featured = useMemo(
    () =>
      OFFICIAL_REALMS.map((official) => ({
        official,
        realm:
          (realms.data ?? []).find(
            (realm) => realm.is_public !== false && official.matches(realm),
          ) ?? null,
      })).filter((entry): entry is { official: OfficialRealm; realm: RealmRow } => !!entry.realm),
    [realms.data],
  );
  const featuredIds = new Set(featured.map((entry) => entry.realm.id));
  const shownFeatured = featured.filter(
    (entry) => matchesSearch(entry.realm) && (category === "all" || category === "official"),
  );

  const publicRealms = (realms.data ?? []).filter((realm) => {
    if (!realm.is_public || featuredIds.has(realm.id)) return false;
    if (!matchesSearch(realm)) return false;
    if (category === "official") return false;
    if (category === "text") return realm.kind === "text" || realm.kind === "drops";
    if (category !== "all" && realm.kind !== category) return false;
    return true;
  });
  const availableCount = shownFeatured.length + publicRealms.length;

  // One room carries the page: your top room when you're home, or the first
  // RIZZ-run room in the directory. Everything else becomes a ruled row, so
  // the page has hierarchy instead of a stack of identical cards.
  const mineLead = myShown[0];
  const mineRest = myShown.slice(1);
  const discoverLead = shownFeatured[0] ?? null;
  const discoverRows: { realm: RealmRow; official: OfficialRealm | null }[] = [
    ...(discoverLead ? shownFeatured.slice(1) : []),
    ...publicRealms.map((realm) => ({ realm, official: null })),
  ];
  const roomsNote = myMemberships.isLoading
    ? "Loading your rooms"
    : myMemberships.isError
      ? "Couldn't load your rooms"
      : myRows.length === 0
        ? "No rooms yet"
        : `${roomCount(myRows.length)}${scopeCounts.owned ? `, ${scopeCounts.owned} owned` : ""}`;
  const directoryNote = realms.isLoading
    ? "Loading the directory"
    : realms.isError
      ? "Couldn't load the directory"
      : `${availableCount} public ${availableCount === 1 ? "room" : "rooms"}`;

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    if (
      iconFile &&
      (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(iconFile.type) ||
        iconFile.size > 5 * 1024 * 1024)
    ) {
      toast.error("Choose a PNG, JPG, WebP, or GIF under 5 MB");
      return;
    }
    const coverProblem = realmCoverProblem(coverFile);
    if (coverProblem) {
      toast.error(coverProblem);
      return;
    }
    setCreating(true);
    try {
      const realm = await createRealmSecure({
        name: name.trim(),
        topic: topic.trim() || undefined,
        kind,
        accent_color: accent,
        is_public: isPublic,
      });

      let iconUrl: string | null = null;
      if (iconFile) {
        const extension = (
          {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/webp": "webp",
            "image/gif": "gif",
          } as const
        )[iconFile.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif"];
        const path = `${user.id}/realm-icons/${realm.id}.${extension}`;
        try {
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(path, iconFile, {
              contentType: iconFile.type,
              upsert: true,
            });
          if (uploadError) throw uploadError;
          iconUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        } catch (iconError) {
          toast.error(
            `Realm created, but its icon couldn't be saved: ${iconError instanceof Error ? iconError.message : "upload failed"}`,
          );
        }
      }

      let coverUrl: string | null = null;
      if (coverFile) {
        try {
          coverUrl = await uploadRealmCover(coverFile, user.id, realm.id);
        } catch (coverError) {
          toast.error(
            `Realm created, but its cover couldn't be saved: ${coverError instanceof Error ? coverError.message : "upload failed"}`,
          );
        }
      }

      if (iconUrl || coverUrl) {
        try {
          await updateRealmDetails({
            realmId: realm.id,
            name: name.trim(),
            description: topic.trim() || null,
            iconUrl: iconUrl ?? undefined,
            coverUrl: coverUrl ?? undefined,
          });
        } catch (detailsError) {
          toast.error(
            `Realm created, but its look couldn't be saved: ${detailsError instanceof Error ? detailsError.message : "update failed"}`,
          );
        }
      }

      toast.success("Realm created");
      qc.invalidateQueries({ queryKey: ["realms"] });
      qc.invalidateQueries({ queryKey: ["my-realms", user.id] });
      setCreateOpen(false);
      setName("");
      setTopic("");
      setIconFile(null);
      setCoverFile(null);
      if (iconPreview) URL.revokeObjectURL(iconPreview);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setIconPreview(null);
      setCoverPreview(null);
      nav({ to: "/r/$slug", params: { slug: realm.slug } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the realm");
    } finally {
      setCreating(false);
    }
  };

  const runPreview = async (raw: string) => {
    const cleaned = extractRealmInviteCode(raw).slice(0, 32);
    setCode(raw);
    if (!cleaned) {
      setPreview(null);
      return;
    }
    try {
      setPreview(await previewRealmInvite(cleaned));
    } catch {
      setPreview(null);
    }
  };

  const handleAcceptInvite = async () => {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    if (!code.trim()) return;
    setJoining(true);
    try {
      const cleaned = extractRealmInviteCode(code);
      if (!cleaned) throw new Error("Paste a valid invite code or link.");
      const realmId = await acceptRealmInvite(cleaned);
      qc.invalidateQueries({ queryKey: ["my-realms", user.id] });
      qc.invalidateQueries({ queryKey: ["realms"] });
      toast.success("Realm joined!");
      setJoinOpen(false);
      setCode("");
      setPreview(null);
      const { data } = await supabase.from("realms").select("slug").eq("id", realmId).maybeSingle();
      if (data?.slug) nav({ to: "/r/$slug", params: { slug: data.slug } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't join with that code");
    } finally {
      setJoining(false);
    }
  };

  const handleQuickJoin = async (realmId: string) => {
    if (!user) {
      toast.error("Sign in to join a realm");
      return;
    }
    setQuickJoining(realmId);
    try {
      await joinRealmPublic(realmId);
      qc.invalidateQueries({ queryKey: ["my-realms", user.id] });
      qc.invalidateQueries({ queryKey: ["realms"] });
      toast.success("Joined!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't join this realm");
    } finally {
      setQuickJoining(null);
    }
  };

  const handlePickRealmIcon = (file?: File) => {
    if (iconPreview) URL.revokeObjectURL(iconPreview);
    if (!file) {
      setIconFile(null);
      setIconPreview(null);
      return;
    }
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  return (
    <div className="-mx-3 -mt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:mx-0 sm:mt-0">
      <div className="mx-auto w-full max-w-[520px] px-4 pt-5 sm:max-w-2xl sm:px-0 sm:pt-1">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 pb-0.5">
            <h1 className="font-display text-[2.5rem] font-extrabold leading-[0.92] tracking-[-0.05em] sm:text-[3rem]">
              Realms
            </h1>
            <p className="mt-2 text-[12px] font-medium text-muted-foreground">
              {view === "mine" ? roomsNote : directoryNote}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Dialog
              open={joinOpen}
              onOpenChange={(next) => {
                setJoinOpen(next);
                if (!next) {
                  setCode("");
                  setPreview(null);
                }
              }}
            >
              <button
                type="button"
                onClick={() => setJoinOpen(true)}
                aria-label="Join a realm with an invite code"
                title="Join with a code"
                className="inline-flex h-11 items-center gap-1.5 rounded-[14px] border border-white/10 bg-surface-1 px-3.5 text-[12px] font-semibold text-foreground transition-[background-color,border-color,transform] duration-150 hover:border-white/25 hover:bg-surface-2 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Code
              </button>
              <DialogContent className="rounded-[28px] border-white/10 bg-[#0d0d0d] p-5 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="font-display">Join a realm</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Invite code or link"
                    value={code}
                    onChange={(e) => {
                      void runPreview(e.target.value);
                    }}
                    maxLength={200}
                    className="h-12 rounded-2xl border-white/10 bg-white/[0.045]"
                    autoFocus
                  />
                  {preview && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
                      {preview.status === "valid" && (
                        <p className="font-medium">
                          ✨ {preview.realm_name} —{" "}
                          <span className="text-muted-foreground">
                            {preview.topic || "no topic"}
                          </span>{" "}
                          · {preview.member_count} members
                        </p>
                      )}
                      {preview.status === "already_member" && (
                        <p className="text-cyan-200">
                          You're already a member of {preview.realm_name}.
                        </p>
                      )}
                      {preview.status === "expired" && (
                        <p className="text-rose-300">That invite has expired.</p>
                      )}
                      {preview.status === "limit_reached" && (
                        <p className="text-rose-300">That invite ran out of uses.</p>
                      )}
                      {preview.status === "banned" && (
                        <p className="text-rose-300">You are banned from that realm.</p>
                      )}
                      {preview.status === "invalid" && (
                        <p className="text-rose-300">That code isn't valid.</p>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={handleAcceptInvite}
                    disabled={joining || !code.trim() || preview?.status === "banned"}
                    className="h-11 w-full rounded-2xl border-0 bg-primary font-bold text-[#0a0a0b] shadow-md"
                  >
                    {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join realm"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Create a new realm"
                  title="New realm"
                  className="inline-flex h-11 items-center gap-1.5 rounded-[14px] bg-primary px-3.5 text-[12px] font-bold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[2.8]" />
                  New
                </button>
              </DialogTrigger>
              <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[28px] border-white/10 bg-[#0d0d0d] p-5 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="font-display">Create a realm</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-3">
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.06] p-3 transition-colors hover:bg-primary/[0.1]">
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/10">
                      {iconPreview ? (
                        <img
                          src={iconPreview}
                          alt="Realm icon preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImagePlus className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">Realm icon</span>
                      <span className="block text-xs text-muted-foreground">
                        GIF, PNG, JPG, or WebP · up to 5 MB
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      aria-label="Upload realm icon"
                      className="sr-only"
                      onChange={(event) => handlePickRealmIcon(event.target.files?.[0])}
                    />
                  </label>

                  <RealmCoverPicker
                    file={coverFile}
                    preview={coverPreview}
                    existingUrl={null}
                    remove={false}
                    onPick={(picked) => {
                      const problem = realmCoverProblem(picked);
                      if (problem) {
                        toast.error(problem);
                        return;
                      }
                      if (coverPreview) URL.revokeObjectURL(coverPreview);
                      setCoverFile(picked);
                      setCoverPreview(URL.createObjectURL(picked));
                    }}
                    onRemove={() => {
                      if (coverPreview) URL.revokeObjectURL(coverPreview);
                      setCoverFile(null);
                      setCoverPreview(null);
                    }}
                  />

                  <Input
                    placeholder="Realm name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={30}
                    className="h-12 rounded-2xl border-white/10 bg-white/[0.045]"
                  />
                  <Textarea
                    placeholder="Description — what is this realm about? (optional)"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    maxLength={160}
                    className="min-h-20 rounded-2xl border-white/10 bg-white/[0.045]"
                  />
                  <div className="flex gap-2">
                    {(["text", "announcement", "voice"] as const).map((k) => {
                      const Icon = KIND_ICON[k];
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setKind(k)}
                          className={`flex-1 rounded-2xl border p-3 transition-all min-h-11 ${
                            kind === k
                              ? "border-primary bg-primary/10"
                              : "border-white/10 bg-white/[0.035]"
                          }`}
                        >
                          <Icon className="h-4 w-4 mx-auto mb-1" />
                          <span className="text-xs capitalize">{k}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPublic(true)}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-2xl border p-3 transition-all min-h-11 ${
                        isPublic
                          ? "border-primary bg-primary/10"
                          : "border-white/10 bg-white/[0.035]"
                      }`}
                    >
                      <Globe className="h-4 w-4" />
                      <span className="text-xs">Public</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPublic(false)}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-2xl border p-3 transition-all min-h-11 ${
                        !isPublic
                          ? "border-primary bg-primary/10"
                          : "border-white/10 bg-white/[0.035]"
                      }`}
                    >
                      <Lock className="h-4 w-4" />
                      <span className="text-xs">Private (invite-only)</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted-foreground">Accent</label>
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      className="h-11 w-14 rounded-md bg-transparent border border-white/10"
                    />
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !name.trim()}
                    className="h-11 w-full rounded-2xl border-0 bg-primary font-bold text-[#0a0a0b] shadow-md"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create realm"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs are an index, not another pill: a rule with a lime selected mark. */}
        <div
          role="tablist"
          aria-label="Realms view"
          className="mt-6 flex items-center gap-1 rounded-full border border-white/[0.07] bg-surface-1 p-1"
        >
          {[
            { key: "mine" as const, label: "My rooms" },
            { key: "discover" as const, label: "Discover" },
          ].map((tab) => {
            const active = view === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(tab.key)}
                className={cn(
                  "relative inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-surface-3 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.key === "mine" && !myMemberships.isLoading ? (
                  <span className="text-[10.5px] font-medium tabular-nums text-muted-foreground">
                    {myRows.length}
                  </span>
                ) : null}

              </button>
            );
          })}
        </div>

        {view === "mine" ? (
          <section aria-label="Your rooms">
            <h2 className="sr-only">Your rooms</h2>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {MY_SCOPES.map(({ key, label }) => {
                const active = realmScope === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRealmScope(key)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[12px] font-semibold transition-colors duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-white/10 bg-surface-1 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                    <span className="text-[10px] font-medium tabular-nums opacity-70">
                      {scopeCounts[key]}
                    </span>
                  </button>
                );
              })}
            </div>

            {myMemberships.isLoading ? <RealmsSkeleton /> : null}

            {!myMemberships.isLoading && myMemberships.isError ? (
              <div className="mt-5">
                <RealmsEmpty
                  Icon={RefreshCw}
                  title="Couldn't load your rooms"
                  body="Check your connection and try again."
                >
                  <EmptyButton onClick={() => void myMemberships.refetch()}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try again
                  </EmptyButton>
                </RealmsEmpty>
              </div>
            ) : null}

            {!myMemberships.isLoading && !myMemberships.isError && myShown.length === 0 ? (
              <div className="mt-5">
                <RealmsEmpty
                  Icon={realmScope === "owned" ? Crown : realmScope === "private" ? Lock : Globe}
                  title={
                    realmScope === "owned"
                      ? "You don't own a room yet"
                      : realmScope === "private"
                        ? "No private rooms yet"
                        : realmScope === "public"
                          ? "No public rooms yet"
                          : "Find your first room"
                  }
                  body={
                    realmScope === "owned"
                      ? "Start a room for your people and it will live here."
                      : realmScope === "private"
                        ? "Invite-only rooms you join will show up here."
                        : realmScope === "public"
                          ? "Rooms you join that anyone can find will show up here."
                          : "Browse public rooms, use an invite code, or start one of your own."
                  }
                >
                  {realmScope !== "owned" ? (
                    <EmptyButton variant="primary" onClick={() => setView("discover")}>
                      <Compass className="h-3.5 w-3.5" />
                      {realmScope === "all" ? "Browse rooms" : "Find a room"}
                    </EmptyButton>
                  ) : null}
                  <EmptyButton onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    New room
                  </EmptyButton>
                </RealmsEmpty>
              </div>
            ) : null}

            {!myMemberships.isLoading && !myMemberships.isError && mineLead ? (
              <>
                <div className="mt-4">
                  <RealmSpotlight realm={mineLead.realm} role={mineLead.role} />
                </div>
                {mineRest.length > 0 ? (
                  <section className="mt-7">
                    <SectionHeading title="Also yours" count={mineRest.length} />
                    <div className="mt-2 border-t border-border">
                      {mineRest.map((membership) => (
                        <RealmRow
                          key={membership.realm.id}
                          realm={membership.realm}
                          role={membership.role}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </section>
        ) : (
          <section aria-label="Discover rooms">
            <div className="relative mt-4 border-b border-border transition-colors focus-within:border-primary">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search rooms"
                aria-label="Search rooms"
                maxLength={80}
                className="h-11 rounded-none border-0 bg-transparent pl-7 pr-9 text-[13.5px] shadow-none placeholder:text-muted-foreground focus-visible:ring-0 md:text-[13.5px]"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear room search"
                  className="absolute right-0 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-[4px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {DISCOVER_CATEGORIES.map(({ key, label }) => {
                const active = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex min-h-8 shrink-0 items-center rounded-full border px-3 text-[12px] font-semibold transition-colors duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-white/10 bg-surface-1 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {realms.isLoading ? <RealmsSkeleton /> : null}

            {!realms.isLoading && realms.isError ? (
              <div className="mt-5">
                <RealmsEmpty
                  Icon={RefreshCw}
                  title="Couldn't load the directory"
                  body="Check your connection and try again."
                >
                  <EmptyButton onClick={() => void realms.refetch()}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try again
                  </EmptyButton>
                </RealmsEmpty>
              </div>
            ) : null}

            {!realms.isLoading && !realms.isError && availableCount === 0 ? (
              <div className="mt-5">
                <RealmsEmpty
                  Icon={term ? Search : Compass}
                  title={
                    term
                      ? `No rooms for “${search.trim()}”`
                      : category === "all"
                        ? "No public rooms yet"
                        : "Nothing in that category yet"
                  }
                  body={
                    term
                      ? "Try a shorter name, a topic, or a different category."
                      : category === "all"
                        ? "When someone opens a room to everyone, it shows up here."
                        : "Try another category or look through every room."
                  }
                >
                  <EmptyButton
                    variant="primary"
                    onClick={() => {
                      if (term) setSearch("");
                      else setCategory("all");
                    }}
                  >
                    {term ? <X className="h-3.5 w-3.5" /> : <Compass className="h-3.5 w-3.5" />}
                    {term ? "Clear search" : "Show all rooms"}
                  </EmptyButton>
                  {!term && category === "all" ? (
                    <EmptyButton onClick={() => setCreateOpen(true)}>
                      <Plus className="h-3.5 w-3.5" />
                      New room
                    </EmptyButton>
                  ) : null}
                </RealmsEmpty>
              </div>
            ) : null}

            {!realms.isLoading && !realms.isError && availableCount > 0 ? (
              <>
                {discoverLead ? (
                  <section className="mt-6">
                    <SectionHeading title="Spotlight" note="Rizz-run rooms" />
                    <div className="mt-3">
                      <RealmSpotlight
                        realm={discoverLead.realm}
                        official={discoverLead.official}
                        joined={myRealmIds.has(discoverLead.realm.id)}
                        fresh={
                          !myRealmIds.has(discoverLead.realm.id) && isFreshRealm(discoverLead.realm)
                        }
                        joining={quickJoining === discoverLead.realm.id}
                        onJoin={() => void handleQuickJoin(discoverLead.realm.id)}
                      />
                    </div>
                  </section>
                ) : null}

                {discoverRows.length > 0 ? (
                  <section className={discoverLead ? "mt-7" : "mt-5"}>
                    <SectionHeading title="Open rooms" count={discoverRows.length} />
                    <div className="mt-2 border-t border-border">
                      {discoverRows.map(({ realm, official }) => {
                        const joined = myRealmIds.has(realm.id);
                        return (
                          <RealmRow
                            key={realm.id}
                            realm={realm}
                            official={official}
                            joined={joined}
                            fresh={!official && !joined && isFreshRealm(realm)}
                            joining={quickJoining === realm.id}
                            onJoin={() => void handleQuickJoin(realm.id)}
                          />
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
