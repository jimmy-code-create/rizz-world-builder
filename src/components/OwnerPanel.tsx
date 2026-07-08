import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Crown, Lock, Search, Sparkles, Trophy, Gift, Shield, Loader2, X, Check } from "lucide-react";
import {
  ownerVerify, ownerSearchUsers, ownerListCatalog, ownerUserInventory,
  ownerGrantBadge, ownerRevokeBadge, ownerGrantEffect, ownerRemoveEffect,
  ownerGiftRizz, ownerGrantAdmin,
} from "@/lib/owner.functions";

type UserRow = { id: string; username: string; display_name: string | null; avatar_url: string | null; rizz_score: number };

const PASS_KEY = "rizz:owner-pass";

export function OwnerPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [password, setPassword] = useState<string>(() => (typeof window !== "undefined" ? sessionStorage.getItem(PASS_KEY) ?? "" : ""));
  const [unlocked, setUnlocked] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const verify = useServerFn(ownerVerify);

  useEffect(() => {
    if (!open) return;
    if (password && !unlocked) {
      (async () => {
        const { ok } = await verify({ data: { password } });
        if (ok) setUnlocked(true);
      })();
    }
  }, [open]);

  async function submit() {
    setVerifying(true);
    try {
      const { ok } = await verify({ data: { password } });
      if (!ok) { toast.error("Wrong password"); return; }
      sessionStorage.setItem(PASS_KEY, password);
      setUnlocked(true);
    } finally { setVerifying(false); }
  }

  function lock() {
    sessionStorage.removeItem(PASS_KEY);
    setPassword("");
    setUnlocked(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { /* keep session unlock */ } onOpenChange(o); }}>
      <DialogContent className="glass-strong border-white/10 max-w-3xl max-h-[90dvh] overflow-y-auto p-0">
        <DialogHeader className="p-5 pb-3 border-b border-white/5">
          <DialogTitle className="flex items-center gap-2 font-display">
            <Crown className="h-5 w-5 text-[var(--rizz-pink)]" /> Owner Control Room
          </DialogTitle>
          <DialogDescription>Assign badges, gift effects, boost rizz, and grant admin — password protected.</DialogDescription>
        </DialogHeader>

        {!unlocked ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" /> Enter the owner password to continue
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-2">
              <Input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Owner password"
                className="bg-background/40"
              />
              <Button type="submit" disabled={verifying || !password} className="bg-gradient-primary border-0 shadow-glow">
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">Default password is <code className="text-foreground">rizz-owner-2026</code> — change it in your backend secrets (OWNER_PANEL_PASSWORD).</p>
          </div>
        ) : (
          <OwnerBody password={password} onLock={lock} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function OwnerBody({ password, onLock }: { password: string; onLock: () => void }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<{ badges: any[]; effects: any[] } | null>(null);
  const [inventory, setInventory] = useState<{ badges: any[]; effects: any[] } | null>(null);

  const search = useServerFn(ownerSearchUsers);
  const listCat = useServerFn(ownerListCatalog);
  const listInv = useServerFn(ownerUserInventory);
  const grantBadge = useServerFn(ownerGrantBadge);
  const revokeBadge = useServerFn(ownerRevokeBadge);
  const grantEffect = useServerFn(ownerGrantEffect);
  const removeEffect = useServerFn(ownerRemoveEffect);
  const giftRizz = useServerFn(ownerGiftRizz);
  const grantAdmin = useServerFn(ownerGrantAdmin);

  useEffect(() => {
    (async () => setCatalog(await listCat({ data: { password } })))();
    void doSearch("");
  }, []);

  async function doSearch(query: string) {
    setLoading(true);
    try { setUsers(await search({ data: { password, q: query } })); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  async function pick(u: UserRow) {
    setSelected(u);
    setInventory(await listInv({ data: { password, userId: u.id } }));
  }

  async function refreshInv() {
    if (selected) setInventory(await listInv({ data: { password, userId: selected.id } }));
  }

  const ownedBadgeSlugs = new Set((inventory?.badges ?? []).map((r: any) => r.badges?.slug));
  const ownedEffectSlugs = new Set((inventory?.effects ?? []).map((r: any) => r.effect?.slug));

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-0 min-h-[60dvh]">
      {/* Left: users */}
      <div className="border-r border-white/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch(q)}
            placeholder="Search users…"
            className="h-8 bg-background/40"
          />
        </div>
        <div className="max-h-[50dvh] overflow-y-auto space-y-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => pick(u)}
              className={`w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-white/5 ${selected?.id === u.id ? "bg-white/10" : ""}`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={u.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs bg-gradient-primary">{(u.display_name || u.username).charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.display_name || u.username}</p>
                <p className="text-[11px] text-muted-foreground truncate">@{u.username} · {u.rizz_score} rizz</p>
              </div>
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onLock}>
          <Lock className="h-3 w-3 mr-1" /> Lock panel
        </Button>
      </div>

      {/* Right: actions */}
      <div className="p-4">
        {!selected ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">Pick a user on the left to start.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-[var(--rizz-pink)]/40">
                <AvatarImage src={selected.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-primary">{(selected.display_name || selected.username).charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold">{selected.display_name || selected.username}</p>
                <p className="text-xs text-muted-foreground">@{selected.username}</p>
              </div>
            </div>

            <Tabs defaultValue="badges">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="badges"><Trophy className="h-3.5 w-3.5 mr-1" />Badges</TabsTrigger>
                <TabsTrigger value="effects"><Sparkles className="h-3.5 w-3.5 mr-1" />Effects</TabsTrigger>
                <TabsTrigger value="gifts"><Gift className="h-3.5 w-3.5 mr-1" />Gifts</TabsTrigger>
                <TabsTrigger value="role"><Shield className="h-3.5 w-3.5 mr-1" />Role</TabsTrigger>
              </TabsList>

              <TabsContent value="badges" className="space-y-2 max-h-[45dvh] overflow-y-auto">
                {(catalog?.badges ?? []).map((b: any) => {
                  const owned = ownedBadgeSlugs.has(b.slug);
                  return (
                    <div key={b.id} className="flex items-center justify-between gap-2 p-2 rounded-lg glass">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{b.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{b.name} <Badge variant="outline" className="ml-1 text-[10px] uppercase">{b.rarity}</Badge></p>
                          <p className="text-[11px] text-muted-foreground truncate">{b.description}</p>
                        </div>
                      </div>
                      {owned ? (
                        <Button size="sm" variant="ghost" onClick={async () => { try { await revokeBadge({ data: { password, userId: selected.id, badgeSlug: b.slug } }); toast.success("Revoked"); refreshInv(); } catch(e:any){ toast.error(e.message); }}}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" onClick={async () => { try { await grantBadge({ data: { password, userId: selected.id, badgeSlug: b.slug } }); toast.success("Granted"); refreshInv(); } catch(e:any){ toast.error(e.message); }}}>
                          Grant
                        </Button>
                      )}
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="effects" className="space-y-2 max-h-[45dvh] overflow-y-auto">
                {(catalog?.effects ?? []).map((e: any) => {
                  const owned = ownedEffectSlugs.has(e.slug);
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-2 p-2 rounded-lg glass">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-4 w-4 rounded-full inline-block" style={{ background: e.preview_color }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.name} <Badge variant="outline" className="ml-1 text-[10px] uppercase">{e.type}</Badge></p>
                          <p className="text-[11px] text-muted-foreground truncate">Rarity: {e.rarity}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={async () => { try { await grantEffect({ data: { password, userId: selected.id, effectSlug: e.slug, equip: false } }); toast.success("Gifted"); refreshInv(); } catch(er:any){ toast.error(er.message); }}}>
                          Gift
                        </Button>
                        <Button size="sm" onClick={async () => { try { await grantEffect({ data: { password, userId: selected.id, effectSlug: e.slug, equip: true } }); toast.success("Equipped"); refreshInv(); } catch(er:any){ toast.error(er.message); }}}>
                          <Check className="h-3.5 w-3.5 mr-1" />Equip
                        </Button>
                        {owned && (
                          <Button size="sm" variant="ghost" onClick={async () => { try { await removeEffect({ data: { password, userId: selected.id, effectSlug: e.slug } }); toast.success("Removed"); refreshInv(); } catch(er:any){ toast.error(er.message); }}}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="gifts" className="space-y-3">
                <p className="text-sm text-muted-foreground">Current: {selected.rizz_score} rizz</p>
                <div className="flex flex-wrap gap-2">
                  {[10, 100, 500, 1000, 5000, -100].map((d) => (
                    <Button key={d} size="sm" variant={d < 0 ? "outline" : "default"} onClick={async () => {
                      try {
                        const r = await giftRizz({ data: { password, userId: selected.id, delta: d } });
                        toast.success(`Rizz → ${r.rizz_score}`);
                        setSelected({ ...selected, rizz_score: r.rizz_score });
                      } catch (e: any) { toast.error(e.message); }
                    }}>
                      {d > 0 ? `+${d}` : d}
                    </Button>
                  ))}
                </div>
                <CustomGift onGift={async (delta) => {
                  try {
                    const r = await giftRizz({ data: { password, userId: selected.id, delta } });
                    toast.success(`Rizz → ${r.rizz_score}`);
                    setSelected({ ...selected, rizz_score: r.rizz_score });
                  } catch (e: any) { toast.error(e.message); }
                }} />
              </TabsContent>

              <TabsContent value="role" className="space-y-2">
                <p className="text-sm text-muted-foreground">Elevate this user to admin (or remove).</p>
                <div className="flex gap-2">
                  <Button onClick={async () => { try { await grantAdmin({ data: { password, userId: selected.id, grant: true } }); toast.success("Now an admin"); } catch(e:any){ toast.error(e.message); }}}>
                    Make admin
                  </Button>
                  <Button variant="outline" onClick={async () => { try { await grantAdmin({ data: { password, userId: selected.id, grant: false } }); toast.success("Admin removed"); } catch(e:any){ toast.error(e.message); }}}>
                    Remove admin
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomGift({ onGift }: { onGift: (delta: number) => void | Promise<void> }) {
  const [v, setV] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); const n = Number(v); if (Number.isFinite(n) && n !== 0) onGift(n); setV(""); }} className="flex gap-2">
      <Input value={v} onChange={(e) => setV(e.target.value)} type="number" placeholder="Custom amount (± rizz)" className="bg-background/40 h-8" />
      <Button size="sm" type="submit">Apply</Button>
    </form>
  );
}