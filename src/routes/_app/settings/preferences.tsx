import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Link2, Shield, Sliders } from "lucide-react";
import { Label } from "@/components/ui/label";
import { PrefRow } from "@/components/settings/PrefRow";
import { SettingsCard, SettingsSubPage } from "@/components/settings/SettingsSubPage";
import { DEFAULT_PREFS, applyPrefs, loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";
import { setRizzCompanionEnabled, useRizzCompanionEnabled } from "@/lib/rizz-companion-preference";
import { areRizzSoundsMuted, setRizzSoundsMuted as persistRizzSoundsMuted } from "@/lib/rizz-sounds";

export const Route = createFileRoute("/_app/settings/preferences")({
  head: () => ({ meta: [{ title: "Preferences · Settings · RIZZ" }] }),
  component: PreferencesSettingsPage,
});

function PreferencesSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const companionEnabled = useRizzCompanionEnabled();
  const [rizzSoundsMutedState, setRizzSoundsMutedState] = useState(false);

  useEffect(() => {
    const p = loadPrefs();
    setPrefs(p);
    applyPrefs(p);
    setRizzSoundsMutedState(areRizzSoundsMuted());
  }, []);

  const updatePref = <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [k]: v };
      savePrefs(next);
      return next;
    });
  };

  return (
    <SettingsSubPage
      title="Preferences"
      description="Feeds, media, accessibility and language."
      icon={<Sliders className="h-5 w-5" />}
    >
      <SettingsCard className="space-y-4">
        <PrefRow label="Autoplay videos" desc="Play reels and clips automatically" checked={prefs.autoplay} onChange={(v) => updatePref("autoplay", v)} />
        <PrefRow
          label="RIZZ Companion"
          desc="Show Lil Rizz for chat and voice help. Saved in this browser."
          checked={companionEnabled}
          onChange={(enabled) => {
            try {
              setRizzCompanionEnabled(enabled);
            } catch {
              toast.error("Couldn't save the companion setting. Allow browser storage and try again.");
            }
          }}
        />
        <PrefRow label="Data saver" desc="Lower quality media on cellular" checked={prefs.dataSaver} onChange={(v) => updatePref("dataSaver", v)} />
        <PrefRow label="Link previews" desc="Show cards for links in chats" checked={prefs.linkPreviews !== false} onChange={(v) => updatePref("linkPreviews", v)} icon={<Link2 className="h-4 w-4" />} />
        <PrefRow label="Notification sounds" desc="Play a chime on new pings" checked={prefs.sounds} onChange={(v) => updatePref("sounds", v)} icon={<Bell className="h-4 w-4" />} />
        <PrefRow
          label="Rizz voice sounds"
          desc="Soft start/stop chime while listening"
          checked={!rizzSoundsMutedState}
          onChange={(v) => {
            persistRizzSoundsMuted(!v);
            setRizzSoundsMutedState(!v);
          }}
          icon={<Bell className="h-4 w-4" />}
        />
        <PrefRow label="Blur sensitive media" desc="Hide flagged content behind a tap" checked={prefs.blurSensitive} onChange={(v) => updatePref("blurSensitive", v)} icon={<Shield className="h-4 w-4" />} />
        <PrefRow label="Focus mode" desc="Hide like and view counts everywhere" checked={prefs.focusMode} onChange={(v) => updatePref("focusMode", v)} />
        <PrefRow label="Color-blind friendly" desc="Tweak palette for better contrast" checked={prefs.colorBlind} onChange={(v) => updatePref("colorBlind", v)} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label htmlFor="mention-highlight-color" className="text-sm font-medium">Mention highlight color</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">Choose how @mentions stand out in chats.</p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <span
              className="rounded-md px-2 py-1 text-sm font-semibold"
              style={{ color: prefs.mentionColor, backgroundColor: `color-mix(in srgb, ${prefs.mentionColor} 18%, transparent)` }}
            >
              @mention
            </span>
            <input
              id="mention-highlight-color"
              aria-label="Mention highlight color"
              type="color"
              value={prefs.mentionColor}
              onChange={(event) => updatePref("mentionColor", event.target.value)}
              className="h-8 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
            />
          </label>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Text size · {Math.round(prefs.textScale * 100)}%</Label>
          <input
            type="range"
            min={0.9}
            max={1.2}
            step={0.01}
            value={prefs.textScale}
            onChange={(e) => {
              // Mark it as an explicit choice so the 90% → 92% migration never touches it.
              updatePref("textScaleCustom", true);
              updatePref("textScale", parseFloat(e.target.value));
            }}
            className="mt-1 w-full accent-primary"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Language</Label>
          <select
            value={prefs.language}
            onChange={(e) => updatePref("language", e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 glass bg-transparent px-3 py-2 text-sm"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="ja">日本語</option>
            <option value="hi">हिन्दी</option>
            <option value="pt">Português</option>
          </select>
        </div>
      </SettingsCard>
    </SettingsSubPage>
  );
}
