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
  { to: "/dms", label: "Messages", icon: MessageCircle },
  { to: "/chat-stories", label: "Chat Stories", icon: MessageSquareText },
  { to: "/bookmarks", label: "Saved", icon: Bookmark },
  { to: "/badges", label: "Badges", icon: Trophy },
  { to: "/leaderboard", label: "Top", icon: Trophy },
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

  // Unread DMs, straight from `direct_messages.read` — the same flag the DM
  // list uses, so the badge means exactly "there are messages you have not
  // opened". Nothing cosmetic, nothing that depends on what you have visited.
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
  // A realm's own pages (/r/<slug>/settings) keep the Realms tab lit even
  // though they do not live under /realms. Settings subpages highlight their
  // parent, and the Appearance tile stays exact so it never lights Settings too.
  const isActive = (to: string) =>
    path === to || (to !== "/feed" && path.startsWith(to + "/")) || (to === "/realms" && path.startsWith("/r/"));

  /** Nav items have exactly three looks: default, hover and active. Nothing
      depends on whether a section has been visited — that state does not exist. */
  const navItem = (active: boolean) =>
    `flex items-center gap-3 rounded-[8px] px-3 py-2.5 transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    }`;

  /** The same three looks for the bigger tiles in the mobile "More" sheet. */
  const navTile = (active: boolean) =>
    `flex flex-col items-center gap-1.5 rounded-[10px] border p-3 transition-colors ${
      active
        ? "border-transparent bg-primary text-primary-foreground"
        : "border-border bg-card hover:bg-secondary"
    }`;

  return (
    <div className={`relative flex h-dvh min-h-0 w-full flex-col overflow-hidden ${isConversation ? "" : "md:pl-64"}`}>
      {!isConversation && <Suspense fallback={null}><NightclubCanvas /></Suspense>}
      {/* Desktop sidebar */}
      {!isConversation && <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col glass-strong border-r border-white/5 px-4 py-6 z-30">
        <Link to="/feed" className="flex items-center gap-2 mb-6 px-2 group" aria-label="RIZZ home">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center font-display font-bold shadow-glow group-hover:scale-105 transition-transform">R</div>
          <img src="/brand/rizz-cat-logo.svg" alt="" className="h-8 w-8 shrink-0" />
          <span className="font-display text-xl font-bold tracking-tight">RIZZ</span>
        </Link>

        <Button onClick={() => setComposerOpen(true)} className="mb-4 h-10 gap-2 rounded-[8px] font-semibold">
          <Plus className="h-5 w-5" /> New post
        </Button>

        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto -mx-1 px-1">
          <button
            type="button"
            onClick={() => setStatusOpen(true)}
            className="flex min-h-[48px] items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
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
              {/* A real badge: unread messages, not “you have not been here yet”. */}
              {t.to === "/dms" && dmUnreadCount > 0 && (
                <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[10px] font-bold text-primary-foreground">
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
            {(unread.data ?? 0) > 0 && (
              <span className="text-[10px] font-bold bg-[var(--rizz-pink)] text-white px-1.5 py-0.5 rounded-full min-w-5 text-center">{unread.data}</span>
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
      </aside>}

      {/* Mobile top bar — brand, a full-width search field, then notifications
          and your avatar (presence dot included). One tidy row on any phone;
          the status picker lives in the avatar menu. */}
      {!isConversation && <header
        className="chat-bar md:hidden z-30 relative flex shrink-0 items-center gap-2 border-b border-white/5 px-3 pb-2"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0.5rem)" }}
      >
        {/* Brand mark as a plain home link. */}
        <Link
          to="/feed"
          aria-label="RIZZ home"
          className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-gradient-primary font-display text-sm font-bold text-primary-foreground shadow-glow ring-1 ring-inset ring-white/25 transition-transform active:scale-95"
        >
          R
          <span aria-hidden className="pointer-events-none absolute -left-1 -top-3 h-7 w-3 rotate-[28deg] rounded-full bg-white/35 blur-[5px]" />
        </Link>

        {/* One search field for the whole app. It opens the command palette,
            which already searches people, realms, posts and DMs. */}
        <button
          type="button"
          onClick={openSearch}
          aria-label="Search RIZZ"
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] pl-3 pr-2 text-left text-[13px] text-muted-foreground backdrop-blur-sm transition-colors hover:bg-white/[0.08] active:bg-white/[0.11]"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Search people, realms, chats</span>
          <kbd className="hidden shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-sans text-[10px] font-semibold min-[400px]:block">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Link
            to="/notifications"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-white/5 active:bg-white/10"
          >
            <Bell className="h-[19px] w-[19px]" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--rizz-pink)] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-background">
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
      {!isConversation && <nav className="md:hidden z-30 shrink-0 glass-strong border-t border-white/5 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <div className="flex items-center justify-between gap-1">
          {mobileTabs.slice(0, 2).map((t) => (
            <NavBtn key={t.to} to={t.to} label={t.label} Icon={t.icon} active={isActive(t.to)} />
          ))}
          {!isReels && <button onClick={() => setComposerOpen(true)} className="flex-1 flex flex-col items-center gap-0.5 py-1 -mt-5" aria-label="New post">
            <div className="h-12 w-12 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center ring-4 ring-background">
              <Plus className="h-5 w-5 text-primary-foreground" />
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
                className={navTile(isActive(t.to))}
              >
                <t.icon className="h-5 w-5" />
                <span className="text-[11px] font-medium text-center leading-tight">{t.label}</span>
              </Link>
            ))}
            <Link to="/notifications" className={`relative ${navTile(isActive("/notifications"))}`}>
              <Bell className="h-5 w-5" />
              <span className="text-[11px] font-medium">Inbox</span>
              {(unread.data ?? 0) > 0 && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-[var(--rizz-pink)] text-white px-1.5 rounded-full">{unread.data}</span>
              )}
            </Link>
            {/* Same three looks as the sidebar: default, hover, active. Nothing
                here changes because a section has been visited. */}
            <Link to="/bookmarks" className={navTile(isActive("/bookmarks"))}>
              <Bookmark className="h-5 w-5" />
              <span className="text-[11px] font-medium">Saved</span>
            </Link>
            <Link to="/effects" className={`relative ${navTile(isActive("/effects"))}`}>
              <Sparkles className="h-5 w-5" />
              <span className="text-[11px] font-medium">Effects</span>
              <span className="absolute top-1 right-1 text-[8px] font-bold border border-[var(--brand-signal,#c8ff3d)] text-[var(--brand-signal,#c8ff3d)] px-1 rounded-full">Soon</span>
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
            className="mt-4 w-full flex items-center justify-center gap-2 p-3 rounded-2xl glass border border-destructive/30 text-destructive font-medium text-sm"
          >
            <LogOut className="h-4 w-4" /> Sign out
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
    <Link to={to} className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5">
      <div className={`grid h-8 w-8 place-items-center rounded-xl transition-all ${active ? "bg-[var(--rizz-pink)]/15" : ""}`}>
        <Icon className={`h-5 w-5 ${active ? "text-[var(--rizz-pink)]" : "text-muted-foreground"}`} />
      </div>
      <span className={`text-[10px] font-medium ${active ? "text-[var(--rizz-pink)]" : "text-muted-foreground"}`}>{label}</span>
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
          <Avatar className={compact ? "h-8 w-8 ring-2 ring-white/15" : "h-9 w-9 ring-2 ring-[var(--rizz-pink)]/40"}>
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">{initial}</AvatarFallback>
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
          <Link to="/effects" className="flex items-center justify-between">
            <span className="flex items-center"><Sparkles className="mr-2 h-4 w-4" /> Effects</span>
            <span className="text-[9px] font-bold border border-[var(--brand-signal,#c8ff3d)] text-[var(--brand-signal,#c8ff3d)] px-1 rounded-full">Soon</span>
          </Link>
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
