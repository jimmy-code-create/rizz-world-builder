import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BADGE_TYPES,
  Badge,
  BadgePill,
  type BadgeType,
} from "@/components/badges/Badge";

/**
 * /badge-preview — the redrawn profile badges, everywhere they have to work.
 *
 * Preview only: nothing else in the app renders the new marks yet, so this page
 * can be reviewed (and rejected) without touching the shipped sprite badges.
 * Three sizes — 16, 20 and 28 — on dark and on light, with the pill that will
 * sit next to a name.
 */
export const Route = createFileRoute("/badge-preview")({
  head: () => ({
    meta: [{ title: "Badge preview · RIZZ" }],
  }),
  component: BadgePreviewPage,
});

const SIZES = [16, 20, 28] as const;

/** The profile card's purple-to-navy wash, so the marks are judged in place. */
const DARK_SURFACE = "linear-gradient(160deg, #2c1a63 0%, #182052 52%, #0c1026 100%)";
const LIGHT_SURFACE = "linear-gradient(160deg, #ffffff 0%, #f1f3fb 100%)";

function NameRow({ dark, types, size }: { dark: boolean; types: BadgeType[]; size: number }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid shrink-0 place-items-center rounded-full font-display font-bold"
        style={{
          width: size + 20,
          height: size + 20,
          fontSize: (size + 20) / 2.6,
          background: dark ? "linear-gradient(140deg,#c8ff3d,#4d9a2a)" : "linear-gradient(140deg,#1c1c1f,#4b4b55)",
          color: dark ? "#16210b" : "#f4f1e7",
        }}
      >
        J
      </span>
      <span
        className="truncate text-sm font-semibold"
        style={{ color: dark ? "#f4f1e7" : "#17171b" }}
      >
        @jimmy
      </span>
      <BadgePill
        types={types}
        size={size}
        className={
          dark
            ? "border-white/10 bg-white/10"
            : "border-black/10 bg-black/[0.04]"
        }
      />
    </div>
  );
}

function Surface({ dark, title, note }: { dark: boolean; title: string; note: string }) {
  return (
    <section
      className="overflow-hidden rounded-3xl border shadow-[0_24px_60px_-30px_rgba(0,0,0,0.65)]"
      style={{
        background: dark ? DARK_SURFACE : LIGHT_SURFACE,
        borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(15,17,34,0.1)",
      }}
    >
      <header
        className="border-b px-5 py-4"
        style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(15,17,34,0.08)" }}
      >
        <h2
          className="font-display text-base font-bold"
          style={{ color: dark ? "#f4f1e7" : "#17171b" }}
        >
          {title}
        </h2>
        <p className="text-xs" style={{ color: dark ? "rgba(244,241,231,0.62)" : "#5b5b6b" }}>
          {note}
        </p>
      </header>

      <div className="px-5 py-4">
        {/* Every badge at every size, in a labelled grid. */}
        <div className="grid grid-cols-[minmax(7.5rem,auto)_repeat(3,minmax(3rem,1fr))] items-center gap-y-3">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: dark ? "rgba(244,241,231,0.45)" : "#83839a" }}
          >
            Badge
          </span>
          {SIZES.map((px) => (
            <span
              key={px}
              className="text-center text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: dark ? "rgba(244,241,231,0.45)" : "#83839a" }}
            >
              {px}px
            </span>
          ))}

          {BADGE_TYPES.map((type) => (
            <Fragment key={type}>
              <span
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: dark ? "#f4f1e7" : "#17171b" }}
              >
                <Badge type={type} size={16} noTooltip />
                <span className="truncate">{type.replace("_", " ")}</span>
              </span>
              {SIZES.map((px) => (
                <span key={px} className="flex justify-center">
                  <Badge type={type} size={px} />
                </span>
              ))}
            </Fragment>
          ))}
        </div>

        {/* The pill, next to a name, at both usable sizes. */}
        <div className="mt-5 space-y-3 border-t pt-4" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(15,17,34,0.08)" }}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: dark ? "rgba(244,241,231,0.45)" : "#83839a" }}
          >
            Next to a name
          </p>
          <NameRow dark={dark} types={[...BADGE_TYPES]} size={20} />
          <NameRow dark={dark} types={["verified", "premium", "creator"]} size={20} />
          <NameRow dark={dark} types={["verified", "early_member"]} size={20} />
        </div>

        {/* All five at 16px in a row — the crowded case. */}
        <div className="mt-4 border-t pt-4" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(15,17,34,0.08)" }}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: dark ? "rgba(244,241,231,0.45)" : "#83839a" }}
          >
            Worst case · five marks at 16px, 4px apart
          </p>
          <div className="mt-2">
            <BadgePill types={[...BADGE_TYPES]} size={16} gap={4} className={dark ? "border-white/10 bg-white/10" : "border-black/10 bg-black/[0.04]"} />
          </div>
        </div>
      </div>
    </section>
  );
}

function BadgePreviewPage() {
  return (
    <main className="min-h-screen w-full bg-[#0a0b14] px-4 py-10 text-[#f4f1e7] sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c8ff3d]">
          Preview · not applied yet
        </p>
        <h1 className="mt-2 font-display text-2xl font-black sm:text-3xl">Profile badges</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
          Five marks, one construction rule: two-tone gradient in a single light direction, a
          hairline rim, a top-edge highlight, and a small glow. Hover (or long-press) a mark for
          its label. Nothing outside this page uses them yet — approve this and they replace the
          sprite badges on the profile card, the full profile, the feed and the chat list.
        </p>

        {/* A shared spec strip, so the "same style" rule is visible at once. */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            "Inline SVG · no image files, no emoji",
            "1u hairline rim · round joins",
            "One gradient in user space (y 3 → 21)",
            "Clipped top highlight",
            "Glow scales with the px size",
            "16 / 20 / 28 tested",
          ].map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/70"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Surface
            dark
            title="On the profile card"
            note="Purple → navy wash, the background these badges actually sit on."
          />
          <Surface
            dark={false}
            title="On a light surface"
            note="Same marks, no glow boost — the gradient has to carry the depth."
          />
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            Type reference
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BADGE_TYPES.map((type) => (
              <div
                key={type}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3"
              >
                <Badge type={type} size={28} />
                <Badge type={type} size={20} noTooltip />
                <Badge type={type} size={16} noTooltip />
                <span className="ml-auto h-2 w-2 rounded-full" style={{ background: type === "verified" ? "#3b82f6" : type === "premium" ? "#8b5cf6" : type === "early_member" ? "#f59e0b" : type === "top_paws" ? "#10b981" : "#f43f5e" }} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/50">
            Export: <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">
              &lt;Badge type="verified" size={20} /&gt;
            </code>{" "}
            — also available as <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">ProfileBadge</code>,
            with <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">label</code>,
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">hint</code> and
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">noTooltip</code> overrides.
          </p>
        </div>
      </div>
    </main>
  );
}
