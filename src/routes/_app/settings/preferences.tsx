import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { Bell, Link2, Radio, Shield, Sliders } from "lucide-react";
import { Label } from "@/components/ui/label";
import { PrefRow } from "@/components/settings/PrefRow";
import { SettingsCard, SettingsSubPage } from "@/components/settings/SettingsSubPage";
import { DEFAULT_PREFS, applyPrefs, loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";
import { areRizzSoundsMuted, setRizzSoundsMuted as persistRizzSoundsMuted } from "@/lib/rizz-sounds";

export const Route = createFileRoute("/_app/settings/preferences")({
  head: () => ({ meta: [{ title: "Preferences · Settings · RIZZ" }] }),
  component: PreferencesSettingsPage,
});

function PreferencesSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const { t } = useI18n();
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
        <PrefRow label={t("pref_autoplay")} desc={t("pref_autoplay_desc")} checked={prefs.autoplay} onChange={(v) => updatePref("autoplay", v)} />
        <PrefRow label={t("pref_datasaver")} desc={t("pref_datasaver_desc")} checked={prefs.dataSaver} onChange={(v) => updatePref("dataSaver", v)} />
        <PrefRow label={t("pref_linkpreviews")} desc={t("pref_linkpreviews_desc")} checked={prefs.linkPreviews !== false} onChange={(v) => updatePref("linkPreviews", v)} icon={<Link2 className="h-4 w-4" />} />
        <PrefRow
          label="Show me in Live & vibing"
          desc="Let people find your status and activity in the Live & vibing list. Calls still work when this is off. Saved on this device."
          checked={prefs.showInLiveAndVibing !== false}
          onChange={(v) => updatePref("showInLiveAndVibing", v)}
          icon={<Radio className="h-4 w-4" />}
        />
        <PrefRow label={t("pref_sounds")} desc={t("pref_sounds_desc")} checked={prefs.sounds} onChange={(v) => updatePref("sounds", v)} icon={<Bell className="h-4 w-4" />} />
        <PrefRow
          label={t("pref_rizz_sounds")}
          desc={t("pref_rizz_sounds_desc")}
          checked={!rizzSoundsMutedState}
          onChange={(v) => {
            persistRizzSoundsMuted(!v);
            setRizzSoundsMutedState(!v);
          }}
          icon={<Bell className="h-4 w-4" />}
        />
        <PrefRow label={t("pref_blur")} desc={t("pref_blur_desc")} checked={prefs.blurSensitive} onChange={(v) => updatePref("blurSensitive", v)} icon={<Shield className="h-4 w-4" />} />
        <PrefRow label={t("pref_focus")} desc={t("pref_focus_desc")} checked={prefs.focusMode} onChange={(v) => updatePref("focusMode", v)} />
        <PrefRow label={t("pref_colorblind")} desc={t("pref_colorblind_desc")} checked={prefs.colorBlind} onChange={(v) => updatePref("colorBlind", v)} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label htmlFor="mention-highlight-color" className="text-sm font-medium">{t("pref_mention_color")}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("pref_mention_color_desc")}</p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            {/* The preview uses the exact chip recipe the chats use, so what you
                pick here is what you get in DMs, groups and realms. */}
            <span
              className="rounded px-1.5 py-0.5 text-sm font-medium"
              style={{
                color: `color-mix(in srgb, ${prefs.mentionColor} 24%, #ffffff)`,
                backgroundColor: `color-mix(in srgb, ${prefs.mentionColor} 72%, #0b0b0c)`,
              }}
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Presets</span>
          {[
            { label: "Discord", value: "#5865f2" },
            { label: "Rizz lime", value: "#c8ff3d" },
            { label: "Rose", value: "#ff5d8f" },
            { label: "Sky", value: "#38bdf8" },
            { label: "Amber", value: "#f5a524" },
            { label: "Cream", value: "#f4f1e7" },
          ].map((preset) => {
            const active = prefs.mentionColor.toLowerCase() === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => updatePref("mentionColor", preset.value)}
                aria-pressed={active}
                className={`flex min-h-9 items-center gap-2 rounded-lg border px-2 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 rounded-full border border-white/20"
                  style={{ background: preset.value }}
                />
                {preset.label}
              </button>
            );
          })}
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">{t("pref_text_size")} · {Math.round(prefs.textScale * 100)}%</Label>
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
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="emoji-size" className="text-xs text-muted-foreground">
              Emoji size · {Math.round(prefs.emojiScale * 100)}%
            </Label>
            {prefs.emojiScale !== 1 && (
              <button
                type="button"
                onClick={() => updatePref("emojiScale", 1)}
                className="text-[10px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Reset
              </button>
            )}
          </div>
          {/* A number alone means nothing here, so the preview is an actual
              message bubble rendered with the live --emoji-scale variable. */}
          <div className="mt-2 flex items-end gap-2" aria-hidden="true">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-[9px] font-bold text-muted-foreground">
              You
            </span>
            <span className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] leading-none text-foreground">
              this set is{" "}
              <span
                className="inline-block align-[-0.15em] leading-none"
                style={{ fontSize: "calc(15px * var(--emoji-scale, 1))" }}
              >
                😎
              </span>
            </span>
          </div>
          <input
            id="emoji-size"
            type="range"
            min={0.75}
            max={1.6}
            step={0.05}
            value={prefs.emojiScale}
            onChange={(e) => updatePref("emojiScale", parseFloat(e.target.value))}
            className="mt-2 w-full accent-primary"
          />
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            One size for every emoji — chats, captions, comments and the picker.
          </p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">{t("language_setting")}</Label>
          <select
            value={["auto", "en", "fr"].includes(prefs.language) ? prefs.language : "auto"}
            onChange={(e) => updatePref("language", e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 glass bg-transparent px-3 py-2 text-sm"
          >
            <option value="auto">{t("language_auto")}</option>
            <option value="en">{t("language_english")}</option>
            <option value="fr">{t("language_francais")}</option>
          </select>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-primary/40 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-primary">
              {t("beta")}
            </span>
            {t("translations_beta_note")}
          </p>
        </div>
      </SettingsCard>
    </SettingsSubPage>
  );
}
