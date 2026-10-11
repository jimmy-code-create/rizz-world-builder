import "./rizz-coach-view.css";

export type RizzCoachState = "idle" | "listening" | "thinking" | "speaking";
export type RizzCoachEmotion = "playful" | "warm" | "excited" | "teasing" | "calm" | "surprised";

export interface RizzCoachViewProps {
  state: RizzCoachState;
  emotion: RizzCoachEmotion;
  heardCaption?: string;
  replyCaption?: string;
  statusMessage?: string;
  onCatClick: () => void;
}

const statePrompts: Record<RizzCoachState, string> = {
  idle: "Tap the cat when you’re ready",
  listening: "I’m listening",
  thinking: "Putting a good one together",
  speaking: "Tap the cat to interrupt",
};

export function RizzCoachView({
  state,
  emotion,
  heardCaption,
  replyCaption,
  statusMessage,
  onCatClick,
}: RizzCoachViewProps) {
  const accessibleAction =
    state === "speaking"
      ? "Interrupt the coach"
      : state === "thinking"
        ? "The coach is preparing a reply"
        : state === "listening"
          ? "The coach is listening"
          : "Start voice practice";

  return (
    <main className="rizz-coach" data-state={state} data-emotion={emotion}>
      <header className="rizz-coach__heading">
        <p className="rizz-coach__eyebrow">RIZZ COACH</p>
        <p className="rizz-coach__intro">Your private little practice room.</p>
      </header>

      <section className="rizz-coach__center" aria-label="Voice practice">
        <p className="rizz-coach__status" role="status" aria-live="polite">
          {statusMessage || statePrompts[state]}
        </p>

        <button
          className="rizz-coach__cat-button"
          type="button"
          onClick={onCatClick}
          aria-label={accessibleAction}
        >
          <img
            className="rizz-coach__cat-image"
            src="/rizz-coach-cat.png"
            alt=""
            draggable={false}
          />
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
