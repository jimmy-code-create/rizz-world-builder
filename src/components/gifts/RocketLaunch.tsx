import type { CSSProperties } from "react";
import type { Gift } from "@/lib/gift-catalog";
import "./rocket-launch.css";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const STARS = [
  { x: "8%", y: "18%", s: 2, d: 0 },
  { x: "18%", y: "9%", s: 1, d: 1.1 },
  { x: "27%", y: "27%", s: 2, d: 0.4 },
  { x: "38%", y: "12%", s: 1, d: 1.8 },
  { x: "47%", y: "22%", s: 2, d: 0.8 },
  { x: "58%", y: "8%", s: 1, d: 2.2 },
  { x: "67%", y: "30%", s: 2, d: 0.2 },
  { x: "78%", y: "14%", s: 1, d: 1.4 },
  { x: "88%", y: "24%", s: 2, d: 0.6 },
  { x: "94%", y: "42%", s: 1, d: 2.5 },
  { x: "12%", y: "48%", s: 1, d: 1.7 },
  { x: "22%", y: "62%", s: 2, d: 0.3 },
  { x: "73%", y: "52%", s: 1, d: 2.1 },
  { x: "85%", y: "68%", s: 2, d: 1.2 },
  { x: "4%", y: "78%", s: 1, d: 0.9 },
  { x: "96%", y: "84%", s: 1, d: 1.9 },
];

const SPEED_LINES = [
  { x: "4%", h: 22, d: 0.9, delay: 0 },
  { x: "12%", h: 13, d: 1.7, delay: 0.4 },
  { x: "20%", h: 30, d: 1.2, delay: 1.1 },
  { x: "30%", h: 17, d: 2.1, delay: 0.2 },
  { x: "41%", h: 25, d: 1.4, delay: 1.5 },
  { x: "53%", h: 12, d: 1.9, delay: 0.8 },
  { x: "63%", h: 28, d: 1.1, delay: 1.9 },
  { x: "72%", h: 16, d: 2.3, delay: 0.5 },
  { x: "82%", h: 24, d: 1.5, delay: 1.3 },
  { x: "91%", h: 14, d: 1.8, delay: 0.1 },
];

const SMOKE = [
  { x: -16, y: 4, s: 1.05, d: 0 },
  { x: 3, y: 0, s: 1.4, d: 0.1 },
  { x: 23, y: 3, s: 1.15, d: 0.18 },
  { x: 45, y: 8, s: 0.9, d: 0.28 },
  { x: 63, y: 1, s: 1.35, d: 0.06 },
  { x: 84, y: 6, s: 1, d: 0.22 },
  { x: 104, y: 2, s: 1.2, d: 0.14 },
  { x: 13, y: 18, s: 0.8, d: 0.36 },
  { x: 34, y: 20, s: 1.1, d: 0.44 },
  { x: 56, y: 17, s: 0.95, d: 0.32 },
  { x: 78, y: 21, s: 1.25, d: 0.4 },
  { x: 4, y: 38, s: 0.62, d: 0.18 },
  { x: 21, y: 44, s: 0.8, d: 0.3 },
  { x: 36, y: 36, s: 0.56, d: 0.12 },
  { x: 49, y: 47, s: 0.74, d: 0.26 },
  { x: 63, y: 38, s: 0.6, d: 0.08 },
  { x: 77, y: 46, s: 0.82, d: 0.34 },
  { x: 92, y: 36, s: 0.58, d: 0.16 },
];

const HEARTS = [
  { x: -118, d: 0, s: 0.85, r: -16 },
  { x: -72, d: 0.35, s: 1.15, r: 12 },
  { x: -28, d: 0.8, s: 0.7, r: -8 },
  { x: 24, d: 0.2, s: 1.05, r: 18 },
  { x: 68, d: 0.65, s: 0.8, r: -14 },
  { x: 112, d: 1.05, s: 1.25, r: 8 },
  { x: -96, d: 1.3, s: 0.65, r: 20 },
  { x: 92, d: 1.55, s: 0.9, r: -20 },
  { x: 0, d: 1.75, s: 1.1, r: 6 },
];

const COMETS = [
  { x: 6, y: 30, d: 2.4, delay: 0.2, r: -38 },
  { x: 88, y: 16, d: 3.1, delay: 1.1, r: -138 },
  { x: 15, y: 72, d: 2.8, delay: 2.4, r: -32 },
  { x: 80, y: 64, d: 2.2, delay: 0.8, r: -150 },
];

function tierLabel(tier: Gift["tier"]) {
  return tier.replace("-", " ").toUpperCase();
}

function handle(value: string) {
  const clean = value.replace(/^@/, "").trim() || "someone";
  return clean.length > 20 ? `@${clean.slice(0, 8)}…` : `@${clean}`;
}

function initial(value: string) {
  return value.replace(/^@/, "").trim().charAt(0).toUpperCase() || "R";
}

function RizzRocket() {
  return (
    <svg
      viewBox="0 0 320 540"
      className="rizz-rocket-art"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="rizz-body" x1="90" y1="40" x2="245" y2="380" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f6e8ff" />
          <stop offset="0.22" stopColor="#d8b4fe" />
          <stop offset="0.54" stopColor="#9333ea" />
          <stop offset="0.8" stopColor="#5b21b6" />
          <stop offset="1" stopColor="#2e1065" />
        </linearGradient>
        <linearGradient id="rizz-fin" x1="55" y1="260" x2="126" y2="405" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff5ca8" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="rizz-band" x1="103" y1="110" x2="220" y2="124" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd166" />
          <stop offset="0.55" stopColor="#ff9f1c" />
          <stop offset="1" stopColor="#ff3b5c" />
        </linearGradient>
        <radialGradient id="rizz-glass" cx="0.36" cy="0.3" r="0.78">
          <stop stopColor="#f8fbff" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#b9e7ff" stopOpacity="0.45" />
          <stop offset="0.72" stopColor="#4c1d95" stopOpacity="0.82" />
          <stop offset="1" stopColor="#160b24" />
        </radialGradient>
        <linearGradient id="rizz-rim" x1="100" y1="130" x2="220" y2="244" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c9ff3d" />
          <stop offset="0.45" stopColor="#f4f0ff" />
          <stop offset="1" stopColor="#ff5ca8" />
        </linearGradient>
        <linearGradient id="rizz-flame" x1="160" y1="402" x2="160" y2="526" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.24" stopColor="#fef08a" />
          <stop offset="0.58" stopColor="#ff5ca8" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="rizz-flame-core" x1="160" y1="406" x2="160" y2="500" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#c9ff3d" />
          <stop offset="1" stopColor="#ff3b5c" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="rizz-heart" x1="142" y1="284" x2="178" y2="318" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff9fbe" />
          <stop offset="1" stopColor="#ff2e63" />
        </linearGradient>
      </defs>

      <g className="rizz-rocket-flame">
        <path
          d="M125 399 C133 447 146 486 160 530 C174 486 187 447 195 399 Z"
          fill="url(#rizz-flame)"
          className="rizz-rocket-flame__outer"
        />
        <path
          d="M141 402 C146 435 153 462 160 492 C167 462 174 435 179 402 Z"
          fill="url(#rizz-flame-core)"
          className="rizz-rocket-flame__inner"
        />
      </g>

      <g className="rizz-rocket-vehicle">
        <path
          d="M104 270 C79 298 62 340 52 398 C83 385 108 362 121 328 Z"
          fill="url(#rizz-fin)"
          stroke="#2b1052"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M216 270 C241 298 258 340 268 398 C237 385 212 362 199 328 Z"
          fill="url(#rizz-fin)"
          stroke="#2b1052"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M160 34 C192 72 215 113 223 166 L233 300 C235 339 210 365 160 380 C110 365 85 339 87 300 L97 166 C105 113 128 72 160 34 Z"
          fill="url(#rizz-body)"
          stroke="#2b1052"
          strokeWidth="5"
        />
        <path
          d="M104 164 C137 148 184 148 218 164 L223 183 C184 168 137 168 97 183 Z"
          fill="url(#rizz-band)"
        />
        <path
          d="M116 350 C137 363 183 363 205 350 L208 371 C183 383 137 383 113 371 Z"
          fill="#2e1065"
          opacity="0.9"
        />
        <path
          d="M126 385 H194 L186 419 H134 Z"
          fill="#35205c"
          stroke="#170b28"
          strokeWidth="4"
        />
        <path
          d="M113 208 C111 269 110 322 120 348"
          fill="none"
          stroke="#ffffff"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.32"
        />
        <path
          d="M211 206 C214 260 215 306 202 340"
          fill="none"
          stroke="#160b24"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.18"
        />

        <g className="rizz-rocket-helmet">
          <circle cx="160" cy="198" r="69" fill="url(#rizz-glass)" stroke="url(#rizz-rim)" strokeWidth="6" />
          <circle cx="160" cy="198" r="61" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.35" />
          <g className="rizz-rocket-cat">
            <path d="M123 174 L126 132 L151 157 Z" fill="#1b1024" />
            <path d="M197 174 L194 132 L169 157 Z" fill="#1b1024" />
            <path d="M128 166 L130 144 L144 158 Z" fill="#ff8ab5" />
            <path d="M192 166 L190 144 L176 158 Z" fill="#ff8ab5" />
            <ellipse cx="160" cy="200" rx="43" ry="34" fill="#1b1024" />
            <ellipse cx="160" cy="205" rx="30" ry="24" fill="#2b153c" />
            <ellipse cx="145" cy="197" rx="5.6" ry="8.2" fill="#c9ff3d" transform="rotate(-9 145 197)" />
            <ellipse cx="175" cy="197" rx="5.6" ry="8.2" fill="#c9ff3d" transform="rotate(9 175 197)" />
            <path d="M154 211 H166 L160 218 Z" fill="#ff6b9d" />
            <path d="M160 218 V223 M160 223 C155 229 149 227 147 223 M160 223 C165 229 171 227 173 223" fill="none" stroke="#ffb3d1" strokeWidth="2" strokeLinecap="round" />
            <path d="M116 207 H139 M117 218 L140 216 M204 207 H181 M203 218 L180 216" stroke="#d7ff7a" strokeWidth="1.8" strokeLinecap="round" opacity="0.75" />
          </g>
          <ellipse cx="132" cy="163" rx="14" ry="7" fill="#ffffff" opacity="0.42" transform="rotate(-34 132 163)" />
          <path d="M105 238 C120 252 139 259 160 261 C181 259 200 252 215 238" fill="none" stroke="#0d0718" strokeWidth="9" opacity="0.24" />
        </g>

        <g className="rizz-rocket-badge">
          <path
            d="M160 291 C150 280 134 291 136 304 C138 319 160 331 160 331 C160 331 182 319 184 304 C186 291 170 280 160 291 Z"
            fill="url(#rizz-heart)"
            stroke="#ffd0e0"
            strokeWidth="2"
          />
          <circle cx="151" cy="301" r="3.4" fill="#ffffff" opacity="0.65" />
        </g>

        <text x="160" y="270" textAnchor="middle" fill="#d7ff7a" fontSize="13" fontWeight="900" letterSpacing="4">
          RIZZ
        </text>
        <circle cx="136" cy="177" r="1.8" fill="#ffffff" opacity="0.75" />
        <circle cx="184" cy="177" r="1.8" fill="#ffffff" opacity="0.75" />
      </g>
    </svg>
  );
}

export function RocketLaunch({
  gift,
  sender,
  receiver,
  message,
  reducedMotion = false,
  onClose,
}: {
  gift: Gift;
  sender: string;
  receiver: string;
  message: string | null;
  reducedMotion?: boolean;
  onClose?: () => void;
}) {
  const senderHandle = handle(sender);
  const receiverHandle = handle(receiver);
  const note = message && !/^sent you a\b/i.test(message) ? message : null;

  return (
    <div
      className={`rizz-rocket-overlay${reducedMotion ? " rizz-rocket--reduced" : ""}`}
      style={{ "--gift-accent": gift.accent } as Vars}
      role="status"
      aria-live="polite"
      aria-label={`${senderHandle} launched ${gift.name} to ${receiverHandle}`}
    >
      <div className="rizz-rocket-aurora" aria-hidden="true" />
      <div className="rizz-rocket-grid" aria-hidden="true" />
      <div className="rizz-rocket-stars" aria-hidden="true">
        {STARS.map((star, index) => (
          <span
            key={index}
            style={
              {
                left: star.x,
                top: star.y,
                width: star.s,
                height: star.s,
                animationDelay: `${star.d}s`,
              } as Vars
            }
          />
        ))}
      </div>
      <div className="rizz-rocket-speed" aria-hidden="true">
        {SPEED_LINES.map((line, index) => (
          <span
            key={index}
            style={
              {
                left: line.x,
                "--line-h": `${line.h}vh`,
                "--line-d": `${line.d}s`,
                "--line-delay": `${line.delay}s`,
              } as Vars
            }
          />
        ))}
      </div>
      <div className="rizz-rocket-comets" aria-hidden="true">
        {COMETS.map((comet, index) => (
          <span
            key={index}
            style={
              {
                left: `${comet.x}%`,
                top: `${comet.y}%`,
                "--comet-d": `${comet.d}s`,
                "--comet-delay": `${comet.delay}s`,
                "--comet-r": `${comet.r}deg`,
              } as Vars
            }
          />
        ))}
      </div>

      <div className="rizz-rocket-topbar">
        <span className="rizz-rocket-live">
          <i aria-hidden="true" /> LIVE GIFT DROP
        </span>
        <span className="rizz-rocket-wordmark">RIZZ</span>
        <span className="rizz-rocket-tier">{tierLabel(gift.tier)}</span>
      </div>

      {onClose && (
        <button type="button" onClick={onClose} className="rizz-rocket-close" aria-label="Close gift animation">
          Skip
        </button>
      )}

      <div className="rizz-rocket-copy">
        <p className="rizz-rocket-eyebrow">
          <span>DAMN DELIVERY</span>
          <i aria-hidden="true" />
          <span>{gift.name}</span>
        </p>
        <h2 className="rizz-rocket-title">
          <span className="rizz-rocket-title__rizz">RIZZ</span>
          <span className="rizz-rocket-title__rocket">ROCKET</span>
        </h2>
        <p className="rizz-rocket-sub">
          {senderHandle} launched <b>{gift.name}</b> to {receiverHandle}
        </p>
        {note && <p className="rizz-rocket-note">“{note}”</p>}
      </div>

      <div className="rizz-rocket-scene" aria-hidden="true">
        <div className="rizz-rocket-rings">
          <span />
          <span />
          <span />
        </div>
        <div className="rizz-rocket-smoke">
          {SMOKE.map((puff, index) => (
            <span
              key={index}
              style={
                {
                  left: `${puff.x}%`,
                  bottom: `${puff.y}%`,
                  "--puff-scale": puff.s,
                  "--puff-delay": `${puff.d}s`,
                } as Vars
              }
            />
          ))}
        </div>
        <div className="rizz-rocket-lift">
          <div className="rizz-rocket-float">
            <RizzRocket />
          </div>
        </div>
        <div className="rizz-rocket-hearts">
          {HEARTS.map((heart, index) => (
            <span
              key={index}
              style={
                {
                  "--heart-x": `${heart.x}px`,
                  "--heart-delay": `${heart.d}s`,
                  "--heart-scale": heart.s,
                  "--heart-rot": `${heart.r}deg`,
                } as Vars
              }
            >
              ♥
            </span>
          ))}
        </div>
        <div className="rizz-rocket-combo">
          <small>COMBO</small>
          <strong>×1</strong>
        </div>
      </div>

      <div className="rizz-rocket-feed">
        <span className="rizz-rocket-feed__avatar">
          {initial(senderHandle)}
          <i aria-hidden="true">{gift.emoji}</i>
        </span>
        <div className="rizz-rocket-feed__copy">
          <p>
            <b>{senderHandle}</b> sent
          </p>
          <p>{gift.name}</p>
        </div>
        <span className="rizz-rocket-feed__count">×1</span>
      </div>

      <div className="rizz-rocket-footer">
        <span>
          <b>{gift.pawsPrice.toLocaleString()}</b> PAWS
        </span>
        <span className="rizz-rocket-footer__to">TO {receiverHandle}</span>
      </div>
    </div>
  );
}
