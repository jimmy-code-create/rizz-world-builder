import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Bell,
  ChevronRight,
  Palette,
  Shield,
  Sliders,
  UserCog,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { applyPrefs, loadPrefs } from "@/lib/prefs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_app/settings/")({
  head: () => ({ meta: [{ title: "Settings · RIZZ" }] }),
  component: SettingsHubPage,
});

type SettingsSection = {
  to: "/settings/profile" | "/settings/appearance" | "/settings/notifications" | "/settings/preferences" | "/settings/blocked" | "/settings/account";
  label: string;
  description: string;
  icon: LucideIcon;
};

const SECTIONS: SettingsSection[] = [
  { to: "/settings/profile", label: "Profile", description: "Name, bio, avatar and banner", icon: UserRound },
  { to: "/settings/appearance", label: "Appearance", description: "Theme, mode, density and motion", icon: Palette },
  { to: "/settings/notifications", label: "Notifications", description: "Push alerts and delivery", icon: Bell },
  { to: "/settings/preferences", label: "Preferences", description: "Feeds, media, text size and language", icon: Sliders },
  { to: "/settings/blocked", label: "Blocked accounts", description: "People you've blocked", icon: Shield },
  { to: "/settings/account", label: "Account", description: "Your data, sign out and delete", icon: UserCog },
];

function SettingsHubPage() {
  const { profile } = useAuth();

  useEffect(() => {
    applyPrefs(loadPrefs());
  }, []);

  if (!profile) return null;
  const initial = (profile.display_name || profile.username || "?").charAt(0).toUpperCase();

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      <Link
        to="/settings/profile"
        className="flex items-center gap-4 rounded-3xl border border-white/5 glass p-4 transition-colors hover:bg-white/5"
      >
        <Avatar className="h-14 w-14 ring-2 ring-[var(--rizz-pink)]/40">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-primary text-xl font-bold">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{profile.display_name || profile.username}</p>
          <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <nav className="overflow-hidden rounded-3xl border border-white/5 glass">
        {SECTIONS.map((section, index) => (
          <Link
            key={section.to}
            to={section.to}
            className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/5 ${
              index > 0 ? "border-t border-white/5" : ""
            }`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-[var(--rizz-pink)]">
              <section.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{section.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{section.description}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
