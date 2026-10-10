import React from 'react';

export type CatMode = 'running' | 'sleeping';

export const catLoaderCss = `
.cat-loader {
  position: relative;
  width: 140px;
  height: 100px;
  isolation: isolate;
  display: grid;
  place-items: center;
  background: transparent;
}
.cat-loader::before {
  content: "";
  position: absolute;
  inset: -50px;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255, 45, 146, 0.22), transparent);
  filter: blur(24px);
  animation: cat-aura 2.6s ease-in-out infinite;
  pointer-events: none;
}
.cat-loader::after {
  content: "";
  position: absolute;
  left: 34%;
  top: 72%;
  width: 34px;
  height: 20px;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(139, 94, 60, 0.38), transparent);
  filter: blur(5px);
  animation: cat-smoke 1.28s ease-out infinite;
  z-index: 0;
  pointer-events: none;
  will-change: transform, opacity;
}
.cat-svg {
  position: relative;
  z-index: 1;
  width: 130px;
  height: 108px;
  overflow: visible;
}
@keyframes cat-aura {
  50% { opacity: 0.55; transform: scale(0.9); }
}
.cat-fur { fill: var(--foreground, #ffffff); }
.cat-shade { fill: var(--muted-foreground, #94a3b8); }
.cat-pink { fill: var(--primary, #ff2d92); }
.cat-face { fill: var(--background, #09090b); }
.cat-line { fill: none; stroke: var(--background, #09090b); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.cat-whisker { fill: none; stroke: var(--muted-foreground, #94a3b8); stroke-width: 1.5; stroke-linecap: round; }
.cat-outline { fill: none; stroke: var(--primary, #ff2d92); stroke-linecap: round; }
.cat-character { transform-origin: 120px 133px; animation: cat-bound 0.64s cubic-bezier(0.45, 0, 0.55, 1) infinite; will-change: transform; }
.cat-leg { transform-box: fill-box; transform-origin: 50% 10%; animation: cat-stride 0.64s ease-in-out infinite; }
.cat-leg.back { animation-delay: -0.32s; opacity: 0.5; }
.cat-leg.front-right { animation-delay: -0.32s; }
.cat-tail { transform-origin: 93px 110px; animation: cat-swish 0.64s ease-in-out infinite; will-change: transform; }
.cat-ear-twitch { transform-box: fill-box; transform-origin: 50% 90%; animation: cat-ear 3.2s ease-in-out infinite; }
.cat-eye { transform-box: fill-box; transform-origin: center; animation: cat-blink 4.8s infinite; }
.cat-shadow { fill: var(--primary, #ff2d92); opacity: 0.14; transform-origin: 120px 165px; animation: cat-shadow 0.64s ease-in-out infinite; will-change: transform, opacity; }
.cat-trail { stroke-width: 2; opacity: 0; animation: cat-trail 1.28s ease-out infinite; }
.cat-trail.second { animation-delay: -0.42s; }
.cat-trail.third { animation-delay: -0.85s; }
.cat-track { stroke-width: 1; opacity: 0.2; }
.cat-track-light { stroke-width: 2; stroke-dasharray: 25 180; animation: cat-track 1.8s ease-in-out infinite; }
.cat-dust { fill: #8B5E3C; opacity: 0; transform-box: fill-box; transform-origin: center; animation: cat-dust 1.28s ease-out infinite; will-change: transform, opacity; }
.cat-dust.d2, .cat-dust.d4, .cat-dust.d6, .cat-dust.d8 { fill: #A67B5B; }
.cat-dust.d2 { animation-delay: -0.21s; }
.cat-dust.d3 { animation-delay: -0.43s; }
.cat-dust.d4 { animation-delay: -0.64s; }
.cat-dust.d5 { animation-delay: -0.85s; }
.cat-dust.d6 { animation-delay: -1.07s; }
.cat-dust.d7 { animation-delay: -0.32s; }
.cat-dust.d8 { animation-delay: -0.96s; }

@keyframes cat-dust {
  0% { opacity: 0; transform: translate(0, 0) scale(0.4); }
  18% { opacity: 0.75; }
  100% { opacity: 0; transform: translate(-34px, -16px) scale(1.4); }
}
@keyframes cat-bound {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-9px) rotate(2deg); }
}
@keyframes cat-stride {
  0%, 100% { transform: rotate(-30deg); }
  50% { transform: rotate(32deg); }
}
@keyframes cat-swish {
  0%, 100% { transform: rotate(-8deg); }
  50% { transform: rotate(12deg); }
}
@keyframes cat-ear {
  0%, 88%, 100% { transform: rotate(0); }
  92% { transform: rotate(-9deg); }
  96% { transform: rotate(5deg); }
}
@keyframes cat-blink {
  0%, 43%, 47%, 100% { transform: scaleY(1); }
  45% { transform: scaleY(0.1); }
}
@keyframes cat-shadow {
  50% { transform: scaleX(0.78); opacity: 0.07; }
}
@keyframes cat-trail {
  0% { opacity: 0; transform: translateX(8px); }
  25% { opacity: 0.5; }
  100% { opacity: 0; transform: translateX(-18px); }
}
@keyframes cat-track {
  50% { opacity: 0.65; }
}
@keyframes cat-smoke {
  0% { opacity: 0; transform: translateY(5px) scale(0.65); }
  28% { opacity: 0.55; }
  100% { opacity: 0; transform: translateY(-12px) scale(1.2); }
}
@keyframes cat-sleep {
  50% { transform: scale(1.025, 0.975); }
}
.is-sleeping .cat-character { animation: cat-sleep 2.8s ease-in-out infinite; }
.is-sleeping .cat-tail { animation: cat-swish 3s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .cat-loader * { animation: none !important; }
  .cat-loader::before, .cat-loader::after { animation: none !important; }
  .cat-track-light { opacity: 0.6; }
  .cat-dust { opacity: 0; }
}
`;

export function CatLoader({ mode = 'running', label = 'Loading' }: { mode?: CatMode; label?: string }) {
  const running = mode === 'running';
  return (
    <div className={`cat-loader ${running ? 'is-running' : 'is-sleeping'}`} role="status" aria-label={label}>
      <style>{catLoaderCss}</style>
      <svg className="cat-svg" viewBox="0 0 240 200" aria-hidden="true">
        <ellipse className="cat-shadow" cx="120" cy="165" rx="48" ry="5" />
        <path className="cat-outline cat-track" d="M65 181 H175" />
        <path className="cat-outline cat-track-light" d="M65 181 H175" />
        {running ? (
          <>
            <path className="cat-outline cat-trail" d="M42 105 H63" />
            <path className="cat-outline cat-trail second" d="M33 120 H53" />
            <path className="cat-outline cat-trail third" d="M49 135 H65" />
            <circle className="cat-dust" cx="96" cy="160" r="3.2" />
            <circle className="cat-dust d2" cx="106" cy="163" r="2.4" />
            <circle className="cat-dust d3" cx="88" cy="158" r="2" />
            <circle className="cat-dust d4" cx="112" cy="161" r="3" />
            <circle className="cat-dust d5" cx="99" cy="164" r="1.8" />
            <circle className="cat-dust d6" cx="92" cy="162" r="2.6" />
            <circle className="cat-dust d7" cx="103" cy="157" r="2.2" />
            <circle className="cat-dust d8" cx="85" cy="163" r="1.7" />
            <g className="cat-character">
              <path className="cat-fur cat-tail" d="M94 115 C67 117 59 98 62 81 C63 73 72 73 72 81 C69 97 78 103 96 102Z" />
              <path className="cat-shade cat-leg back" d="M96 126 Q104 136 98 145 L90 153 Q82 157 79 151 Q78 148 83 144 L89 138 L85 129Z" />
              <path className="cat-shade cat-leg back" d="M143 125 L150 142 L159 145 Q165 151 158 154 L146 151 Q141 150 138 140 L134 128Z" />
              <path className="cat-fur" d="M82 111 Q83 96 103 96 L134 99 Q152 101 153 118 Q154 137 132 138 L104 137 Q83 136 82 120 L77 117Z" />
              <path className="cat-fur cat-leg" d="M97 125 Q105 135 99 144 L91 154 Q87 159 82 155 Q78 152 83 147 L88 138 L85 128Z" />
              <path className="cat-fur cat-leg front-right" d="M139 123 L149 140 L159 144 Q164 148 161 152 Q159 155 153 153 L143 150 Q138 148 135 139 L130 126Z" />
              <path className="cat-fur" d="M126 100 L126 69 Q126 62 132 67 L146 78 Q155 76 163 81 L177 69 Q183 65 181 74 L177 100 Q185 109 179 121 Q173 133 153 132 Q130 132 125 117 Q121 108 126 100Z" />
              <g className="cat-ear-twitch">
                <path className="cat-pink" d="M131 73 L132 92 L141 82Z M175 77 L165 85 L175 94Z" opacity="0.7" />
              </g>
              <ellipse className="cat-face cat-eye" cx="149" cy="105" rx="3" ry="4.5" />
              <ellipse className="cat-face cat-eye" cx="171" cy="105" rx="3" ry="4.5" />
              <path className="cat-pink" d="M157 112 Q161 110 164 112 L161 116Z" />
              <path className="cat-line" d="M161 116 V118 Q157 122 154 118 M161 118 Q165 122 168 118" />
              <path className="cat-whisker" d="M143 114 L130 112 M143 119 L130 121 M176 114 L189 112 M176 119 L189 121" />
              <path className="cat-outline" strokeWidth="4" d="M132 132 Q144 139 156 133" />
              <circle className="cat-pink" cx="147" cy="137" r="3" />
            </g>
          </>
        ) : (
          <g className="cat-character">
            <ellipse className="cat-fur" cx="125" cy="139" rx="49" ry="25" />
            <path className="cat-fur" d="M78 132 L76 103 L93 116 Q101 112 109 116 L126 104 L123 134 Q124 154 102 155 Q79 155 78 132Z" />
            <path className="cat-pink" d="M81 113 L83 127 L90 119Z M120 113 L112 120 L119 127Z" opacity="0.7" />
            <path className="cat-line" d="M86 135 Q91 141 96 135 M106 135 Q111 141 116 135" />
            <path className="cat-pink" d="M98 142 L104 142 L101 146Z" />
            <path className="cat-fur cat-tail" d="M161 135 Q184 145 162 158 Q143 167 122 160 Q116 157 119 152 Q121 149 128 151 Q155 158 163 149 Q169 143 158 143Z" />
          </g>
        )}
      </svg>
    </div>
  );
}
