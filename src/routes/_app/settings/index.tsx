import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Bell,
  ChevronRight,
  Palette,
  Shield,
  Sliders,
  Sparkles,
  UserCog,
  UserRound,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { applyPrefs, loadPrefs } from "@/lib/prefs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceSheet } from "@/components/presence/PresenceSheet";
import { AvatarWithStatus, CustomStatusLine } from "@/components/presence/StatusDot";
import { statusLabel, useSelfPresence } from "@/lib/presence";

export const Route = createFileRoute("/_app/settings/")({
  head: () => ({ meta: [{ title: "Settings · RIZZ" }] }),
  component: SettingsHubPage,
});

type SettingsSection = {
  to:
    | "/settings/profile"
    | "/settings/appearance"
    | "/settings/notifications"
    | "/settings/preferences"
    | "/settings/voice"
    | "/settings/blocked"
    | "/settings/account"
    | "/effects";
  label: string;
  description: string;
  icon: LucideIcon;
  soon?: boolean;
};

function SettingsHubPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [statusOpen, setStatusOpen] = useState(false);
  const presence = useSelfPresence();

  // Built per render (not module scope) so labels follow the live language.
  const SECTIONS: SettingsSection[] = [
    { to: "/settings/profile", label: t("profile"), description: t("settings_profile_desc"), icon: UserRound },
    { to: "/settings/appearance", label: t("appearance"), description: t("settings_appearance_desc"), icon: Palette },
    { to: "/settings/notifications", label: t("notifications"), description: t("settings_notifications_desc"), icon: Bell },
    { to: "/settings/voice", label: t("settings_voice_label"), description: t("settings_voice_desc"), icon: Volume2 },
    { to: "/settings/preferences", label: t("preferences"), description: t("settings_preferences_desc"), icon: Sliders },
    { to: "/settings/blocked", label: t("settings_blocked_label"), description: t("settings_blocked_desc"), icon: Shield },
    { to: "/settings/account", label: t("settings_account_label"), description: t("settings_account_desc"), icon: UserCog },
    { to: "/effects", label: t("effects"), description: t("settings_effects_desc"), icon: Palette },
  ];

  useEffect(() => {
    applyPrefs(loadPrefs());
  }, []);

  if (!profile) return null;
  const initial = (profile.display_name || profile.username || "?").charAt(0).toUpperCase();

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="font-display text-xl sm:text-2xl font-bold">{t("settings")}</h1>

      <Link
        to="/settings/profile"
        className="flex items-center gap-3.5 rounded-2xl border border-white/5 glass p-3.5 transition-colors hover:bg-white/5"
      >
        <Avatar className="h-12 w-12 ring-2 ring-primary/40">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{profile.display_name || profile.username}</p>
          <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <button
        type="button"
        onClick={() => setStatusOpen(true)}
        className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-white/5 glass px-4 py-2.5 text-left transition-colors hover:bg-white/5"
      >
        <AvatarWithStatus status={presence.status} dotSize={11}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">{initial}</AvatarFallback>
          </Avatar>
        </AvatarWithStatus>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t("status")}</span>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="shrink-0">{statusLabel(presence.status)}</span>
            {presence.customStatus && <CustomStatusLine status={presence.customStatus} className="min-w-0" />}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <nav className="overflow-hidden rounded-2xl border border-white/5 glass">
        {SECTIONS.map((section, index) => (
          <Link
            key={section.to}
            to={section.to}
            className={`flex min-h-[56px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5 ${
              index > 0 ? "border-t border-white/5" : ""
            }`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-primary">
              <section.icon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold leading-tight">
                {section.label}
                {section.soon && (
                  <span className="rounded-full border border-primary px-1.5 py-0.5 text-[9px] font-bold leading-none text-primary">
                    {t("soon")}
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground mt-0.5">{section.description}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </nav>

      <Link
        to="/tutorial"
        search={{ replay: true }}
        className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.045] px-4 py-2.5 transition-colors hover:bg-primary/[0.08]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight">Welcome tour</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            Replay Rizzy’s eight-scene tour
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      <PresenceSheet open={statusOpen} onOpenChange={setStatusOpen} />
    </div>
  );
}
