import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchRealms, createRealmSecure, joinRealmPublic, previewRealmInvite, acceptRealmInvite, extractRealmInviteCode, updateRealm } from "@/lib/realms";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Hash, Megaphone, Mic, Users, Plus, Loader2, Globe, Lock, KeyRound, ImagePlus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

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
  accent_color: string | null;
  kind: "text" | "announcement" | "voice" | "drops";
  is_public: boolean;
  member_count: number;
  owner?: { username: string };
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
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewRealmInvite>> | null>(null);

  const realms = useQuery({
    queryKey: ["realms"],
    queryFn: fetchRealms,
  });

  const myMemberships = useQuery({
    queryKey: ["my-realms", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("realm_members")
        .select("realm_id, role, realm:realms!realm_members_realm_id_fkey(id,slug,name,topic,icon_url,accent_color,kind,is_public,member_count,owner:profiles!realms_owner_id_fkey(username))")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as Array<{ realm_id: string; role: "owner" | "mod" | "member"; realm: RealmRow | null }>;
    },
  });

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    if (iconFile && (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(iconFile.type) || iconFile.size > 5 * 1024 * 1024)) {
      toast.error("Choose a PNG, JPG, WebP, or GIF under 5 MB");
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
      if (iconFile) {
        const extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" } as const)[iconFile.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif"];
        const path = `${user.id}/realm-icons/${realm.id}.${extension}`;
        try {
          const { error: uploadError } = await supabase.storage.from("avatars").upload(path, iconFile, {
            contentType: iconFile.type,
            upsert: true,
          });
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from("avatars").getPublicUrl(path);
          await updateRealm({ realmId: realm.id, iconUrl: data.publicUrl });
        } catch (iconError) {
          toast.error(`Realm created, but its icon couldn't be saved: ${iconError instanceof Error ? iconError.message : "upload failed"}`);
        }
      }
      toast.success("Realm created");
      qc.invalidateQueries({ queryKey: ["realms"] });
      qc.invalidateQueries({ queryKey: ["my-realms", user.id] });
      setCreateOpen(false);
      setName("");
      setTopic("");
      setIconFile(null);
      if (iconPreview) URL.revokeObjectURL(iconPreview);
      setIconPreview(null);
      nav({ to: "/r/$slug", params: { slug: realm.slug } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create the realm");
    } finally {
      setCreating(false);
    }
  };

  const runPreview = async (raw: string) => {
    const cleaned = extractRealmInviteCode(raw).slice(0, 32);
    setCode(raw);
    if (!cleaned) { setPreview(null); return; }
    try {
      setPreview(await previewRealmInvite(cleaned));
    } catch {
      setPreview(null);
    }
  };

  const handleAcceptInvite = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!code.trim()) return;
    setJoining(true);
    try {
      const cleaned = extractRealmInviteCode(code);
      if (!cleaned) throw new Error("Paste a valid invite code or link.");
      const realmId = await acceptRealmInvite(cleaned);
      qc.invalidateQueries({ queryKey: ["my-realms", user.id] });
      toast.success("Realm joined!");
      setJoinOpen(false); setCode(""); setPreview(null);
      const { data } = await supabase.from("realms").select("slug").eq("id", realmId).maybeSingle();
      if (data?.slug) nav({ to: "/r/$slug", params: { slug: data.slug } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't join with that code");
    } finally {
      setJoining(false);
    }
  };

  const handleQuickJoin = async (realmId: string) => {
    if (!user) { toast.error("Sign in to join a realm"); return; }
    try {
      await joinRealmPublic(realmId);
      qc.invalidateQueries({ queryKey: ["my-realms", user.id] });
      toast.success("Joined!");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't join this realm");
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

  const myRealmIds = new Set((myMemberships.data ?? []).map((m) => m.realm_id));
  const publicRealms = (realms.data ?? []).filter((r: RealmRow) => r.is_public !== false);

  return (
    <div
      className="space-y-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
      style={{ paddingTop: "max(0.25rem, env(safe-area-inset-top, 0px))" }}
    >
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight">Realms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Public spaces anyone can join — topics, announcements and drops.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Dialog open={joinOpen} onOpenChange={(next) => { setJoinOpen(next); if (!next) { setCode(""); setPreview(null); } }}>
            <Button variant="outline" className="glass h-11 border-white/10" onClick={() => setJoinOpen(true)}>
              <KeyRound className="h-4 w-4 mr-1.5" />Join by code
            </Button>
            <DialogContent className="glass-strong border-white/10">
              <DialogHeader><DialogTitle className="font-display">Join a realm</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Invite code or link"
                  value={code}
                  onChange={(e) => { void runPreview(e.target.value); }}
                  maxLength={200}
                  className="glass border-white/10"
                  autoFocus
                />
                {preview && (
                  <div className="rounded-xl border border-white/10 glass p-3 text-sm">
                    {preview.status === "valid" && (
                      <p className="font-medium">✨ {preview.realm_name} — <span className="text-muted-foreground">{preview.topic || "no topic"}</span> · {preview.member_count} members</p>
                    )}
                    {preview.status === "already_member" && <p className="text-cyan-200">You're already a member of {preview.realm_name}.</p>}
                    {preview.status === "expired" && <p className="text-rose-300">That invite has expired.</p>}
                    {preview.status === "limit_reached" && <p className="text-rose-300">That invite ran out of uses.</p>}
                    {preview.status === "banned" && <p className="text-rose-300">You are banned from that realm.</p>}
                    {preview.status === "invalid" && <p className="text-rose-300">That code isn't valid.</p>}
                  </div>
                )}
                <Button onClick={handleAcceptInvite} disabled={joining || !code.trim() || preview?.status === "banned"} className="w-full bg-primary text-primary-foreground border-0 shadow-md">
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join realm"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 bg-primary text-primary-foreground border-0 shadow-md"><Plus className="h-4 w-4 mr-1.5" />New realm</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-sky-300/20 shadow-[0_0_48px_rgba(59,130,246,0.14)]">
              <DialogHeader><DialogTitle className="font-display">Create a realm</DialogTitle></DialogHeader>                <div className="grid grid-cols-1 gap-3">
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-sky-300/30 bg-sky-400/[0.06] p-3 transition-colors hover:bg-sky-400/[0.1]">
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-sky-400/20 to-blue-600/20">
                      {iconPreview ? <img src={iconPreview} alt="Realm icon preview" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-sky-200" />}
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
                  <Input placeholder="Realm name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="glass h-11 border-white/10" />
                  <Textarea placeholder="Description — what is this realm about? (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={160} className="glass border-white/10 min-h-20" />
                <div className="flex gap-2">
                  {(["text", "announcement", "voice"] as const).map((k) => {
                    const Icon = KIND_ICON[k];
                    return (
                      <button key={k} onClick={() => setKind(k)} className={`flex-1 p-3 rounded-xl border transition-all min-h-11 ${kind === k ? "border-primary bg-primary/10" : "border-white/10 glass"}`}>
                        <Icon className="h-4 w-4 mx-auto mb-1" />
                        <span className="text-xs capitalize">{k}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsPublic(true)} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all min-h-11 ${isPublic ? "border-primary bg-primary/10" : "border-white/10 glass"}`}>
                    <Globe className="h-4 w-4" /><span className="text-xs">Public</span>
                  </button>
                  <button onClick={() => setIsPublic(false)} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all min-h-11 ${!isPublic ? "border-primary bg-primary/10" : "border-white/10 glass"}`}>
                    <Lock className="h-4 w-4" /><span className="text-xs">Private (invite-only)</span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground">Accent</label>
                  <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-11 w-14 rounded-md bg-transparent border border-white/10" />
                </div>
                <Button onClick={handleCreate} disabled={creating || !name.trim()} className="w-full bg-primary text-primary-foreground border-0 shadow-md">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create realm"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* My realms */}
      <section>
        <h2 className="font-display text-lg font-bold mb-3">Your realms</h2>
        {myMemberships.isLoading && <div className="h-24 animate-pulse rounded-3xl glass" />}
        {!myMemberships.isLoading && (myMemberships.data ?? []).length === 0 && (
          <div className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">
            You haven't joined a realm yet. Browse public ones below or join with a code.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(myMemberships.data ?? []).map((m) => {
            const realm = m.realm;
            if (!realm) return null;
            const Icon = KIND_ICON[realm.kind as keyof typeof KIND_ICON] ?? Hash;
            return (
              <Link key={realm.id} to="/r/$slug" params={{ slug: realm.slug }} className="block min-h-[44px] rounded-3xl">
                <motion.div whileHover={{ y: -3 }} className="glass relative overflow-hidden rounded-3xl border border-sky-300/10 p-5 transition-colors hover:border-sky-300/25" style={{ boxShadow: `inset 0 0 0 1px ${realm.accent_color}33, 0 12px 36px rgba(37,99,235,.08)` }}>
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-2xl flex shrink-0 items-center justify-center ring-1 ring-white/15" style={{ background: `linear-gradient(135deg, ${realm.accent_color || "#38bdf8"}, #2563eb)` }}>
                      {realm.icon_url ? <img src={realm.icon_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <Icon className="h-6 w-6 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-lg leading-tight truncate flex items-center gap-1.5">
                        {realm.name}
                        {realm.is_public ? <Globe className="h-3.5 w-3.5 text-white/40" /> : <Lock className="h-3.5 w-3.5 text-white/40" />}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{realm.topic || "—"}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide rounded-full border border-white/10 px-2 py-0.5 text-white/60">{m.role}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{realm.member_count} members</span>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Browse public realms */}
      <section>
        <h2 className="font-display text-lg font-bold mb-3">Discover public realms</h2>
        {realms.isLoading && <div className="h-40 animate-pulse rounded-3xl glass" />}
        {realms.isError && <p className="text-sm text-destructive">Couldn't load realms. Try again later.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {publicRealms.map((realm) => {
            const Icon = KIND_ICON[realm.kind as keyof typeof KIND_ICON] ?? Hash;
            const joined = myRealmIds.has(realm.id);
            return (
              <motion.div key={realm.id} whileHover={{ y: -3 }} className="glass relative overflow-hidden rounded-3xl border border-sky-300/10 p-5 transition-colors hover:border-sky-300/25" style={{ boxShadow: `inset 0 0 0 1px ${realm.accent_color}33, 0 12px 36px rgba(37,99,235,.08)` }}>
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-2xl flex shrink-0 items-center justify-center ring-1 ring-white/15" style={{ background: `linear-gradient(135deg, ${realm.accent_color || "#38bdf8"}, #2563eb)` }}>
                    {realm.icon_url ? <img src={realm.icon_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <Icon className="h-6 w-6 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-lg leading-tight truncate">{realm.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{realm.topic || "—"}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{realm.member_count} members</span>
                  {joined ? (
                    <Link to="/r/$slug" params={{ slug: realm.slug }} className="ml-auto">
                      <Button size="sm" variant="outline" className="glass border-white/10">Open</Button>
                    </Link>
                  ) : (
                    <Button size="sm" onClick={() => void handleQuickJoin(realm.id)} className="ml-auto bg-primary text-primary-foreground border-0 shadow-md">Join</Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        {!realms.isLoading && publicRealms.length === 0 && (
          <div className="glass rounded-3xl p-10 text-center">
            <div className="text-5xl mb-3">🏰</div>
            <h2 className="font-display text-xl font-bold">No public realms yet</h2>
            <p className="text-sm text-muted-foreground mt-1">Be the first to start one.</p>
          </div>
        )}
      </section>
    </div>
  );
}
