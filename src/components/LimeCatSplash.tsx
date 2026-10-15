import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";

export function LimeCatSplash({ message }: { message?: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatusText = () => {
    if (message) return message;
    if (seconds >= 12) return "Still connecting… taking longer than usual";
    if (seconds >= 8) return "Waking up server from cold start…";
    if (seconds >= 4) return "Almost ready to pounce…";
    return "Waking up the server cat…";
  };

  const statusText = getStatusText();

  return (
    <div
      className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-[#0b0b0c] text-center select-none px-4"
      role="status"
      aria-live="polite"
    >
      <div className="relative mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 256"
          width="160"
          height="160"
          className="select-none overflow-visible"
        >
          <style>{`
            @keyframes cat-ear-left-twitch {
              0%, 85%, 100% { transform: rotate(0deg); }
              90% { transform: rotate(-5deg); }
              95% { transform: rotate(3deg); }
            }
            @keyframes cat-ear-right-twitch {
              0%, 80%, 100% { transform: rotate(0deg); }
              86% { transform: rotate(6deg); }
              92% { transform: rotate(-2deg); }
            }
            @keyframes cat-blink {
              0%, 42%, 46%, 100% { transform: scaleY(1); }
              44% { transform: scaleY(0.08); }
            }
            @keyframes cat-whisker-twitch {
              0%, 75%, 100% { transform: translateY(0); }
              80% { transform: translateY(-1.5px); }
              85% { transform: translateY(1px); }
            }
            @keyframes cat-breathe {
              0%, 100% { transform: translateY(0) scale(1); }
              50% { transform: translateY(-3px) scale(1.02); }
            }
            .anim-ear-left {
              transform-origin: 90px 90px;
              animation: cat-ear-left-twitch 4s ease-in-out infinite;
            }
            .anim-ear-right {
              transform-origin: 165px 90px;
              animation: cat-ear-right-twitch 4.5s ease-in-out infinite 0.4s;
            }
            .anim-eyes {
              transform-origin: 128px 110px;
              animation: cat-blink 3.8s ease-in-out infinite;
            }
            .anim-whiskers {
              transform-origin: 128px 126px;
              animation: cat-whisker-twitch 3.2s ease-in-out infinite;
            }
            .anim-cat-body {
              animation: cat-breathe 2.4s ease-in-out infinite;
            }
          `}</style>

          <g className="anim-cat-body">
            {/* speech bubble with the R mark */}
            <path
              d="M62 118h132c16 0 28 12 28 28v44c0 16-12 28-28 28H124l-40 26v-26H62c-16 0-28-12-28-28v-44c0-16 12-28 28-28z"
              fill="#18181b"
            />
            <path
              d="M62 118h132c16 0 28 12 28 28v44c0 16-12 28-28 28H124l-40 26v-26H62c-16 0-28-12-28-28v-44c0-16 12-28 28-28z"
              fill="none"
              stroke="#27272a"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            {/* the two dots of the R counter */}
            <ellipse cx="112" cy="171" rx="13" ry="15" fill="#C8FF3D" />
            <ellipse cx="146" cy="171" rx="13" ry="15" fill="#C8FF3D" />
            {/* the R stem */}
            <path d="M92 143h16v56H92z" fill="#0b0b0c" />

            {/* Left Ear */}
            <g className="anim-ear-left">
              <path d="M74 96 L80 52 L112 84 Z" fill="#18181b" />
              <path d="M84 88 L88 64 L106 84 Z" fill="#C8FF3D" />
            </g>

            {/* Right Ear */}
            <g className="anim-ear-right">
              <path d="M182 96 L176 52 L144 84 Z" fill="#18181b" />
              <path d="M172 88 L168 64 L150 84 Z" fill="#C8FF3D" />
            </g>

            {/* Cat Head */}
            <ellipse cx="128" cy="112" rx="52" ry="42" fill="#18181b" stroke="#27272a" strokeWidth="2" />

            {/* Eyes */}
            <g className="anim-eyes">
              <ellipse cx="110" cy="108" rx="16" ry="18" fill="#F4F1E7" />
              <ellipse cx="146" cy="108" rx="16" ry="18" fill="#F4F1E7" />
              <ellipse cx="113" cy="111" rx="8" ry="10" fill="#0b0b0c" />
              <ellipse cx="149" cy="111" rx="8" ry="10" fill="#0b0b0c" />
              <circle cx="108" cy="103" r="3.2" fill="#FFFFFF" />
              <circle cx="144" cy="103" r="3.2" fill="#FFFFFF" />
            </g>

            {/* Nose & Smile */}
            <path d="M124 128h9l-4.5 6z" fill="#C8FF3D" />
            <path d="M128 136c3 4 8 4 11 0" stroke="#C8FF3D" strokeWidth="3.5" fill="none" strokeLinecap="round" />

            {/* Animated Whiskers */}
            <g className="anim-whiskers">
              <path d="M96 122h-18M96 130l-16 5M160 122h18M160 130l16 5" stroke="#C8FF3D" strokeWidth="3" strokeLinecap="round" />
            </g>

            {/* Paws resting on bubble */}
            <ellipse cx="86" cy="132" rx="12" ry="10" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
            <ellipse cx="170" cy="132" rx="12" ry="10" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
          </g>

          {/* Accent Sparks */}
          <path d="M198 84l6-16 6 16 16 6-16 6-6 16-6-16-16-6z" fill="#C8FF3D" opacity="0.9" />
          <path d="M46 74l4-10 4 10 10 4-10 4-4 10-4-10-10-4z" fill="#C8FF3D" opacity="0.75" />
        </svg>
      </div>

      <div className="min-h-[44px] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={statusText}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.28 }}
            className="text-xs font-semibold text-muted-foreground tracking-wide font-sans"
          >
            {statusText}
          </motion.p>
        </AnimatePresence>

        {seconds >= 12 && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 active:scale-95"
          >
            <RefreshCw className="h-3 w-3" /> Refresh page
          </button>
        )}
      </div>
    </div>
  );
}
