import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Home, Compass, Plus, Bell, User as UserIcon, LogOut, Settings, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const tabs = [
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/leaderboard", label: "Top", icon: Trophy },
] as const;

export function AppShell() {
  const { user, profile, loading, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-gradient-primary animate-pulse-glow" />
      </div>
    );
  }

  const initial = (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase();

  return (
    <div className="relative min-h-dvh pb-24 md:pb-0 md:pl-64">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col glass-strong border-r border-white/5 px-5 py-6 z-30">
        <Link to="/feed" className="flex items-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center font-display font-bold shadow-glow">R</div>
          <span className="font-display text-xl font-bold tracking-tight">RIZZ</span>
        </Link>
        <nav className="flex flex-col gap-1 flex-1">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                path === t.to
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <t.icon className="h-5 w-5" />
              <span className="font-medium">{t.label}</span>
            </Link>
          ))}
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
            <span className="font-medium">Profile</span>
          </Link>
        </nav>
        <ProfileMenu profile={profile} initial={initial} signOut={signOut} />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 glass-strong border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <Link to="/feed" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center font-display font-bold text-sm shadow-glow">R</div>
          <span className="font-display text-lg font-bold">RIZZ</span>
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
          </Button>
          <ProfileMenu profile={profile} initial={initial} signOut={signOut} compact />
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-white/5 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <div className="flex items-center justify-around">
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} className="flex-1 flex flex-col items-center gap-1 py-2">
              <div className={`p-2 rounded-xl transition-all ${path === t.to ? "bg-gradient-primary shadow-glow" : ""}`}>
                <t.icon className={`h-5 w-5 ${path === t.to ? "text-primary-foreground" : "text-muted-foreground"}`} />
              </div>
              <span className={`text-[10px] font-medium ${path === t.to ? "text-foreground" : "text-muted-foreground"}`}>{t.label}</span>
            </Link>
          ))}
          <button className="flex-1 flex flex-col items-center gap-1 py-2" onClick={() => nav({ to: "/feed" })}>
            <div className="p-2 rounded-xl bg-gradient-primary shadow-glow">
              <Plus className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">Post</span>
          </button>
          <Link to="/u/$username" params={{ username: profile?.username ?? "" }} className="flex-1 flex flex-col items-center gap-1 py-2">
            <div className={`p-2 rounded-xl transition-all ${path.startsWith("/u/") ? "bg-gradient-primary shadow-glow" : ""}`}>
              <UserIcon className={`h-5 w-5 ${path.startsWith("/u/") ? "text-primary-foreground" : "text-muted-foreground"}`} />
            </div>
            <span className={`text-[10px] font-medium ${path.startsWith("/u/") ? "text-foreground" : "text-muted-foreground"}`}>You</span>
          </Link>
        </div>
      </nav>
    </div>
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
        <DropdownMenuItem asChild>
          <Link to="/u/$username" params={{ username: profile?.username ?? "" }}>
            <UserIcon className="mr-2 h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}