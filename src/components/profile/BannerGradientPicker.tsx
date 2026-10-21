import { useRef, useState } from "react";
import {
  ArrowLeftRight,
  Ban,
  Check,
  Image as ImageIcon,
  Loader2,
  Palette,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  BANNER_PRESETS,
  DEFAULT_BANNER_ANGLE,
  gradientCss,
  isValidBannerHex,
  presetForGradient,
  type BannerGradient,
} from "@/lib/banner";
import { cn } from "@/lib/utils";

const QUICK_COLORS = [
  "#f43f5e",
  "#fb923c",
  "#facc15",
  "#a3e635",
  "#22c55e",
  "#14b8a6",
  "#38bdf8",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f2efe6",
  "#141416",
];

const ANGLE_PRESETS = [
  { value: 45, label: "↗", name: "Up-right" },
  { value: 90, label: "→", name: "Right" },
  { value: 135, label: "↘", name: "Down-right" },
  { value: 180, label: "↓", name: "Down" },
];

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(clamp(channel, 0, 255))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const [r255, g255, b255] = hexToRgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

type Props = {
  imageUrl: string | null;
  gradient: BannerGradient | null;
  onGradientChange: (gradient: BannerGradient) => void;
  onClearGradient: () => void;
  onUpload: (file: File) => void | Promise<void>;
  onRemoveImage: () => void | Promise<void>;
  uploading?: boolean;
};

/**
 * Discord-style profile customiser: a 3:1 banner image plus a profile-wide
 * gradient. The gradient never paints the banner box — it tints the whole
 * profile behind the banner and content. Includes sixteen presets and a custom
 * two-colour sheet with an SV square, hue slider, validated hex input, quick
 * colours, swap and angle (including ↓ ↘ → ↗).
 */
export function BannerGradientPicker({
  imageUrl,
  gradient,
  onGradientChange,
  onClearGradient,
  onUpload,
  onRemoveImage,
  uploading = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<BannerGradient>(gradient ?? BANNER_PRESETS[0]);
  const [active, setActive] = useState<"c1" | "c2">("c1");
  const [hsv, setHsv] = useState(() => hexToHsv((gradient ?? BANNER_PRESETS[0]).c1));
  const [hexText, setHexText] = useState((gradient ?? BANNER_PRESETS[0]).c1);

  const selectedPreset = presetForGradient(gradient);
  const activeHex = draft[active];
  const hexValid = isValidBannerHex(hexText);

  function setColor(hex: string) {
    setDraft((current) => ({ ...current, [active]: hex }));
    setHsv(hexToHsv(hex));
    setHexText(hex);
  }

  function chooseActive(next: "c1" | "c2") {
    setActive(next);
    setHsv(hexToHsv(draft[next]));
    setHexText(draft[next]);
  }

  function openCustom() {
    const base = gradient ?? {
      ...BANNER_PRESETS[0],
      angle: DEFAULT_BANNER_ANGLE,
    };
    setDraft({ ...base });
    setActive("c1");
    setHsv(hexToHsv(base.c1));
    setHexText(base.c1);
    setCustomOpen(true);
  }

  function updateFromPointer(clientX: number, clientY: number) {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = clamp((clientX - rect.left) / rect.width);
    const v = clamp(1 - (clientY - rect.top) / rect.height);
    const next = { ...hsv, s, v };
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    setDraft((current) => ({ ...current, [active]: hex }));
    setHexText(hex);
  }

  function applyCustom() {
    const next: BannerGradient = {
      c1: isValidBannerHex(draft.c1) ? draft.c1 : BANNER_PRESETS[0].c1,
      c2: isValidBannerHex(draft.c2) ? draft.c2 : BANNER_PRESETS[0].c2,
      angle: Math.min(360, Math.max(0, Math.round(draft.angle))),
    };
    onGradientChange(next);
    setCustomOpen(false);
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onUpload(file);
          event.target.value = "";
        }}
      />

      {/* Banner image. The gradient below is independent, like Discord's
          banner image + profile theme colours. */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Banner image
          </p>
          <span className="text-[10px] text-muted-foreground">3:1 · top anchored</span>
        </div>
        <div
          className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1f] bg-cover bg-top"
          style={
            imageUrl ? { backgroundImage: `url("${imageUrl.replace(/"/g, '\\"')}")` } : undefined
          }
        >
          {!imageUrl && (
            <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
              No banner image yet
            </span>
          )}
          {imageUrl && (
            <span className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="h-11 border-white/20 bg-black/40"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => void onRemoveImage()}
                className="h-11 border-white/20 bg-black/40"
              >
                Remove
              </Button>
            </span>
          )}
        </div>
        {!imageUrl && (
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="h-11 w-full border-white/10"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading…" : "Upload banner"}
          </Button>
        )}
      </div>

      {/* Profile-wide gradient. It never paints the 3:1 banner. */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Profile gradient
          </p>
          <span className="truncate text-[10px] text-muted-foreground">
            {gradient ? (selectedPreset?.label ?? "Custom") : "Default"}
          </span>
        </div>
        <p className="text-[11px] leading-4 text-muted-foreground">
          Tints the whole profile behind your banner and content.
        </p>
        <div className="grid grid-cols-4 gap-2.5">
          {BANNER_PRESETS.map((preset) => {
            const selected = selectedPreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${preset.label} profile gradient`}
                onClick={() => {
                  onGradientChange({ c1: preset.c1, c2: preset.c2, angle: preset.angle });
                }}
                className="group flex min-h-11 flex-col items-center gap-1.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
              >
                <span
                  className={cn(
                    "relative block h-14 w-full rounded-xl border border-white/10 transition-transform group-hover:scale-[1.03]",
                    selected && "ring-2 ring-[#c8ff3d] ring-offset-2 ring-offset-[#141416]",
                  )}
                  style={{ background: gradientCss(preset) }}
                >
                  {selected && (
                    <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/25">
                      <Check className="h-4 w-4 text-white" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate text-[10px] font-medium text-muted-foreground">
                  {preset.label}
                </span>
              </button>
            );
          })}

          {/* None is a first-class swatch, marked with a slashed circle. */}
          <button
            type="button"
            aria-pressed={!gradient}
            aria-label="No profile gradient"
            onClick={onClearGradient}
            className="group flex min-h-11 flex-col items-center gap-1.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
          >
            <span
              className={cn(
                "relative grid h-14 w-full place-items-center rounded-xl border border-white/10 bg-[#1c1c1f] transition-transform group-hover:scale-[1.03]",
                !gradient && "ring-2 ring-[#c8ff3d] ring-offset-2 ring-offset-[#141416]",
              )}
            >
              <Ban className="h-5 w-5 text-muted-foreground" />
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">None</span>
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={openCustom}
          className="mt-1 h-11 w-full justify-center gap-2 border-white/10"
        >
          <Palette className="h-4 w-4" />
          Custom colors
        </Button>
      </div>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent
          hideClose
          className="left-0 right-0 top-auto bottom-0 max-h-[92dvh] w-full translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-b-none rounded-t-3xl border-white/10 bg-[#141416] p-0 sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[400px] sm:max-w-[400px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
        >
          <DialogTitle className="sr-only">Custom profile gradient</DialogTitle>
          <div
            className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/25 sm:hidden"
            aria-hidden
          />
          <div className="space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-[#f2efe6]">
                Custom profile gradient
              </h3>
              <button
                type="button"
                aria-label="Close custom gradient"
                onClick={() => setCustomOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="h-16 w-full rounded-2xl border border-white/10"
              style={{ background: gradientCss(draft) }}
              aria-label="Profile gradient preview"
            />

            {/* Primary / Accent */}
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Color to edit">
              {(
                [
                  { id: "c1", label: "Primary", hex: draft.c1 },
                  { id: "c2", label: "Accent", hex: draft.c2 },
                ] as const
              ).map(({ id, label, hex }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active === id}
                  onClick={() => chooseActive(id)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]",
                    active === id
                      ? "border-[#c8ff3d]/60 bg-[#c8ff3d]/10"
                      : "border-white/10 hover:bg-white/5",
                  )}
                >
                  <span
                    className="h-6 w-6 shrink-0 rounded-md border border-white/20"
                    style={{ background: hex }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                      {label}
                    </span>
                    <span className="block font-mono text-[11px] text-foreground">{hex}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Saturation / value square */}
            <div
              ref={areaRef}
              role="slider"
              aria-label="Saturation and brightness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hsv.s * 100)}
              tabIndex={0}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                updateFromPointer(event.clientX, event.clientY);
              }}
              onPointerMove={(event) => {
                if (event.buttons) updateFromPointer(event.clientX, event.clientY);
              }}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 0.1 : 0.02;
                if (event.key === "ArrowLeft")
                  setColor(hsvToHex(hsv.h, clamp(hsv.s - step), hsv.v));
                else if (event.key === "ArrowRight")
                  setColor(hsvToHex(hsv.h, clamp(hsv.s + step), hsv.v));
                else if (event.key === "ArrowUp")
                  setColor(hsvToHex(hsv.h, hsv.s, clamp(hsv.v + step)));
                else if (event.key === "ArrowDown")
                  setColor(hsvToHex(hsv.h, hsv.s, clamp(hsv.v - step)));
                else return;
                event.preventDefault();
              }}
              className="relative h-40 w-full cursor-crosshair touch-none overflow-hidden rounded-2xl border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
              style={{
                backgroundImage:
                  "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(" +
                  Math.round(hsv.h) +
                  " 100% 50%))",
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  background: activeHex,
                }}
              />
            </div>

            {/* Hue */}
            <div className="relative h-11">
              <div
                aria-hidden
                className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
                }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
                style={{
                  left: `${(hsv.h / 360) * 100}%`,
                  background: hsvToHex(hsv.h, 1, 1),
                }}
              />
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={Math.round(hsv.h)}
                aria-label="Hue"
                onChange={(event) => {
                  const h = Number(event.target.value);
                  const next = { ...hsv, h };
                  setHsv(next);
                  const hex = hsvToHex(h, hsv.s, hsv.v);
                  setDraft((current) => ({ ...current, [active]: hex }));
                  setHexText(hex);
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>

            {/* Hex */}
            <div>
              <label
                htmlFor="banner-hex"
                className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Hex
              </label>
              <Input
                id="banner-hex"
                value={hexText}
                onChange={(event) => {
                  const value = event.target.value.slice(0, 7);
                  setHexText(value);
                  if (isValidBannerHex(value)) {
                    const hex = value.toLowerCase();
                    setDraft((current) => ({ ...current, [active]: hex }));
                    setHsv(hexToHsv(hex));
                  }
                }}
                onBlur={() => {
                  if (!hexValid) setHexText(activeHex);
                }}
                aria-invalid={!hexValid}
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                className="mt-1 h-11 border-white/10 bg-transparent font-mono"
              />
              {!hexValid && (
                <p className="mt-1 text-[11px] text-rose-300">Use a six-digit hex like #c8ff3d.</p>
              )}
            </div>

            {/* Quick colours */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Quick colors
              </p>
              <div className="grid grid-cols-6 gap-2">
                {QUICK_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use ${color}`}
                    aria-pressed={activeHex.toLowerCase() === color}
                    onClick={() => setColor(color)}
                    className={cn(
                      "min-h-11 w-full rounded-lg border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]",
                      activeHex.toLowerCase() === color
                        ? "border-white ring-2 ring-[#c8ff3d]"
                        : "border-white/15",
                    )}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const nextDraft = { ...draft, c1: draft.c2, c2: draft.c1 };
                const nextActive = active === "c1" ? "c2" : "c1";
                setDraft(nextDraft);
                setActive(nextActive);
                setHsv(hexToHsv(nextDraft[nextActive]));
                setHexText(nextDraft[nextActive]);
              }}
              className="h-11 w-full border-white/10"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Swap primary and accent
            </Button>

            {/* Angle */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Angle
                </p>
                <span className="font-mono text-xs text-foreground">
                  {Math.round(draft.angle)}°
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={Math.round(draft.angle)}
                aria-label="Gradient angle"
                onChange={(event) => {
                  const angle = Number(event.target.value);
                  setDraft((current) => ({ ...current, angle }));
                }}
                className="mt-1 h-11 w-full accent-[#c8ff3d]"
              />
              <div className="grid grid-cols-4 gap-2">
                {ANGLE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    aria-label={`${preset.name} (${preset.value} degrees)`}
                    aria-pressed={Math.round(draft.angle) === preset.value}
                    onClick={() => setDraft((current) => ({ ...current, angle: preset.value }))}
                    className={cn(
                      "min-h-11 rounded-xl border text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]",
                      Math.round(draft.angle) === preset.value
                        ? "border-[#c8ff3d]/60 bg-[#c8ff3d]/10 text-[#c8ff3d]"
                        : "border-white/10 text-muted-foreground hover:bg-white/5",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={applyCustom}
              disabled={!hexValid}
              className="h-11 w-full border-0 bg-primary font-bold text-primary-foreground"
            >
              Apply gradient
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
