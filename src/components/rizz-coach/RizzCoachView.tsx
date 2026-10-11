import "./rizz-coach-view.css";

export type RizzCoachState = "idle" | "listening" | "thinking" | "speaking";
export type RizzCoachEmotion = "playful" | "warm" | "excited" | "teasing" | "calm" | "surprised";

export interface RizzCoachViewProps {
  state: RizzCoachState;
  emotion: RizzCoachEmotion;
  heardCaption?: string;
  replyCaption?: string;
  statusMessage?: string;
  micLevel?: number;
  onOrbClick: () => void;
}

const statePrompts: Record<RizzCoachState, string> = {
  idle: "Tap the glow when you’re ready",
  listening: "I’m listening",
  thinking: "Putting a good one together",
  speaking: "Tap to jump in",
};

export function RizzCoachView({
  state,
  emotion,
  heardCaption,
  replyCaption,
  statusMessage,
  micLevel = 0,
  onOrbClick,
}: RizzCoachViewProps) {
  const accessibleAction =
    state === "listening"
      ? "Interrupt listening"
      : state === "speaking"
        ? "Interrupt the coach"
        : "Start voice practice";

  return (
    <main
      className="rizz-coach"
      data-state={state}
      data-emotion={emotion}
      style={{ "--voice-level": String(Math.max(0, Math.min(1, micLevel))) } as React.CSSProperties}
    >
      <div className="rizz-coach__atmosphere" aria-hidden="true" />

      <header className="rizz-coach__heading">
        <p className="rizz-coach__eyebrow">RIZZ COACH</p>
        <p className="rizz-coach__intro">Your private little practice room.</p>
      </header>

      <section className="rizz-coach__center" aria-label="Voice practice">
        <p className="rizz-coach__status" role="status" aria-live="polite">
          {statusMessage || statePrompts[state]}
        </p>

        <button
          className="rizz-coach__orb-button"
          type="button"
          onClick={onOrbClick}
          aria-label={accessibleAction}
        >
          <span className="rizz-coach__orb-field" aria-hidden="true">
            <span className="rizz-coach__orb-halo" />
            <span className="rizz-coach__orb-ripple rizz-coach__orb-ripple--one" />
            <span className="rizz-coach__orb-ripple rizz-coach__orb-ripple--two" />
            <span className="rizz-coach__orb-wave rizz-coach__orb-wave--one" />
            <span className="rizz-coach__orb-wave rizz-coach__orb-wave--two" />
            <span className="rizz-coach__orb-wave rizz-coach__orb-wave--three" />
            <span className="rizz-coach__orb">
              <span className="rizz-coach__orb-light" />
            </span>
          </span>
        </button>
        <span className="rizz-coach__private-note">JUST YOU &amp; ME</span>
      </section>

      <div className="rizz-coach__captions" aria-live="polite" aria-atomic="true">
        <p
          className={`rizz-coach__caption rizz-coach__caption--heard${heardCaption ? " is-visible" : ""}`}
          aria-hidden={!heardCaption}
        >
          <span className="rizz-coach__caption-label">YOU</span>
          <span>{heardCaption || "\u00a0"}</span>
        </p>
        <p
          className={`rizz-coach__caption rizz-coach__caption--reply${replyCaption ? " is-visible" : ""}`}
          aria-hidden={!replyCaption}
        >
          <span className="rizz-coach__caption-label">COACH</span>
          <span>{replyCaption || "\u00a0"}</span>
        </p>
      </div>
    </main>
  );
}
