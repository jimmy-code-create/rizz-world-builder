import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, PawPrint, RotateCcw, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { catFromProfile } from "@/features/cat-studio/useCatStudio";
import { colourwayFor } from "@/features/cat-studio/model";
import { CatStudioScreen } from "@/features/cat-studio/CatStudioScreen";
import { AvatarModel3D } from "./AvatarModel3D";
import { OUTFIT_STYLES } from "./clothes";
import {
  AVATAR_BACKGROUNDS,
  DEFAULT_AVATAR,
  type AvatarGender,
  HAIR_COLOURS,
  NO_CAPABILITIES,
  OUTFIT_COLOURS,
  SKIN_TONES,
  loadStoredAvatar,
  storeAvatar,
  type Avatar3DConfig,
  type AvatarCapabilities,
  type AvatarMorphTarget,
} from "./config";

const TABS = [
  { id: "avatar", label: "Avatar", icon: UserRound },
  { id: "pets", label: "Pets", icon: PawPrint },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * Create Avatar: the person, and the pet at their feet.
 *
 * Two tabs, because they are two different jobs: Avatar is you, Pets is the
 * companion that stands beside you and shows on your profile.
 *
 * Every control here is gated on what the loaded model actually has, so a model
 * without glasses simply shows no glasses switch instead of a dead toggle.
 */
export function CreateAvatarScreen() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabId>("avatar");
  const [config, setConfig] = useState<Avatar3DConfig>(() => loadStoredAvatar());
  const [capabilities, setCapabilities] = useState<AvatarCapabilities>(NO_CAPABILITIES);

  useEffect(() => {
    storeAvatar(config);
  }, [config]);

  const cat = useMemo(() => catFromProfile(profile), [profile]);
  const petColourway = useMemo(() => colourwayFor(cat?.colourway).id, [cat]);
  const setGender = (gender: AvatarGender) => setConfig((current) => ({ ...current, gender }));

  const morphs = capabilities.morphs;
  const morphGroups = useMemo(
    () => ({
      eyes: morphs.filter((target) => target.group === "eyes"),
      weight: morphs.filter((target) => target.group === "weight"),
      other: morphs.filter((target) => target.group === "other"),
    }),
    [morphs],
  );
  const canBeard = morphs.some((target) => target.group === "beard");

  const setMorph = (key: string, value: number) =>
    setConfig((current) => ({ ...current, morphs: { ...current.morphs, [key]: value } }));

  const hasAnything =
    capabilities.skin ||
    capabilities.hair ||
    capabilities.outfit ||
    capabilities.glasses ||
    canBeard;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => nav({ to: "/settings" })}
          aria-label="Back"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-surface-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-xl font-bold">Create Avatar</h1>
      </div>

      <div className="mt-3 flex gap-1 rounded-2xl border border-white/[0.07] bg-surface-2 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={cn(
              "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-bold transition-colors",
              tab === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab === "pets" ? (
        <div className="mt-3">
          <CatStudioScreen />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {/* The stage: the person, arms down and full length, with their cat at
              their feet — the same scene the Flexes card shows, so what is built
              here is what shows on the profile. */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[radial-gradient(120%_90%_at_50%_12%,#24261b_0%,#151518_55%,#101012_100%)]">
            <div className="h-[58dvh] min-h-[360px] w-full">
              <AvatarModel3D
                config={config}
                petColourway={cat ? petColourway : null}
                onCapabilities={setCapabilities}
              />
            </div>

            {!cat && (
              <button
                type="button"
                onClick={() => setTab("pets")}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/12 bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground backdrop-blur"
              >
                No pet yet — make one
              </button>
            )}
          </div>

          <ChoiceRow
            title="Who"
            options={[
              { id: "male", label: "Man" },
              { id: "female", label: "Woman" },
            ]}
            value={config.gender}
            onPick={(id) => setGender(id as AvatarGender)}
          />

          <ChoiceRow
            title="Background"
            options={AVATAR_BACKGROUNDS.map((entry) => ({
              id: entry.id,
              label: entry.name,
              swatch: entry.swatch,
            }))}
            value={config.background}
            onPick={(background) => setConfig((current) => ({ ...current, background }))}
          />

          {capabilities.skin && (
            <SwatchRow
              title="Skin"
              colours={SKIN_TONES}
              value={config.skin}
              onPick={(skin) => setConfig((current) => ({ ...current, skin }))}
            />
          )}

          {capabilities.hair && (
            <SwatchRow
              title="Hair"
              colours={HAIR_COLOURS}
              value={config.hair}
              onPick={(hair) => setConfig((current) => ({ ...current, hair }))}
            />
          )}

          {capabilities.outfit && (
            <ChoiceRow
              title="Clothes"
              options={OUTFIT_STYLES.map((entry) => ({
                id: entry.id,
                label: entry.name,
                swatch: entry.swatch,
              }))}
              value={config.outfitStyle}
              onPick={(outfitStyle) => setConfig((current) => ({ ...current, outfitStyle }))}
            />
          )}

          {capabilities.outfit && (
            <SwatchRow
              title="Colour"
              colours={OUTFIT_COLOURS}
              value={config.outfit}
              onPick={(outfit) => setConfig((current) => ({ ...current, outfit }))}
            />
          )}

          {capabilities.glasses && (
            <section className="rounded-2xl border border-white/[0.07] bg-surface-2 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                Glasses
              </p>
              <button
                type="button"
                onClick={() => setConfig((current) => ({ ...current, glasses: !current.glasses }))}
                aria-pressed={config.glasses}
                className={cn(
                  "mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors",
                  config.glasses
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-white/10 bg-[#141416] text-muted-foreground hover:border-white/25",
                )}
              >
                {config.glasses ? "Wearing glasses" : "No glasses"}
                {config.glasses && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
              </button>
            </section>
          )}

          {morphGroups.eyes.length > 0 && (
            <SliderGroup
              title="Eyes"
              targets={morphGroups.eyes}
              config={config}
              onChange={setMorph}
            />
          )}
          {morphGroups.weight.length > 0 && (
            <SliderGroup
              title="Body"
              targets={morphGroups.weight}
              config={config}
              onChange={setMorph}
            />
          )}
          {morphGroups.other.length > 0 && (
            <SliderGroup
              title="More"
              targets={morphGroups.other.slice(0, 8)}
              config={config}
              onChange={setMorph}
            />
          )}

          {canBeard && (
            <section className="rounded-2xl border border-white/[0.07] bg-surface-2 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                Facial hair
              </p>
              <button
                type="button"
                onClick={() => setConfig((current) => ({ ...current, beard: !current.beard }))}
                aria-pressed={config.beard}
                className={cn(
                  "mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors",
                  config.beard
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-white/10 bg-[#141416] text-muted-foreground hover:border-white/25",
                )}
              >
                {config.beard ? "Beard on" : "Clean shave"}
                {config.beard && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
              </button>
            </section>
          )}

          {!hasAnything && (
            <p className="px-1 text-[11.5px] leading-snug text-muted-foreground">
              This model carries a single baked texture, so there is no separate skin, hair or
              outfit to colour. The man&apos;s model has them; the woman&apos;s keeps her own look.
            </p>
          )}

          <button
            type="button"
            onClick={() => setConfig(DEFAULT_AVATAR)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function ChoiceRow({
  title,
  options,
  value,
  onPick,
}: {
  title: string;
  options: { id: string; label: string; swatch?: string }[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-surface-2 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((entry) => {
          const active = entry.id === value;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPick(entry.id)}
              aria-pressed={active}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors",
                active
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/12 text-muted-foreground hover:border-white/25 hover:text-foreground",
              )}
            >
              {entry.swatch && (
                <span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full border border-white/20"
                  style={{ background: entry.swatch }}
                />
              )}
              {entry.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SwatchRow({
  title,
  colours,
  value,
  onPick,
}: {
  title: string;
  colours: readonly string[];
  value: string;
  onPick: (colour: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-surface-2 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {colours.map((colour) => {
          const active = value.toLowerCase() === colour.toLowerCase();
          return (
            <button
              key={colour}
              type="button"
              onClick={() => onPick(colour)}
              aria-label={`${title} ${colour}`}
              aria-pressed={active}
              className={cn(
                "h-8 w-8 rounded-full ring-offset-2 ring-offset-surface-2 transition",
                active ? "ring-2 ring-primary" : "ring-1 ring-white/15",
              )}
              style={{ backgroundColor: colour }}
            />
          );
        })}
      </div>
    </section>
  );
}

function SliderGroup({
  title,
  targets,
  config,
  onChange,
}: {
  title: string;
  targets: AvatarMorphTarget[];
  config: Avatar3DConfig;
  onChange: (key: string, value: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-surface-2 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-1 space-y-2.5">
        {targets.map((target) => {
          const value = config.morphs[target.key] ?? 0;
          return (
            <label key={target.key} className="block">
              <span className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span className="truncate">{target.label}</span>
                <span className="tabular-nums">{Math.round(value * 100)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(value * 100)}
                onChange={(event) => onChange(target.key, Number(event.target.value) / 100)}
                className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#c9ff3d]"
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
