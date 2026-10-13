import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Bot, Home, Compass, Plus, Bell, User as UserIcon, LogOut, Settings, Trophy, Hash, Gift, MessageCircle, Bookmark, Sparkles, Users, Search, Palette, Film, MoreHorizontal, MessageSquareText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  { to: "/dms", label: "DMs", icon: MessageCircle },
  { to: "/chat-stories", label: "Chat Stories", icon: MessageSquareText },
  { to: "/bookmarks", label: "Saved", icon: Bookmark },
  { to: "/effects", label: "Effects", icon: Sparkles },
  { to: "/badges", label: "Badges", icon: Trophy },
  { to: "/leaderboard", label: "Top", icon: Trophy },
  { to: "/bots", label: "Bots", icon: Bot },
] as const;

const mobileTabs = [
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/reels", label: "Reels", icon: Film },
  { to: "/dms", label: "DMs", icon: MessageCircle },
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
  // Chat surfaces scroll themselves (their message list owns the viewport) and
  // hide the shell chrome. Realm settings lives at /r/<slug>/settings, which is
  // a normal page: matching it here left it inside an `overflow-hidden` column
  // with no scroller of its own, so nothing below the first screen could be
  // reached on a phone.
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

  // Allow the keyboard shortcut "n" (and other places) to open the composer
  useEffect(() => {
    const open = () => setComposerOpen(true);
    window.addEventListener("rizz:new-post", open);
    return () => window.removeEventListener("rizz:new-post", open);
  }, []);

  // The header's search field opens the command palette, which already searches
  // people, realms, posts and messages from anywhere in the app.
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

  const unreadDms = useQuery({
    queryKey: ["unread-dms-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("direct_messages" as any)
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
  });

  // A new ping chimes softly (never under Do not disturb, never when the
  // "Notification sounds" preference is off).
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

  // Realtime replaces the old 30s poll for the unread badge, so the shell stops
  // refetching (and re-rendering) on a timer while nothing is happening.
  useEffect(() => {
    if (!user) return;
    const channel1 = supabase
      .channel(`unread-notifs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => { qc.invalidateQueries({ queryKey: ["unread-notifs", user.id] }); },
      )
      .subscribe();
    const channel2 = supabase
      .channel(`unread-dms-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${user.id}` },
        () => { qc.invalidateQueries({ queryKey: ["unread-dms-count", user.id] }); },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
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
  const unreadDmsCount = unreadDms.data ?? 0;

  // Active route matching: supports deep links, refresh, and nested routes.
  const isActive = (to: string) => {
    if (to === "/feed") return path === "/" || path === "/feed" || path.startsWith("/feed/");
    if (to === "/dms") return path === "/dms" || path.startsWith("/dm/") || path.startsWith("/call/");
    if (to === "/groups") return path === "/groups" || path.startsWith("/g/") || path.startsWith("/join/");
    if (to === "/realms") return path === "/realms" || path.startsWith("/r/") || path.startsWith("/join-realm/");
    if (to === "/bots") return path === "/bots" || path.startsWith("/bots");
    if (to === "/settings") return path === "/settings" || path.startsWith("/settings/");
    return path === to || path.startsWith(to + "/");
  };

  return (
    <div className={`relative flex h-dvh min-h-0 w-full flex-col overflow-hidden ${isConversation ? "" : "md:pl-64"}`}>
      {!isConversation && <Suspense fallback={null}><NightclubCanvas /></Suspense>}
      {/* Desktop sidebar */}
      {!isConversation && <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-sidebar border-r border-border px-4 py-6 z-30">
        <Link to="/feed" className="flex items-center gap-2.5 mb-6 px-2 group" aria-label="RIZZ home">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-base">R</div>
          <span className="font-display text-xl font-bold tracking-tight text-foreground">RIZZ</span>
        </Link>

        <Button onClick={() => setComposerOpen(true)} className="mb-4 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 rounded-lg h-10 gap-2 shadow-none border-0">
          <Plus className="h-5 w-5 shrink-0" /> New post
        </Button>

        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto -mx-1 px-1">
          <button
            type="button"
            onClick={() => setStatusOpen(true)}
            className="flex min-h-[44px] items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
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
          {sideTabs.map((t) => {
            const active = isActive(t.to);
            const badgeCount = t.to === "/dms" ? unreadDmsCount : 0;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors font-medium text-sm ${
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <t.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 truncate">{t.label}</span>
                {badgeCount > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center ${active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"}`}>
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            to="/notifications"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors font-medium text-sm ${
              isActive("/notifications")
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Bell className="h-5 w-5 shrink-0" />
            <span className="flex-1 truncate">Inbox</span>
            {unreadCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center ${isActive("/notifications") ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"}`}>
                {unreadBadge}
              </span>
            )}
          </Link>
          <Link
            to="/u/$username"
            params={{ username: profile?.username ?? "" }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors font-medium text-sm ${
              path.startsWith("/u/")
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <UserIcon className="h-5 w-5 shrink-0" />
            <span className="flex-1 truncate">Profile</span>
          </Link>
        </nav>

        <ProfileMenu profile={profile} initial={initial} signOut={signOut} />
      </aside>}

      {/* Mobile top bar — brand, a full-width search field, then notifications
          and your avatar (presence dot included). */}
      {!isConversation && <header
        className="chat-bar md:hidden z-30 relative flex shrink-0 items-center gap-2 border-b border-border px-3 pb-2"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0.5rem)" }}
      >
        {/* Brand mark as a plain home link. */}
        <Link
          to="/feed"
          aria-label="RIZZ home"
          className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground shadow-none transition-transform active:scale-95"
        >
          R
        </Link>

        {/* One search field for the whole app. It opens the command palette */}
        <button
          type="button"
          onClick={openSearch}
          aria-label="Search RIZZ"
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card pl-3 pr-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted/40"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Search people, realms, chats</span>
          <kbd className="hidden shrink-0 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-sans text-[10px] font-semibold min-[400px]:block">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Link
            to="/notifications"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg text-foreground transition-colors hover:bg-muted/50 active:bg-muted"
          >
            <Bell className="h-[19px] w-[19px]" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
                {unreadBadge}
              </span>
            )}
          </Link>
          {/* Status lives inside the avatar menu: the bar now carries brand,
              search, notifications and you, and nothing else. */}
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
      </header>}

      {/* Content */}
      <main className={`relative z-10 flex min-h-0 flex-1 flex-col ${
        isConversation || isReels
          ? "w-full overflow-hidden"
          : "mx-auto w-full max-w-3xl overflow-y-auto px-4 py-6 md:px-8 md:py-10"
      }`}>
        <Outlet />
      </main>

      {/* Global voice call bar — sits above the nav, never over the composer */}
      <VoiceCallBar />

      {/* Mobile bottom nav — 5 items, center FAB */}
      {!isConversation && <nav className="md:hidden z-30 shrink-0 bg-sidebar border-t border-border px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <div className="flex items-center justify-between gap-1">
          {mobileTabs.slice(0, 2).map((t) => (
            <NavBtn key={t.to} to={t.to} label={t.label} Icon={t.icon} active={isActive(t.to)} />
          ))}
          {!isReels && <button onClick={() => setComposerOpen(true)} className="flex-1 flex flex-col items-center gap-0.5 py-1 -mt-4" aria-label="New post">
            <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center ring-4 ring-background">
              <Plus className="h-5 w-5 shrink-0" />
            </div>
          </button>}
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
      </nav>}

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="glass-strong border-white/10 max-w-lg">
          <DialogTitle className="font-display text-xl">Create post</DialogTitle>
          <Suspense fallback={<div className="h-24 rounded-2xl skeleton-shimmer" />}>
            <PostComposer onPosted={() => setComposerOpen(false)} />
          </Suspense>
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
            className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
          >
            <Avatar className="h-12 w-12 ring-2 ring-border">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-secondary text-foreground font-bold">{initial}</AvatarFallback>
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
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
                  isActive(t.to) ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-card border-border hover:bg-muted/40"
                }`}
              >
                <t.icon className="h-5 w-5 shrink-0" />
                <span className="text-[11px] font-medium text-center leading-tight">{t.label}</span>
              </Link>
            ))}
            <Link
              to="/notifications"
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
                isActive("/notifications") ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-card border-border hover:bg-muted/40"
              }`}
            >
              <Bell className="h-5 w-5 shrink-0" />
              <span className="text-[11px] font-medium">Inbox</span>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-primary text-primary-foreground px-1.5 rounded-full">{unreadCount}</span>
              )}
            </Link>
            <Link to="/bookmarks" className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-border hover:bg-muted/40">
              <Bookmark className="h-5 w-5 shrink-0" />
              <span className="text-[11px] font-medium">Saved</span>
            </Link>
            <Link to="/settings" className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-border hover:bg-muted/40">
              <Settings className="h-5 w-5 shrink-0" />
              <span className="text-[11px] font-medium">Settings</span>
            </Link>
            <Link to="/settings/appearance" className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-border hover:bg-muted/40">
              <Palette className="h-5 w-5 shrink-0" />
              <span className="text-[11px] font-medium">Theme</span>
            </Link>
          </div>

          <button
            onClick={() => { setMoreOpen(false); signOut(); }}
            className="mt-4 w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-card border border-destructive/30 text-destructive font-medium text-sm hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 shrink-0" /> Sign out
          </button>
        </SheetContent>
      </Sheet>
      <PresenceSheet open={statusOpen} onOpenChange={setStatusOpen} />
      <ExternalLinkGuard />
      {/* Reaction bursts live outside the chats, so playing one never re-renders
          a message list. */}
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
    <Link to={to} className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
      <div className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${active ? "bg-primary/10" : ""}`}>
        <Icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <span className={`text-[10px] font-medium ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>{label}</span>
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
  /** Presence, drawn as a dot (or status emoji) on the avatar when compact. */
  status?: PublicPresence;
  emoji?: string | null;
  onStatus?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={status ? `Your profile. Status: ${statusLabel(status)}` : "Your profile"}
          className={`relative flex items-center gap-3 transition-colors ${compact ? "h-10 w-10 justify-center rounded-full hover:bg-white/5 active:bg-white/10" : "p-2 rounded-xl hover:bg-white/5 w-full"}`}
        >
          <Avatar className={compact ? "h-8 w-8 ring-2 ring-border" : "h-9 w-9 ring-2 ring-border"}>
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-secondary text-foreground font-bold">{initial}</AvatarFallback>
          </Avatar>
          {!compact && (
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">{profile?.display_name || profile?.username}</p>
              <p className="text-xs text-muted-foreground truncate">@{profile?.username}</p>
            </div>
          )}
          {compact && status && (
            <span className="pointer-events-none absolute bottom-0 right-0 grid h-4 w-4 place-items-center rounded-full bg-background ring-1 ring-white/10">
              {emoji ? (
                <span aria-hidden className="text-[9px] leading-none">{emoji}</span>
              ) : (
                <StatusDot status={status} size={9} ring={false} />
              )}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-strong border-white/10 w-56">
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">@{profile?.username}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {onStatus && (
          <DropdownMenuItem onClick={onStatus}>
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
          <Link to="/settings/appearance"><Palette className="mr-2 h-4 w-4" /> Appearance</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
