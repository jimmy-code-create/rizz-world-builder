import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Home,
  Compass,
  Plus,
  Bell,
  User as UserIcon,
  LogOut,
  Settings,
  Trophy,
  Hash,
  Coins,
  MessageCircle,
  Bookmark,
  Users,
  Search,
  Palette,
  Film,
  MoreHorizontal,
  MessageSquareText,
  Gamepad2,
  ChevronRight,
  Clock,
  Pin,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { AccountMenu } from "@/components/account/AccountMenu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VoiceCallBar } from "@/components/voice/VoiceCallBar";
import { PresenceSheet } from "@/components/presence/PresenceSheet";
import { ReactionBurstLayer } from "@/components/chat/ReactionBurst";
import { ExternalLinkGuard } from "@/components/chat/LinkPreviews";
import { StatusDot } from "@/components/presence/StatusDot";
import { StatusEmoji } from "@/lib/cat-emoji-text";
import { RizzCat } from "@/components/RizzCat";
import { AppLoader } from "@/components/AppLoader";
import { statusShortLabel, useSelfPresence } from "@/lib/presence";
import { playNotificationPing } from "@/lib/notification-sound";
import { useI18n } from "@/lib/i18n";
import { useUnreadCounts } from "@/lib/use-unread-counts";
import { useBadgeSync } from "@/lib/badge-earning";
import { loadPins, loadRecents, recordRecent, togglePin } from "@/lib/nav-shortcuts";

// Secondary UI and the decorative background are split out of the initial shell
// bundle: they load in their own chunks when first used instead of before paint.
const NightclubCanvas = lazy(() =>
  import("@/components/NightclubCanvas").then((m) => ({ default: m.NightclubCanvas })),
);
const CommandPalette = lazy(() =>
  import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);
const AppOverlays = lazy(() =>
  import("@/components/AppOverlays").then((m) => ({ default: m.AppOverlays })),
);
const KeyboardShortcuts = lazy(() =>
  import("@/components/KeyboardShortcuts").then((m) => ({ default: m.KeyboardShortcuts })),
);
const IncomingCallRinger = lazy(() =>
  import("@/components/IncomingCallRinger").then((m) => ({ default: m.IncomingCallRinger })),
);
const PostComposer = lazy(() =>
  import("@/components/PostComposer").then((m) => ({ default: m.PostComposer })),
);

const sideTabs = [
  { to: "/feed", label: "feed", icon: Home },
  { to: "/reels", label: "reels", icon: Film },
  { to: "/explore", label: "explore", icon: Compass },
  { to: "/groups", label: "groups", icon: Users },
  { to: "/realms", label: "realms", icon: Hash },
  { to: "/drops", label: "bounties", icon: Coins },
  { to: "/dms", label: "messages", icon: MessageCircle },
  { to: "/chat-stories", label: "chat_stories", icon: MessageSquareText },
  { to: "/bookmarks", label: "saved", icon: Bookmark },
  { to: "/badges", label: "badges", icon: Trophy },
  { to: "/leaderboard", label: "leaderboard", icon: Trophy },
  { to: "/games", label: "games", icon: Gamepad2 },
  { to: "/bots", label: "bots", icon: Bot },
] as const;

/**
 * Single source of truth for the More sheet: every screen it can show, so the
 * grouped grid, the pinned chips and the recents row can never drift apart.
 * The screen previously missed Games entirely, so it was unreachable on mobile.
 */
const destinations = {
  "/pulse": { labelKey: "whats_happening", icon: Activity },
  "/feed": { labelKey: "feed", icon: Home },
  "/reels": { labelKey: "reels", icon: Film },
  "/explore": { labelKey: "explore", icon: Compass },
  "/groups": { labelKey: "groups", icon: Users },
  "/realms": { labelKey: "realms", icon: Hash },
  "/chat-stories": { labelKey: "chat_stories", icon: MessageSquareText },
  "/dms": { labelKey: "messages", icon: MessageCircle },
  "/games": { labelKey: "games", icon: Gamepad2 },
  "/bots": { labelKey: "bots", icon: Bot },
  "/drops": { labelKey: "bounties", icon: Coins },
  "/leaderboard": { labelKey: "leaderboard", icon: Trophy },
  "/notifications": { labelKey: "inbox", icon: Bell },
  "/bookmarks": { labelKey: "saved", icon: Bookmark },
  "/badges": { labelKey: "badges", icon: Trophy },
  "/settings": { labelKey: "settings", icon: Settings },
  "/settings/appearance": { labelKey: "theme", icon: Palette },
  "/effects": { labelKey: "effects", icon: Palette },
} as const;

type DestKey = keyof typeof destinations;

const destinationKeys = Object.keys(destinations) as DestKey[];

/** The More sheet, grouped so a long feature list stays understandable. */
const moreGroups: Array<{
  titleKey: string;
  items: Array<{ kind: "dest"; key: DestKey } | { kind: "action"; action: "new-post" }>;
}> = [
  {
    titleKey: "create",
    items: [
      { kind: "action", action: "new-post" },
      { kind: "dest", key: "/effects" },
    ],
  },
  {
    titleKey: "communities",
    items: [
      { kind: "dest", key: "/explore" },
      { kind: "dest", key: "/groups" },
      { kind: "dest", key: "/realms" },
      { kind: "dest", key: "/chat-stories" },
    ],
  },
  {
    titleKey: "play",
    items: [
      { kind: "dest", key: "/games" },
      { kind: "dest", key: "/bots" },
      { kind: "dest", key: "/drops" },
      { kind: "dest", key: "/leaderboard" },
    ],
  },
  {
    titleKey: "you",
    items: [
      { kind: "dest", key: "/notifications" },
      { kind: "dest", key: "/bookmarks" },
      { kind: "dest", key: "/badges" },
      { kind: "dest", key: "/settings" },
      { kind: "dest", key: "/settings/appearance" },
    ],
  },
];

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

const mobileTabs = [
  { to: "/feed", label: "feed", icon: Home },
  { to: "/reels", label: "reels", icon: Film },
  { to: "/dms", label: "messages", icon: MessageCircle },
] as const;

export function AppShell() {
  const { user, profile, loading, profileError, refreshProfile, signOut } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [composerOpen, setComposerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [mobileSignOutConfirm, setMobileSignOutConfirm] = useState(false);
  const [recentDests, setRecentDests] = useState<DestKey[]>([]);
  const [pinnedDests, setPinnedDests] = useState<DestKey[]>([]);
  const [editShortcuts, setEditShortcuts] = useState(false);
  const presence = useSelfPresence();
  // Keeps earned badges current app-wide: awards on mount, re-checks on focus.
  useBadgeSync(user?.id);

  const isConversation =
    /^\/(?:_app\/)?(?:dm\/|g\/|c\/)/.test(path) || /^\/(?:_app\/)?r\/[^/]+\/?$/.test(path);
  const isReels = path === "/reels" || path === "/_app/reels";
  const isWidePage =
    path === "/feed" || path === "/_app/feed" || path === "/badges" || path === "/_app/badges";

  const mainRef = useRef<HTMLElement>(null);

  // Preserve and restore main scroll position across tabs and reloads
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const saved = sessionStorage.getItem(`rizz_main_scroll_${path}`);
    if (saved !== null) {
      const scrollY = parseInt(saved, 10);
      if (!isNaN(scrollY) && scrollY > 0) {
        requestAnimationFrame(() => {
          if (mainRef.current) mainRef.current.scrollTop = scrollY;
        });
      }
    }

    const onScroll = () => {
      sessionStorage.setItem(`rizz_main_scroll_${path}`, String(mainEl.scrollTop));
    };

    mainEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      mainEl.removeEventListener("scroll", onScroll);
    };
  }, [path]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (mainRef.current) {
        sessionStorage.setItem(`rizz_main_scroll_${path}`, String(mainRef.current.scrollTop));
      }
    };
    window.addEventListener("pagehide", onBeforeUnload);
    return () => window.removeEventListener("pagehide", onBeforeUnload);
  }, [path]);

  // Close the More sheet whenever the route changes
  useEffect(() => {
    setMoreOpen(false);
  }, [path]);

  // Load pinned / recent shortcuts on the client, then remember every visit.
  useEffect(() => {
    const known = destinationKeys as readonly string[];
    setRecentDests(loadRecents().filter((key) => known.includes(key)) as DestKey[]);
    setPinnedDests(loadPins().filter((key) => known.includes(key)) as DestKey[]);
  }, []);

  useEffect(() => {
    const normalized = path.replace(/^\/_app/, "");
    setRecentDests(recordRecent(normalized, destinationKeys) as DestKey[]);
  }, [path]);

  const handleTogglePin = (key: DestKey) => {
    const next = togglePin(key);
    setPinnedDests(
      next.filter((item): item is DestKey => destinationKeys.includes(item as DestKey)),
    );
  };

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

  const counts = useUnreadCounts();

  const lastUnread = useRef<number | null>(null);
  const notificationCount = counts.loaded ? counts.notifications : null;
  useEffect(() => {
    if (notificationCount === null) return;
    const previous = lastUnread.current;
    lastUnread.current = notificationCount;
    if (previous === null || notificationCount <= previous) return;
    if (typeof document !== "undefined" && !document.hidden) return;
    playNotificationPing();
  }, [notificationCount]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`unread-notifs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["unread-notifs", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  if (profileError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">{profileError}</p>
        <Button variant="outline" onClick={() => void refreshProfile()}>
          Retry
        </Button>
      </div>
    );
  }

  if (loading || !user || !profile?.username || !profile.tutorial_seen) {
    return <AppLoader />;
  }

  const initial = (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase();
  const unreadCount = counts.notifications;
  const unreadBadge = unreadCount > 9 ? "9+" : String(unreadCount);
  const dmUnreadCount = counts.messages;
  const dmBadge = dmUnreadCount > 9 ? "9+" : String(dmUnreadCount);

  const isActive = (to: string) =>
    path === to ||
    (to !== "/feed" && path.startsWith(to + "/")) ||
    (to === "/realms" && path.startsWith("/r/"));

  return (
    <div
      className={`relative flex h-dvh min-h-0 w-full flex-col overflow-hidden ${isConversation ? "" : "md:pl-64"}`}
    >
      {!isConversation && (
        <Suspense fallback={null}>
          <NightclubCanvas />
        </Suspense>
      )}

      {/* Desktop sidebar */}
      {!isConversation && (
        <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-card/60 backdrop-blur-md border-r border-border px-4 py-6 z-30">
          <Link
            to="/feed"
            className="flex items-center gap-2.5 mb-6 px-2 group"
            aria-label="RIZZ home"
          >
            <div className="h-10 w-10 rounded-2xl bg-surface-2 border border-border flex items-center justify-center p-1.5 transition-transform group-hover:scale-105">
              <img
                src="/brand/rizz-cat-logo.svg"
                alt="RIZZ"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              RIZZ
            </span>
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
              onClick={openSearch}
              className="flex min-h-[44px] items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground transition-all hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="h-5 w-5" />
              <span className="font-medium text-sm flex-1 text-left">
                {t("search_placeholder")}
              </span>
              <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setStatusOpen(true)}
              className="flex min-h-[44px] items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground transition-all hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {presence.customStatus?.emoji ? (
                <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center leading-none">
                  <StatusEmoji emoji={presence.customStatus.emoji} size={18} />
                </span>
              ) : (
                <StatusDot status={presence.status} size={12} ring={false} />
              )}
              <span className="font-medium text-sm flex-1 text-left">Status</span>
              <span className="text-xs">{statusShortLabel(presence.status)}</span>
            </button>
            <Link to="/pulse" className={navItem(isActive("/pulse"))}>
              <Activity className="h-5 w-5" />
              <span className="flex-1 text-sm font-medium">{t("whats_happening")}</span>
            </Link>
            {sideTabs.map((tab) => (
              <Link key={tab.to} to={tab.to} className={navItem(isActive(tab.to))}>
                <tab.icon className="h-5 w-5" />
                <span className="flex-1 text-sm font-medium">{t(tab.label)}</span>
                {tab.to === "/dms" && dmUnreadCount > 0 && (
                  <span
                    className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
                      isActive(tab.to)
                        ? "bg-primary-foreground text-primary"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {dmBadge}
                  </span>
                )}
              </Link>
            ))}
            <Link to="/notifications" className={navItem(isActive("/notifications"))}>
              <Bell className="h-5 w-5" />
              <span className="font-medium text-sm flex-1">{t("inbox")}</span>
              {unreadCount > 0 && (
                <span
                  className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
                    isActive("/notifications")
                      ? "bg-primary-foreground text-primary"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
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
              <span className="font-medium text-sm">{t("profile")}</span>
            </Link>
          </nav>

          <AccountMenu profile={profile} initial={initial} signOut={signOut} />
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
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 border border-border p-1.5 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-surface-3"
          >
            <img
              src="/brand/rizz-cat-logo.svg"
              alt="RIZZ"
              className="h-full w-full object-contain"
            />
          </Link>

          <Link
            to="/explore"
            aria-label="Search and Explore RIZZ"
            className="flex h-11 min-h-[44px] min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border bg-surface-2/60 px-3.5 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-2 active:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{t("search_placeholder")}</span>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              to="/notifications"
              aria-label={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
              }
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-surface-2 active:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground ring-2 ring-background">
                  {unreadBadge}
                </span>
              )}
            </Link>
            <AccountMenu
              profile={profile}
              initial={initial}
              signOut={signOut}
              compact
              onStatus={() => setStatusOpen(true)}
            />
          </div>
        </header>
      )}

      {/* Content - strictly using token gutters: 12px (px-3), 16px (sm:px-4), 24px (lg:px-6) */}
      <main
        ref={mainRef}
        className={`relative z-10 flex min-h-0 flex-1 flex-col ${
          isConversation || isReels
            ? "w-full overflow-hidden"
            : isWidePage
              ? "mx-auto w-full max-w-7xl overflow-y-auto px-3 sm:px-4 lg:px-6 py-3 md:py-4"
              : "mx-auto w-full max-w-3xl overflow-y-auto px-3 sm:px-4 lg:px-6 py-3 md:py-4"
        }`}
      >
        <Outlet />
      </main>

      {/* Global voice call bar */}
      <VoiceCallBar />

      {/* Mobile bottom nav — 5 items, center FAB with 48px min touch height */}
      {!isConversation && (
        <nav className="md:hidden z-30 shrink-0 bg-card/90 backdrop-blur-md border-t border-border px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <div className="flex items-center justify-between gap-1">
            {mobileTabs.slice(0, 2).map((tab) => {
              const label = t(tab.label);
              return (
                <NavBtn
                  key={tab.to}
                  to={tab.to}
                  label={label}
                  Icon={tab.icon}
                  active={isActive(tab.to)}
                />
              );
            })}
            {!isReels && (
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="flex-1 flex flex-col items-center justify-center -mt-4 min-h-[44px] min-w-[44px] focus-visible:outline-none"
                aria-label="New post"
              >
                <div className="h-12 w-12 min-h-[44px] min-w-[44px] rounded-full bg-[#c8ff3d] text-[#0a0a0b] flex items-center justify-center ring-4 ring-background shadow-md transition-transform active:scale-95 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring">
                  <Plus className="h-6 w-6 stroke-[2.5]" />
                </div>
              </button>
            )}
            {mobileTabs.slice(2).map((tab) => {
              const label = t(tab.label);
              return (
                <NavBtn
                  key={tab.to}
                  to={tab.to}
                  label={label}
                  Icon={tab.icon}
                  active={isActive(tab.to)}
                />
              );
            })}
            <button
              onClick={() => setMoreOpen(true)}
              className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1 focus-visible:outline-none"
              aria-label={t("more")}
            >
              <div className="p-1 rounded-lg">
                <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{t("more")}</span>
            </button>
          </div>
        </nav>
      )}

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="border-border bg-card max-w-lg">
          <DialogTitle className="font-display text-xl">{t("create_post")}</DialogTitle>
          <Suspense fallback={<div className="h-24 rounded-2xl bg-surface-2 animate-pulse" />}>
            <PostComposer onPosted={() => setComposerOpen(false)} />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Mobile "More" drawer */}
      <Sheet
        open={moreOpen}
        onOpenChange={(open) => {
          setMoreOpen(open);
          if (!open) setEditShortcuts(false);
        }}
      >
        <SheetContent
          side="bottom"
          className="border-border bg-card rounded-t-3xl max-h-[85dvh] overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <SheetHeader className="text-left pt-2 pr-8">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="font-display text-xl">{t("everything_on_rizz")}</SheetTitle>
              <button
                type="button"
                onClick={() => setEditShortcuts((editing) => !editing)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {editShortcuts ? t("done") : t("edit")}
              </button>
            </div>
            {editShortcuts && <p className="mt-1 text-xs text-muted-foreground">{t("pin_hint")}</p>}
          </SheetHeader>

          {/* Search — opens the same command palette as ⌘K on desktop */}
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              openSearch();
            }}
            className="mt-4 flex min-h-[48px] w-full items-center gap-2.5 rounded-2xl border border-border bg-surface-2/60 px-3.5 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-2 active:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{t("search_placeholder")}</span>
          </button>

          {/* What's happening */}
          <Link
            to="/pulse"
            className="mt-3 flex min-h-[64px] items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.07] p-3 transition-colors hover:bg-primary/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Activity className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-foreground">
                {t("whats_happening")}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {t("pulse_subtitle")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>

          {/* Profile card */}
          <Link
            to="/u/$username"
            params={{ username: profile?.username ?? "" }}
            className="mt-3 flex items-center gap-3 p-3 rounded-2xl border border-border bg-card/60 hover:bg-card transition-colors min-h-[56px]"
          >
            <UserAvatar
              src={profile?.avatar_url}
              fallback={initial}
              size="lg"
              presence={presence.status}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-foreground">
                {profile?.display_name || profile?.username}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                @{profile?.username} · {t("view_profile")}
              </p>
            </div>
          </Link>

          {/* Pinned + recently used shortcuts */}
          {!editShortcuts && (pinnedDests.length > 0 || recentDests.length > 0) && (
            <div className="mt-4 space-y-3">
              {pinnedDests.length > 0 && (
                <section>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Pin className="h-3 w-3" /> {t("pinned")}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {pinnedDests.map((key) => (
                      <ShortcutChip key={key} destKey={key} />
                    ))}
                  </div>
                </section>
              )}
              {recentDests.filter((key) => !pinnedDests.includes(key)).length > 0 && (
                <section>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Clock className="h-3 w-3" /> {t("recent")}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {recentDests
                      .filter((key) => !pinnedDests.includes(key))
                      .map((key) => (
                        <ShortcutChip key={key} destKey={key} />
                      ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Grouped destinations */}
          {moreGroups.map((group) => (
            <section key={group.titleKey} className="mt-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(group.titleKey)}
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {group.items.map((item) =>
                  item.kind === "action" ? (
                    <button
                      key={item.action}
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        setComposerOpen(true);
                      }}
                      className={navTile(false)}
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-[11px] font-medium text-center leading-tight">
                        {t("create_post")}
                      </span>
                    </button>
                  ) : (
                    <ShortcutTile
                      key={item.key}
                      destKey={item.key}
                      active={isActive(item.key)}
                      editing={editShortcuts}
                      pinned={pinnedDests.includes(item.key)}
                      badge={
                        item.key === "/notifications" && unreadCount > 0 ? unreadBadge : undefined
                      }
                      onTogglePin={handleTogglePin}
                    />
                  ),
                )}
              </div>
            </section>
          ))}

          <button
            onClick={() => {
              setMoreOpen(false);
              setMobileSignOutConfirm(true);
            }}
            className="mt-4 w-full min-h-[48px] flex items-center justify-center gap-2 p-3 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive font-medium text-sm transition-colors hover:bg-destructive/20"
          >
            <LogOut className="h-4 w-4" /> {t("sign_out")}
          </button>
        </SheetContent>
      </Sheet>

      <AlertDialog open={mobileSignOutConfirm} onOpenChange={setMobileSignOutConfirm}>
        <AlertDialogContent className="glass-strong border-white/10 rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t("sign_out_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("sign_out_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="h-10 rounded-xl glass border-white/10">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void signOut()}
              className="h-10 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

function NavBtn({
  to,
  label,
  Icon,
  active,
}: {
  to: string;
  label: string;
  Icon: any;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1 focus-visible:outline-none"
    >
      <div
        className={`grid h-8 w-8 place-items-center rounded-xl transition-all ${active ? "bg-primary/10" : ""}`}
      >
        <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <span
        className={`text-[10px] font-medium ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </Link>
  );
}

/**
 * A More-sheet tile. In pin-edit mode it toggles its pin instead of
 * navigating, so pinning never needs tiny nested buttons.
 */
function ShortcutTile({
  destKey,
  active,
  editing,
  pinned,
  badge,
  onTogglePin,
}: {
  destKey: DestKey;
  active: boolean;
  editing: boolean;
  pinned: boolean;
  badge?: string;
  onTogglePin: (key: DestKey) => void;
}) {
  const { t } = useI18n();
  const dest = destinations[destKey];
  const className = `relative ${navTile(active)}`;
  const content = (
    <>
      <dest.icon className="h-5 w-5" />
      <span className="text-[11px] font-medium text-center leading-tight">{t(dest.labelKey)}</span>
      {editing ? (
        <Pin
          className={`absolute right-1.5 top-1.5 h-3 w-3 ${
            pinned ? "fill-primary text-primary" : "text-muted-foreground"
          }`}
        />
      ) : badge ? (
        <span className="absolute top-1.5 right-1.5 rounded-full bg-primary px-1.5 text-[9px] font-bold leading-4 text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </>
  );
  return editing ? (
    <button
      type="button"
      onClick={() => onTogglePin(destKey)}
      aria-pressed={pinned}
      className={className}
    >
      {content}
    </button>
  ) : (
    <Link to={destKey} className={className}>
      {content}
    </Link>
  );
}

/** Compact chip for a pinned or recently visited destination. */
function ShortcutChip({ destKey }: { destKey: DestKey }) {
  const { t } = useI18n();
  const dest = destinations[destKey];
  return (
    <Link
      to={destKey}
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <dest.icon className="h-3.5 w-3.5 text-muted-foreground" />
      {t(dest.labelKey)}
    </Link>
  );
}
