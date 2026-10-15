/**
 * Custom Animated Cat Emojis (Hard Cap: Exactly 12)
 *
 * Designed in the RIZZ visual language: #141416 near-black cat body,
 * #c8ff3d neon-lime accents, and #f2efe6 cream outlines.
 * Lightweight inline SVG with CSS keyframe animation (<2KB each).
 * Respects prefers-reduced-motion: reduce.
 */

export interface CatEmojiItem {
  name: string;
  token: string;
  label: string;
  keywords: string[];
  svg: string;
}

export const CAT_EMOJIS: CatEmojiItem[] = [
  {
    name: "cat_vibe",
    token: ":cat_vibe:",
    label: "Vibing Cat",
    keywords: ["vibe", "vibing", "groove", "headphones", "music", "chill", "listening", "cat"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes cv-bob { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-2px) rotate(2deg); } }
    .cv-head { transform-origin: 18px 24px; animation: cv-bob 0.8s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .cv-head { animation: none; } }
  </style>
  <g class="cv-head">
    <polygon points="9,14 13,5 18,12" fill="#141416" stroke="#f2efe6" stroke-width="1.2" stroke-linejoin="round"/>
    <polygon points="11,12 13,7 16,11" fill="#c8ff3d"/>
    <polygon points="27,14 23,5 18,12" fill="#141416" stroke="#f2efe6" stroke-width="1.2" stroke-linejoin="round"/>
    <polygon points="25,12 23,7 20,11" fill="#c8ff3d"/>
    <ellipse cx="18" cy="20" rx="11" ry="9" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <path d="M12 18 Q14 15 16 18" stroke="#f2efe6" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <path d="M20 18 Q22 15 24 18" stroke="#f2efe6" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <polygon points="17.5,21 18.5,21 18,21.8" fill="#c8ff3d"/>
    <path d="M16 23 Q18 24.5 20 23" stroke="#f2efe6" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M7 19 C7 11 11 8 18 8 C25 8 29 11 29 19" stroke="#c8ff3d" stroke-width="2" stroke-linecap="round" fill="none"/>
    <rect x="5.5" y="16" width="3" height="7" rx="1.5" fill="#c8ff3d"/>
    <rect x="27.5" y="16" width="3" height="7" rx="1.5" fill="#c8ff3d"/>
  </g>
</svg>`,
  },
  {
    name: "cat_party",
    token: ":cat_party:",
    label: "Party Cat",
    keywords: ["party", "celebrate", "woo", "tada", "yay", "hat", "confetti", "birthday", "bop"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes cp-jump { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-4px) rotate(-3deg); } }
    @keyframes cp-star { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
    .cp-cat { transform-origin: 18px 24px; animation: cp-jump 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }
    .cp-s1 { animation: cp-star 0.7s ease-in-out infinite; }
    .cp-s2 { animation: cp-star 0.7s ease-in-out infinite 0.35s; }
    @media (prefers-reduced-motion: reduce) { .cp-cat, .cp-s1, .cp-s2 { animation: none; } }
  </style>
  <g class="cp-cat">
    <polygon points="8,15 11,7 16,13" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="10,13 11,9 14,12" fill="#c8ff3d"/>
    <polygon points="28,15 25,7 20,13" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="26,13 25,9 22,12" fill="#c8ff3d"/>
    <ellipse cx="18" cy="21" rx="11" ry="9" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <path d="M12 19 Q14 16 16 19" stroke="#c8ff3d" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M20 19 Q22 16 24 19" stroke="#c8ff3d" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M16 23 Q18 26 20 23 Z" fill="#c8ff3d"/>
    <polygon points="18,3 13,14 23,14" fill="#c8ff3d" stroke="#f2efe6" stroke-width="1"/>
    <line x1="14.5" y1="10" x2="21.5" y2="10" stroke="#141416" stroke-width="1.2"/>
    <circle cx="18" cy="3" r="1.5" fill="#f2efe6"/>
  </g>
  <circle cx="6" cy="10" r="1.2" fill="#c8ff3d" class="cp-s1"/>
  <circle cx="30" cy="11" r="1.4" fill="#f2efe6" class="cp-s2"/>
</svg>`,
  },
  {
    name: "cat_peek",
    token: ":cat_peek:",
    label: "Peeking Cat",
    keywords: ["peek", "peeking", "curious", "hide", "hello", "hi", "eyes", "looking"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes cpk-peek { 0%, 20%, 80%, 100% { transform: translateY(0); } 40%, 60% { transform: translateY(6px); } }
    .cpk-head { animation: cpk-peek 2.4s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .cpk-head { animation: none; } }
  </style>
  <g class="cpk-head">
    <polygon points="9,17 12,8 17,14" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="11,14 12,10 15,13" fill="#c8ff3d"/>
    <polygon points="27,17 24,8 19,14" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="25,14 24,10 21,13" fill="#c8ff3d"/>
    <ellipse cx="18" cy="20" rx="11" ry="9" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <circle cx="13.5" cy="18" r="3" fill="#f2efe6"/>
    <circle cx="14" cy="17.5" r="1.8" fill="#141416"/>
    <circle cx="14.8" cy="16.8" r="0.8" fill="#c8ff3d"/>
    <circle cx="22.5" cy="18" r="3" fill="#f2efe6"/>
    <circle cx="22" cy="17.5" r="1.8" fill="#141416"/>
    <circle cx="22.8" cy="16.8" r="0.8" fill="#c8ff3d"/>
    <ellipse cx="11" cy="27" rx="2.5" ry="2" fill="#141416" stroke="#f2efe6" stroke-width="1"/>
    <ellipse cx="25" cy="27" rx="2.5" ry="2" fill="#141416" stroke="#f2efe6" stroke-width="1"/>
  </g>
  <rect x="2" y="27" width="32" height="7" rx="2" fill="#1c1c1f" stroke="#c8ff3d" stroke-width="1.2"/>
</svg>`,
  },
  {
    name: "cat_cool",
    token: ":cat_cool:",
    label: "Cool Cat",
    keywords: ["cool", "sunglasses", "shades", "deal", "chill", "swag", "glasses", "rizz"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes cc-shades { 0%, 25%, 75%, 100% { transform: translateY(0); } 40%, 60% { transform: translateY(3px) rotate(-2deg); } }
    .cc-shades { transform-origin: 18px 18px; animation: cc-shades 2.2s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .cc-shades { animation: none; } }
  </style>
  <polygon points="9,13 13,4 17,11" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
  <polygon points="11,11 13,6 15,10" fill="#c8ff3d"/>
  <polygon points="27,13 23,4 19,11" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
  <polygon points="25,11 23,6 21,10" fill="#c8ff3d"/>
  <ellipse cx="18" cy="19" rx="11" ry="9" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
  <circle cx="13" cy="18" r="2.2" fill="#c8ff3d"/>
  <circle cx="23" cy="18" r="2.2" fill="#c8ff3d"/>
  <path d="M17 24 Q20 25 22 23" stroke="#f2efe6" stroke-width="1.3" stroke-linecap="round" fill="none"/>
  <g class="cc-shades">
    <path d="M7 17 Q13 14 18 17 Q23 14 29 17" stroke="#c8ff3d" stroke-width="1.4" fill="none"/>
    <rect x="8.5" y="16.5" width="8" height="5.5" rx="2" fill="#0b0b0c" stroke="#c8ff3d" stroke-width="1.2"/>
    <rect x="19.5" y="16.5" width="8" height="5.5" rx="2" fill="#0b0b0c" stroke="#c8ff3d" stroke-width="1.2"/>
    <line x1="10" y1="18" x2="12" y2="20" stroke="#f2efe6" stroke-width="0.9" stroke-linecap="round"/>
    <line x1="21" y1="18" x2="23" y2="20" stroke="#f2efe6" stroke-width="0.9" stroke-linecap="round"/>
  </g>
</svg>`,
  },
  {
    name: "cat_fire",
    token: ":cat_fire:",
    label: "Fire Cat",
    keywords: ["fire", "lit", "hot", "flame", "burn", "spicy", "streak", "heat"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes cfi-flicker { 0%, 100% { transform: scale(1) translateY(0); opacity: 0.9; } 50% { transform: scale(1.08) translateY(-1.5px); opacity: 1; } }
    .cfi-flame { transform-origin: 18px 30px; animation: cfi-flicker 0.45s ease-in-out alternate infinite; }
    @media (prefers-reduced-motion: reduce) { .cfi-flame { animation: none; } }
  </style>
  <g class="cfi-flame">
    <path d="M18 2 C13 7 10 14 11 20 C11 27 15 31 18 31 C21 31 25 27 25 20 C26 14 23 7 18 2 Z" fill="#c8ff3d" opacity="0.4"/>
    <path d="M18 7 C14 12 12 16 13 22 C13 27 16 30 18 30 C20 30 23 27 23 22 C24 16 22 12 18 7 Z" fill="#c8ff3d"/>
    <path d="M18 13 C16 16 15 19 16 23 C16 26 17 28 18 28 C19 28 20 26 20 23 C21 19 20 16 18 13 Z" fill="#f2efe6"/>
  </g>
  <polygon points="9,14 13,5 17,12" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
  <polygon points="11,12 13,7 15,11" fill="#c8ff3d"/>
  <polygon points="27,14 23,5 19,12" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
  <polygon points="25,12 23,7 21,11" fill="#c8ff3d"/>
  <ellipse cx="18" cy="20" rx="11" ry="9" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
  <ellipse cx="13" cy="19" rx="2.2" ry="2.6" fill="#c8ff3d"/>
  <ellipse cx="23" cy="19" rx="2.2" ry="2.6" fill="#c8ff3d"/>
  <circle cx="13" cy="18.5" r="1" fill="#141416"/>
  <circle cx="23" cy="18.5" r="1" fill="#141416"/>
  <path d="M15 23 Q18 25 21 23" stroke="#f2efe6" stroke-width="1.3" stroke-linecap="round" fill="none"/>
</svg>`,
  },
  {
    name: "cat_sip",
    token: ":cat_sip:",
    label: "Sipping Cat",
    keywords: ["sip", "tea", "boba", "coffee", "drink", "chill", "slurp", "juice"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes cs-sip { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
    @keyframes cs-pearl { 0% { transform: translateY(0); } 100% { transform: translateY(-7px); opacity: 0; } }
    .cs-cat { animation: cs-sip 1.2s ease-in-out infinite; }
    .cs-pearl { animation: cs-pearl 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
    @media (prefers-reduced-motion: reduce) { .cs-cat, .cs-pearl { animation: none; } }
  </style>
  <g class="cs-cat">
    <polygon points="9,13 13,4 17,11" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="11,11 13,6 15,10" fill="#c8ff3d"/>
    <polygon points="27,13 23,4 19,11" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="25,11 23,6 21,10" fill="#c8ff3d"/>
    <ellipse cx="18" cy="18" rx="10.5" ry="8.5" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <path d="M12 17 Q14 14.5 16 17" stroke="#c8ff3d" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <path d="M20 17 Q22 14.5 24 17" stroke="#c8ff3d" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <line x1="18" y1="18" x2="19.5" y2="27" stroke="#c8ff3d" stroke-width="1.8" stroke-linecap="round"/>
  </g>
  <path d="M15 24 L16 33 L23 33 L24 24 Z" fill="#1c1c1f" stroke="#f2efe6" stroke-width="1"/>
  <ellipse cx="19.5" cy="24" rx="4.5" ry="1.2" fill="#c8ff3d"/>
  <circle cx="18" cy="30" r="1.2" fill="#c8ff3d"/>
  <circle cx="21" cy="31" r="1.2" fill="#c8ff3d"/>
  <circle cx="18.8" cy="23" r="0.9" fill="#c8ff3d" class="cs-pearl"/>
</svg>`,
  },
  {
    name: "cat_nod",
    token: ":cat_nod:",
    label: "Nodding Cat",
    keywords: ["nod", "yes", "agree", "based", "true", "yep", "affirm", "ok"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes cn-nod { 0%, 100% { transform: translateY(0); } 30% { transform: translateY(-3.5px); } 60% { transform: translateY(3px); } }
    .cn-head { transform-origin: 18px 24px; animation: cn-nod 0.6s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .cn-head { animation: none; } }
  </style>
  <g class="cn-head">
    <polygon points="9,14 13,5 17,12" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="11,12 13,7 15,11" fill="#c8ff3d"/>
    <polygon points="27,14 23,5 19,12" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="25,12 23,7 21,11" fill="#c8ff3d"/>
    <ellipse cx="18" cy="20" rx="11" ry="9" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <circle cx="13" cy="18" r="2.5" fill="#f2efe6"/>
    <circle cx="13" cy="18" r="1.6" fill="#141416"/>
    <circle cx="13.7" cy="17.3" r="0.8" fill="#c8ff3d"/>
    <circle cx="23" cy="18" r="2.5" fill="#f2efe6"/>
    <circle cx="23" cy="18" r="1.6" fill="#141416"/>
    <circle cx="23.7" cy="17.3" r="0.8" fill="#c8ff3d"/>
    <path d="M15 23 Q18 26 21 23" stroke="#c8ff3d" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <path d="M7 19 Q5 21 7 23" stroke="#c8ff3d" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.7"/>
    <path d="M29 19 Q31 21 29 23" stroke="#c8ff3d" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.7"/>
  </g>
</svg>`,
  },
  {
    name: "cat_sleep",
    token: ":cat_sleep:",
    label: "Sleepy Cat",
    keywords: ["sleep", "sleeping", "tired", "zzz", "bed", "rest", "nap", "goodnight"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes csl-z1 { 0% { opacity: 0; transform: translate(0, 0) scale(0.6); } 50% { opacity: 1; } 100% { opacity: 0; transform: translate(4px, -8px) scale(1.1); } }
    @keyframes csl-z2 { 0% { opacity: 0; transform: translate(0, 0) scale(0.6); } 50% { opacity: 1; } 100% { opacity: 0; transform: translate(5px, -10px) scale(1.2); } }
    @keyframes csl-breath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
    .csl-body { transform-origin: 18px 24px; animation: csl-breath 2.5s ease-in-out infinite; }
    .csl-z1 { animation: csl-z1 2.2s linear infinite; }
    .csl-z2 { animation: csl-z2 2.2s linear infinite 1.1s; }
    @media (prefers-reduced-motion: reduce) { .csl-body, .csl-z1, .csl-z2 { animation: none; } }
  </style>
  <g class="csl-body">
    <ellipse cx="18" cy="24" rx="12" ry="8" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="12,20 15,14 18,20" fill="#141416" stroke="#f2efe6" stroke-width="1"/>
    <polygon points="13.5,19 15,16 16.5,19" fill="#c8ff3d"/>
    <path d="M19 22 Q21 24 23 22" stroke="#c8ff3d" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <path d="M7 25 Q6 20 10 19" stroke="#f2efe6" stroke-width="1.3" stroke-linecap="round" fill="none"/>
  </g>
  <text x="21" y="15" fill="#c8ff3d" font-family="sans-serif" font-weight="bold" font-size="7" class="csl-z1">z</text>
  <text x="25" y="11" fill="#f2efe6" font-family="sans-serif" font-weight="bold" font-size="9" class="csl-z2">Z</text>
</svg>`,
  },
  {
    name: "cat_pop",
    token: ":cat_pop:",
    label: "Popcat",
    keywords: ["pop", "popcat", "mouth", "open", "sing", "scream", "loud", "waa"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes cp-mouth { 0%, 45% { transform: scaleY(0.2); } 50%, 95% { transform: scaleY(1.3); } 100% { transform: scaleY(0.2); } }
    @keyframes cp-head { 0%, 45% { transform: translateY(0); } 50%, 95% { transform: translateY(-2px); } 100% { transform: translateY(0); } }
    .cpop-head { transform-origin: 18px 24px; animation: cp-head 0.4s steps(1) infinite; }
    .cpop-mouth { transform-origin: 18px 23px; animation: cp-mouth 0.4s steps(1) infinite; }
    @media (prefers-reduced-motion: reduce) { .cpop-head, .cpop-mouth { animation: none; } }
  </style>
  <g class="cpop-head">
    <polygon points="9,13 13,4 17,11" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="11,11 13,6 15,10" fill="#c8ff3d"/>
    <polygon points="27,13 23,4 19,11" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="25,11 23,6 21,10" fill="#c8ff3d"/>
    <ellipse cx="18" cy="19" rx="11" ry="9" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <circle cx="13" cy="16" r="3" fill="#f2efe6"/>
    <circle cx="13" cy="16" r="1.8" fill="#141416"/>
    <circle cx="13.7" cy="15.3" r="0.8" fill="#c8ff3d"/>
    <circle cx="23" cy="16" r="3" fill="#f2efe6"/>
    <circle cx="23" cy="16" r="1.8" fill="#141416"/>
    <circle cx="23.7" cy="15.3" r="0.8" fill="#c8ff3d"/>
    <ellipse cx="18" cy="23" rx="4.5" ry="3.5" fill="#c8ff3d" stroke="#f2efe6" stroke-width="1" class="cpop-mouth"/>
  </g>
</svg>`,
  },
  {
    name: "cat_heart",
    token: ":cat_heart:",
    label: "Heart Eyes Cat",
    keywords: ["heart", "love", "crush", "cute", "kiss", "hearts", "blush", "adore"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes ch-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
    @keyframes ch-float { 0% { opacity: 0; transform: translateY(0) scale(0.6); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-7px) scale(1.1); } }
    .ch-hearts { transform-origin: 18px 18px; animation: ch-pulse 0.7s ease-in-out infinite; }
    .ch-float { animation: ch-float 1.8s ease-out infinite; }
    @media (prefers-reduced-motion: reduce) { .ch-hearts, .ch-float { animation: none; } }
  </style>
  <polygon points="9,14 13,5 17,12" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
  <polygon points="11,12 13,7 15,11" fill="#c8ff3d"/>
  <polygon points="27,14 23,5 19,12" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
  <polygon points="25,12 23,7 21,11" fill="#c8ff3d"/>
  <ellipse cx="18" cy="20" rx="11" ry="9" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
  <g class="ch-hearts">
    <path d="M13 16 C12 14 9 14.5 9 16.5 C9 18.5 13 21 13 21 C13 21 17 18.5 17 16.5 C17 14.5 14 14 13 16 Z" fill="#c8ff3d"/>
    <path d="M23 16 C22 14 19 14.5 19 16.5 C19 18.5 23 21 23 21 C23 21 27 18.5 27 16.5 C27 14.5 24 14 23 16 Z" fill="#c8ff3d"/>
  </g>
  <ellipse cx="10" cy="22" rx="2" ry="1.2" fill="#c8ff3d" opacity="0.6"/>
  <ellipse cx="26" cy="22" rx="2" ry="1.2" fill="#c8ff3d" opacity="0.6"/>
  <path d="M16 23 Q18 25 20 23" stroke="#f2efe6" stroke-width="1.3" stroke-linecap="round" fill="none"/>
  <path d="M28 8 C27 6.5 24.5 7 24.5 8.5 C24.5 10 28 12 28 12 C28 12 31.5 10 31.5 8.5 C31.5 7 29 6.5 28 8 Z" fill="#f2efe6" class="ch-float"/>
</svg>`,
  },
  {
    name: "cat_shock",
    token: ":cat_shock:",
    label: "Shocked Cat",
    keywords: ["shock", "surprised", "omg", "gasp", "spooked", "scared", "what", "woah"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes csk-jitter { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-1px, 1px); } 40% { transform: translate(1px, -1px); } 60% { transform: translate(-1px, -1px); } 80% { transform: translate(1px, 1px); } }
    .csk-cat { animation: csk-jitter 0.15s linear infinite; }
    @media (prefers-reduced-motion: reduce) { .csk-cat { animation: none; } }
  </style>
  <g class="csk-cat">
    <polygon points="9,13 13,3 17,11" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="11,11 13,5 15,10" fill="#c8ff3d"/>
    <polygon points="27,13 23,3 19,11" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="25,11 23,5 21,10" fill="#c8ff3d"/>
    <ellipse cx="18" cy="19" rx="11" ry="9" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <circle cx="13" cy="17" r="3.2" fill="#c8ff3d"/>
    <circle cx="13" cy="17" r="2.2" fill="#141416"/>
    <circle cx="23" cy="17" r="3.2" fill="#c8ff3d"/>
    <circle cx="23" cy="17" r="2.2" fill="#141416"/>
    <circle cx="18" cy="23.5" r="1.8" fill="#c8ff3d" stroke="#f2efe6" stroke-width="0.8"/>
    <line x1="4" y1="16" x2="1" y2="15" stroke="#c8ff3d" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="4" y1="20" x2="1" y2="21" stroke="#c8ff3d" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="32" y1="16" x2="35" y2="15" stroke="#c8ff3d" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="32" y1="20" x2="35" y2="21" stroke="#c8ff3d" stroke-width="1.2" stroke-linecap="round"/>
  </g>
</svg>`,
  },
  {
    name: "cat_dance",
    token: ":cat_dance:",
    label: "Dancing Cat",
    keywords: ["dance", "dancing", "jam", "bop", "move", "boogie", "music", "rave"],
    svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes cd-dance { 0%, 100% { transform: rotate(-6deg) translateY(0); } 50% { transform: rotate(6deg) translateY(-2px); } }
    @keyframes cd-note { 0% { opacity: 0; transform: translateY(0) scale(0.7); } 50% { opacity: 1; } 100% { opacity: 0; transform: translateY(-7px) scale(1.1); } }
    .cd-cat { transform-origin: 18px 30px; animation: cd-dance 0.5s ease-in-out alternate infinite; }
    .cd-note { animation: cd-note 1s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .cd-cat, .cd-note { animation: none; } }
  </style>
  <g class="cd-cat">
    <polygon points="9,14 13,5 17,12" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="11,12 13,7 15,11" fill="#c8ff3d"/>
    <polygon points="27,14 23,5 19,12" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <polygon points="25,12 23,7 21,11" fill="#c8ff3d"/>
    <ellipse cx="18" cy="20" rx="10.5" ry="8.5" fill="#141416" stroke="#f2efe6" stroke-width="1.2"/>
    <path d="M12 18 Q14 15.5 16 18" stroke="#c8ff3d" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <circle cx="23" cy="18" r="2.2" fill="#f2efe6"/>
    <circle cx="23" cy="18" r="1.2" fill="#141416"/>
    <path d="M16 23 Q18 25 20 23" stroke="#f2efe6" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    <circle cx="8" cy="23" r="2.2" fill="#c8ff3d"/>
    <circle cx="28" cy="23" r="2.2" fill="#c8ff3d"/>
  </g>
  <path d="M6 8 L6 5 L10 4 L10 7 Z M6 8 C6 9 5 10 4 10 C3 10 2 9.5 2 8.5 C2 7.5 3 7 4 7 C5 7 6 7.5 6 8 Z" fill="#c8ff3d" class="cd-note"/>
</svg>`,
  },
];

export const CAT_EMOJI_BY_NAME = new Map<string, CatEmojiItem>(
  CAT_EMOJIS.map((e) => [e.name, e]),
);

export const CAT_EMOJI_NAMES = new Set<string>(CAT_EMOJIS.map((e) => e.name));

/** Clean name by stripping optional surrounding colons: ":cat_vibe:" -> "cat_vibe" */
export function normalizeEmojiName(raw: string): string {
  return raw.replace(/^:+|:+$/g, "").toLowerCase();
}

export function isCatEmoji(nameOrToken: string | null | undefined): boolean {
  if (!nameOrToken) return false;
  return CAT_EMOJI_NAMES.has(normalizeEmojiName(nameOrToken));
}

export function getCatEmoji(nameOrToken: string | null | undefined): CatEmojiItem | undefined {
  if (!nameOrToken) return undefined;
  return CAT_EMOJI_BY_NAME.get(normalizeEmojiName(nameOrToken));
}

/** Search through the 12 custom emojis by name or keyword */
export function searchCatEmojis(query: string): CatEmojiItem[] {
  const q = query.trim().toLowerCase().replace(/^:/, "");
  if (!q) return CAT_EMOJIS;
  return CAT_EMOJIS.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}

const CAT_EMOJI_TOKEN_RE = /:(cat_[a-z0-9_]{2,20}):/g;

export type CatEmojiSegment = {
  type: "text" | "cat_emoji";
  value: string;
  name?: string;
};

/** Parses text into text chunks and cat emoji tokens */
export function splitCatEmojiSegments(text: string): CatEmojiSegment[] {
  if (!text || !text.includes(":cat_")) return [{ type: "text", value: text }];
  const segments: CatEmojiSegment[] = [];
  let cursor = 0;
  CAT_EMOJI_TOKEN_RE.lastIndex = 0;
  for (const match of text.matchAll(CAT_EMOJI_TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, index) });
    }
    const name = match[1];
    if (isCatEmoji(name)) {
      segments.push({ type: "cat_emoji", value: match[0], name });
    } else {
      segments.push({ type: "text", value: match[0] });
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }
  return segments;
}
