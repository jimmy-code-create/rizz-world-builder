/**
 * The app's one unicode emoji set: smiley faces, and nothing else.
 *
 * Every picker in RIZZ (the composer sheet, the realm sheet, the post and
 * reaction sheets) reads this table instead of the old 750-glyph catalogue.
 * It is plain data with no image URLs, which is what lets a picker paint a
 * hundred cells in a single frame.
 */

export type Smiley = { char: string; name: string; tags?: string };

/**
 * The faces, in the order people look for them: grins, love, tongues, hands
 * over faces, neutral, sad, angry, then the cats the app is named after.
 * `name` is also the search text, so it is written the way someone types it.
 */
export const SMILEY_EMOJI: readonly Smiley[] = [
  { char: "😀", name: "grinning", tags: "smile happy" },
  { char: "😃", name: "grin big eyes", tags: "smile happy" },
  { char: "😄", name: "grin smiling eyes", tags: "smile happy" },
  { char: "😁", name: "beaming", tags: "smile teeth" },
  { char: "😆", name: "laughing squint", tags: "lol happy" },
  { char: "😅", name: "sweat smile", tags: "nervous relief" },
  { char: "🤣", name: "rolling laughing", tags: "rofl lol" },
  { char: "😂", name: "tears of joy", tags: "laugh cry funny" },
  { char: "🙂", name: "slight smile", tags: "polite fine" },
  { char: "🙃", name: "upside down", tags: "silly sarcasm" },
  { char: "🫠", name: "melting", tags: "hot overwhelmed" },
  { char: "😉", name: "wink", tags: "flirt tease" },
  { char: "😊", name: "blush", tags: "smile shy" },
  { char: "😇", name: "halo angel", tags: "innocent good" },
  { char: "🥰", name: "hearts smile", tags: "love adore" },
  { char: "😍", name: "heart eyes", tags: "love crush" },
  { char: "🤩", name: "star struck", tags: "wow amazed" },
  { char: "😘", name: "blowing a kiss", tags: "love kiss" },
  { char: "😗", name: "kissing", tags: "kiss" },
  { char: "☺️", name: "relaxed", tags: "smile blush" },
  { char: "😚", name: "kiss closed eyes", tags: "kiss shy" },
  { char: "😙", name: "kiss smiling eyes", tags: "kiss" },
  { char: "🥲", name: "happy tear", tags: "cry proud" },
  { char: "😋", name: "yum", tags: "tongue tasty" },
  { char: "😛", name: "tongue out", tags: "silly" },
  { char: "😜", name: "wink tongue", tags: "silly crazy" },
  { char: "🤪", name: "zany", tags: "crazy silly" },
  { char: "😝", name: "squint tongue", tags: "silly" },
  { char: "🤑", name: "money mouth", tags: "rich cash" },
  { char: "🤗", name: "hug", tags: "warm comfort" },
  { char: "🤭", name: "giggle", tags: "oops laugh" },
  { char: "🫢", name: "gasp", tags: "shock oops" },
  { char: "🫣", name: "peeking", tags: "shy scared" },
  { char: "🤫", name: "shush", tags: "quiet secret" },
  { char: "🤔", name: "thinking", tags: "hmm maybe" },
  { char: "🫡", name: "salute", tags: "yes sir respect" },
  { char: "🤐", name: "zipper mouth", tags: "quiet secret" },
  { char: "🤨", name: "raised brow", tags: "sus doubt" },
  { char: "😐", name: "neutral", tags: "meh blank" },
  { char: "😑", name: "expressionless", tags: "meh done" },
  { char: "😶", name: "no mouth", tags: "speechless" },
  { char: "🫥", name: "dotted out", tags: "invisible gone" },
  { char: "😏", name: "smirk", tags: "sus smug" },
  { char: "😒", name: "unamused", tags: "side eye meh" },
  { char: "🙄", name: "eye roll", tags: "whatever" },
  { char: "😬", name: "grimace", tags: "awkward yikes" },
  { char: "😮‍💨", name: "exhale", tags: "sigh relief" },
  { char: "🤥", name: "lying", tags: "pinocchio" },
  { char: "😌", name: "relieved", tags: "calm peace" },
  { char: "😔", name: "pensive", tags: "sad down" },
  { char: "😪", name: "sleepy", tags: "tired" },
  { char: "🤤", name: "drool", tags: "tasty sleep" },
  { char: "😴", name: "sleeping", tags: "tired zzz" },
  { char: "😷", name: "mask", tags: "sick covid" },
  { char: "🤒", name: "thermometer", tags: "sick ill" },
  { char: "🤕", name: "bandage", tags: "hurt ouch" },
  { char: "🤢", name: "nauseated", tags: "sick gross" },
  { char: "🤮", name: "vomit", tags: "sick gross" },
  { char: "🤧", name: "sneeze", tags: "sick bless you" },
  { char: "🥵", name: "hot", tags: "sweat heat" },
  { char: "🥶", name: "cold", tags: "freezing" },
  { char: "🥴", name: "woozy", tags: "drunk dizzy" },
  { char: "😵", name: "dizzy", tags: "dead knocked out" },
  { char: "😵‍💫", name: "spiral eyes", tags: "confused dizzy" },
  { char: "🤯", name: "mind blown", tags: "wow shock" },
  { char: "🤠", name: "cowboy", tags: "yeehaw hat" },
  { char: "🥳", name: "party", tags: "celebrate birthday" },
  { char: "🥸", name: "disguised", tags: "incognito" },
  { char: "😎", name: "cool", tags: "sunglasses swag" },
  { char: "🤓", name: "nerd", tags: "glasses smart" },
  { char: "🧐", name: "monocle", tags: "hm inspect" },
  { char: "😕", name: "confused", tags: "unsure" },
  { char: "🫤", name: "diagonal mouth", tags: "meh unsure" },
  { char: "😟", name: "worried", tags: "concern" },
  { char: "🙁", name: "frown", tags: "sad" },
  { char: "☹️", name: "very sad", tags: "frown" },
  { char: "😮", name: "surprised", tags: "oh wow" },
  { char: "😯", name: "hushed", tags: "oh" },
  { char: "😲", name: "astonished", tags: "shock wow" },
  { char: "😳", name: "flushed", tags: "blush embarrassed" },
  { char: "🥺", name: "pleading", tags: "please puppy" },
  { char: "🥹", name: "holding tears", tags: "cry touched" },
  { char: "😦", name: "frowning open mouth", tags: "sad shock" },
  { char: "😧", name: "anguished", tags: "worried" },
  { char: "😨", name: "fearful", tags: "scared" },
  { char: "😰", name: "anxious sweat", tags: "nervous" },
  { char: "😥", name: "sad relieved", tags: "phew sad" },
  { char: "😢", name: "cry", tags: "sad tear" },
  { char: "😭", name: "sob", tags: "cry loud sad" },
  { char: "😱", name: "scream", tags: "shock scared" },
  { char: "😖", name: "confounded", tags: "frustrated" },
  { char: "😣", name: "persevere", tags: "struggle" },
  { char: "😞", name: "disappointed", tags: "sad" },
  { char: "😓", name: "downcast sweat", tags: "sad tired" },
  { char: "😩", name: "weary", tags: "tired ugh" },
  { char: "😫", name: "tired", tags: "exhausted" },
  { char: "🥱", name: "yawn", tags: "bored tired" },
  { char: "😤", name: "triumph", tags: "huff proud" },
  { char: "😡", name: "angry", tags: "mad rage" },
  { char: "😠", name: "mad", tags: "angry" },
  { char: "🤬", name: "cursing", tags: "angry swearing" },
  { char: "😈", name: "smiling devil", tags: "naughty" },
  { char: "👿", name: "angry devil", tags: "evil" },
  { char: "💀", name: "skull", tags: "dead gone" },
  { char: "🤡", name: "clown", tags: "fool" },
  { char: "👻", name: "ghost", tags: "boo" },
  { char: "👽", name: "alien", tags: "space" },
  { char: "🤖", name: "robot", tags: "bot" },
  { char: "😺", name: "cat grin", tags: "cat kitty" },
  { char: "😸", name: "cat smile", tags: "cat kitty" },
  { char: "😹", name: "cat tears of joy", tags: "cat laugh" },
  { char: "😻", name: "cat heart eyes", tags: "cat love" },
  { char: "😼", name: "cat smirk", tags: "cat smug" },
  { char: "😽", name: "cat kiss", tags: "cat kiss" },
  { char: "🙀", name: "cat wow", tags: "cat shock" },
  { char: "😿", name: "cat crying", tags: "cat sad" },
  { char: "😾", name: "cat pout", tags: "cat angry" },
] as const;

export const SMILEY_CHARS: ReadonlySet<string> = new Set(
  SMILEY_EMOJI.map((entry) => entry.char),
);

export function isSmiley(value: string): boolean {
  return SMILEY_CHARS.has(value);
}

/** Name/tag search. Every word must match, so "cat sad" finds 😿. */
export function searchSmileys(term: string): readonly Smiley[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return SMILEY_EMOJI;
  const words = needle.split(/\s+/).filter(Boolean);
  return SMILEY_EMOJI.filter((entry) => {
    const haystack = `${entry.char} ${entry.name} ${entry.tags ?? ""}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
