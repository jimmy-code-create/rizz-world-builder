/**
 * Story Creator content: templates, text styles, RIZZ-matched fonts,
 * sticker packs (emoji + Hinglish/Gen Z phrases + code-drawn icons).
 * Pure data + canvas draw helpers; no framework imports.
 */

/* ------------------------------------------------------------------ */
/* Fonts: match RIZZ (Bricolage Grotesque display, Instrument Sans body) */
/* ------------------------------------------------------------------ */

export const RIZZ_DISPLAY = `"Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif`;
export const RIZZ_SANS = `"Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif`;
export const RIZZ_MONO = `ui-monospace, "Cascadia Mono", Menlo, monospace`;
export const RIZZ_HAND = `"Segoe Print", "Bradley Hand", cursive`;

export type FontId =
  | "rizz-display"
  | "rizz-sans"
  | "rizz-black"
  | "rizz-mono"
  | "rizz-hand"
  | "poster-condensed"
  | "serif-quote"
  | "round-soft";

export const FONTS: Array<{ id: FontId; label: string; stack: string }> = [
  { id: "rizz-display", label: "Rizz Display", stack: RIZZ_DISPLAY },
  { id: "rizz-sans", label: "Rizz Sans", stack: RIZZ_SANS },
  { id: "rizz-black", label: "Rizz Black", stack: RIZZ_DISPLAY },
  { id: "rizz-mono", label: "Typewriter", stack: RIZZ_MONO },
  { id: "rizz-hand", label: "Handwritten", stack: RIZZ_HAND },
  {
    id: "poster-condensed",
    label: "Poster",
    stack: `"Arial Narrow", "Helvetica Neue", Arial, sans-serif`,
  },
  { id: "serif-quote", label: "Quote Serif", stack: `Georgia, "Times New Roman", serif` },
  { id: "round-soft", label: "Round Soft", stack: `"Comic Sans MS", "Chalkboard SE", sans-serif` },
];

export function fontStack(id: FontId): string {
  return FONTS.find((f) => f.id === id)?.stack ?? RIZZ_SANS;
}

/* ------------------------------------------------------------------ */
/* Text styles                                                         */
/* ------------------------------------------------------------------ */

export type TextStyleId =
  "classic" | "neon" | "outline" | "highlight" | "typewriter" | "poster" | "handwritten";

export const TEXT_STYLES: Array<{ id: TextStyleId; label: string }> = [
  { id: "classic", label: "Classic" },
  { id: "neon", label: "Neon glow" },
  { id: "outline", label: "Outline" },
  { id: "highlight", label: "Highlight" },
  { id: "typewriter", label: "Typewriter" },
  { id: "poster", label: "Bold poster" },
  { id: "handwritten", label: "Handwritten" },
];

/* ------------------------------------------------------------------ */
/* Templates (12+, Instagram style). Slots are fractions of 720x1280.  */
/* ------------------------------------------------------------------ */

export type TemplateSlot = { x: number; y: number; w: number; h: number };
export type TemplateText = {
  text: string;
  x: number;
  y: number;
  size: number;
  style: TextStyleId;
  font: FontId;
  color: string;
};
export type TemplateDef = {
  id: string;
  label: string;
  bg: string;
  frame: "none" | "polaroid" | "film" | "neon";
  slots: TemplateSlot[];
  texts: TemplateText[];
};

const INK = "#141416";
const LIME = "#c8ff3d";
const PAPER = "#f5f1e6";

export const TEMPLATES: TemplateDef[] = [
  { id: "blank", label: "Blank", bg: INK, frame: "none", slots: [], texts: [] },
  {
    id: "grid2",
    label: "Grid 2",
    bg: INK,
    frame: "none",
    slots: [
      { x: 0.04, y: 0.06, w: 0.92, h: 0.42 },
      { x: 0.04, y: 0.5, w: 0.92, h: 0.42 },
    ],
    texts: [],
  },
  {
    id: "grid3",
    label: "Grid 3",
    bg: INK,
    frame: "none",
    slots: [
      { x: 0.04, y: 0.06, w: 0.92, h: 0.34 },
      { x: 0.04, y: 0.42, w: 0.44, h: 0.34 },
      { x: 0.52, y: 0.42, w: 0.44, h: 0.34 },
    ],
    texts: [],
  },
  {
    id: "grid4",
    label: "Grid 4",
    bg: INK,
    frame: "none",
    slots: [
      { x: 0.04, y: 0.06, w: 0.44, h: 0.38 },
      { x: 0.52, y: 0.06, w: 0.44, h: 0.38 },
      { x: 0.04, y: 0.46, w: 0.44, h: 0.38 },
      { x: 0.52, y: 0.46, w: 0.44, h: 0.38 },
    ],
    texts: [],
  },
  {
    id: "polaroid",
    label: "Polaroid",
    bg: "#232326",
    frame: "polaroid",
    slots: [{ x: 0.08, y: 0.1, w: 0.84, h: 0.56 }],
    texts: [
      {
        text: "good days",
        x: 0.5,
        y: 0.78,
        size: 44,
        style: "handwritten",
        font: "rizz-hand",
        color: "#f5f1e6",
      },
    ],
  },
  {
    id: "filmstrip",
    label: "Film strip",
    bg: "#0c0c0e",
    frame: "film",
    slots: [
      { x: 0.06, y: 0.12, w: 0.88, h: 0.2 },
      { x: 0.06, y: 0.36, w: 0.88, h: 0.2 },
      { x: 0.06, y: 0.6, w: 0.88, h: 0.2 },
    ],
    texts: [],
  },
  {
    id: "quote",
    label: "Quote card",
    bg: "#1a1a1e",
    frame: "none",
    slots: [],
    texts: [
      {
        text: "“type something worth starring at”",
        x: 0.5,
        y: 0.44,
        size: 52,
        style: "classic",
        font: "serif-quote",
        color: PAPER,
      },
      {
        text: "— you, probably",
        x: 0.5,
        y: 0.58,
        size: 30,
        style: "classic",
        font: "rizz-sans",
        color: LIME,
      },
    ],
  },
  {
    id: "thisorthat",
    label: "This or That",
    bg: INK,
    frame: "none",
    slots: [
      { x: 0.04, y: 0.18, w: 0.44, h: 0.5 },
      { x: 0.52, y: 0.18, w: 0.44, h: 0.5 },
    ],
    texts: [
      {
        text: "THIS",
        x: 0.26,
        y: 0.1,
        size: 56,
        style: "poster",
        font: "poster-condensed",
        color: LIME,
      },
      {
        text: "THAT",
        x: 0.74,
        y: 0.1,
        size: 56,
        style: "outline",
        font: "poster-condensed",
        color: PAPER,
      },
    ],
  },
  {
    id: "qna",
    label: "Q&A",
    bg: "#191920",
    frame: "none",
    slots: [{ x: 0.08, y: 0.08, w: 0.84, h: 0.5 }],
    texts: [
      {
        text: "ask me anything",
        x: 0.5,
        y: 0.66,
        size: 40,
        style: "highlight",
        font: "rizz-display",
        color: INK,
      },
      {
        text: "answers at 9pm",
        x: 0.5,
        y: 0.74,
        size: 28,
        style: "classic",
        font: "rizz-sans",
        color: PAPER,
      },
    ],
  },
  {
    id: "countdown",
    label: "Countdown",
    bg: INK,
    frame: "neon",
    slots: [{ x: 0.08, y: 0.12, w: 0.84, h: 0.44 }],
    texts: [
      {
        text: "02 : 14 : 55",
        x: 0.5,
        y: 0.66,
        size: 64,
        style: "neon",
        font: "rizz-mono",
        color: LIME,
      },
      {
        text: "until the drop",
        x: 0.5,
        y: 0.74,
        size: 30,
        style: "classic",
        font: "rizz-sans",
        color: PAPER,
      },
    ],
  },
  {
    id: "music",
    label: "Music card",
    bg: "#101014",
    frame: "none",
    slots: [{ x: 0.1, y: 0.1, w: 0.8, h: 0.46 }],
    texts: [
      {
        text: "♪ now playing",
        x: 0.5,
        y: 0.62,
        size: 32,
        style: "classic",
        font: "rizz-sans",
        color: LIME,
      },
      {
        text: "midnight drive",
        x: 0.5,
        y: 0.7,
        size: 48,
        style: "poster",
        font: "rizz-display",
        color: PAPER,
      },
    ],
  },
  {
    id: "neonframe",
    label: "Neon frame",
    bg: INK,
    frame: "neon",
    slots: [{ x: 0.06, y: 0.08, w: 0.88, h: 0.7 }],
    texts: [
      {
        text: "stay electric",
        x: 0.5,
        y: 0.86,
        size: 44,
        style: "neon",
        font: "rizz-display",
        color: LIME,
      },
    ],
  },
  {
    id: "split",
    label: "Split mood",
    bg: INK,
    frame: "none",
    slots: [{ x: 0.0, y: 0.0, w: 1.0, h: 0.55 }],
    texts: [
      {
        text: "POV: monday",
        x: 0.5,
        y: 0.72,
        size: 52,
        style: "poster",
        font: "poster-condensed",
        color: PAPER,
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Sticker packs                                                       */
/* ------------------------------------------------------------------ */

export type StickerTab = "Emoji" | "Icons" | "Mood" | "Gen Z" | "Hinglish" | "Desi pop";

export const EMOJI_PACK: Record<Exclude<StickerTab, "Icons">, string[]> = {
  Emoji: [
    "😂",
    "🔥",
    "❤️",
    "😭",
    "🙏",
    "👀",
    "✨",
    "💀",
    "🥺",
    "😎",
    "🤝",
    "🎉",
    "💯",
    "😴",
    "🤯",
    "🫶",
  ],
  Mood: ["😌", "😤", "🥲", "😶‍🌫️", "🤒", "😈", "🤡", "👻", "🌧️", "🌙", "☀️", "🌊"],
  "Gen Z": [],
  Hinglish: [],
  "Desi pop": ["🪔", "🏏", "🍵", "⭐", "🎬", "🥁", "🦚", "🕌"],
};

export const PHRASE_PACK: Record<string, string[]> = {
  "Gen Z": [
    "no cap",
    "slay",
    "rizz",
    "bussin",
    "it's giving",
    "lowkey",
    "highkey",
    "sus",
    "GOAT",
    "bet",
  ],
  Hinglish: [
    "kya scene hai",
    "mast plan",
    "full paisa vasool",
    "scene set hai",
    "bhai sahab",
    "arre yaar",
    "ekdum kadak",
    "chalo chalein",
    "dil se",
    "bindaas",
  ],
};

/* ------------------------------------------------------------------ */
/* Code-drawn icons (40). Each draws centered in a 100x100 box.        */
/* ------------------------------------------------------------------ */

export type Ctx = CanvasRenderingContext2D;

function poly(c: Ctx, pts: Array<[number, number]>) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
}

export const ICONS: Record<string, { label: string; draw: (c: Ctx, color: string) => void }> = {};
function icon(name: string, label: string, draw: (c: Ctx, color: string) => void) {
  ICONS[name] = { label, draw };
}

icon("heart", "Heart", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(50, 82);
  c.bezierCurveTo(8, 55, 12, 20, 32, 20);
  c.bezierCurveTo(43, 20, 48, 30, 50, 36);
  c.bezierCurveTo(52, 30, 57, 20, 68, 20);
  c.bezierCurveTo(88, 20, 92, 55, 50, 82);
  c.fill();
});
icon("star", "Star", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? 34 : 15;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = 50 + r * Math.cos(a);
    const y = 50 + r * Math.sin(a);
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
  c.fill();
});
icon("bolt", "Bolt", (c, color) => {
  c.fillStyle = color;
  poly(c, [
    [56, 10],
    [30, 56],
    [47, 56],
    [42, 90],
    [70, 44],
    [53, 44],
  ]);
  c.fill();
});
icon("fire", "Fire", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(50, 8);
  c.bezierCurveTo(62, 30, 82, 42, 82, 66);
  c.bezierCurveTo(82, 82, 66, 92, 50, 92);
  c.bezierCurveTo(34, 92, 18, 82, 18, 66);
  c.bezierCurveTo(18, 52, 30, 46, 34, 32);
  c.bezierCurveTo(38, 42, 44, 44, 44, 44);
  c.bezierCurveTo(42, 32, 46, 18, 50, 8);
  c.fill();
});
icon("crown", "Crown", (c, color) => {
  c.fillStyle = color;
  poly(c, [
    [15, 70],
    [20, 35],
    [35, 55],
    [50, 28],
    [65, 55],
    [80, 35],
    [85, 70],
  ]);
  c.fill();
  c.fillRect(15, 74, 70, 8);
});
icon("smile", "Smile", (c, color) => {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 6;
  c.beginPath();
  c.arc(50, 50, 32, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.arc(39, 42, 4, 0, Math.PI * 2);
  c.arc(61, 42, 4, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(50, 55, 16, 0.3, Math.PI - 0.3);
  c.stroke();
});
icon("cool", "Cool face", (c, color) => {
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.beginPath();
  c.arc(50, 50, 32, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = color;
  c.fillRect(24, 38, 22, 12);
  c.fillRect(54, 38, 22, 12);
  c.fillRect(44, 42, 12, 4);
  c.beginPath();
  c.arc(50, 64, 10, 0.2, Math.PI - 0.2);
  c.stroke();
});
icon("ghost", "Ghost", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(22, 85);
  c.lineTo(22, 50);
  c.bezierCurveTo(22, 28, 34, 16, 50, 16);
  c.bezierCurveTo(66, 16, 78, 28, 78, 50);
  c.lineTo(78, 85);
  c.lineTo(68, 76);
  c.lineTo(59, 85);
  c.lineTo(50, 76);
  c.lineTo(41, 85);
  c.lineTo(32, 76);
  c.closePath();
  c.fill();
});
icon("skull", "Skull", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(50, 42, 26, Math.PI, 0);
  c.lineTo(76, 62);
  c.lineTo(76, 72);
  c.lineTo(24, 72);
  c.lineTo(24, 62);
  c.closePath();
  c.fill();
  c.globalCompositeOperation = "destination-out";
  c.beginPath();
  c.arc(40, 48, 7, 0, Math.PI * 2);
  c.arc(60, 48, 7, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = "source-over";
});
icon("flower", "Flower", (c, color) => {
  c.fillStyle = color;
  for (let i = 0; i < 6; i += 1) {
    const a = (i * Math.PI) / 3;
    c.beginPath();
    c.ellipse(50 + 18 * Math.cos(a), 50 + 18 * Math.sin(a), 13, 9, a, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#141416";
  c.beginPath();
  c.arc(50, 50, 9, 0, Math.PI * 2);
  c.fill();
});
icon("leaf", "Leaf", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(50, 10);
  c.bezierCurveTo(80, 35, 80, 70, 50, 90);
  c.bezierCurveTo(20, 70, 20, 35, 50, 10);
  c.fill();
});
icon("sun", "Sun", (c, color) => {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 6;
  c.beginPath();
  c.arc(50, 50, 18, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4;
    c.beginPath();
    c.moveTo(50 + 26 * Math.cos(a), 50 + 26 * Math.sin(a));
    c.lineTo(50 + 36 * Math.cos(a), 50 + 36 * Math.sin(a));
    c.stroke();
  }
});
icon("moon", "Moon", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(56, 44, 28, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = "destination-out";
  c.beginPath();
  c.arc(68, 36, 24, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = "source-over";
});
icon("cloud", "Cloud", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(36, 58, 16, 0, Math.PI * 2);
  c.arc(54, 48, 20, 0, Math.PI * 2);
  c.arc(70, 60, 13, 0, Math.PI * 2);
  c.fill();
  c.fillRect(22, 58, 60, 14);
});
icon("rain", "Rain", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(50, 36, 18, Math.PI, 0);
  c.lineTo(68, 44);
  c.lineTo(32, 44);
  c.closePath();
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 5;
  for (const x of [36, 50, 64]) {
    c.beginPath();
    c.moveTo(x, 56);
    c.lineTo(x - 5, 72);
    c.stroke();
  }
});
icon("snow", "Snowflake", (c, color) => {
  c.strokeStyle = color;
  c.lineWidth = 5;
  for (let i = 0; i < 3; i += 1) {
    const a = (i * Math.PI) / 3;
    c.beginPath();
    c.moveTo(50 - 26 * Math.cos(a), 50 - 26 * Math.sin(a));
    c.lineTo(50 + 26 * Math.cos(a), 50 + 26 * Math.sin(a));
    c.stroke();
  }
});
icon("music", "Music note", (c, color) => {
  c.fillStyle = color;
  c.fillRect(62, 18, 7, 48);
  c.beginPath();
  c.ellipse(53, 68, 14, 10, -0.3, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(62, 18);
  c.bezierCurveTo(74, 22, 80, 30, 78, 40);
  c.lineTo(71, 38);
  c.bezierCurveTo(72, 31, 68, 25, 62, 23);
  c.closePath();
  c.fill();
});
icon("camera", "Camera", (c, color) => {
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.strokeRect(18, 34, 64, 44);
  c.beginPath();
  c.arc(50, 56, 13, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = color;
  c.fillRect(34, 26, 18, 8);
});
icon("gift", "Gift", (c, color) => {
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.strokeRect(24, 44, 52, 40);
  c.beginPath();
  c.moveTo(50, 44);
  c.lineTo(50, 84);
  c.moveTo(24, 58);
  c.lineTo(76, 58);
  c.stroke();
  c.beginPath();
  c.arc(40, 32, 9, 0, Math.PI * 2);
  c.arc(60, 32, 9, 0, Math.PI * 2);
  c.stroke();
});
icon("rocket", "Rocket", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(50, 8);
  c.bezierCurveTo(66, 28, 66, 56, 50, 74);
  c.bezierCurveTo(34, 56, 34, 28, 50, 8);
  c.fill();
  c.beginPath();
  c.arc(50, 40, 8, 0, Math.PI * 2);
  c.fillStyle = "#141416";
  c.fill();
});
icon("diamond", "Diamond", (c, color) => {
  c.fillStyle = color;
  poly(c, [
    [30, 36],
    [70, 36],
    [86, 52],
    [50, 88],
    [14, 52],
  ]);
  c.fill();
  c.strokeStyle = "#141416";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(30, 36);
  c.lineTo(70, 36);
  c.moveTo(14, 52);
  c.lineTo(86, 52);
  c.stroke();
});
icon("lips", "Kiss", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(14, 52);
  c.bezierCurveTo(30, 34, 44, 38, 50, 46);
  c.bezierCurveTo(56, 38, 70, 34, 86, 52);
  c.bezierCurveTo(70, 70, 56, 68, 50, 62);
  c.bezierCurveTo(44, 68, 30, 70, 14, 52);
  c.fill();
});
icon("chai", "Chai cup", (c, color) => {
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(30, 40);
  c.lineTo(36, 78);
  c.lineTo(64, 78);
  c.lineTo(70, 40);
  c.closePath();
  c.stroke();
  c.beginPath();
  c.arc(74, 56, 10, -Math.PI / 2, Math.PI / 2);
  c.stroke();
  for (const x of [42, 50, 58]) {
    c.beginPath();
    c.moveTo(x, 30);
    c.bezierCurveTo(x - 4, 24, x + 4, 20, x, 14);
    c.stroke();
  }
});
icon("cricket", "Cricket", (c, color) => {
  c.fillStyle = color;
  c.save();
  c.translate(50, 50);
  c.rotate(-0.5);
  c.fillRect(-8, -34, 16, 52);
  c.restore();
  c.beginPath();
  c.arc(66, 68, 12, 0, Math.PI * 2);
  c.fill();
});
icon("diya", "Diya", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(18, 62);
  c.bezierCurveTo(35, 82, 65, 82, 82, 62);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(50, 26);
  c.bezierCurveTo(58, 38, 58, 46, 50, 52);
  c.bezierCurveTo(42, 46, 42, 38, 50, 26);
  c.fill();
});
icon("rangoli", "Rangoli", (c, color) => {
  c.strokeStyle = color;
  c.lineWidth = 4;
  for (const r of [10, 20, 30]) {
    c.beginPath();
    c.arc(50, 50, r, 0, Math.PI * 2);
    c.stroke();
  }
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4;
    c.beginPath();
    c.moveTo(50 + 30 * Math.cos(a), 50 + 30 * Math.sin(a));
    c.lineTo(50 + 38 * Math.cos(a), 50 + 38 * Math.sin(a));
    c.stroke();
  }
});
icon("starburst", "Burst", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < 24; i += 1) {
    const r = i % 2 === 0 ? 38 : 22;
    const a = (i * Math.PI) / 12;
    const x = 50 + r * Math.cos(a);
    const y = 50 + r * Math.sin(a);
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
  c.fill();
});
icon("film", "Film", (c, color) => {
  c.fillStyle = color;
  c.fillRect(22, 28, 56, 44);
  c.fillStyle = "#141416";
  for (let i = 0; i < 4; i += 1) {
    c.fillRect(26 + i * 14, 32, 8, 8);
    c.fillRect(26 + i * 14, 60, 8, 8);
  }
});
icon("play", "Play", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(50, 50, 34, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#141416";
  poly(c, [
    [42, 34],
    [66, 50],
    [42, 66],
  ]);
  c.fill();
});
icon("hash", "Hashtag", (c, color) => {
  c.strokeStyle = color;
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(38, 18);
  c.lineTo(30, 82);
  c.moveTo(70, 18);
  c.lineTo(62, 82);
  c.moveTo(20, 40);
  c.lineTo(82, 40);
  c.moveTo(18, 62);
  c.lineTo(80, 62);
  c.stroke();
});
icon("at", "Mention", (c, color) => {
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.beginPath();
  c.arc(50, 50, 28, 0, Math.PI * 2);
  c.stroke();
  c.font = "700 34px sans-serif";
  c.fillStyle = color;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("a", 50, 53);
});
icon("check", "Check", (c, color) => {
  c.strokeStyle = color;
  c.lineWidth = 10;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(28, 53);
  c.lineTo(45, 70);
  c.lineTo(74, 32);
  c.stroke();
});
icon("x", "Cross", (c, color) => {
  c.strokeStyle = color;
  c.lineWidth = 10;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(32, 32);
  c.lineTo(68, 68);
  c.moveTo(68, 32);
  c.lineTo(32, 68);
  c.stroke();
});
icon("arrow", "Arrow", (c, color) => {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 9;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(18, 50);
  c.lineTo(74, 50);
  c.moveTo(52, 28);
  c.lineTo(76, 50);
  c.lineTo(52, 72);
  c.stroke();
});
icon("chat", "Chat bubble", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(20, 24);
  c.lineTo(80, 24);
  c.lineTo(80, 62);
  c.lineTo(48, 62);
  c.lineTo(36, 78);
  c.lineTo(36, 62);
  c.lineTo(20, 62);
  c.closePath();
  c.fill();
});
icon("thumb", "Thumbs up", (c, color) => {
  c.fillStyle = color;
  c.fillRect(26, 44, 12, 34);
  c.beginPath();
  c.moveTo(42, 78);
  c.lineTo(42, 44);
  c.bezierCurveTo(42, 34, 50, 32, 52, 24);
  c.bezierCurveTo(53, 18, 60, 18, 60, 24);
  c.lineTo(60, 40);
  c.lineTo(74, 40);
  c.bezierCurveTo(80, 40, 80, 48, 74, 50);
  c.lineTo(64, 56);
  c.bezierCurveTo(78, 58, 78, 78, 60, 78);
  c.closePath();
  c.fill();
});
icon("eye", "Eye", (c, color) => {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(12, 50);
  c.bezierCurveTo(30, 28, 70, 28, 88, 50);
  c.bezierCurveTo(70, 72, 30, 72, 12, 50);
  c.stroke();
  c.beginPath();
  c.arc(50, 50, 10, 0, Math.PI * 2);
  c.fill();
});
icon("lock", "Lock", (c, color) => {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 7;
  c.strokeRect(30, 46, 40, 34);
  c.beginPath();
  c.arc(50, 46, 14, Math.PI, 0);
  c.stroke();
  c.fillStyle = "#141416";
  c.beginPath();
  c.arc(50, 60, 5, 0, Math.PI * 2);
  c.fill();
});
icon("bell", "Bell", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(50, 14);
  c.bezierCurveTo(68, 14, 72, 34, 72, 52);
  c.lineTo(80, 64);
  c.lineTo(20, 64);
  c.lineTo(28, 52);
  c.bezierCurveTo(28, 34, 32, 14, 50, 14);
  c.fill();
  c.beginPath();
  c.arc(50, 74, 7, 0, Math.PI * 2);
  c.fill();
});
icon("mic", "Mic", (c, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(50, 38, 14, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.beginPath();
  c.arc(50, 38, 22, 0.3, Math.PI - 0.3);
  c.stroke();
  c.beginPath();
  c.moveTo(50, 62);
  c.lineTo(50, 78);
  c.moveTo(38, 78);
  c.lineTo(62, 78);
  c.stroke();
});

export type BrushId = "pen" | "marker" | "highlighter" | "neon" | "spray" | "rainbow" | "eraser";

export const BRUSHES: Array<{ id: BrushId; label: string }> = [
  { id: "pen", label: "Pen" },
  { id: "marker", label: "Marker" },
  { id: "highlighter", label: "Highlighter" },
  { id: "neon", label: "Neon glow" },
  { id: "spray", label: "Spray" },
  { id: "rainbow", label: "Rainbow" },
  { id: "eraser", label: "Eraser" },
];

export const ICON_NAMES = Object.keys(ICONS);
