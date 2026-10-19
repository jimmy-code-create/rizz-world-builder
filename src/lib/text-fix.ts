/**
 * A tiny spell-corrector for text that comes out of the database.
 *
 * Bounties, group names and post captions are written by people, and a typo
 * in one of them ("Bring 1 freind") is shown to everybody who visits the
 * page. The rows themselves are user data, so they are not rewritten behind
 * the user's back; instead the text is corrected on the way out, and only for
 * misspellings that have no other meaning.
 */

/** Misspellings that are unambiguous — each has exactly one correct spelling. */
const TYPOS: Record<string, string> = {
  freind: "friend",
  freinds: "friends",
  fiends: "friends",
  recieve: "receive",
  recieved: "received",
  recieves: "receives",
  teh: "the",
  adn: "and",
  wich: "which",
  thier: "their",
  beleive: "believe",
  becuase: "because",
  seperate: "separate",
  occured: "occurred",
  definately: "definitely",
  wnat: "want",
  woudl: "would",
  shoudl: "should",
  coudl: "could",
  taht: "that",
  thta: "that",
  alot: "a lot",
  boudny: "bounty",
  bountys: "bounties",
  bountie: "bounty",
  moderater: "moderator",
  modderator: "moderator",
  follwer: "follower",
  folllow: "follow",
  messge: "message",
  mesage: "message",
  mesages: "messages",
  grup: "group",
  gropu: "group",
  gruop: "group",
  memebr: "member",
  mmeber: "member",
};

const PATTERN = new RegExp(`\\b(${[...Object.keys(TYPOS)].join("|")})\\b`, "gi");

/** Keeps the capitalisation of the original word: "Freind" -> "Friend". */
function matchCase(original: string, replacement: string) {
  if (!original) return replacement;
  if (original === original.toUpperCase() && original.length > 1) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Fix the known misspellings in a piece of text. The text is returned
 * unchanged when there is nothing to fix.
 */
export function fixCommonTypos(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(PATTERN, (match) => matchCase(match, TYPOS[match.toLowerCase()] ?? match));
}

/** True when the text contains a spelling this module would correct. */
export function hasKnownTypo(text: string | null | undefined): boolean {
  if (!text) return false;
  PATTERN.lastIndex = 0;
  return PATTERN.test(text);
}
