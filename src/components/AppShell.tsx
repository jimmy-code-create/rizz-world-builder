import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, Compass, Plus, Bell, User as UserIcon, LogOut, Settings, Trophy, Hash, Gift, MessageCircle, Bookmark, Sparkles, Users, Search, Palette, Film, FlaskConical, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PostComposer } from "@/components/PostComposer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CommandPalette } from "@/components/CommandPalette";
import { AppOverlays } from "@/components/AppOverlays";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { OwnerPanel } from "@/components/OwnerPanel";
import { IncomingCallRinger } from "@/components/IncomingCallRinger";
import { NightclubCanvas } from "@/components/NightclubCanvas";

const sideTabs = [
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/reels", label: "Reels", icon: Film },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/channels", label: "Channels", icon: Hash },
  { to: "/drops", label: "Giveaways", icon: Gift },
  { to: "/dms", label: "DMs", icon: MessageCircle },
  { to: "/bookmarks", label: "Saved", icon: Bookmark },
  { to: "/effects", label: "Effects", icon: Sparkles },
  { to: "/badges", label: "Badges", icon: Trophy },
  { to: "/leaderboard", label: "Top", icon: Trophy },
  { to: "/labs", label: "Labs", icon: FlaskConical },
] as const;

const mobileTabs = [
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/reels", label: "Reels", icon: Film },
  { to: "/dms", label: "DMs", icon: MessageCircle },
] as const;

export function AppShell() {
  const { user, profile, loading, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [composerOpen, setComposerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);

  // Close the More sheet whenever the route changes
  useEffect(() => { setMoreOpen(false); }, [path]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  // Allow the keyboard shortcut "n" (and other places) to open the composer
  useEffect(() => {
    const open = () => setComposerOpen(true);
    window.addEventListener("rizz:new-post", open);
    return () => window.removeEventListener("rizz:new-post", open);
  }, []);

  const unread = useQuery({
    queryKey: ["unread-notifs", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  if (loading || !user) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-gradient-primary animate-pulse-glow" />
      </div>
    );
  }

  const initial = (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase();
  const isActive = (to: string) => path === to || (to !== "/feed" && path.startsWith(to + "/"));

  return (
    <div className="relative min-h-dvh pb-24 md:pb-0 md:pl-64">
      <NightclubCanvas />
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col glass-strong border-r border-white/5 px-4 py-6 z-30">
        <button
          type="button"
          onClick={() => setOwnerOpen(true)}
          className="flex items-center gap-2 mb-6 px-2 group"
          aria-label="Open owner panel"
          title="Owner panel"
        >
          <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center font-display font-bold shadow-glow group-hover:scale-105 transition-transform">R</div>
          <span className="font-display text-xl font-bold tracking-tight">RIZZ</span>
        </button>

        <Button onClick={() => setComposerOpen(true)} className="mb-4 bg-gradient-primary border-0 shadow-glow rounded-xl h-10 gap-2">
          <Plus className="h-4 w-4" /> New post
        </Button>

        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto -mx-1 px-1">
          {sideTabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive(t.to)
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <t.icon className="h-5 w-5" />
              <span className="font-medium text-sm">{t.label}</span>
            </Link>
          ))}
          <Link
            to="/notifications"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              isActive("/notifications")
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <Bell className="h-5 w-5" />
            <span className="font-medium text-sm flex-1">Inbox</span>
            {(unread.data ?? 0) > 0 && (
              <span className="text-[10px] font-bold bg-[var(--rizz-pink)] text-white px-1.5 py-0.5 rounded-full min-w-5 text-center">{unread.data}</span>
            )}
          </Link>
          <Link
            to="/u/$username"
            params={{ username: profile?.username ?? "" }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              path.startsWith("/u/")
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <UserIcon className="h-5 w-5" />
            <span className="font-medium text-sm">Profile</span>
          </Link>
        </nav>

        <ProfileMenu profile={profile} initial={initial} signOut={signOut} />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 glass-strong border-b border-white/5 px-4 py-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOwnerOpen(true)}
          className="flex items-center gap-2 shrink-0"
          aria-label="Open owner panel"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center font-display font-bold text-sm shadow-glow">R</div>
          <span className="font-display text-lg font-bold">RIZZ</span>
        </button>
        <Link to="/explore" className="flex-1 max-w-xs flex items-center gap-2 glass rounded-full px-3 py-1.5 text-xs text-muted-foreground border border-white/5">
          <Search className="h-3.5 w-3.5" /> Search RIZZ
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <Link to="/notifications" className="relative h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-white/5">
            <Bell className="h-5 w-5" />
            {(unread.data ?? 0) > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[var(--rizz-pink)] shadow-glow" />
            )}
          </Link>
          <ProfileMenu profile={profile} initial={initial} signOut={signOut} compact />
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <Outlet />
      </main>

      {/* Mobile bottom nav — 5 items, center FAB */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-white/5 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <div className="flex items-center justify-between gap-1">
          {mobileTabs.slice(0, 2).map((t) => (
            <NavBtn key={t.to} to={t.to} label={t.label} Icon={t.icon} active={isActive(t.to)} />
          ))}
          <button onClick={() => setComposerOpen(true)} className="flex-1 flex flex-col items-center gap-0.5 py-1 -mt-5" aria-label="New post">
            <div className="h-12 w-12 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center ring-4 ring-background">
              <Plus className="h-6 w-6 text-primary-foreground" />
            </div>
          </button>
          {mobileTabs.slice(2).map((t) => (
            <NavBtn key={t.to} to={t.to} label={t.label} Icon={t.icon} active={isActive(t.to)} />
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5"
            aria-label="More"
          >
            <div className="p-1.5 rounded-xl">
              <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">More</span>
          </button>
        </div>
      </nav>

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="glass-strong border-white/10 max-w-lg">
          <DialogTitle className="font-display text-xl">Create post</DialogTitle>
          <PostComposer onPosted={() => setComposerOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Mobile "More" drawer — every desktop section within thumb reach */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="glass-strong border-white/10 rounded-t-3xl max-h-[85dvh] overflow-y-auto pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-xl">Everything on RIZZ</SheetTitle>
          </SheetHeader>

          {/* Profile card */}
          <Link
            to="/u/$username"
            params={{ username: profile?.username ?? "" }}
            className="mt-4 flex items-center gap-3 p-3 rounded-2xl glass border border-white/5"
          >
            <Avatar className="h-12 w-12 ring-2 ring-[var(--rizz-pink)]/40">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">{initial}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{profile?.display_name || profile?.username}</p>
              <p className="text-xs text-muted-foreground truncate">@{profile?.username} · View profile</p>
            </div>
          </Link>

          {/* Grid of every destination */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {sideTabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition ${
                  isActive(t.to) ? "bg-gradient-primary text-white shadow-glow" : "glass hover:bg-white/5"
                }`}
              >
                <t.icon className="h-5 w-5" />
                <span className="text-[11px] font-medium text-center leading-tight">{t.label}</span>
              </Link>
            ))}
            <Link
              to="/notifications"
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl transition ${
                isActive("/notifications") ? "bg-gradient-primary text-white shadow-glow" : "glass hover:bg-white/5"
              }`}
            >
              <Bell className="h-5 w-5" />
              <span className="text-[11px] font-medium">Inbox</span>
              {(unread.data ?? 0) > 0 && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-[var(--rizz-pink)] text-white px-1.5 rounded-full">{unread.data}</span>
              )}
            </Link>
            <Link to="/bookmarks" className="flex flex-col items-center gap-1.5 p-3 rounded-2xl glass hover:bg-white/5">
              <Bookmark className="h-5 w-5" />
              <span className="text-[11px] font-medium">Saved</span>
            </Link>
            <Link to="/settings" className="flex flex-col items-center gap-1.5 p-3 rounded-2xl glass hover:bg-white/5">
              <Settings className="h-5 w-5" />
              <span className="text-[11px] font-medium">Settings</span>
            </Link>
            <Link to="/settings" hash="appearance" className="flex flex-col items-center gap-1.5 p-3 rounded-2xl glass hover:bg-white/5">
              <Palette className="h-5 w-5" />
              <span className="text-[11px] font-medium">Theme</span>
            </Link>
          </div>

          <button
            onClick={() => { setMoreOpen(false); signOut(); }}
            className="mt-4 w-full flex items-center justify-center gap-2 p-3 rounded-2xl glass border border-destructive/30 text-destructive font-medium text-sm"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </SheetContent>
      </Sheet>
      <IncomingCallRinger />

      <CommandPalette />
      <AppOverlays />
      <KeyboardShortcuts profileUsername={profile?.username} />
      <OwnerPanel open={ownerOpen} onOpenChange={setOwnerOpen} />
    </div>
  );
}

function NavBtn({ to, label, Icon, active }: { to: string; label: string; Icon: any; active: boolean }) {
  return (
    <Link to={to} className="flex-1 flex flex-col items-center gap-0.5 py-1.5">
      <div className={`p-1.5 rounded-xl transition-all ${active ? "bg-white/10" : ""}`}>
        <Icon className={`h-5 w-5 ${active ? "text-[var(--rizz-pink)]" : "text-muted-foreground"}`} />
      </div>
      <span className={`text-[10px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </Link>
  );
}

function ProfileMenu({
  profile,
  initial,
  signOut,
  compact,
}: {
  profile: { username: string; display_name: string | null; avatar_url: string | null } | null;
  initial: string;
  signOut: () => Promise<void>;
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`flex items-center gap-3 rounded-xl ${compact ? "" : "p-2 hover:bg-white/5 w-full"} transition-colors`}>
          <Avatar className="h-9 w-9 ring-2 ring-[var(--rizz-pink)]/40">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">{initial}</AvatarFallback>
          </Avatar>
          {!compact && (
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">{profile?.display_name || profile?.username}</p>
              <p className="text-xs text-muted-foreground truncate">@{profile?.username}</p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-strong border-white/10 w-56">
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">@{profile?.username}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/u/$username" params={{ username: profile?.username ?? "" }}>
            <UserIcon className="mr-2 h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/bookmarks"><Bookmark className="mr-2 h-4 w-4" /> Saved</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/effects"><Sparkles className="mr-2 h-4 w-4" /> Effects</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/badges"><Trophy className="mr-2 h-4 w-4" /> Badges</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" hash="appearance"><Palette className="mr-2 h-4 w-4" /> Appearance</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
