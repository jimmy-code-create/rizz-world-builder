import { useSyncExternalStore } from "react";

/**
 * Which voice-call bots are currently taken out of the call.
 *
 * MUSIC BOT keeps its own state next to its audio owner (`MusicBotInCall`),
 * because hiding the tile has to stop the sound. GAME BOT has no audio of its
 * own, so its visibility lives here in a tiny external store: the call view, the
 * in-call chat and a `/game` command typed anywhere all have to be able to bring
 * it back, and component state could only ever be reached from one of them.
 */
let gameHidden = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Take GAME BOT out of the call, or put its card back. */
export function setGameBotHidden(hidden: boolean) {
  if (gameHidden === hidden) return;
  gameHidden = hidden;
  listeners.forEach((listener) => listener());
}

export function gameBotHiddenSnapshot() {
  return gameHidden;
}

export function useGameBotHidden(): boolean {
  return useSyncExternalStore(subscribe, gameBotHiddenSnapshot, gameBotHiddenSnapshot);
}
