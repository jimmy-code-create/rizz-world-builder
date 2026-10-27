/**
 * The call view sits under the provider that owns the WebRTC engine, and the
 * engine's speaking levels change up to ~5x a second while people talk. This
 * harness renders that exact shape — a provider that re-renders on every tick,
 * a heavy memoised child that draws the call surface, and the tiles that do
 * subscribe to speaking levels — and counts renders per tick.
 *
 * It is the guard for `export const VoiceCallView = memo(...)`: without that
 * memo the whole call surface re-rendered at audio rate, which is what made the
 * controls answer late on a phone.
 */
let JSDOM;
try {
  ({ JSDOM } = await import("jsdom"));
} catch {
  // jsdom is a declared devDependency but is not installed in every workspace;
  // the guard is skipped rather than failing the suite there.
  console.log("voice-rerender: skipped (jsdom is not installed)");
  process.exit(0);
}

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { createElement: h, memo, createContext, useContext, useState, useMemo } = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");

let checks = 0;
let failures = 0;
function check(label, condition) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

const SpeakingContext = createContext([]);
const speakingOf = {
  heavy: 0,
  tiles: 0,
  unmemoised: 0,
};

/** The call surface: big tree, no speaking subscription. */
const HeavyView = memo(function HeavyView() {
  speakingOf.heavy += 1;
  return h("div", null, Array.from({ length: 40 }, (_, index) => h("span", { key: index }, `row ${index}`)));
});

/** Same component without the memo boundary, for the counter-example. */
function LooseView() {
  speakingOf.unmemoised += 1;
  return h("div", null, "loose");
}

/** The tiles are the only legitimate subscriber to speaking levels. */
function Tiles() {
  const speaking = useContext(SpeakingContext);
  speakingOf.tiles += 1;
  return h("div", null, speaking.length);
}

let setSpeaking = () => {};
function Provider({ children }) {
  const [speaking, set] = useState([]);
  setSpeaking = set;
  const value = useMemo(() => speaking, [speaking]);
  return h(SpeakingContext.Provider, { value }, children);
}

const root = createRoot(document.getElementById("root"));
await act(async () => {
  root.render(
    h(Provider, null, h(HeavyView, null), h(LooseView, null), h(Tiles, null)),
  );
});

const afterMount = { ...speakingOf };
check("memoised view renders once on mount", afterMount.heavy === 1);
check("tiles render once on mount", afterMount.tiles === 1);

// 20 speaking ticks, the rate a busy conversation produces.
for (let tick = 0; tick < 20; tick += 1) {
  await act(async () => {
    setSpeaking(tick % 2 === 0 ? ["peer-a"] : ["peer-a", "peer-b"]);
  });
}

const heavyRenders = speakingOf.heavy - afterMount.heavy;
const tileRenders = speakingOf.tiles - afterMount.tiles;
const unmemoisedRenders = speakingOf.unmemoised - afterMount.unmemoised;

check(`memoised call surface ignores all 20 audio ticks (got ${heavyRenders})`, heavyRenders === 0);
check(`tiles re-render on every audio tick (got ${tileRenders})`, tileRenders === 20);
check(`unmemoised surface would re-render 20 times (got ${unmemoisedRenders})`, unmemoisedRenders === 20);

await act(async () => {
  root.unmount();
});

if (failures) {
  console.error(`voice-rerender: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`voice-rerender: ${checks} checks passed`);
