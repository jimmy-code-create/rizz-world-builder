import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  Bot, Home, Compass, Plus, Bell, User as UserIcon, LogOut, Settings, Trophy, Hash, Gift,
  MessageCircle, Bookmark, Users, Search, Palette, Film, MoreHorizontal, MessageSquareText,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VoiceCallBar } from "@/components/voice/VoiceCallBar";
import { PresenceSheet } from "@/components/presence/PresenceSheet";
import { ReactionBurstLayer } from "@/components/chat/ReactionBurst";
import { ExternalLinkGuard } from "@/components/chat/LinkPreviews";
import { StatusDot } from "@/components/presence/StatusDot";
import { RizzCat } from "@/components/RizzCat";
import { statusLabel, statusShortLabel, useSelfPresence, type PublicPresence } from "@/lib/presence";
import { playNotificationPing } from "@/lib/notification-sound";

// Secondary UI and the decorative background are split out of the initial shell
// bundle: they load in their own chunks when first used instead of before paint.
const NightclubCanvas = lazy(() => import("@/components/NightclubCanvas").then((m) => ({ default: m.NightclubCanvas })));
const CommandPalette = lazy(() => import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })));
const AppOverlays = lazy(() => import("@/components/AppOverlays").then((m) => ({ default: m.AppOverlays })));
const KeyboardShortcuts = lazy(() => import("@/components/KeyboardShortcuts").then((m) => ({ default: m.KeyboardShortcuts })));
const IncomingCallRinger = lazy(() => import("@/components/IncomingCallRinger").then((m) => ({ default: m.IncomingCallRinger })));
const PostComposer = lazy(() => import("@/components/PostComposer").then((m) => ({ default: m.PostComposer })));

const sideTabs = [
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/reels", label: "Reels", icon: Film },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/realms", label: "Realms", icon: Hash },
  { to: "/drops", label: "Giveaways", icon: Gift },
  { to: "/dms", label: "Messages", icon: MessageCircle },
  { to: "/chat-stories", label: "Chat Stories", icon: MessageSquareText },
  { to: "/bookmarks", label: "Saved", icon: Bookmark },
  { to: "/badges", label: "Badges", icon: Trophy },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/bots", label: "Bots", icon: Bot },
] as const;

const mobileTabs = [
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/reels", label: "Reels", icon: Film },
  { to: "/dms", label: "Messages", icon: MessageCircle },
] as const;

export function AppShell() {
  const { user, profile, loading, profileError, refreshProfile, signOut } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [composerOpen, setComposerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const presence = useSelfPresence();

  const isConversation = /^\/(?:_app\/)?(?:dm\/|g\/|c\/)/.test(path) || /^\/(?:_app\/)?r\/[^/]+\/?$/.test(path);
  const isReels = path === "/reels" || path === "/_app/reels";

  // Close the More sheet whenever the route changes
  useEffect(() => { setMoreOpen(false); }, [path]);

  useEffect(() => {
    if (loading || profileError) return;
    if (!user) nav({ to: "/" });
    else if (!profile?.username) nav({ to: "/claim" });
    else if (!profile.tutorial_seen) nav({ to: "/tutorial" });
  }, [loading, user, profile, profileError, nav]);

  // Allow the keyboard shortcut "n" to open the composer
  useEffect(() => {
    const open = () => setComposerOpen(true);
    window.addEventListener("rizz:new-post", open);
    return () => window.removeEventListener("rizz:new-post", open);
  }, []);

  const openSearch = () => window.dispatchEvent(new CustomEvent("rizz:command-palette"));

  const unread = useQuery({
    queryKey: ["unread-notifs", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("notifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
  });

  const dmUnread = useQuery({
    queryKey: ["unread-dms", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("direct_messages" as any)
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
  });

  const lastUnread = useRef<number | null>(null);
  useEffect(() => {
    const count = unread.data;
    if (typeof count !== "number") return;
    const previous = lastUnread.current;
    lastUnread.current = count;
    if (previous === null || count <= previous) return;
    if (typeof document !== "undefined" && !document.hidden) return;
    playNotificationPing();
  }, [unread.data]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`unread-notifs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => { qc.invalidateQueries({ queryKey: ["unread-notifs", user.id] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  if (profileError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">{profileError}</p>
        <Button variant="outline" onClick={() => void refreshProfile()}>Retry</Button>
      </div>
    );
  }

  if (loading || !user || !profile?.username || !profile.tutorial_seen) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <RizzCat mood="peek" size={76} className="animate-pulse" />
      </div>
    );
  }

  const initial = (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase();
  const unreadCount = unread.data ?? 0;
  const unreadBadge = unreadCount > 9 ? "9+" : String(unreadCount);
  const dmUnreadCount = dmUnread.data ?? 0;
  const dmBadge = dmUnreadCount > 9 ? "9+" : String(dmUnreadCount);

  const isActive = (to: string) =>
    path === to || (to !== "/feed" && path.startsWith(to + "/")) || (to === "/realms" && path.startsWith("/r/"));

  const navItem = (active: boolean) =>
    `flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active
        ? "bg-primary text-primary-foreground font-semibold"
        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
    }`;

  const navTile = (active: boolean) =>
    `flex min-h-[56px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active
        ? "border-primary bg-primary/10 text-primary font-semibold"
        : "border-border bg-card text-muted-foreground hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <div className={`relative flex h-dvh min-h-0 w-full flex-col overflow-hidden ${isConversation ? "" : "md:pl-64"}`}>
      {!isConversation && <Suspense fallback={null}><NightclubCanvas /></Suspense>}

      {/* Desktop sidebar */}
      {!isConversation && (
        <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-card/60 backdrop-blur-md border-r border-border px-4 py-6 z-30">
          <Link to="/feed" className="flex items-center gap-2.5 mb-6 px-2 group" aria-label="RIZZ home">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-base transition-transform group-hover:scale-105">
              R
            </div>
            <img src="/brand/rizz-cat-logo.svg" alt="" className="h-8 w-8 shrink-0" />
            <span className="font-display text-xl font-bold tracking-tight text-foreground">RIZZ</span>
          </Link>

          <Button
            onClick={() => setComposerOpen(true)}
            className="mb-4 h-11 min-h-[44px] gap-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring shadow-sm"
          >
            <Plus className="h-5 w-5" /> New post
          </Button>

          <nav className="flex flex-col gap-1 flex-1 overflow-y-auto -mx-1 px-1">
            <button
              type="button"
              onClick={() => setStatusOpen(true)}
              className="flex min-h-[44px] items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground transition-all hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {presence.customStatus?.emoji ? (
                <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center text-base leading-none">
                  {presence.customStatus.emoji}
                </span>
              ) : (
                <StatusDot status={presence.status} size={12} ring={false} />
              )}
              <span className="font-medium text-sm flex-1 text-left">Status</span>
              <span className="text-xs">{statusShortLabel(presence.status)}</span>
            </button>
            {sideTabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={navItem(isActive(t.to))}
              >
                <t.icon className="h-5 w-5" />
                <span className="flex-1 text-sm font-medium">{t.label}</span>
                {t.to === "/dms" && dmUnreadCount > 0 && (
                  <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
                    isActive(t.to) ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                  }`}>
                    {dmBadge}
                  </span>
                )}
              </Link>
            ))}
            <Link
              to="/notifications"
              className={navItem(isActive("/notifications"))}
            >
              <Bell className="h-5 w-5" />
              <span className="font-medium text-sm flex-1">Inbox</span>
              {unreadCount > 0 && (
                <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
                  isActive("/notifications") ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                }`}>
                  {unreadBadge}
                </span>
              )}
            </Link>
            <Link
              to="/u/$username"
              params={{ username: profile?.username ?? "" }}
              className={navItem(path.startsWith("/u/"))}
            >
              <UserIcon className="h-5 w-5" />
              <span className="font-medium text-sm">Profile</span>
            </Link>
          </nav>

          <ProfileMenu profile={profile} initial={initial} signOut={signOut} />
        </aside>
      )}

      {/* Mobile top bar */}
      {!isConversation && (
        <header
          className="chat-bar md:hidden z-30 relative flex shrink-0 items-center gap-2 border-b border-border px-3 pb-2.5"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0.5rem)" }}
        >
          <Link
            to="/feed"
            aria-label="RIZZ home"
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary font-display text-base font-bold text-primary-foreground transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            R
          </Link>

          <button
            type="button"
            onClick={openSearch}
            aria-label="Search RIZZ"
            className="flex h-11 min-h-[44px] min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border bg-surface-2/60 px-3.5 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-2 active:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Search people, tags, chats</span>
            <kbd className="hidden shrink-0 rounded-md border border-border bg-surface-3 px-1.5 py-0.5 font-sans text-[10px] font-semibold min-[400px]:block">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              to="/notifications"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-surface-2 active:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground ring-2 ring-background">
                  {unreadBadge}
                </span>
              )}
            </Link>
            <ProfileMenu
              profile={profile}
              initial={initial}
              signOut={signOut}
              compact
              status={presence.status}
              emoji={presence.customStatus?.emoji}
              onStatus={() => setStatusOpen(true)}
            />
          </div>
        </header>
      )}

      {/* Content - strictly using token gutters: 16px (px-4), 24px (sm:px-6), 32px (lg:px-8) */}
      <main className={`relative z-10 flex min-h-0 flex-1 flex-col ${
        isConversation || isReels
          ? "w-full overflow-hidden"
          : "mx-auto w-full max-w-3xl overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      }`}>
        <Outlet />
      </main>

      {/* Global voice call bar */}
      <VoiceCallBar />

      {/* Mobile bottom nav — 5 items, center FAB with 48px min touch height */}
      {!isConversation && (
        <nav className="md:hidden z-30 shrink-0 bg-card/90 backdrop-blur-md border-t border-border px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <div className="flex items-center justify-between gap-1">
            {mobileTabs.slice(0, 2).map((t) => (
              <NavBtn key={t.to} to={t.to} label={t.label} Icon={t.icon} active={isActive(t.to)} />
            ))}
            {!isReels && (
              <button
                onClick={() => setComposerOpen(true)}
                className="flex-1 flex flex-col items-center gap-0.5 py-1 -mt-4 focus-visible:outline-none"
                aria-label="New post"
              >
                <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center ring-4 ring-background shadow-md transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring">
                  <Plus className="h-5 w-5" />
                </div>
              </button>
            )}
            {mobileTabs.slice(2).map((t) => (
              <NavBtn key={t.to} to={t.to} label={t.label} Icon={t.icon} active={isActive(t.to)} />
            ))}
            <button
              onClick={() => setMoreOpen(true)}
              className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1 focus-visible:outline-none"
              aria-label="More"
            >
              <div className="p-1 rounded-lg">
                <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">More</span>
            </button>
          </div>
        </nav>
      )}

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="border-border bg-card max-w-lg">
          <DialogTitle className="font-display text-xl">Create post</DialogTitle>
          <Suspense fallback={<div className="h-24 rounded-2xl bg-surface-2 animate-pulse" />}>
            <PostComposer onPosted={() => setComposerOpen(false)} />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Mobile "More" drawer */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="border-border bg-card rounded-t-3xl max-h-[85dvh] overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <SheetHeader className="text-left pt-2">
            <SheetTitle className="font-display text-xl">Everything on RIZZ</SheetTitle>
          </SheetHeader>

          {/* Profile card */}
          <Link
            to="/u/$username"
            params={{ username: profile?.username ?? "" }}
            className="mt-4 flex items-center gap-3 p-3 rounded-2xl border border-border bg-card/60 hover:bg-card transition-colors min-h-[56px]"
          >
            <UserAvatar
              src={profile?.avatar_url}
              fallback={initial}
              size="lg"
              presence={presence.status}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-foreground">{profile?.display_name || profile?.username}</p>
              <p className="text-xs text-muted-foreground truncate">@{profile?.username} · View profile</p>
            </div>
          </Link>

          {/* Grid of destinations */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {sideTabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={navTile(isActive(t.to))}
              >
                <t.icon className="h-5 w-5" />
                <span className="text-[11px] font-medium text-center leading-tight">{t.label}</span>
              </Link>
            ))}
            <Link to="/notifications" className={`relative ${navTile(isActive("/notifications"))}`}>
              <Bell className="h-5 w-5" />
              <span className="text-[11px] font-medium">Inbox</span>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-primary text-primary-foreground px-1.5 rounded-full">
                  {unreadBadge}
                </span>
              )}
            </Link>
            <Link to="/bookmarks" className={navTile(isActive("/bookmarks"))}>
              <Bookmark className="h-5 w-5" />
              <span className="text-[11px] font-medium">Saved</span>
            </Link>
            <Link to="/effects" className={`relative ${navTile(isActive("/effects"))}`}>
              <Palette className="h-5 w-5" />
              <span className="text-[11px] font-medium">Effects</span>
              <span className="absolute top-1 right-1 text-[8px] font-bold border border-primary text-primary px-1 rounded-full">
                Soon
              </span>
            </Link>
            <Link to="/settings" className={navTile(path === "/settings")}>
              <Settings className="h-5 w-5" />
              <span className="text-[11px] font-medium">Settings</span>
            </Link>
            <Link to="/settings/appearance" className={navTile(isActive("/settings/appearance"))}>
              <Palette className="h-5 w-5" />
              <span className="text-[11px] font-medium">Theme</span>
            </Link>
          </div>

          <button
            onClick={() => { setMoreOpen(false); signOut(); }}
            className="mt-4 w-full min-h-[48px] flex items-center justify-center gap-2 p-3 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive font-medium text-sm transition-colors hover:bg-destructive/20"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </SheetContent>
      </Sheet>

      <PresenceSheet open={statusOpen} onOpenChange={setStatusOpen} />
      <ExternalLinkGuard />
      <ReactionBurstLayer />

      <Suspense fallback={null}>
        <IncomingCallRinger />
        <CommandPalette />
        <AppOverlays />
        <KeyboardShortcuts profileUsername={profile?.username} />
      </Suspense>
    </div>
  );
}

function NavBtn({ to, label, Icon, active }: { to: string; label: string; Icon: any; active: boolean }) {
  return (
    <Link
      to={to}
      className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1 focus-visible:outline-none"
    >
      <div className={`grid h-8 w-8 place-items-center rounded-xl transition-all ${active ? "bg-primary/10" : ""}`}>
        <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <span className={`text-[10px] font-medium ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>
        {label}
      </span>
    </Link>
  );
}

function ProfileMenu({
  profile,
  initial,
  signOut,
  compact,
  status,
  emoji,
  onStatus,
}: {
  profile: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  initial: string;
  signOut: () => Promise<void>;
  compact?: boolean;
  status?: PublicPresence;
  emoji?: string | null;
  onStatus?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={status ? `Your profile. Status: ${statusLabel(status)}` : "Your profile"}
          className={`relative flex items-center gap-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            compact
              ? "h-11 w-11 justify-center rounded-full hover:bg-surface-2 active:bg-surface-3"
              : "p-2 rounded-xl hover:bg-surface-2 w-full min-h-[44px]"
          }`}
        >
          <div className="relative inline-flex items-center justify-center">
            <UserAvatar
              src={profile?.avatar_url}
              fallback={initial}
              size={compact ? "sm" : "md"}
              presence={emoji ? undefined : status}
            />
            {emoji && (
              <span className="pointer-events-none absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-background ring-1 ring-border text-[9px] leading-none">
                {emoji}
              </span>
            )}
          </div>
          {!compact && (
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate text-foreground">{profile?.display_name || profile?.username}</p>
              <p className="text-xs text-muted-foreground truncate">@{profile?.username}</p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border-border w-56 shadow-xl">
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">@{profile?.username}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {onStatus && (
          <DropdownMenuItem onClick={onStatus} className="min-h-[44px] cursor-pointer">
            <span className="mr-2 grid h-4 w-4 place-items-center">
              {emoji ? (
                <span className="text-sm leading-none">{emoji}</span>
              ) : status ? (
                <StatusDot status={status} size={9} ring={false} />
              ) : null}
            </span>
            Status · {status ? statusShortLabel(status) : "Online"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className="min-h-[44px] cursor-pointer">
          <Link to="/u/$username" params={{ username: profile?.username ?? "" }}>
            <UserIcon className="mr-2 h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-[44px] cursor-pointer">
          <Link to="/bookmarks"><Bookmark className="mr-2 h-4 w-4" /> Saved</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-[44px] cursor-pointer">
          <Link to="/effects" className="flex items-center justify-between">
            <span className="flex items-center"><Palette className="mr-2 h-4 w-4" /> Effects</span>
            <span className="text-[9px] font-bold border border-primary text-primary px-1 rounded-full">Soon</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-[44px] cursor-pointer">
          <Link to="/badges"><Trophy className="mr-2 h-4 w-4" /> Badges</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-[44px] cursor-pointer">
          <Link to="/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-[44px] cursor-pointer">
          <Link to="/settings/appearance"><Palette className="mr-2 h-4 w-4" /> Appearance</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="min-h-[44px] cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
