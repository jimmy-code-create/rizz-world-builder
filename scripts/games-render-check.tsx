import { renderToStaticMarkup } from "react-dom/server";
import { GamePlayOverlay } from "@/components/games/GamePlayOverlay";
import { GameStage } from "@/components/games/GameStage";
import { getGames } from "@/lib/activities";

let failures = 0;
const games = getGames();
const builtins = games.filter((game) => game.source === "builtin");

for (const game of builtins) {
  try {
    const html = renderToStaticMarkup(<GameStage entry={game} players={3} fullscreen className="absolute inset-0" />);
    const ok = html.length > 200;
    console.log(`${ok ? "PASS" : "FAIL"}  renders ${game.id} (${game.category}) — ${html.length} chars`);
    if (!ok) failures += 1;
  } catch (error) {
    console.log(`FAIL  renders ${game.id} — ${String(error)}`);
    failures += 1;
  }
}

try {
  const html = renderToStaticMarkup(<GamePlayOverlay entry={builtins[0]} onClose={() => {}} />);
  console.log(`PASS  fullscreen player renders — ${html.length} chars`);
} catch (error) {
  console.log(`FAIL  fullscreen player — ${String(error)}`);
  failures += 1;
}

console.log(`\n${builtins.length} built-in games, ${games.length} total`);
console.log(failures === 0 ? "ALL RENDER CHECKS PASSED" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
