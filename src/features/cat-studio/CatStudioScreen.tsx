/**
 * Cat Studio — the builder screen.
 *
 * Layout follows the brief: preview on top (never more than 40% of the
 * viewport), then Shape / Fur / Face / Wear / Backdrop, a 3-column item grid,
 * and Save · Randomize · Reset · Undo pinned at the bottom. One close button,
 * no glow, no gradients, 44px targets, sentence case.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Lock, PawPrint, RotateCcw, Shuffle, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CatAvatar } from "./CatAvatar";
import { CatModel3D, type CatModelHandle } from "./CatModel3D";
import {
  BREED_PRESETS,
  DEFAULT_CONFIG,
  EXPRESSIONS,
  FUR_COLORS,
  ACCENT_COLORS,
  EYE_COLORS,
  PATTERNS,
  SHAPE_RANGES,
  clampShape,
  randomCatConfig,
  sanitizeCatConfig,
  type CatConfig,
  type CatExpression,
  type CatPattern,
  type CatSlot,
  type ShapeKey,
} from "./config";
import { CAT_ITEMS, RARITY_LABEL, getCatItem, type CatRarity, type CatSlotId } from "./catalog";
import { catFromProfile, useCatStudio } from "./useCatStudio";

const RARITY_BORDER: Record<CatRarity, string> = {
  common: "border-white/12",
  rare: "border-[#9be8ff]/40",
  epic: "border-[#c7a3ff]/45",
  legendary: "border-[#e8c15a]/45",
  luxe: "border-primary/50",
};

const TABS = [
  { id: "shape", label: "Shape" },
  { id: "fur", label: "Fur" },
  { id: "face", label: "Face" },
  { id: "wear", label: "Wear" },
  { id: "backdrop", label: "Backdrop" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const SLIDER_LABEL: Record<ShapeKey, string> = {
  body: "Chubbiness",
  head: "Head width",
  earSize: "Ear size",
  earTilt: "Ear tilt",
  eyeSize: "Eye size",
  eyeSpacing: "Eye spacing",
  tailLength: "Tail length",
};

function formatShapeValue(key: ShapeKey, value: number) {
  if (key === "earTilt") return `${Math.round(value)}°`;
  return value.toFixed(2);
}

export function CatStudioScreen() {
  const studio = useCatStudio();
  const nav = useNavigate();
  const [config, setConfig] = useState<CatConfig>(() => catFromProfile(studio.profile) ?? DEFAULT_CONFIG);
  const [history, setHistory] = useState<CatConfig[]>([]);
  const [tab, setTab] = useState<TabId>("shape");
  const [trying, setTrying] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [view, setView] = useState<"3d" | "2d">("3d");
  const model = useRef<CatModelHandle>(null);

  // Pick the saved cat up once the profile is there (it arrives after mount).
  const savedSignature = JSON.stringify(catFromProfile(studio.profile) ?? null);
  useEffect(() => {
    const saved = catFromProfile(studio.profile);
    if (saved) setConfig(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSignature]);

  const commit = (next: CatConfig) => {
    setHistory((stack) => [...stack.slice(-9), config]);
    setConfig(sanitizeCatConfig(next));
  };

  const patch = (next: Partial<CatConfig>) => commit({ ...config, ...next });

  const previewConfig = useMemo(() => {
    if (!trying) return config;
    const item = getCatItem(trying);
    if (!item) return config;
    return sanitizeCatConfig({ ...config, slots: { ...config.slots, [item.slot]: item.id } });
  }, [config, trying]);

  const triedItem = getCatItem(trying);
  const triedOwned = trying ? studio.owned(trying) : false;
  const triedIsLuxeLocked = !!triedItem && triedItem.requires_purify && !studio.purify && !triedOwned;
  const balanceAfter = triedItem ? Math.max(0, studio.balance - triedItem.price) : studio.balance;

  const equip = (slot: CatSlot, id: string | null) => {
    commit({ ...config, slots: { ...config.slots, [slot]: id } });
    setTrying(null);
  };

  const onItemTap = (id: string) => {
    const item = getCatItem(id);
    if (!item) return;
    if (studio.owned(id)) {
      equip(item.slot, config.slots[item.slot] === id ? null : id);
      return;
    }
    setTrying(config.slots[item.slot] === id ? null : id);
  };

  const buy = async () => {
    if (!triedItem) return;
    const result = await studio.buy.mutateAsync(triedItem.id);
    const item = triedItem;
    setConfirming(null);
    setTrying(null);
    if (result?.status !== "error") equip(item.slot, item.id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-white/8 px-2 py-1.5">
        <button
          type="button"
          onClick={() => nav({ to: "/settings/profile" })}
          aria-label="Close Cat Studio"
          className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[16px] font-bold leading-tight">Cat Studio</h1>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <PawPrint className="h-3 w-3" /> {studio.balance.toLocaleString()} Paws
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            const png = view === "3d" ? await model.current?.capturePng(512).catch(() => undefined) : undefined;
            studio.save.mutate({ config, png });
          }}
          disabled={studio.save.isPending}
          className="h-11 rounded-[14px] bg-primary px-4 text-[13px] font-bold text-primary-foreground transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
        >
          {studio.save.isPending ? "Saving…" : "Save"}
        </button>
      </header>

      {/* Preview — never taller than 40% of the viewport. The 3D model is the
          default: drag it to turn, and Save captures exactly the pose shown. */}
      <div
        className="shrink-0 border-b border-white/8 bg-surface-1 px-3 py-2"
        style={{ maxHeight: "40vh" }}
      >
        <div className="relative mx-auto h-[min(32vh,260px)] w-full max-w-[320px]">
          {view === "3d" ? (
            <CatModel3D config={previewConfig} handleRef={model} />
          ) : (
            <div className="grid h-full place-items-center">
              <CatAvatar config={previewConfig} animated className="h-full w-auto" />
            </div>
          )}

          <div className="absolute right-0 top-0 flex gap-1">
            {(["3d", "2d"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                className={cn(
                  "h-9 w-9 rounded-full border text-[11px] font-bold uppercase",
                  view === mode
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-white/12 bg-background/70 text-muted-foreground",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Wear it</span>
          {(
            [
              ["sticker", "Sticker"],
              ["name", "By name"],
              ["photo", "Photo"],
            ] as const
          ).map(([option, label]) => (
            <button
              key={option}
              type="button"
              onClick={() => commit({ ...config, flex: option })}
              aria-pressed={config.flex === option}
              className={cn(
                "h-8 rounded-full border px-2.5 text-[11.5px] font-semibold",
                config.flex === option
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-white/12 text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-1 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              const index = EXPRESSIONS.indexOf(previewConfig.expression);
              commit({ ...config, expression: EXPRESSIONS[(index + 1) % EXPRESSIONS.length] });
            }}
            className="h-9 rounded-full border border-white/12 px-3 text-[11.5px] font-semibold capitalize text-muted-foreground"
          >
            Expression: {previewConfig.expression}
          </button>
          <span className="text-[11px] text-muted-foreground">
            {view === "3d" ? "Drag to turn" : "Tap expression"}
          </span>
        </div>
      </div>

      {/* Try-on / buy bar. */}
      {(triedItem || confirming) && (
        <div className="shrink-0 border-b border-white/8 bg-surface-1 px-3 py-2.5">
          {confirming && triedItem ? (
            <div className="flex flex-col gap-2">
              <p className="text-[12.5px] leading-snug">
                Buy {triedItem.name} for <strong>{triedItem.price} Paws</strong>? Balance after:{" "}
                <strong>{balanceAfter.toLocaleString()}</strong>.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void buy()}
                  disabled={studio.buy.isPending}
                  className="h-11 flex-1 rounded-[14px] bg-primary text-[13px] font-bold text-primary-foreground disabled:opacity-50"
                >
                  {studio.buy.isPending ? "Buying…" : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="h-11 flex-1 rounded-[14px] border border-white/12 text-[13px] font-semibold text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold">Trying on {triedItem?.name}</p>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <PawPrint className="h-3 w-3" /> {triedItem?.price} · {triedItem ? RARITY_LABEL[triedItem.rarity] : ""}
                </p>
              </div>
              {triedIsLuxeLocked ? (
                <span className="h-11 rounded-[14px] border border-primary/40 px-4 text-[12px] font-bold leading-[44px] text-primary">
                  Purify
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(triedItem!.id)}
                  className="h-11 rounded-[14px] bg-primary px-4 text-[12.5px] font-bold text-primary-foreground"
                >
                  Buy for {triedItem?.price} Paws
                </button>
              )}
              <button
                type="button"
                onClick={() => setTrying(null)}
                className="h-11 rounded-[14px] border border-white/12 px-3 text-[12.5px] font-semibold text-muted-foreground"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabs. */}
      <div className="no-scrollbar flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/8 px-2 py-1.5">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-pressed={tab === entry.id}
            className={cn(
              "h-11 shrink-0 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors",
              tab === entry.id
                ? "bg-surface-3 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {tab === "shape" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Breeds
              </p>
              <div className="grid grid-cols-2 gap-2">
                {BREED_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      commit({
                        ...config,
                        shape: clampShape(preset.config.shape),
                        colors: { ...preset.config.colors },
                        pattern: preset.config.pattern,
                        expression: preset.config.expression,
                      })
                    }
                    className="h-11 rounded-[14px] border border-white/12 bg-surface-1 px-3 text-[12.5px] font-semibold"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
            {(Object.keys(SHAPE_RANGES) as ShapeKey[]).map((key) => {
              const [min, max] = SHAPE_RANGES[key];
              return (
                <label key={key} className="block">
                  <span className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-medium">{SLIDER_LABEL[key]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatShapeValue(key, config.shape[key])}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.01}
                    value={config.shape[key]}
                    onChange={(event) =>
                      setConfig((current) =>
                        sanitizeCatConfig({
                          ...current,
                          shape: { ...current.shape, [key]: Number(event.target.value) },
                        }),
                      )
                    }
                    className="h-11 w-full accent-[var(--primary)]"
                    aria-label={SLIDER_LABEL[key]}
                  />
                </label>
              );
            })}
          </div>
        )}

        {tab === "fur" && (
          <div className="space-y-4">
            <ColorPicker
              title="Fur"
              colors={FUR_COLORS}
              value={config.colors.fur}
              onPick={(fur) => patch({ colors: { ...config.colors, fur } })}
            />
            <ColorPicker
              title="Accent"
              colors={ACCENT_COLORS}
              value={config.colors.accent}
              onPick={(accent) => patch({ colors: { ...config.colors, accent } })}
            />
            <ColorPicker
              title="Eyes"
              colors={EYE_COLORS}
              value={config.colors.eye}
              onPick={(eye) => patch({ colors: { ...config.colors, eye } })}
            />
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Pattern
              </p>
              <div className="flex flex-wrap gap-2">
                {PATTERNS.map((pattern) => (
                  <button
                    key={pattern}
                    type="button"
                    onClick={() => patch({ pattern: pattern as CatPattern })}
                    aria-pressed={config.pattern === pattern}
                    className={cn(
                      "h-11 rounded-full border px-3.5 text-[12.5px] font-semibold capitalize",
                      config.pattern === pattern
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-white/12 bg-surface-1 text-muted-foreground",
                    )}
                  >
                    {pattern}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "face" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Expression
              </p>
              <div className="flex flex-wrap gap-2">
                {EXPRESSIONS.map((expression) => (
                  <button
                    key={expression}
                    type="button"
                    onClick={() => patch({ expression: expression as CatExpression })}
                    aria-pressed={config.expression === expression}
                    className={cn(
                      "h-11 rounded-full border px-3.5 text-[12.5px] font-semibold capitalize",
                      config.expression === expression
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-white/12 bg-surface-1 text-muted-foreground",
                    )}
                  >
                    {expression}
                  </button>
                ))}
              </div>
            </div>
            <ItemGrid slot="face" config={config} onTap={onItemTap} owned={studio.owned} equipped={config.slots.face} />
          </div>
        )}

        {tab === "wear" && (
          <div className="space-y-5">
            {(["hat", "eyewear", "neck", "back"] as CatSlotId[]).map((slot) => (
              <div key={slot}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {slot === "hat" ? "Hats" : slot === "eyewear" ? "Eyewear" : slot === "neck" ? "Neck" : "Back"}
                </p>
                <ItemGrid slot={slot} config={config} onTap={onItemTap} owned={studio.owned} equipped={config.slots[slot]} />
              </div>
            ))}
          </div>
        )}

        {tab === "backdrop" && (
          <ItemGrid
            slot="backdrop"
            config={config}
            onTap={onItemTap}
            owned={studio.owned}
            equipped={config.slots.backdrop}
            allowNone
            onNone={() => equip("backdrop", null)}
          />
        )}
      </div>

      {/* Controls. */}
      <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-white/8 px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <button
          type="button"
          onClick={() => {
            setHistory((stack) => [...stack.slice(-9), config]);
            // Randomize the cat, not how you wear it.
            setConfig({ ...randomCatConfig((id) => studio.owned(id)), flex: config.flex });
            setTrying(null);
          }}
          className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] border border-white/12 text-[12.5px] font-semibold"
        >
          <Shuffle className="h-4 w-4" /> Randomize
        </button>
        <button
          type="button"
          onClick={() => commit(DEFAULT_CONFIG)}
          className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] border border-white/12 text-[12.5px] font-semibold"
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
        <button
          type="button"
          disabled={!history.length}
          onClick={() => {
            const previous = history[history.length - 1];
            if (!previous) return;
            setHistory((stack) => stack.slice(0, -1));
            setConfig(previous);
            setTrying(null);
          }}
          className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] border border-white/12 text-[12.5px] font-semibold disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" /> Undo
        </button>
      </div>
    </div>
  );
}

function ColorPicker({
  title,
  colors,
  value,
  onPick,
}: {
  title: string;
  colors: readonly string[];
  value: string;
  onPick: (color: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onPick(color)}
            aria-label={`${title} ${color}`}
            aria-pressed={value.toLowerCase() === color.toLowerCase()}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-[14px] border-2",
              value.toLowerCase() === color.toLowerCase() ? "border-primary" : "border-white/12",
            )}
            style={{ background: color }}
          >
            {value.toLowerCase() === color.toLowerCase() && <Check className="h-4 w-4 text-black" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function ItemGrid({
  slot,
  config,
  onTap,
  owned,
  equipped,
  allowNone = false,
  onNone,
}: {
  slot: CatSlot;
  config: CatConfig;
  onTap: (id: string) => void;
  owned: (id: string) => boolean;
  equipped: string | null;
  allowNone?: boolean;
  onNone?: () => void;
}) {
  const items = CAT_ITEMS.filter((item) => item.slot === slot);
  return (
    <div className="grid grid-cols-3 gap-2">
      {allowNone && (
        <button
          type="button"
          onClick={onNone}
          className={cn(
            "flex min-h-[112px] flex-col items-center justify-center gap-1 rounded-[14px] border px-2 py-2 text-[11px] font-semibold",
            equipped === null ? "border-primary/50 bg-primary/10 text-primary" : "border-white/12 bg-surface-1 text-muted-foreground",
          )}
        >
          None
        </button>
      )}
      {items.map((item) => {
        const isOwned = owned(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTap(item.id)}
            aria-pressed={equipped === item.id}
            className={cn(
              "relative flex min-h-[112px] flex-col items-center justify-between gap-1 rounded-[14px] border bg-surface-1 px-1.5 py-2 text-center",
              RARITY_BORDER[item.rarity],
              equipped === item.id && "ring-1 ring-primary",
              item.rarity === "luxe" && "cat-luxe",
            )}
          >
            <CatAvatar
              config={{ ...config, slots: { hat: null, eyewear: null, neck: null, face: null, back: null, backdrop: null, [item.slot]: item.id } }}
              size={44}
              label=""
            />
            <span className="line-clamp-1 text-[10.5px] font-semibold leading-tight">{item.name}</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {isOwned ? (
                <Check className="h-3 w-3 text-primary" />
              ) : item.requires_purify ? (
                <span className="text-primary">Purify</span>
              ) : (
                <>
                  <PawPrint className="h-3 w-3" /> {item.price}
                  {!isOwned && <Lock className="h-2.5 w-2.5" />}
                </>
              )}
            </span>
            <span className="sr-only">{RARITY_LABEL[item.rarity]}</span>
          </button>
        );
      })}
    </div>
  );
}
