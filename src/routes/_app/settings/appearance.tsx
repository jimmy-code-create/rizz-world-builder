import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Check, Palette } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  THEME_MODES,
  THEME_PRESETS,
  applyTheme,
  preferredThemeMode,
  rememberThemeChoice,
  type ThemePreset,
  type ThemeMode,
  type Density,
} from "@/lib/theme";
import { SettingsCard, SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_app/settings/appearance")({
  head: () => ({ meta: [{ title: "Appearance · Settings · RIZZ" }] }),
  component: AppearanceSettingsPage,
});

function AppearanceSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [preset, setPreset] = useState<ThemePreset>((profile?.theme_preset as ThemePreset) || "nightclub");
  const [mode, setMode] = useState<ThemeMode>(() => preferredThemeMode(profile?.theme_mode));
  const [density, setDensity] = useState<Density>((profile?.ui_density as Density) || "comfy");
  const [reduced, setReduced] = useState<boolean>(!!profile?.reduced_motion);
  /* A picker that changes something local confirms it right here, next to the
     control — no toast at the bottom of the window. */
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(0), 2000);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  useEffect(() => {
    if (!profile) return;
    setPreset((profile.theme_preset as ThemePreset) || "nightclub");
    setMode(preferredThemeMode(profile.theme_mode));
    setDensity((profile.ui_density as Density) || "comfy");
    setReduced(!!profile.reduced_motion);
  }, [profile]);

  async function saveAppearance(next: { preset?: ThemePreset; mode?: ThemeMode; density?: Density; reduced?: boolean }) {
    const newPreset = next.preset ?? preset;
    const newMode = next.mode ?? mode;
    const newDensity = next.density ?? density;
    const newReduced = next.reduced ?? reduced;
    if (next.preset) setPreset(next.preset);
    if (next.mode) setMode(next.mode);
    if (next.density) setDensity(next.density);
    if (next.reduced !== undefined) setReduced(next.reduced);
    if (next.mode) {
      rememberThemeChoice();
      try {
        localStorage.setItem("rizz.mode", next.mode);
      } catch {
        /* storage off: applyTheme still updates this session */
      }
    }
    applyTheme(newPreset, newMode, newDensity, newReduced);
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ theme_preset: newPreset, theme_mode: newMode, ui_density: newDensity, reduced_motion: newReduced } as any)
      .eq("id", user.id);
    await refreshProfile();
    setSavedAt(Date.now());
  }

  if (!profile) return null;

  return (
    <SettingsSubPage
      title="Appearance"
      description="Tune the vibe, brightness and layout."
      icon={<Palette className="h-5 w-5" />}
    >
      <SettingsCard className="space-y-5">
        <div className="flex min-h-[1rem] items-center justify-end" aria-live="polite">
          {savedAt ? (
            <span
              role="status"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700"
            >
              <Check className="h-3 w-3" aria-hidden /> {t("appearance_saved")}
            </span>
          ) : null}
        </div>
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">{t("appearance_theme")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {THEME_PRESETS.map((t) => {
              const active = preset === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => saveAppearance({ preset: t.id })}
                  className={`relative rounded-[10px] border p-3 text-left transition-colors ${active ? "border-primary ring-1 ring-primary/15" : "border-border hover:border-foreground/25"}`}
                >
                  <div className="mb-2 flex gap-1">
                    {t.colors.map((c) => (
                      <span key={c} className="h-5 w-5 rounded-full ring-1 ring-border" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{t.name}</span>
                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">{t("appearance_mode")}</Label>
          {/* Four modes, not three: AMOLED black is what OLED phones ask for, and
              it is the mode the forum, chat and feed all answer to. */}
          <div className="grid grid-cols-2 gap-2">
            {THEME_MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => saveAppearance({ mode: m.id })}
                  aria-pressed={active}
                  className={`flex items-center justify-between gap-2 rounded-[8px] border px-3 py-2 text-left text-sm font-medium transition-colors ${active ? "border-transparent bg-primary text-primary-foreground" : "border-border hover:bg-secondary"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{m.label}</span>
                    <span className={`block truncate text-[10px] font-normal ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {m.hint}
                    </span>
                  </span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">{t("appearance_density")}</Label>
          <div className="flex gap-2">
            {(["comfy", "compact"] as Density[]).map((d) => (
              <button
                key={d}
                onClick={() => saveAppearance({ density: d })}
                className={`flex-1 rounded-[8px] border px-3 py-2 text-sm font-medium capitalize transition-colors ${density === d ? "border-transparent bg-primary text-primary-foreground" : "border-border hover:bg-secondary"}`}
              >
                {d === "comfy" ? t("density_comfy") : t("density_compact")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">{t("appearance_reduced_motion")}</Label>
            <p className="text-[11px] text-muted-foreground">{t("appearance_reduced_motion_desc")}</p>
          </div>
          <Switch checked={reduced} onCheckedChange={(v) => saveAppearance({ reduced: v })} />
        </div>
      </SettingsCard>
    </SettingsSubPage>
  );
}
