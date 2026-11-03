import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
  BadgeCheck,
  Hash,
  Megaphone,
  Mic,
  Users,
  Plus,
  Loader2,
  Globe,
  Lock,
  KeyRound,
  ImagePlus,
  Search,
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
  owner?: { username: string };
};

type Membership = {
  realm_id: string;
  role: "owner" | "mod" | "member";
  realm: RealmRow | null;
};

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
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewRealmInvite>> | null>(null);

  const [realmScope, setRealmScope] = useState<"public" | "private">("public");
  const [search, setSearch] = useState("");

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
    () => (myMemberships.data ?? []).filter((row): row is Membership & { realm: RealmRow } => !!row.realm),
    [myMemberships.data],
  );
  const scopeCounts = useMemo(
    () => ({
      public: myRows.filter((row) => row.realm.is_public).length,
      private: myRows.filter((row) => !row.realm.is_public).length,
    }),
    [myRows],
  );
  const myShown = myRows.filter((row) => row.realm.is_public === (realmScope === "public"));

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
        realm: (realms.data ?? []).find((realm) => realm.is_public !== false && official.matches(realm)) ?? null,
      })).filter((entry): entry is { official: OfficialRealm; realm: RealmRow } => !!entry.realm),
    [realms.data],
  );
  const featuredIds = new Set(featured.map((entry) => entry.realm.id));
  const shownFeatured = featured.filter((entry) => matchesSearch(entry.realm));

  const publicRealms = (realms.data ?? []).filter(
    (realm) => realm.is_public !== false && !myRealmIds.has(realm.id) && !featuredIds.has(realm.id) && matchesSearch(realm),
  );

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
          { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" } as const
        )[iconFile.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif"];
        const path = `${user.id}/realm-icons/${realm.id}.${extension}`;
        try {
          const { error: uploadError } = await supabase.storage.from("avatars").upload(path, iconFile, {
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
    try {
      await joinRealmPublic(realmId);
      qc.invalidateQueries({ queryKey: ["my-realms", user.id] });
      qc.invalidateQueries({ queryKey: ["realms"] });
      toast.success("Joined!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't join this realm");
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
    <div
      className="space-y-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
      style={{ paddingTop: "max(0.25rem, env(safe-area-inset-top, 0px))" }}
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight">Realms</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Public and private spaces — join the official rooms or start your own.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
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
            <Button
              variant="outline"
              size="sm"
              className="glass h-9 border-white/10 text-xs"
              onClick={() => setJoinOpen(true)}
            >
              <KeyRound className="h-3.5 w-3.5 mr-1.5" />
              Join by code
            </Button>
            <DialogContent className="glass-strong border-white/10">
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
                  className="glass border-white/10"
                  autoFocus
                />
                {preview && (
                  <div className="rounded-xl border border-white/10 glass p-3 text-sm">
                    {preview.status === "valid" && (
                      <p className="font-medium">
                        ✨ {preview.realm_name} —{" "}
                        <span className="text-muted-foreground">{preview.topic || "no topic"}</span> ·{" "}
                        {preview.member_count} members
                      </p>
                    )}
                    {preview.status === "already_member" && (
                      <p className="text-cyan-200">You're already a member of {preview.realm_name}.</p>
                    )}
                    {preview.status === "expired" && <p className="text-rose-300">That invite has expired.</p>}
                    {preview.status === "limit_reached" && (
                      <p className="text-rose-300">That invite ran out of uses.</p>
                    )}
                    {preview.status === "banned" && <p className="text-rose-300">You are banned from that realm.</p>}
                    {preview.status === "invalid" && <p className="text-rose-300">That code isn't valid.</p>}
                  </div>
                )}
                <Button
                  onClick={handleAcceptInvite}
                  disabled={joining || !code.trim() || preview?.status === "banned"}
                  className="w-full bg-primary text-primary-foreground border-0 shadow-md"
                >
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join realm"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 text-xs bg-primary text-primary-foreground border-0 shadow-md">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New realm
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong max-h-[90dvh] overflow-y-auto border-sky-300/20 shadow-[0_0_48px_rgba(59,130,246,0.14)]">
              <DialogHeader>
                <DialogTitle className="font-display">Create a realm</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-sky-300/30 bg-sky-400/[0.06] p-3 transition-colors hover:bg-sky-400/[0.1]">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-sky-400/20 to-blue-600/20">
                    {iconPreview ? (
                      <img src={iconPreview} alt="Realm icon preview" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-sky-200" />
                    )}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Realm icon</span>
                    <span className="block text-xs text-muted-foreground">GIF, PNG, JPG, or WebP · up to 5 MB</span>
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
                  className="glass h-11 border-white/10"
                />
                <Textarea
                  placeholder="Description — what is this realm about? (optional)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={160}
                  className="glass border-white/10 min-h-20"
                />
                <div className="flex gap-2">
                  {(["text", "announcement", "voice"] as const).map((k) => {
                    const Icon = KIND_ICON[k];
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKind(k)}
                        className={`flex-1 p-3 rounded-xl border transition-all min-h-11 ${
                          kind === k ? "border-primary bg-primary/10" : "border-white/10 glass"
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
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all min-h-11 ${
                      isPublic ? "border-primary bg-primary/10" : "border-white/10 glass"
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                    <span className="text-xs">Public</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all min-h-11 ${
                      !isPublic ? "border-primary bg-primary/10" : "border-white/10 glass"
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
                  className="w-full bg-primary text-primary-foreground border-0 shadow-md"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create realm"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* My realms */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Your realms</h2>
          <span className="text-xs font-mono text-muted-foreground">{myRows.length} joined</span>
        </div>

        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5">
          {(["public", "private"] as const).map((scope) => {
            const active = realmScope === scope;
            const Icon = scope === "public" ? Globe : Lock;
            return (
              <button
                key={scope}
                type="button"
                onClick={() => setRealmScope(scope)}
                aria-pressed={active}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold capitalize transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {scope === "public" ? "Public realms" : "Private realms"}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                    active ? "bg-black/20" : "bg-white/10",
                  )}
                >
                  {scopeCounts[scope]}
                </span>
              </button>
            );
          })}
        </div>

        {myMemberships.isLoading && <div className="h-24 animate-pulse rounded-3xl glass" />}

        {!myMemberships.isLoading && myShown.length === 0 && (
          <div className="glass rounded-3xl border border-white/5 p-6 text-center text-sm text-muted-foreground">
            {realmScope === "public"
              ? "You haven't joined a public realm yet. Join an official room below or use a code."
              : "No private realms yet. Create one and invite people with a code."}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {myShown.map((membership) => {
            const realm = membership.realm;
            const Icon = KIND_ICON[realm.kind as keyof typeof KIND_ICON] ?? Hash;
            return (
              <div
                key={realm.id}
                className="glass relative overflow-hidden rounded-3xl border border-white/10 p-5 transition-colors hover:border-primary/50 hover:bg-white/[0.04]"
              >
                <Link
                  to="/r/$slug"
                  params={{ slug: realm.slug }}
                  aria-label={`Open ${realm.name}`}
                  className="absolute inset-0 z-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />

                {realm.cover_url ? (
                  <div className="pointer-events-none relative z-10 -mx-5 -mt-5 mb-3 h-24 overflow-hidden bg-white/5">
                    <img
                      src={realm.cover_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b]/70 to-transparent" />
                  </div>
                ) : null}

                <div className="pointer-events-none relative z-10 flex items-start gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-2xl flex shrink-0 items-center justify-center ring-1 ring-white/15 bg-surface-2">
                    {realm.icon_url ? (
                      <img
                        src={realm.icon_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-base leading-tight truncate flex items-center gap-1.5">
                      {realm.name}
                      {realm.is_public ? (
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{realm.topic || "—"}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-foreground/80">
                    {membership.role}
                  </span>
                </div>
                <div className="pointer-events-none relative z-10 mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{realm.member_count} members</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Discover */}
      <section className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Discover realms</h2>
          <span className="text-xs font-mono text-muted-foreground">
            {term
              ? `${publicRealms.length + shownFeatured.length} results`
              : `${publicRealms.length + shownFeatured.length} available`}
          </span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search realms by name, topic or slug"
            aria-label="Search realms"
            maxLength={80}
            className="glass h-11 border-white/10 pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear realm search"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {shownFeatured.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Featured official realms
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {shownFeatured.map(({ official, realm }) => {
                const joined = myRealmIds.has(realm.id);
                const Icon = KIND_ICON[realm.kind as keyof typeof KIND_ICON] ?? Hash;
                return (
                  <div
                    key={realm.id}
                    className="relative overflow-hidden rounded-3xl border border-white/10 bg-card/60"
                  >
                    <div className="relative h-28 overflow-hidden">
                      {realm.cover_url ? (
                        <img
                          src={realm.cover_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: `radial-gradient(140% 120% at 15% 0%, ${official.accent}33, transparent 60%), linear-gradient(135deg, ${realm.accent_color ?? "#171717"}, #0d0d0d)`,
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <span
                        className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-black"
                        style={{ backgroundColor: official.accent }}
                      >
                        <BadgeCheck className="h-3 w-3" />
                        {official.label}
                      </span>
                      {joined ? (
                        <span className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/85">
                          Joined
                        </span>
                      ) : null}
                      <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center gap-2">
                        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/50 ring-1 ring-white/20">
                          {realm.icon_url ? (
                            <img src={realm.icon_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Icon className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <p className="truncate font-display text-base font-bold text-white">{official.name}</p>
                      </div>
                    </div>
                    <div className="space-y-2 p-3.5">
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{official.blurb}</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {realm.member_count} members
                        </span>
                        {joined ? (
                          <Link to="/r/$slug" params={{ slug: realm.slug }}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="glass h-8 border-white/10 px-3 text-xs"
                            >
                              Open
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => void handleQuickJoin(realm.id)}
                            className="h-8 border-0 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-md"
                          >
                            Join
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {realms.isLoading && <div className="h-40 animate-pulse rounded-3xl glass" />}
        {realms.isError && <p className="text-sm text-destructive">Couldn't load realms. Try again later.</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {publicRealms.map((realm) => {
            const Icon = KIND_ICON[realm.kind as keyof typeof KIND_ICON] ?? Hash;
            return (
              <div
                key={realm.id}
                className="glass relative overflow-hidden rounded-3xl border border-white/10 p-5 transition-colors hover:border-primary/50 hover:bg-white/[0.04]"
              >
                {realm.cover_url ? (
                  <div className="-mx-5 -mt-5 mb-3 h-24 overflow-hidden bg-white/5">
                    <img
                      src={realm.cover_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-2xl flex shrink-0 items-center justify-center ring-1 ring-white/15 bg-surface-2">
                    {realm.icon_url ? (
                      <img
                        src={realm.icon_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-base leading-tight truncate">{realm.name}</h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{realm.topic || "—"}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>{realm.member_count} members</span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => void handleQuickJoin(realm.id)}
                    disabled={!user}
                    className="h-8 border-0 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-md"
                  >
                    Join
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {!realms.isLoading && publicRealms.length === 0 && shownFeatured.length === 0 && (
          <div className="glass rounded-3xl border border-white/5 p-8 text-center">
            {term ? (
              <>
                <h3 className="font-display text-base font-bold text-foreground">No realms match “{search.trim()}”</h3>
                <p className="mt-1 text-xs text-muted-foreground">Try a shorter name, a topic, or clear the search.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSearch("")}
                  className="mt-3 glass h-9 border-white/10 text-xs"
                >
                  Clear search
                </Button>
              </>
            ) : (
              <>
                <h3 className="font-display text-base font-bold text-foreground">You're all caught up!</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  You are already a member of all public realms, or no new public realms exist yet.
                </p>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
