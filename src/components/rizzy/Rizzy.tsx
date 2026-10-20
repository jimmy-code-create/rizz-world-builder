import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import "./rizzy.css";

/**
 * Rizzy — the original RIZZ mascot.
 *
 * One layered vector rig, not a set of drawings. Every pose shares the same
 * head, ears, muzzle, eye geometry and proportions; poses only change the arms,
 * expression and head tilt. The idle motion (blink, tail, ears, breathing,
 * head bob) is CSS, so it stays cheap and stops completely for reduced motion.
 */
export type RizzyPose =
  "wave" | "point" | "think" | "chat" | "present" | "paw" | "badge" | "celebrate";

type EyeMood = "open" | "happy" | "wink" | "squint" | "proud" | "excited";
type MouthMood = "smile" | "grin" | "smirk" | "oh";
type Look = "center" | "left" | "right" | "up";

type ArmSpec = {
  side: "left" | "right";
  /** Centre line of the forearm, drawn with a thick round stroke. */
  path: string;
  hand: [number, number];
  handAngle: number;
  shoulder: [number, number];
  animate?: "wave" | "cheer";
};

type PoseSpec = {
  eyes: EyeMood;
  mouth: MouthMood;
  look: Look;
  tilt: number;
  arms: ArmSpec[];
  label: string;
};

const WAVE_ARM: ArmSpec = {
  side: "left",
  path: "M158 352 C122 354 84 330 76 294",
  hand: [78, 282],
  handAngle: 20,
  shoulder: [162, 350],
  animate: "wave",
};
const POINT_ARM: ArmSpec = {
  side: "right",
  path: "M302 350 C330 351 350 343 364 332",
  hand: [369, 330],
  handAngle: 82,
  shoulder: [302, 350],
};
const THINK_ARM: ArmSpec = {
  side: "left",
  path: "M162 350 C194 349 216 338 226 319",
  hand: [231, 312],
  handAngle: 55,
  shoulder: [162, 350],
};
const CHAT_LEFT_ARM: ArmSpec = {
  side: "left",
  path: "M162 352 C144 341 136 327 139 313",
  hand: [143, 303],
  handAngle: 12,
  shoulder: [162, 352],
};
const CHAT_RIGHT_ARM: ArmSpec = {
  side: "right",
  path: "M298 352 C316 341 324 327 321 313",
  hand: [317, 303],
  handAngle: -12,
  shoulder: [298, 352],
};
const OFFER_ARM: ArmSpec = {
  side: "right",
  path: "M302 351 C332 355 354 350 370 340",
  hand: [375, 338],
  handAngle: 80,
  shoulder: [302, 351],
};
const PAW_ARM: ArmSpec = {
  side: "right",
  path: "M302 353 C332 365 354 374 369 384",
  hand: [374, 387],
  handAngle: 115,
  shoulder: [302, 353],
};
const BADGE_ARM: ArmSpec = {
  side: "right",
  path: "M302 350 C330 348 350 339 365 326",
  hand: [370, 322],
  handAngle: 75,
  shoulder: [302, 350],
};
const CHEER_LEFT_ARM: ArmSpec = {
  side: "left",
  path: "M158 352 C126 350 98 328 88 296",
  hand: [83, 280],
  handAngle: 24,
  shoulder: [162, 350],
  animate: "cheer",
};
const CHEER_RIGHT_ARM: ArmSpec = {
  side: "right",
  path: "M302 352 C334 350 362 328 372 296",
  hand: [377, 280],
  handAngle: -24,
  shoulder: [298, 350],
  animate: "cheer",
};

const POSES: Record<RizzyPose, PoseSpec> = {
  wave: {
    eyes: "open",
    mouth: "grin",
    look: "right",
    tilt: 2,
    arms: [WAVE_ARM],
    label: "waving hello",
  },
  point: {
    eyes: "open",
    mouth: "smirk",
    look: "right",
    tilt: -2,
    arms: [POINT_ARM],
    label: "pointing the way",
  },
  think: {
    eyes: "squint",
    mouth: "oh",
    look: "up",
    tilt: -7,
    arms: [THINK_ARM],
    label: "thinking",
  },
  chat: {
    eyes: "excited",
    mouth: "grin",
    look: "right",
    tilt: 3,
    arms: [CHAT_LEFT_ARM, CHAT_RIGHT_ARM],
    label: "ready to chat",
  },
  present: {
    eyes: "proud",
    mouth: "smirk",
    look: "right",
    tilt: -1,
    arms: [OFFER_ARM],
    label: "showing off a preview",
  },
  paw: {
    eyes: "happy",
    mouth: "grin",
    look: "center",
    tilt: 2,
    arms: [PAW_ARM],
    label: "celebrating rewards",
  },
  badge: {
    eyes: "proud",
    mouth: "smirk",
    look: "right",
    tilt: -2,
    arms: [BADGE_ARM],
    label: "showing a badge",
  },
  celebrate: {
    eyes: "happy",
    mouth: "grin",
    look: "center",
    tilt: 0,
    arms: [CHEER_LEFT_ARM, CHEER_RIGHT_ARM],
    label: "celebrating",
  },
};

const LOOK_OFFSET: Record<Look, [number, number]> = {
  center: [0, 0],
  left: [-4, 1],
  right: [4, 1],
  up: [2, -5],
};

function Eye({
  cx,
  mood,
  look,
  delay,
  prefix,
}: {
  cx: number;
  mood: EyeMood;
  look: Look;
  delay: string;
  prefix: string;
}) {
  const [dx, dy] = LOOK_OFFSET[look];

  if (mood === "happy") {
    return (
      <g>
        <path
          d={`M${cx - 25} 230 Q${cx} 204 ${cx + 25} 230`}
          fill="none"
          stroke={`url(#${prefix}-eye)`}
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d={`M${cx - 20} 232 Q${cx} 212 ${cx + 20} 232`}
          fill="none"
          stroke="#0a0a0d"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.4"
        />
      </g>
    );
  }

  const narrowed = mood === "squint";
  const proud = mood === "proud";
  const excited = mood === "excited";
  const closed = mood === "wink" && cx > 230;

  if (closed) {
    return (
      <g>
        <path
          d={`M${cx - 24} 230 Q${cx} 208 ${cx + 24} 230`}
          fill="none"
          stroke={`url(#${prefix}-eye)`}
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
    );
  }

  return (
    <g className="rz-eye-open" style={{ "--rz-blink-delay": delay } as CSSProperties}>
      <ellipse
        cx={cx}
        cy="226"
        rx="31"
        ry={narrowed ? 29 : 35}
        fill={`url(#${prefix}-eye)`}
        stroke="#08080b"
        strokeWidth="5"
      />
      {/* Pupil + highlights move together — a cat's attention, not a stare. */}
      <g transform={`translate(${dx} ${dy})`}>
        <ellipse cx={cx + 6} cy="229" rx="9" ry={narrowed ? 21 : 25} fill="#08080b" />
        <circle cx={cx - 13} cy="209" r="7" fill="#fff" opacity="0.92" />
        <circle cx={cx + 11} cy="245" r="3.5" fill="#fff" opacity="0.55" />
        {excited && (
          <>
            <circle cx={cx + 16} cy="207" r="3.2" fill="#fff" opacity="0.85" />
            <circle cx={cx - 3} cy="251" r="2.4" fill="#c9ff3d" opacity="0.9" />
          </>
        )}
      </g>
      {proud && (
        <path
          d={`M${cx - 32} 214 Q${cx} 199 ${cx + 32} 214 L${cx + 32} 188 L${cx - 32} 188 Z`}
          fill={`url(#${prefix}-head)`}
          opacity="0.94"
        />
      )}
      {narrowed && (
        <path
          d={`M${cx - 32} 212 Q${cx} 201 ${cx + 32} 212 L${cx + 32} 188 L${cx - 32} 188 Z`}
          fill={`url(#${prefix}-head)`}
          opacity="0.9"
        />
      )}
    </g>
  );
}

function Arm({ arm, prefix }: { arm: ArmSpec; prefix: string }) {
  const { hand, handAngle, path, side, shoulder, animate } = arm;
  const isLeft = side === "left";

  return (
    <g
      className={cn(
        "rz-arm",
        animate === "wave" && "rz-arm-wave",
        animate === "cheer" && "rz-arm-cheer",
      )}
      style={
        {
          transformOrigin: `${shoulder[0]}px ${shoulder[1]}px`,
          "--rz-arm-swing": animate === "cheer" ? (isLeft ? "-5deg" : "5deg") : "-7deg",
        } as CSSProperties
      }
    >
      {/* A dark contour separates the limb from the body; the thin rim light
          keeps the silhouette readable against Rizzy's near-black fur. */}
      <path d={path} fill="none" stroke="#050507" strokeWidth="37" strokeLinecap="round" />
      <path
        d={path}
        fill="none"
        stroke={`url(#${prefix}-fur)`}
        strokeWidth="31"
        strokeLinecap="round"
      />
      <path
        d={path}
        fill="none"
        stroke="#686873"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.34"
        transform="translate(-2.5 -3)"
      />
      <g transform={`translate(${hand[0]} ${hand[1]}) rotate(${handAngle})`}>
        <ellipse cx="0" cy="0" rx="18" ry="14.5" fill="#1b1b21" stroke="#08080b" strokeWidth="3" />
        <path
          d="M-8 4 v7 M0 2 v9 M8 4 v7"
          stroke="#4a4a55"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.9"
        />
        <ellipse cx={isLeft ? -5 : 5} cy="-8" rx="7" ry="4" fill="#ffffff" opacity="0.07" />
      </g>
    </g>
  );
}

export function Rizzy({
  pose = "wave",
  className,
  label,
}: {
  pose?: RizzyPose;
  className?: string;
  /** Accessible description; defaults to the pose's short action. */
  label?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const prefix = `rz-${uid}`;
  const spec = POSES[pose];

  return (
    <svg
      viewBox="0 0 460 500"
      role="img"
      aria-label={label ?? `Rizzy the cat, ${spec.label}`}
      className={cn("rz-rizzy block h-auto w-full overflow-visible select-none", className)}
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${prefix}-fur`} x1="0" y1="0" x2="0.38" y2="1">
          <stop offset="0" stopColor="#3a3a44" />
          <stop offset="0.34" stopColor="#222229" />
          <stop offset="0.68" stopColor="#141419" />
          <stop offset="1" stopColor="#07070a" />
        </linearGradient>
        <radialGradient id={`${prefix}-head`} cx="0.34" cy="0.2" r="0.92">
          <stop offset="0" stopColor="#3d3d47" />
          <stop offset="0.4" stopColor="#222229" />
          <stop offset="0.78" stopColor="#131318" />
          <stop offset="1" stopColor="#09090c" />
        </radialGradient>
        <radialGradient id={`${prefix}-eye`} cx="0.36" cy="0.28" r="0.76">
          <stop offset="0" stopColor="#f7ffd6" />
          <stop offset="0.26" stopColor="#dcff67" />
          <stop offset="0.62" stopColor="#b6f51d" />
          <stop offset="0.9" stopColor="#8fd000" />
          <stop offset="1" stopColor="#6fae00" />
        </radialGradient>
        <linearGradient id={`${prefix}-muzzle`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf4" />
          <stop offset="0.7" stopColor="#eee9da" />
          <stop offset="1" stopColor="#d9d2c2" />
        </linearGradient>
        <linearGradient id={`${prefix}-collar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2ff8a" />
          <stop offset="0.38" stopColor="#c9ff3d" />
          <stop offset="1" stopColor="#91c400" />
        </linearGradient>
        <linearGradient id={`${prefix}-tail`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#32323b" />
          <stop offset="0.5" stopColor="#1a1a20" />
          <stop offset="1" stopColor="#09090c" />
        </linearGradient>
        <radialGradient id={`${prefix}-ground`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.62" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.28" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id={`${prefix}-blur18`}>
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id={`${prefix}-soft`}>
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000" floodOpacity="0.38" />
        </filter>
        <filter id={`${prefix}-eyeGlow`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse
        cx="232"
        cy="470"
        rx="152"
        ry="25"
        fill={`url(#${prefix}-ground)`}
        filter={`url(#${prefix}-blur18)`}
      />

      <g className="rz-tail">
        <path
          d="M300 408 C370 434 420 398 412 342 C408 314 420 292 438 284 C452 278 460 292 451 303 C443 314 429 308 423 323 C411 351 421 374 433 392 C453 423 405 458 318 438 Z"
          fill={`url(#${prefix}-tail)`}
          filter={`url(#${prefix}-soft)`}
        />
        <path
          d="M307 415 C367 433 405 401 400 349 C397 325 408 301 428 291"
          fill="none"
          stroke="#55555f"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.35"
        />
      </g>

      <g className="rz-breathe" filter={`url(#${prefix}-soft)`}>
        <path
          d="M230 292 C172 292 137 339 134 387 C131 425 161 456 201 464 L259 464 C299 456 329 425 326 387 C323 339 288 292 230 292 Z"
          fill={`url(#${prefix}-fur)`}
        />
        <ellipse cx="158" cy="425" rx="49" ry="36" fill="#111116" />
        <ellipse cx="302" cy="425" rx="49" ry="36" fill="#111116" />
        <path
          d="M197 329 C205 350 211 365 206 388 L220 374 L224 397 L233 376 L243 398 L250 373 L263 388 C256 359 262 340 268 326 C244 340 219 340 197 329 Z"
          fill="#2b2b34"
          opacity="0.6"
        />
        <ellipse cx="190" cy="450" rx="42" ry="25" fill="#18181e" />
        <ellipse cx="270" cy="450" rx="42" ry="25" fill="#18181e" />
        <path
          d="M170 451 v12 M186 449 v14 M202 451 v12"
          stroke="#3c3c46"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M258 451 v12 M274 449 v14 M290 451 v12"
          stroke="#3c3c46"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M151 334 Q230 360 309 334 L306 352 Q230 379 154 352 Z"
          fill={`url(#${prefix}-collar)`}
          stroke="#09090c"
          strokeWidth="3"
        />
        <circle cx="230" cy="371" r="16" fill="#0b0b0f" stroke="#c9ff3d" strokeWidth="3" />
        <g fill="#c9ff3d">
          <ellipse cx="223" cy="367" rx="3" ry="4" />
          <ellipse cx="230" cy="364" rx="3" ry="4" />
          <ellipse cx="237" cy="367" rx="3" ry="4" />
          <path d="M230 372 c-5 0 -8 4 -8 7 0 3 3 5 8 5 s8 -2 8 -5 c0 -3 -3 -7 -8 -7z" />
        </g>
        <path
          d="M169 332 C148 358 144 393 155 421"
          fill="none"
          stroke="#62626e"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.28"
        />
      </g>

      <g transform={`rotate(${spec.tilt} 230 340)`}>
        <g className="rz-head">
          <g className="rz-ear rz-ear-left">
            <path
              d="M118 180 C100 138 94 94 104 58 C108 46 124 50 136 66 L190 132 C164 138 140 156 118 180 Z"
              fill={`url(#${prefix}-head)`}
            />
            <path
              d="M126 158 C114 120 110 88 114 68 L172 128 C152 134 138 145 126 158 Z"
              fill="#1b1b22"
            />
            <path
              d="M127 147 C120 119 117 94 119 79 L161 125 C147 130 136 138 127 147 Z"
              fill="#272730"
            />
            <path
              d="M122 148 C118 121 116 97 118 81"
              fill="none"
              stroke="#c9ff3d"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.22"
            />
          </g>
          <g className="rz-ear rz-ear-right">
            <path
              d="M342 180 C360 138 366 94 356 58 C352 46 336 50 324 66 L270 132 C296 138 320 156 342 180 Z"
              fill={`url(#${prefix}-head)`}
            />
            <path
              d="M334 158 C346 120 350 88 346 68 L288 128 C308 134 322 145 334 158 Z"
              fill="#1b1b22"
            />
            <path
              d="M333 147 C340 119 343 94 341 79 L299 125 C313 130 324 138 333 147 Z"
              fill="#272730"
            />
            <path
              d="M338 148 C342 121 344 97 342 81"
              fill="none"
              stroke="#c9ff3d"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.16"
            />
          </g>

          <path
            d="M230 102 C300 102 345 144 351 208 C354 247 344 282 321 311 C311 324 299 336 284 345 C269 353 250 357 230 357 C210 357 191 353 176 345 C161 336 149 324 139 311 C116 282 106 247 109 208 C115 144 160 102 230 102 Z"
            fill={`url(#${prefix}-head)`}
            filter={`url(#${prefix}-soft)`}
          />
          <path
            d="M124 252 L96 260 L122 272 L101 287 L128 297 L110 315 L142 314 Z"
            fill={`url(#${prefix}-head)`}
          />
          <path
            d="M336 252 L364 260 L338 272 L359 287 L332 297 L350 315 L318 314 Z"
            fill={`url(#${prefix}-head)`}
          />
          <path
            d="M196 117 L202 92 L214 112 L222 86 L234 110 L246 92 L251 118 Z"
            fill={`url(#${prefix}-head)`}
          />
          <path
            d="M174 119 C137 140 116 173 112 213"
            fill="none"
            stroke="#73737f"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.3"
          />
          <path
            d="M330 129 C352 151 363 179 364 209"
            fill="none"
            stroke="#4f4f5a"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.3"
          />
          <path
            d="M206 111 C223 106 240 106 256 111"
            fill="none"
            stroke="#777783"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.3"
          />

          <path
            d={spec.eyes === "squint" ? "M146 178 Q172 170 198 184" : "M146 181 Q172 169 198 181"}
            fill="none"
            stroke="#0b0b0f"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path
            d={spec.eyes === "squint" ? "M262 184 Q288 170 314 178" : "M262 181 Q288 169 314 181"}
            fill="none"
            stroke="#0b0b0f"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.85"
          />

          <g filter={`url(#${prefix}-eyeGlow)`} opacity="0.55">
            <ellipse cx="171" cy="226" rx="34" ry="38" fill="#b6f51d" />
            <ellipse cx="289" cy="226" rx="34" ry="38" fill="#b6f51d" />
          </g>
          <Eye cx={171} mood={spec.eyes} look={spec.look} delay="0.2s" prefix={prefix} />
          <Eye cx={289} mood={spec.eyes} look={spec.look} delay="0.2s" prefix={prefix} />

          <ellipse cx="230" cy="281" rx="55" ry="34" fill={`url(#${prefix}-muzzle)`} />
          <ellipse cx="230" cy="291" rx="34" ry="14" fill="#d7d0c0" opacity="0.35" />
          <path
            d="M230 255 C223 255 218 260 218 265 C218 270 224 273 230 277 C236 273 242 270 242 265 C242 260 237 255 230 255 Z"
            fill="#1d1d24"
          />
          <path
            d="M223 260 C225 258 228 258 230 259"
            fill="none"
            stroke="#6d6d79"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.8"
          />
          <path d="M230 277 L230 286" stroke="#2b2b33" strokeWidth="2.5" strokeLinecap="round" />

          {spec.mouth === "oh" ? (
            <ellipse cx="230" cy="290" rx="9" ry="11" fill="#2a1118" />
          ) : (
            <>
              <path
                d={
                  spec.mouth === "smirk"
                    ? "M211 284 Q228 300 247 282 Q230 292 211 284 Z"
                    : "M211 284 Q230 308 249 284 Q230 294 211 284 Z"
                }
                fill="#2a1118"
              />
              <path d="M213 284 L218 294 L222 284 Z" fill="#fffdf4" />
              <path d="M247 284 L242 294 L238 284 Z" fill="#fffdf4" />
              <path
                d="M222 290 Q230 295 238 290"
                fill="none"
                stroke="#d98d9a"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.7"
              />
            </>
          )}
          {spec.eyes === "happy" && (
            <g fill="#c9ff3d" opacity="0.16">
              <ellipse cx="145" cy="264" rx="14" ry="7" />
              <ellipse cx="315" cy="264" rx="14" ry="7" />
            </g>
          )}

          <g fill="none" stroke="#f4f1e7" strokeWidth="2" strokeLinecap="round" opacity="0.42">
            <path d="M183 274 C157 268 135 264 115 266" />
            <path d="M181 284 C156 284 134 286 114 292" />
            <path d="M183 293 C161 299 142 307 126 318" />
            <path d="M277 274 C303 268 325 264 345 266" />
            <path d="M279 284 C304 284 326 286 346 292" />
            <path d="M277 293 C299 299 318 307 334 318" />
          </g>
          <g fill="#2b2b34" opacity="0.65">
            <circle cx="195" cy="270" r="1.4" />
            <circle cx="190" cy="278" r="1.2" />
            <circle cx="265" cy="270" r="1.4" />
            <circle cx="270" cy="278" r="1.2" />
          </g>
          <path
            d="M138 238 C148 243 155 251 159 261"
            fill="none"
            stroke="#5c5c68"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.3"
          />
          <path
            d="M322 238 C312 243 305 251 301 261"
            fill="none"
            stroke="#4e4e59"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.3"
          />
        </g>
      </g>

      {spec.arms.map((arm) => (
        <Arm key={arm.side + arm.path} arm={arm} prefix={prefix} />
      ))}
    </svg>
  );
}
