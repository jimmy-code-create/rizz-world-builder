/**
 * The Rizz library: the emoji and text stickers the composer offers.
 *
 * The cat emoji set is gone. Cat faces were cute in a sticker pack, but as the
 * app's only expressive language they were slow to scan, unreadable at 14px in
 * a reaction chip, and impossible to type or search — and they rendered as
 * custom SVG that grew the bundle. This library is plain Unicode and plain
 * text instead, so anything picked here survives every surface (chat, comments,
 * notifications, share cards) with no image pipeline at all.
 *
 * Four packs, ordered by what people actually send while chatting: a face for
 * the feeling, a hype burst, something soft, and a kaomoji for the chaos.
 */
export type RizzPack = {
  id: string;
  label: string;
  /** The tile glyph shown on the pack chip. */
  glyph: string;
  items: string[];
};

export const RIZZ_PACKS: RizzPack[] = [
  {
    id: "faces",
    label: "Faces",
    glyph: "😎",
    items: [
      "😀", "😁", "😂", "🤣", "😊", "🥹", "😍", "🥰",
      "😘", "😎", "🤩", "🥳", "😏", "😅", "😭", "🥺",
      "😤", "😳", "🤔", "🫠", "🙃", "😴", "🤯", "💀",
    ],
  },
  {
    id: "hype",
    label: "Hype",
    glyph: "🔥",
    items: [
      "🔥", "💯", "⚡", "✨", "🎉", "🎊", "🏆", "👑",
      "🚀", "💥", "👏", "🙌", "🤝", "💪", "🫡", "🥇",
      "📈", "🎯", "🕹️", "🎮", "🎵", "📣", "🗣️", "🫨",
    ],
  },
  {
    id: "soft",
    label: "Soft",
    glyph: "💗",
    items: [
      "❤️", "🩷", "🧡", "💛", "💚", "🩵", "💙", "💜",
      "🤍", "🖤", "💗", "💖", "💘", "💝", "🫶", "🤗",
      "🌙", "🌸", "🌷", "☁️", "🫂", "🕊️", "🧸", "🍰",
    ],
  },
  {
    id: "chaos",
    label: "Chaos",
    glyph: "(╯°□°)╯",
    items: [
      "(╯°□°)╯︵ ┻━┻",
      "┬─┬ノ( º _ ºノ)",
      "( •_•)>⌐■-■",
      "(⌐■_■)",
      "(ಥ﹏ಥ)",
      "(¬‿¬)",
      "༼ つ ◕_◕ ༽つ",
      "(づ｡◕‿‿◕｡)づ",
      "¯\\_(ツ)_/¯",
      "(ง'̀-'́)ง",
      "( ˘ ³˘)♥",
      "ᕕ( ᐛ )ᕗ",
      "ʕ•ᴥ•ʔ",
      "(ノಠ益ಠ)ノ彡┻━┻",
      "o(*￣▽￣*)ブ",
      "(๑•̀ㅂ•́)و✧",
    ],
  },
];

/**
 * Reactions, picked for a 14px chip: high contrast, no detail to lose.
 *
 * These replace the cat faces that used to fill the reaction sheet — same idea
 * (an in-house set, not the platform's default row), but plain Unicode, so a
 * reaction costs nothing to render and survives every surface.
 */
export const RIZZ_REACTIONS = [
  "🔥", "😂", "🥹", "💀", "👀", "🫶", "✨", "💯",
  "😭", "🤝", "🥳", "😳", "🫠", "😎", "🙌", "❤️",
] as const;

/** Every item in one list, so a search can scan the whole library at once. */
export const RIZZ_ALL_ITEMS: { pack: RizzPack; item: string }[] = RIZZ_PACKS.flatMap((pack) =>
  pack.items.map((item) => ({ pack, item })),
);

/**
 * Search matches a pack's name ("hype") as well as the item itself, so typing
 * "soft" finds hearts even though a heart has no word in it.
 */
export function searchRizzLibrary(query: string): { pack: RizzPack; item: string }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return RIZZ_ALL_ITEMS;
  return RIZZ_ALL_ITEMS.filter(
    (entry) => entry.pack.label.toLowerCase().includes(needle) || entry.item.includes(needle),
  );
}

/** Where a picked item lands in the draft: one space, never glued to a word. */
export function insertRizzItem(draft: string, item: string, maxLength = Infinity): string {
  const next = `${draft}${draft && !draft.endsWith(" ") ? " " : ""}${item}`;
  return next.slice(0, maxLength);
}
