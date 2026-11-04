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
  LayoutGrid,
  Loader2,
  Lock,
  Megaphone,
  Mic,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
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
  { key: "public", label: "Public", Icon: Globe },
  { key: "private", label: "Private", Icon: Lock },
  { key: "owned", label: "Yours", Icon: Crown },
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

const ROLE_META: Record<
  Membership["role"],
  { label: string; Icon: typeof Crown; className: string }
> = {
  owner: {
    label: "Owner",
    Icon: Crown,
    className:
      "border-primary/50 bg-primary text-[#0a0a0b] shadow-[0_4px_14px_rgba(201,255,61,0.28)]",
  },
  mod: {
    label: "Mod",
    Icon: ShieldCheck,
    className: "border-white/25 bg-white/20 text-white",
  },
  member: {
    label: "Member",
    Icon: UserRound,
    className: "border-white/20 bg-black/50 text-white/80",
  },
};

/** Six-digit hex plus an alpha suffix, without breaking any other CSS colour. */
function tint(color: string, alpha: string) {
  const value = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return `${value}${alpha}`;
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}${alpha}`;
  }
  return value;
}

function memberLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "member" : "members"}`;
}

function isFreshRealm(realm: RealmRow) {
  if (!realm.created_at) return false;
  const created = Date.parse(realm.created_at);
  return Number.isFinite(created) && Date.now() - created < 7 * 24 * 60 * 60 * 1000;
}

function RealmJoinAction({
  joining,
  joined,
  onJoin,
}: {
  joining: boolean;
  joined: boolean;
  onJoin: () => void;
}) {
  if (joined) {
    return (
      <span className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-4 text-[12px] font-semibold text-white backdrop-blur-md">
        <ArrowUpRight className="h-3.5 w-3.5" />
        Open
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onJoin}
      disabled={joining}
      className="pointer-events-auto inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-[12px] font-bold text-[#0a0a0b] shadow-[0_10px_22px_-12px_rgba(201,255,61,0.9)] transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-60"
    >
      {joining ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plus className="h-3.5 w-3.5 stroke-[2.6]" />
      )}
      {joining ? "Joining" : "Join"}
    </button>
  );
}

function RealmBannerCard({
  realm,
  official = null,
  role,
  tall = false,
  joined = false,
  showFresh = false,
  action,
}: {
  realm: RealmRow;
  official?: OfficialRealm | null;
  role?: Membership["role"];
  tall?: boolean;
  joined?: boolean;
  showFresh?: boolean;
  action?: ReactNode;
}) {
  const KindIcon = KIND_ICON[realm.kind as keyof typeof KIND_ICON] ?? Hash;
  const accent = official
    ? official.key === "official"
      ? "#e5484d"
      : official.accent
    : realm.accent_color || "#c9ff3d";
  const roleMeta = role ? ROLE_META[role] : null;
  const RoleIcon = roleMeta?.Icon;
  const initial = (realm.name || official?.name || "?").charAt(0).toUpperCase();
  const fresh = showFresh && isFreshRealm(realm);

  return (
    <article
      className={cn(
        "group relative isolate overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#101010] shadow-[0_18px_44px_-28px_rgba(0,0,0,0.95)] transition-[border-color,transform] duration-300 hover:border-white/20",
        tall ? "h-[196px]" : "h-[148px]",
      )}
    >
      <div className="absolute inset-0 overflow-hidden">
        {realm.cover_url ? (
          <img
            src={realm.cover_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="h-full w-full transition-transform duration-700 group-hover:scale-[1.04]"
            style={{
              background: `radial-gradient(135% 150% at 12% 0%, ${tint(accent, "99")} 0%, ${tint(accent, "2e")} 38%, transparent 68%), linear-gradient(145deg, ${tint(accent, "38")} 0%, #111 56%, #070707 100%)`,
            }}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.03)_36%,rgba(0,0,0,0.72)_74%,rgba(0,0,0,0.94)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_100%,rgba(0,0,0,0.62),transparent_60%)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-5 -top-9 select-none font-display text-[8.5rem] font-black leading-none text-white/[0.055]"
      >
        {initial}
      </div>

      <Link
        to="/r/$slug"
        params={{ slug: realm.slug }}
        aria-label={`Open ${realm.name}`}
        className="absolute inset-0 z-10 rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      />

      <div className="pointer-events-none relative z-20 flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                realm.is_public
                  ? "bg-primary shadow-[0_0_8px_rgba(201,255,61,0.85)]"
                  : "bg-amber-300",
              )}
            />
            {realm.is_public ? "Public" : "Private"}
          </span>

          <div className="flex shrink-0 items-center gap-1.5">
            {official ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] shadow-lg"
                style={{
                  backgroundColor: official.accent,
                  color: official.key === "official" ? "#0a0a0b" : "#ffffff",
                }}
              >
                <BadgeCheck className="h-3 w-3" />
                {official.label}
              </span>
            ) : roleMeta && RoleIcon ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] backdrop-blur-md",
                  roleMeta.className,
                )}
              >
                <RoleIcon className="h-3 w-3" />
                {roleMeta.label}
              </span>
            ) : fresh ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-md">
                <Sparkles className="h-3 w-3" />
                New
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[14px] border border-white/20 bg-black/50 shadow-lg backdrop-blur-md"
            style={{
              background: realm.icon_url
                ? undefined
                : `linear-gradient(145deg, ${tint(accent, "66")}, rgba(0,0,0,0.72))`,
            }}
          >
            {realm.icon_url ? (
              <img
                src={realm.icon_url}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-display text-lg font-black text-white">{initial}</span>
            )}
          </div>

          <div className="min-w-0 flex-1 pb-0.5">
            {official && tall ? (
              <p className="mb-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/60">
                <KindIcon className="h-3 w-3" />
                Official realm
              </p>
            ) : null}
            <h3 className="font-display text-[20px] font-black leading-tight tracking-[-0.025em] text-white">
              <span className="line-clamp-1">{official?.name ?? realm.name}</span>
            </h3>
            {official && tall ? (
              <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-white/60">
                {official.blurb}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-white/60">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {memberLabel(realm.member_count)}
              </span>
              {joined && !role ? (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Check className="h-3 w-3" />
                  Joined
                </span>
              ) : null}
            </div>
          </div>

          {action ? <div className="pointer-events-none shrink-0">{action}</div> : null}
        </div>
      </div>
    </article>
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
  const [realmScope, setRealmScope] = useState<MyScope>("public");
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
        return !row.realm.is_public;
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
      <div className="mx-auto w-full max-w-[470px] space-y-5 px-4 pt-3 sm:max-w-2xl sm:px-0">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-3"
        >
          <div className="min-w-0">
            <h1 className="font-display text-[2rem] font-black leading-none tracking-[-0.045em]">
              Realms
            </h1>
            <p className="mt-1.5 text-[13px] font-medium text-muted-foreground">
              Your spaces. Your people.
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
                title="Join by code"
                className="grid h-11 w-11 place-items-center rounded-[14px] border border-white/10 bg-white/[0.045] text-foreground transition-colors hover:border-white/25 hover:bg-white/[0.08] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <KeyRound className="h-[18px] w-[18px]" />
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
                  className="grid h-11 w-11 place-items-center rounded-[14px] bg-primary text-[#0a0a0b] shadow-[0_10px_24px_-12px_rgba(201,255,61,0.8)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="h-5 w-5 stroke-[2.6]" />
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
        </motion.div>

        {/* One pill, two rooms: your joined realms or the public directory. */}
        <div
          role="tablist"
          aria-label="Realms view"
          className="relative grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1"
        >
          {[
            { key: "mine" as const, label: "My realms", Icon: LayoutGrid },
            { key: "discover" as const, label: "Discover", Icon: Compass },
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
                  "relative flex h-11 items-center justify-center rounded-full text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "text-[#0a0a0b]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="realms-tab-thumb"
                    className="absolute inset-0 rounded-full bg-primary shadow-[0_8px_22px_-12px_rgba(201,255,61,0.9)]"
                    transition={{ type: "spring", stiffness: 430, damping: 34 }}
                  />
                ) : null}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <tab.Icon className="h-4 w-4" />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {view === "mine" ? (
          <motion.section
            key="mine"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {MY_SCOPES.map(({ key, label, Icon }) => {
                const active = realmScope === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRealmScope(key)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-white/20 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        active
                          ? "bg-primary/20 text-primary"
                          : "bg-white/[0.07] text-muted-foreground",
                      )}
                    >
                      {scopeCounts[key]}
                    </span>
                  </button>
                );
              })}
            </div>

            {myMemberships.isLoading && (
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="h-[148px] animate-pulse rounded-[24px] border border-white/[0.06] bg-white/[0.035]"
                  />
                ))}
              </div>
            )}

            {myMemberships.isError && !myMemberships.isLoading && (
              <div className="rounded-[24px] border border-destructive/25 bg-destructive/10 p-6 text-center">
                <RefreshCw className="mx-auto h-6 w-6 text-destructive" />
                <h2 className="mt-3 font-display text-base font-bold">Couldn't load your realms</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={() => void myMemberships.refetch()}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold transition-colors hover:bg-white/[0.1]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
              </div>
            )}

            {!myMemberships.isLoading && !myMemberships.isError && myShown.length === 0 && (
              <div className="relative overflow-hidden rounded-[24px] border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  {realmScope === "owned" ? (
                    <Crown className="h-5 w-5" />
                  ) : realmScope === "private" ? (
                    <Lock className="h-5 w-5" />
                  ) : (
                    <Globe className="h-5 w-5" />
                  )}
                </div>
                <h2 className="mt-3 font-display text-base font-bold">
                  {realmScope === "owned"
                    ? "Nothing of your own yet"
                    : realmScope === "private"
                      ? "No private realms yet"
                      : "No public realms yet"}
                </h2>
                <p className="mx-auto mt-1 max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                  {realmScope === "owned"
                    ? "Start a room for your people and it will live right here."
                    : realmScope === "private"
                      ? "Private realms stay invite-only. Make one and share the code."
                      : "Join an official room, browse the directory, or use an invite code."}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setView("discover")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-[#0a0a0b] transition-transform active:scale-95"
                  >
                    <Compass className="h-3.5 w-3.5" />
                    Discover
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-4 text-xs font-semibold transition-colors hover:bg-white/[0.09]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create
                  </button>
                </div>
              </div>
            )}

            {!myMemberships.isError && myShown.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {myShown.map((membership) => (
                  <RealmBannerCard
                    key={membership.realm.id}
                    realm={membership.realm}
                    role={membership.role}
                    action={
                      <span
                        aria-hidden
                        className="grid h-11 w-11 place-items-center rounded-full bg-primary text-[#0a0a0b] shadow-[0_10px_24px_-12px_rgba(201,255,61,0.9)] transition-transform duration-300 group-hover:scale-105"
                      >
                        <ArrowUpRight className="h-5 w-5 stroke-[2.6]" />
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </motion.section>
        ) : (
          <motion.section
            key="discover"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search realms by name, topic or slug"
                aria-label="Search realms"
                maxLength={80}
                className="h-12 rounded-2xl border-white/10 bg-white/[0.045] pl-11 pr-10 text-[13px] placeholder:text-muted-foreground focus-visible:ring-primary/40"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear realm search"
                  className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {DISCOVER_CATEGORIES.map(({ key, label, Icon }) => {
                const active = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary bg-primary text-[#0a0a0b]"
                        : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-white/20 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>

            {realms.isLoading && (
              <div className="space-y-3">
                <div className="h-[196px] animate-pulse rounded-[24px] border border-white/[0.06] bg-white/[0.035]" />
                <div className="h-[148px] animate-pulse rounded-[24px] border border-white/[0.06] bg-white/[0.035]" />
              </div>
            )}

            {realms.isError && !realms.isLoading && (
              <div className="rounded-[24px] border border-destructive/25 bg-destructive/10 p-6 text-center">
                <RefreshCw className="mx-auto h-6 w-6 text-destructive" />
                <h2 className="mt-3 font-display text-base font-bold">
                  Couldn't load the directory
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={() => void realms.refetch()}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold transition-colors hover:bg-white/[0.1]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
              </div>
            )}

            {shownFeatured.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Featured
                  </h2>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {availableCount} available
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {shownFeatured.map(({ official, realm }) => {
                    const joined = myRealmIds.has(realm.id);
                    const joiningThis = quickJoining === realm.id;
                    return (
                      <RealmBannerCard
                        key={realm.id}
                        realm={realm}
                        official={official}
                        tall
                        joined={joined}
                        action={
                          <RealmJoinAction
                            joined={joined}
                            joining={joiningThis}
                            onJoin={() => void handleQuickJoin(realm.id)}
                          />
                        }
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {publicRealms.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    <Compass className="h-3.5 w-3.5" />
                    More to explore
                  </h2>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {publicRealms.length} {publicRealms.length === 1 ? "realm" : "realms"}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {publicRealms.map((realm) => {
                    const joined = myRealmIds.has(realm.id);
                    return (
                      <RealmBannerCard
                        key={realm.id}
                        realm={realm}
                        joined={joined}
                        showFresh={!joined}
                        action={
                          <RealmJoinAction
                            joined={joined}
                            joining={quickJoining === realm.id}
                            onJoin={() => void handleQuickJoin(realm.id)}
                          />
                        }
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {!realms.isLoading && !realms.isError && availableCount === 0 && (
              <div className="relative overflow-hidden rounded-[24px] border border-dashed border-white/10 bg-white/[0.025] p-7 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  {term ? <Search className="h-5 w-5" /> : <Compass className="h-5 w-5" />}
                </div>
                <h2 className="mt-3 font-display text-base font-bold">
                  {term
                    ? `No realms for “${search.trim()}”`
                    : category === "all"
                      ? "You're all caught up"
                      : "Nothing in this lane yet"}
                </h2>
                <p className="mx-auto mt-1 max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                  {term
                    ? "Try a shorter name, a topic, or a different category."
                    : category === "all"
                      ? "No public realms have opened yet. Check back soon or start your own."
                      : "Try another category or show everything again."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (term) setSearch("");
                    else setCategory("all");
                  }}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-[#0a0a0b] transition-transform active:scale-95"
                >
                  {term ? <X className="h-3.5 w-3.5" /> : <Compass className="h-3.5 w-3.5" />}
                  {term ? "Clear search" : "Show all"}
                </button>
              </div>
            )}
          </motion.section>
        )}
      </div>
    </div>
  );
}
