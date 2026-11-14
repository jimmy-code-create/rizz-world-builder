/**
 * The cat, drawn as small self-contained SVG snippets.
 *
 * Each function returns one layer's markup in the shared 512 x 512 box. Colours
 * are CSS variables (--fur, --fur-dark, --accent, --eye) so a single config
 * repaints the whole cat, and a saved PNG goes through exactly this code.
 *
 * Layer order is fixed by `catLayerStack` and never by the caller.
 */
import { sanitizeCatConfig, shapeTransforms, type CatConfig } from "./config.ts";

const FUR = "var(--fur,#17171a)";
const FUR_DARK = "var(--fur-dark,#0d0d10)";
const ACCENT = "var(--accent,#c8ff3d)";
const EYE = "var(--eye,#ffffff)";

const HEAD = { cx: 256, cy: 232, r: 118 };
const EYE_Y = 232;
const EYE_X = 256;

function backdropArt(id: string | null): string {
  switch (id) {
    case "backdrop_marble":
      return `
        <rect width="512" height="512" fill="#1b1b20"/>
        <path d="M-20 120 C 110 100 150 190 260 168 C 360 148 420 210 540 176" stroke="#2f2f38" stroke-width="16" fill="none"/>
        <path d="M-20 320 C 120 300 170 390 280 360 C 390 330 440 402 540 372" stroke="#2b2b33" stroke-width="10" fill="none"/>`;
    case "backdrop_velvet":
      return `
        <rect width="512" height="512" fill="#2a0d16"/>
        <path d="M40 0 H120 V512 H40 Z" fill="#3a1120"/>
        <path d="M196 0 H276 V512 H196 Z" fill="#350f1c"/>
        <path d="M352 0 H432 V512 H352 Z" fill="#3a1120"/>
        <ellipse cx="256" cy="-40" rx="320" ry="120" fill="#4a1626"/>`;
    case "backdrop_city":
      return `
        <rect width="512" height="512" fill="#0b1020"/>
        <circle cx="404" cy="96" r="30" fill="#f4f1e7" opacity="0.9"/>
        <rect x="20" y="300" width="86" height="212" fill="#141b2e"/>
        <rect x="120" y="248" width="74" height="264" fill="#101728"/>
        <rect x="208" y="320" width="92" height="192" fill="#151d33"/>
        <rect x="316" y="268" width="80" height="244" fill="#101728"/>
        <rect x="410" y="336" width="86" height="176" fill="#141b2e"/>
        <g fill="${ACCENT}" opacity="0.55">
          <rect x="36" y="322" width="10" height="12"/><rect x="62" y="352" width="10" height="12"/>
          <rect x="134" y="272" width="10" height="12"/><rect x="158" y="306" width="10" height="12"/>
          <rect x="224" y="344" width="10" height="12"/><rect x="252" y="380" width="10" height="12"/>
          <rect x="332" y="292" width="10" height="12"/><rect x="360" y="330" width="10" height="12"/>
        </g>`;
    case "backdrop_luxe_night":
      return `
        <rect width="512" height="512" fill="#111014"/>
        <circle cx="120" cy="110" r="2.5" fill="${ACCENT}"/>
        <circle cx="188" cy="64" r="1.8" fill="${ACCENT}"/>
        <circle cx="360" cy="120" r="2.2" fill="${ACCENT}"/>
        <circle cx="430" cy="72" r="1.6" fill="${ACCENT}"/>
        <circle cx="300" cy="58" r="1.4" fill="${ACCENT}"/>
        <path d="M0 430 H512 V512 H0 Z" fill="#1a1820"/>`;
    case "backdrop_solid":
      return `<rect width="512" height="512" fill="#141418"/>`;
    default:
      return "";
  }
}

function backArt(id: string | null): string {
  switch (id) {
    case "back_velvet_cape":
      return `<path d="M150 300 C 60 360 60 500 90 512 H422 C 452 500 452 360 362 300 Z" fill="#4a1024"/>
        <path d="M176 316 C 120 380 118 470 132 512 H380 C 394 470 392 380 336 316 Z" fill="#5c1530"/>`;
    case "back_scarf":
      return `<path d="M196 300 C 150 380 150 470 176 512 H232 C 208 452 214 372 244 312 Z" fill="${ACCENT}" opacity="0.9"/>`;
    case "back_wings":
      return `<path d="M120 300 C 40 250 20 360 60 420 C 90 400 110 360 140 340 Z" fill="${FUR_DARK}"/>
        <path d="M392 300 C 472 250 492 360 452 420 C 422 400 402 360 372 340 Z" fill="${FUR_DARK}"/>`;
    case "back_backpack":
      return `<rect x="330" y="330" width="96" height="104" rx="22" fill="#3a3a44"/>
        <rect x="330" y="330" width="96" height="30" rx="14" fill="#4a4a56"/>`;
    case "back_aurora_cloak":
      return `<path d="M150 300 C 50 370 60 510 86 512 H426 C 452 510 462 370 362 300 Z" fill="#141a2c"/>
        <path d="M150 300 C 50 370 60 510 86 512 H200 C 150 440 150 360 178 300 Z" fill="${ACCENT}" opacity="0.28"/>
        <path d="M362 300 C 462 370 452 510 426 512 H312 C 362 440 362 360 334 300 Z" fill="#9be8ff" opacity="0.22"/>`;
    default:
      return "";
  }
}

function eyesMarkup(expression: string): string {
  const open = (side: "l" | "r") => {
    const flip = side === "r" ? 1 : -1;
    if (expression === "happy") {
      // Big white eyes, with the lower lids raised: the default mascot look.
      return `<g class="cat-eye"><ellipse rx="30" ry="34" fill="${EYE}"/><circle cx="${flip * 5}" cy="2" r="13" fill="${FUR_DARK}"/><circle cx="${flip * 1}" cy="-8" r="4" fill="${EYE}"/><rect x="-32" y="26" width="64" height="16" fill="${FUR}"/></g>`;
    }
    if (expression === "sleepy") {
      return `<g class="cat-eye"><path d="M-30 6 C -18 -18 18 -18 30 6" stroke="${FUR_DARK}" stroke-width="11" stroke-linecap="round" fill="none"/></g>`;
    }
    if (expression === "chill") {
      return `<g class="cat-eye"><ellipse rx="30" ry="34" fill="${EYE}"/><rect x="-32" y="-32" width="64" height="26" fill="${FUR}"/><circle cx="${flip * 6}" cy="10" r="12" fill="${FUR_DARK}"/></g>`;
    }
    if (expression === "smug") {
      return `<g class="cat-eye"><ellipse rx="30" ry="34" fill="${EYE}"/><circle cx="${flip * 7}" cy="4" r="12" fill="${FUR_DARK}"/><path d="M-32 -14 H30" stroke="${FUR}" stroke-width="9"/></g>`;
    }
    // surprised / default
    const pupil = expression === "surprised" ? 15 : 12;
    return `<g class="cat-eye"><ellipse rx="30" ry="34" fill="${EYE}"/><circle cx="${flip * 5}" cy="4" r="${pupil}" fill="${FUR_DARK}"/><circle cx="${flip * 1}" cy="-6" r="4" fill="${EYE}"/></g>`;
  };
  return open("l") + open("r");
}

function neckArt(id: string | null): string {
  switch (id) {
    case "neck_gold_chain":
      return `<path d="M186 306 C 214 344 298 344 326 306" stroke="#e8c15a" stroke-width="10" fill="none"/>
        <circle cx="256" cy="344" r="14" fill="#f4d47a"/>`;
    case "neck_pearls":
      return `<g fill="#f4f1e7">${Array.from({ length: 9 })
        .map((_, index) => {
          const t = index / 8;
          const x = 190 + t * 132;
          const y = 308 + Math.sin(Math.PI * t) * 40;
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/>`;
        })
        .join("")}</g>`;
    case "neck_bow_tie":
      return `<path d="M256 328 L214 306 L214 350 Z" fill="#b43a5b"/>
        <path d="M256 328 L298 306 L298 350 Z" fill="#b43a5b"/>
        <rect x="246" y="318" width="20" height="20" rx="6" fill="#8f2743"/>`;
    case "neck_diamond_collar":
      return `<path d="M186 306 C 214 346 298 346 326 306" stroke="#2a2a33" stroke-width="16" fill="none"/>
        <path d="M256 330 l16 18 -16 20 -16 -20 z" fill="#9be8ff"/>
        <path d="M256 330 l6 18 -6 20 -6 -20 z" fill="#d9f6ff"/>`;
    case "neck_bandana":
      return `<path d="M180 304 L332 304 L256 372 Z" fill="#b45a5a"/>`;
    default:
      return "";
  }
}

function faceArt(id: string | null): string {
  switch (id) {
    case "face_blush":
      return `<ellipse cx="176" cy="272" rx="26" ry="14" fill="#ff8fa8" opacity="0.55"/>
        <ellipse cx="336" cy="272" rx="26" ry="14" fill="#ff8fa8" opacity="0.55"/>`;
    case "face_whisker_gems":
      return `<g fill="#9be8ff">
        <path d="M120 244 l8 10 -8 10 -8 -10 z"/><path d="M392 244 l8 10 -8 10 -8 -10 z"/>
        <path d="M136 286 l6 8 -6 8 -6 -8 z"/><path d="M376 286 l6 8 -6 8 -6 -8 z"/></g>`;
    case "face_star_sticker":
      return `<path d="M352 190 l7 16 17 2 -13 12 4 17 -15 -9 -15 9 4 -17 -13 -12 17 -2 z" fill="${ACCENT}"/>`;
    case "face_freckles":
      return `<g fill="${FUR_DARK}" opacity="0.6">
        <circle cx="196" cy="268" r="3.4"/><circle cx="212" cy="277" r="3"/>
        <circle cx="300" cy="277" r="3"/><circle cx="316" cy="268" r="3.4"/></g>`;
    case "face_tear":
      return `<path d="M318 258 c 10 14 12 20 12 26 a 12 12 0 0 1 -24 0 c 0 -6 2 -12 12 -26 z" fill="#7fc8ff" opacity="0.85"/>`;
    default:
      return "";
  }
}

function eyewearArt(id: string | null): string {
  switch (id) {
    case "eyewear_sunglasses":
      return `<rect x="150" y="212" width="92" height="46" rx="16" fill="#0b0b0e"/>
        <rect x="270" y="212" width="92" height="46" rx="16" fill="#0b0b0e"/>
        <rect x="240" y="228" width="32" height="8" fill="#0b0b0e"/>`;
    case "eyewear_monocle":
      return `<circle cx="300" cy="232" r="44" stroke="#e8c15a" stroke-width="9" fill="none"/>
        <path d="M338 250 C 366 268 380 296 386 330" stroke="#e8c15a" stroke-width="5" fill="none"/>`;
    case "eyewear_heart":
      return `<g fill="#ff6f91">
        <path d="M204 206 c 16 -18 44 -4 40 18 l -40 32 -40 -32 c -4 -22 24 -36 40 -18 z"/>
        <path d="M308 206 c 16 -18 44 -4 40 18 l -40 32 -40 -32 c -4 -22 24 -36 40 -18 z"/></g>`;
    case "eyewear_visor":
      return `<rect x="146" y="208" width="220" height="52" rx="26" fill="#1b1b22"/>
        <rect x="146" y="208" width="220" height="18" rx="9" fill="${ACCENT}" opacity="0.45"/>`;
    case "eyewear_diamond":
      return `<g fill="#9be8ff" opacity="0.9">
        <path d="M204 206 l26 22 -26 28 -26 -28 z"/>
        <path d="M308 206 l26 22 -26 28 -26 -28 z"/></g>`;
    default:
      return "";
  }
}

function hatArt(id: string | null): string {
  switch (id) {
    case "hat_crown":
      return `<path d="M176 132 L196 74 L226 116 L256 62 L286 116 L316 74 L336 132 Z" fill="#e8c15a"/>
        <rect x="176" y="128" width="160" height="16" rx="6" fill="#f4d47a"/>`;
    case "hat_top_hat":
      return `<rect x="206" y="26" width="100" height="96" rx="8" fill="#101014"/>
        <rect x="176" y="114" width="160" height="18" rx="9" fill="#101014"/>
        <rect x="206" y="74" width="100" height="14" fill="${ACCENT}"/>`;
    case "hat_beret":
      return `<ellipse cx="256" cy="112" rx="104" ry="40" fill="#b45a5a"/>
        <circle cx="256" cy="74" r="10" fill="#8f2743"/>`;
    case "hat_beanie":
      return `<path d="M156 138 C 156 62 356 62 356 138 Z" fill="#3a3a44"/>
        <rect x="150" y="126" width="212" height="26" rx="13" fill="#4a4a56"/>
        <circle cx="256" cy="62" r="18" fill="${ACCENT}"/>`;
    case "hat_halo":
      return `<ellipse cx="256" cy="70" rx="78" ry="20" stroke="${ACCENT}" stroke-width="10" fill="none"/>`;
    case "hat_star_crown":
      return `<path d="M176 132 L196 74 L226 116 L256 62 L286 116 L316 74 L336 132 Z" fill="#f4d47a"/>
        <g fill="${ACCENT}">
          <path d="M256 84 l6 12 13 2 -10 9 3 13 -12 -7 -12 7 3 -13 -10 -9 13 -2 z"/>
          <circle cx="206" cy="108" r="5"/><circle cx="306" cy="108" r="5"/></g>`;
    default:
      return "";
  }
}

/** Build the ordered layer stack for a config — the single source of truth. */
export function catLayerStack(input: unknown): { key: string; markup: string }[] {
  const config = sanitizeCatConfig(input) as CatConfig;
  const t = shapeTransforms(config.shape);
  const slots = config.slots;

  const tailTransform = `translate(372 404) rotate(${t.tail.rotate}) scale(${t.tail.scale} 1) translate(-372 -404)`;
  const bodyTransform = `translate(256 402) scale(${t.body.scaleX} ${t.body.scaleY}) translate(-256 -402)`;
  const headTransform = `translate(${256} ${HEAD.cy}) scale(${t.head.scaleX} ${t.head.scaleY}) translate(-256 ${-HEAD.cy}) translate(0 ${-t.head.lift})`;
  const earTransform = (side: 1 | -1) =>
    `translate(${256 + side * 92} 150) scale(${t.ears.scale}) rotate(${side * t.ears.tilt}) translate(${-(256 + side * 92)} -150)`;

  const patterns: Record<string, string> = {
    solid: "",
    tuxedo: `<ellipse cx="256" cy="398" rx="74" ry="70" fill="#f4f1e7" opacity="0.92"/>
             <ellipse cx="256" cy="288" rx="46" ry="34" fill="#f4f1e7" opacity="0.92"/>`,
    tabby: `<g stroke="${FUR_DARK}" stroke-width="12" stroke-linecap="round" opacity="0.55">
        <path d="M212 150 l10 34"/><path d="M256 138 l0 36"/><path d="M300 150 l-10 34"/></g>`,
    calico: `<path d="M168 200 c 40 -30 76 -6 62 30 c -14 34 -66 22 -62 -30 z" fill="${ACCENT}" opacity="0.5"/>
             <ellipse cx="300" cy="398" rx="52" ry="44" fill="${ACCENT}" opacity="0.38"/>`,
  };

  const expression = config.expression;
  const layers = [
    { key: "backdrop", markup: backdropArt(slots.backdrop) },
    {
      key: "tail",
      markup: `<g transform="${tailTransform}"><path d="M372 404 C 462 396 486 320 442 282" stroke="${FUR}" stroke-width="34" stroke-linecap="round" fill="none"/>
        <path d="M442 282 c 10 -10 20 -8 22 4" stroke="${ACCENT}" stroke-width="6" stroke-linecap="round" fill="none"/></g>`,
    },
    { key: "back", markup: backArt(slots.back) },
    {
      key: "body",
      markup: `<g transform="${bodyTransform}"><ellipse cx="256" cy="402" rx="120" ry="104" fill="${FUR}"/>
        <ellipse cx="256" cy="426" rx="66" ry="58" fill="${FUR_DARK}" opacity="0.5"/></g>`,
    },
    {
      key: "head",
      markup: `<g transform="${headTransform}"><circle cx="${HEAD.cx}" cy="${HEAD.cy}" r="${HEAD.r}" fill="${FUR}"/>
        </g>`,
    },
    {
      key: "ears",
      markup: `<g transform="${earTransform(-1)}"><g class="cat-ear-l">
          <path d="M168 168 L146 68 L240 136 Z" fill="${FUR}"/><path d="M176 158 L162 100 L216 142 Z" fill="${ACCENT}"/></g></g>
        <g transform="${earTransform(1)}"><g class="cat-ear-r">
          <path d="M344 168 L366 68 L272 136 Z" fill="${FUR}"/><path d="M336 158 L350 100 L296 142 Z" fill="${ACCENT}"/></g></g>`,
    },
    { key: "pattern", markup: patterns[config.pattern] ?? "" },
    {
      key: "eyes",
      markup: `<g transform="translate(${EYE_X} ${EYE_Y})">
          <g transform="translate(${-t.eyes.gap} 0) scale(${t.eyes.scale})">${eyesMarkup(expression)}</g>
          <g transform="translate(${t.eyes.gap} 0) scale(${t.eyes.scale})">${eyesMarkup(expression)}</g></g>`,
    },
    {
      key: "muzzle",
      markup: `<path d="M256 268 l -12 10 h 24 z" fill="${ACCENT}"/>
        <path d="M256 278 c 0 10 -10 18 -20 14" stroke="${FUR_DARK}" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M256 278 c 0 10 10 18 20 14" stroke="${FUR_DARK}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    },
    {
      key: "whiskers",
      markup: `<g stroke="${ACCENT}" stroke-width="6" stroke-linecap="round" opacity="0.95">
        <path d="M214 268 L138 254"/><path d="M214 284 L134 288"/>
        <path d="M298 268 L374 254"/><path d="M298 284 L378 288"/></g>`,
    },
    { key: "face", markup: faceArt(slots.face) },
    { key: "neck", markup: neckArt(slots.neck) },
    { key: "hat", markup: hatArt(slots.hat) },
    { key: "eyewear", markup: eyewearArt(slots.eyewear) },
  ];

  return layers.filter((layer) => layer.markup.trim().length > 0);
}
