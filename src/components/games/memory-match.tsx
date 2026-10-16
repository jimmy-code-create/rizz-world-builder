import { useMemo, useState } from "react";
import { GameChip, GameShell, GameTimer } from "@/components/games/board-frame";
import { GameIcon } from "@/components/GameIcon";

/**
 * MEMORY MATCH — pairs of the app's own cat emojis. Six pairs is a coffee break,
 * twelve is a real memory test; both fit the same board.
 */
const ICONS = [
  ":cat_cool:",
  ":cat_hype:",
  ":cat_lol:",
  ":cat_love:",
  ":cat_music:",
  ":cat_sad:",
  ":cat_sleep:",
  ":cat_sus:",
  ":cat_think:",
  ":cat_wave:",
  ":cat_wow:",
  ":cat_gg:",
];

type Card = { id: number; icon: string; flipped: boolean; matched: boolean };

function deal(pairs: number): Card[] {
  const chosen = ICONS.slice(0, pairs);
  const deck: Card[] = [];
  chosen.forEach((icon, index) => {
    deck.push({ id: index * 2, icon, flipped: false, matched: false });
    deck.push({ id: index * 2 + 1, icon, flipped: false, matched: false });
  });
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function MemoryMatchGame() {
  const [pairs, setPairs] = useState(8);
  const [cards, setCards] = useState<Card[]>(() => deal(8));
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [locked, setLocked] = useState(false);

  const matched = useMemo(() => cards.filter((card) => card.matched).length / 2, [cards]);
  const solved = matched === pairs;

  const restart = (nextPairs = pairs) => {
    setPairs(nextPairs);
    setCards(deal(nextPairs));
    setOpen([]);
    setMoves(0);
    setLocked(false);
    setResetKey((key) => key + 1);
  };

  const flip = (index: number) => {
    const card = cards[index];
    if (locked || !card || card.matched || open.includes(index)) return;
    if (open.length === 1) {
      const first = cards[open[0]];
      const next = cards.map((item, i) =>
        i === index || i === open[0]
          ? { ...item, flipped: true, matched: item.icon === card.icon }
          : item,
      );
      setMoves((count) => count + 1);
      setCards(next);
      setOpen([]);
      if (card.icon === first.icon) return;
      setLocked(true);
      window.setTimeout(() => {
        setCards((current) =>
          current.map((item, i) =>
            i === index || i === open[0] ? { ...item, flipped: false } : item,
          ),
        );
        setLocked(false);
      }, 620);
      return;
    }
    setOpen([index]);
    setCards(cards.map((item, i) => (i === index ? { ...item, flipped: true } : item)));
  };

  return (
    <GameShell
      status={solved ? `Solved in ${moves} moves.` : `${matched}/${pairs} pairs found`}
      chips={
        <>
          <GameChip label="moves" value={moves} accent="#c9ff3d" />
          <GameChip label="pairs" value={`${matched}/${pairs}`} />
          <GameTimer running={!solved} resetKey={resetKey} />
        </>
      }
      onRestart={() => restart()}
      footer="Two cards at a time. Twelve pairs is the full cat set."
    >
      <div className="flex w-full max-w-[min(100%,560px)] flex-col items-center gap-2">
        <div className="flex gap-1.5">
          {[6, 8, 12].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => restart(count)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                pairs === count
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/15 text-white/65 hover:text-white"
              }`}
            >
              {count} pairs
            </button>
          ))}
        </div>

        <div
          className="grid w-full gap-2"
          style={{ gridTemplateColumns: `repeat(${pairs <= 8 ? 4 : 6}, minmax(0, 1fr))` }}
        >
          {cards.map((card, index) => {
            const faceUp = card.flipped || card.matched;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => flip(index)}
                aria-label={faceUp ? card.icon : "hidden card"}
                className={`grid aspect-square place-items-center rounded-xl border transition ${
                  card.matched
                    ? "border-primary/60 bg-primary/15"
                    : faceUp
                      ? "border-white/20 bg-white/[0.08]"
                      : "border-white/10 bg-[#1c1c1f] hover:border-primary/40"
                }`}
              >
                {faceUp ? (
                  <GameIcon icon={card.icon} size={pairs <= 8 ? 34 : 26} />
                ) : (
                  <span className="text-lg text-white/20">?</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </GameShell>
  );
}

export default MemoryMatchGame;
