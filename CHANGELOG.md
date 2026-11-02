# Changelog

## 2026-11-03 — Bounty tags, heading colour, covers, and the photo-picker fix

- Bounties now carry up to five Reddit-style tags. Every member can add them —
  Paws-prize bounties and free open calls alike — with suggested topics,
  comma-paste support, duplicate/case cleanup and removable chips. Tags render
  on the card and the board has a shareable `?tag=design` filter with counts.
- The posting form gained a live card preview, a heading-colour picker (eight
  bright presets plus a custom hex colour), and a cover image with a real
  preview, replace/remove controls and compression before upload.
- The form is longer, so it scrolls inside the phone viewport with the existing
  safe-area padding and a sticky post button. Requirements are now captured for
  open calls too, and the card shows them for every bounty that has them.
- Fixed the photo-picker losing the selected image in DMs, groups and bounties.
  A Supabase `TOKEN_REFRESHED` event on returning from the native picker was
  flipping the auth shell back to `AppLoader`, which unmounted the route and
  discarded its draft. Background profile refreshes now update in place and
  keep the current screen mounted.
- `20261115000000_bounty_presentation.sql` adds `drops.heading_color`, a GIN
  index for tags, server-side title/tag/colour validation for direct open-call
  inserts, and an 11-argument `post_paws_bounty` wrapper that preserves the
  existing escrow body. The client falls back gracefully if the migration has
  not reached a deployment yet.

## 2026-11-02 — Purify sells itself, without the video

- `/purify` is a page now, not an advert. The black video box, the mute button,
  the Skip pill and “tap anywhere to skip” are gone, along with the 10 MB
  `purify-intro.mp4` and `PurifyIntro.tsx`. In their place: a lime shield with
  one slow light sweep, a four-line perk list, and a swipeable preview strip
  built from the real `Badge`, `Avatar` and `ReactionPills` components in a demo
  state — nothing on the page can fail to load into an empty container.
- The perks are one array. `PURIFY_PERKS` in `src/lib/purify.ts` feeds both the
  page and the bottom sheet, so editing a title or a line is a one-file change.
  The four entries are the ones the code actually enforces: escrow bounties,
  super reactions, the profile badge, and shared realm emoji uploads.
- Price, restore and exit are honest. The card keeps the monthly price from
  `PURIFY_PRICE_LABEL` (large, with “Billed monthly. Cancel anytime.”), Restore
  purchase re-reads the profile, the CTA reads “Get Purify · $1/mo”, and Maybe
  later is a quiet text link back to the feed. There is no invented member
  count anywhere.
- A gate is a sheet, not an interstitial. Tapping Take bounty, super react, a
  gated banner or the realm emoji uploader posts one `rizz:open-purify-paywall`
  event; `PurifyPaywallSheet` (mounted once in `AppShell`) answers with the
  shield, three perks, the same CTA and a link to the full page. Deliberate
  taps always show it; anything unasked-for is capped to once per seven days
  after Maybe later. Nothing is ever forced on arrival.
- The realm emoji uploader is now a Purify perk: non-members see the paywall
  instead of the form. Viewing and using shared emoji stays free. This is inert
  until `VITE_PURIFY_ENFORCED=1`, same as the other gates.
- Motion is three small pieces: a 250–350ms staggered entrance, the shield
  shimmer, and a glow that drifts with scroll. All three stand down under
  `prefers-reduced-motion` or the app's reduced-motion flag, and the entrance
  renders its final state instead of an invisible container.
- Opening a realm no longer crashes with React #310. The page's image-cleanup
  effect sat below the loading/not-found early returns, so the first render
  called fewer hooks than the render that had data. It now runs before both
  returns, with a comment on why hooks must stay above them.
- The loading screen now measures absence. A small pre-React script stamps
  `rizz.last-active-at` while the app is visible and when it goes away; a
  return within ten minutes paints the shell (or a quiet skeleton while the
  session rehydrates) and skips the brand splash entirely. A first visit or a
  return after ten minutes still gets it.
- The post page's comment panel no longer fixes itself to 62dvh. With one
  comment that left a screen of empty surface, and because the panel was a
  scroller itself, dragging over the blank area never moved the page. It now
  grows with the thread, caps at 62dvh and only then scrolls, so the composer
  sits where the conversation ends.
- The bounty dialog fits a phone: it caps at the viewport, scrolls inside it,
  and pads the bottom for the home indicator, so “Lock … Paws & post” is no
  longer cut off with no way to reach it.
- The background dot canvas is legible on OLED phones. 6% ink crushed to
  black; 12% keeps the same one-paint halftone but actually reads as texture
  behind the post, drops and realm pages instead of an empty black field.
- `/purify` no longer runs past the right edge of a phone. The page root was
  `max-w-xl` without `w-full`, so as a flex child it sized to the swipe strip's
  max-content and clipped the hero, the perk copy and every card. It now takes
  the full column, and the strip's gutters match the shell's.
- The perk list now carries every real gate, not four: escrow bounties, super
  reactions, animated RIZZ emoji, the profile badge, profile gradients, banner
  photos, GIFs, 50 MB uploads and shared realm emoji — each with the concrete
  example (a 500-Paws drop, 16 gradients, ✦ pills). The preview strip gained an
  animated-emoji card and a real gradient-profile card, both built from live
  components and presets.
- The RIZZ cat emoji were redrawn as one premium sticker set: matte jet-black
  fur with an inner gradient, a thin lime rim light, a glossy forehead, dark
  olive inner ears, curved lime whiskers and blush. The idle loop breathes,
  twitches an ear, sways the whiskers and pulses the rim — transform/opacity
  only, max three loops on screen. Static faces now have no expression
  animation at all.
- Animated cat emoji are a Purify perk. The pickers put a small lock on every
  face and show the same faces as still stickers to free accounts; Purify
  members get hover, one-shot and loop motion. Super-reaction celebrations
  still animate for every viewer because sending one already requires Purify.
  The super burst now uses the new Rizzy art.

## 2026-11-01 — One emoji system, a bounty gate, and a louder double tap

- A realm emoji is now an app emoji. It is stored as `<:shortcode:id>` so two
  realms can both own `:cat:` without colliding, it renders through `EmojiText`
  in comments, and one picker offers it everywhere: Recent, Default, a tab per
  joined realm and shortcode search. A removed emoji, or one from a realm the
  reader left, degrades to `:cat:` — the sentence never breaks.
- The data model grew the parts the rest of the phase needs: a realm-level
  `allow_external_emoji` switch, a `status` on each emoji so removal is a
  tombstone rather than a delete, a 50-per-realm cap, and report/remove RPCs
  that re-check `owner`/`admin` server-side. `post_reactions.emoji` is widened
  so a `ce:<id>` reaction key fits.
- Super reactions are live on posts for Purify members, drawn the way Discord
  draws them: a taller pill than a normal reaction, an amethyst-to-violet
  gradient, an outer glow, a spark glyph and a one-shot 520ms pop when it
  becomes super. The switch itself is that language too — gradient track, glow,
  bigger knob — and while it is on, the picker wears a **Super** chip so the
  next pick is obviously not a normal reaction. The picker gained a **Super reaction** switch; a super pick
  becomes a `kind = 'super'` row and marks its sender in the reactor list. It
  replaces that member's normal reaction for the same emoji, so one tap is one
  row and the count can never double. Billing off means everyone can try it;
  flip `VITE_PURIFY_ENFORCED` and the switch locks to subscribers. The switch
  only appears once `20261112000000_post_super_reactions.sql` is applied, and
  reads of the old table keep working until then.
- Reaction pills are sized for the thumb without shouting: 32px tall with an
  18px glyph, 36px and 22px when super. Readable at a glance, no longer a row
  of dinner plates.
- Toasts stopped shouting. The pill is now thumb-wide (20.5rem max) with a
  12px title and 11px note, only one is on screen at a time, routine receipts
  leave sooner, and a gating message that gets tapped again is ignored for six
  seconds instead of restarting its timer. Info wears the app's lime dot rather
  than a system blue, and the escrow gate reads “Escrow bounties need Purify /
  Open calls stay free to take.” instead of a two-sentence red alert.
- The separate `/create` page is gone. Writing a post happens in the feed's
  inline composer or the one the plus button opens; the page-only shell, the
  expand link and the `fullPage` prop were removed with it.
- Reacting gives a short vibration on phones that support it — the post pills,
  the picker and the reel double tap each pulse once, through the same deduped
  haptic utility the rest of the app uses.
- Realm emoji reactions no longer fail with **Invalid reaction**. The table had
  already been widened, but `toggle_post_reaction` kept its own 16-character
  guard, so a 39-character `ce:<id>` key was rejected before the insert. The
  RPC now accepts 64 characters; `20261113000000_post_reaction_key_length.sql`
  carries the replacement and repeats the column widening.
- The post footer lost its two extra entry points: the expand-to-comments arrows
  and the “view all reactions” button. The reaction pills stay, and long-pressing
  a pill still opens the reactor list.
- Reels lost their React tray and their reaction column: a double tap likes
  the reel and pops the sticker at your thumb, nothing else. The emoji stream
  from the last pass is gone — a second, unrelated emoji appearing after a
  double tap read as noise. Reduced motion keeps the static “Liked” pill.
- A post reacts with the shared picker. The footer's eight fixed emoji were
  replaced by the one picker (recents, defaults, a tab per joined realm, search),
  so anyone can react with a custom emoji; the pick lands as a `ce:<id>`
  reaction and shows up as a pill — image, count, highlighted when it is yours.
  Long-pressing a pill opens the reactor list, which now draws custom emoji as
  images too instead of printing the raw key.
- The expand-to-comments icon left the post action row: comments already open
  from the post itself and the comment count right beside it.
- Escrow bounties now say what they mean to non-premium members: instead of a
  Take button that the database would refuse, the card offers the upgrade path.
- Notifications gained the **Bounties** tab: every `bounty_*` event in one
  lifecycle view.
- Double-tapping a reel fires six differently coloured glyphs alongside the
  sticker, from the tap point and inside the reduced-motion guard.
- Reels gained a reaction tray: six quick reactions plus the shared picker, and
  every reaction you leave floats up the screen from a random column, capped at
  twelve so a fast tapper cannot flood the frame. A custom emoji floats as its
  own image when it resolves, and as nothing at all when it does not.
- The composer now has a page of its own at `/create`. The inline composer is
  still one tap away (and on mobile it links out), but writing a real post no
  longer means writing it in a box wedged between two feed cards: the draft,
  the poll, the image and the visibility choice all survive on `/create`, and
  the back button returns to wherever you came from.

## 2026-10-29 — No more stutter for viewers while the host reads comments

- Opening the host's comment sheet published a full party sync, and every guest
  ran the whole playback apply for it: a smooth scroll of the feed plus two
  delayed seek/play passes on the reel. That is why viewers felt lag exactly
  when the host started reading. Syncs now carry a `scope`; a comment change is
  `"comments"`, and the guest mirrors the sheet and returns before any player
  work. Playback syncs still carry the comment flag, so a late joiner learns it.

## 2026-10-29 — The profile badges, redrawn and applied

- Every badge now draws from one inline SVG component: a 24-grid silhouette
  with a 1u white hairline rim, a two-tone gradient in *user space* (lit at the
  top, deep at the bottom — so the paw's four shapes share a single light), a
  top-edge highlight clipped to the silhouette, and a glow that scales with the
  rendered px. No drop shadows, no flat fills, no image files, no emoji.
- Five marks: **verified** (shield + check), **premium** (gem + sparkle),
  **early_member** (star), **top_paws** (paw), **creator** (crown), each with
  one inner icon simple enough to survive 16px. Adding a sixth is one entry in
  the badge table.
- The swap happens in the one component every surface already used, so the
  profile card, the full profile, feed rows, forum rows, the preview sheet and
  the /badges shelf all moved at once with props (`slug`, `size`, `locked`,
  `title`, `className`) unchanged. The name row's four slugs map to four
  *different* new marks — verified → shield, purify → gem, streamer → crown,
  bounty-hunter → paw — and `og`/`founder` get the star. Any slug the family
  does not cover keeps the sprite badge instead of disappearing.
- Name rows carry their marks in one rounded pill with 4px between them, on the
  feed and in forum rows as well as on the profile.
- `/badge-preview` is the spec sheet: every mark at 16, 20 and 28 on the
  profile's purple-to-navy wash and on a light surface, with the pill rows.

## 2026-10-29 — Polls in every chat, sorts on every thread, a party you read together

- **Polls reach DMs and groups.** The `+` offers Poll in all three chats now.
  A new migration adds a nullable `card` payload to `direct_messages` and
  `group_messages`, a `chat_polls` / `chat_poll_votes` pair scoped by group or
  by the two people in a DM, and two SECURITY DEFINER RPCs (`create_chat_poll`,
  `vote_chat_poll`) that re-check membership, blocks and the closing time. The
  poll renders from the message itself and tallies stream over Realtime, the
  same shape realm polls have had. A blocked pair cannot be polled.
- **The Rizz library is gone.** The `+` sheet no longer opens an emoji/sticker
  sub-view: the component, the four packs, the search and the insert helper are
  deleted, and every composer stopped wiring them. The curated reaction set
  moved to `src/lib/reactions.ts`, where the rest of the reaction vocabulary
  lives.
- **The `+` is a square.** The trigger is a squared tile with a squared frame
  around the plus, and the sheet is a grid of equal square tiles instead of
  differently sized cards — a palette of choices rather than a list.
- **Comments can always be sorted.** Every thread (posts, side discussion,
  reels) shows **Top voted** and **Newest** as two pills whenever there is at
  least one comment. Before, one button showed the current order and only
  appeared with more than one thread, so a fresh reel looked like comments had
  no sort at all.
- **Reel party reads together.** The party sync now carries whether the host
  has comments open. A guest's comments sheet opens on the same reel when the
  host opens theirs and closes when the host closes, with a pulsing “Host is
  reading” badge in the sheet header. A guest can still open comments alone —
  the follower only reacts to a change from the host.

## 2026-10-29 — Story layers you can place without a precise drag

- The selected-layer toolbar was one horizontally scrolling strip, so on a 360px
  phone the rotate dial, the fonts and the colours sat past the fold — "rotate"
  and "font" looked missing and a drag was the only way to place words. It is a
  panel now with three tabs: **Move**, **Font** and **Colour**.
- Move carries a nudge pad (four arrows, 1.5% of the canvas per tap, the centre
  button snaps the layer back to the middle), a rotate stepper at ±15° with a 0°
  reset and a −180…180 fine slider, and size steps from 0.2× to 4×. Every step
  is undo-safe and clamped to the stage, so "drag" is no longer the only way to
  line a caption up.
- Font shows each family as its own card, drawing its name in that typeface, so
  the choice is made by shape rather than by reading four labels. Colour holds
  the eight swatches (32px, with a white ring on the current one) and the
  Living-text toggle.
- Text and sticker layers gained 10px of padding on their drag box. A two-letter
  word used to be a ~30px grab target that a thumb missed; the words themselves
  stay centred on their own x/y.

## 2026-10-29 — Discord's +, the Rizz library, and a reply that opens the keyboard

- Every chat composer — DMs, groups and realms — now opens the same attach
  sheet from one `+`: Photo (library), Camera (the lens, not the library), Poll
  and Schedule where the surface has them, and the Rizz library. The photo-only
  icon and the realm's bare `+` are gone, so nothing is discoverable only by
  guessing what an icon does.
- The Rizz library inserts Unicode emoji and kaomoji straight into the draft —
  searchable, four packs (Faces, Hype, Soft, Chaos), one tap from the `+`. Media
  picked from Photo/Camera still compresses, uploads and travels with the
  message.
- Replying behaves like Discord on a phone: tapping Reply on a message focuses
  the composer (so the keyboard opens) and re-pins the chat to the newest
  message while the viewport settles, instead of leaving the reply bar under the
  keyboard. Groups gained reply at all — a bar above the box, a Reply action on
  the message, and the quote carried in the body so it survives a reload.
- The reaction sheet drops its twelve-cat grid. Sixteen Rizz reaction emoji take
  its place: plain Unicode, readable at 14px in a chip, and free to render.
  Existing `:cat_*:` shortcodes still render in old messages and reactions.

## 2026-10-29 — A better cat, a real face, and photos in realms

- The twelve cat emoji are redrawn. One silhouette — ear pair plus head circle,
  one rim light — and much bigger features: 9px eyes with pupils and a
  catchlight, blush, a lime nose, and expressions that live in the eyes and the
  mouth instead of in decoration. The sleeper's z's are drawn as paths now, so
  they no longer depend on whatever font a phone happens to have.
- The comment box shows your actual photo. When an account has no picture it
  falls back to the cat the app already gives that account, not a lime letter.
- Realms can send photos. The composer's bare `+` now wears the photo icon and
  keeps polls and scheduled messages one tap inside; a picked photo previews
  above the composer, compresses, uploads to the same bucket DMs and groups use,
  and travels with the message as `attachment_url` — alone, or with a caption
  that is never mistaken for a slash command.
- Composer rows line up: the emoji picker takes a `triggerClassName`, realms run
  one 44px row, and the comment box matches its picker to its send button.
- The emoji loop only pays for an `IntersectionObserver` when something is
  actually looping; a picker of twelve faces used to create twelve observers
  that never had anything to pause.

## 2026-10-29 — The streamer badge finds its centre

- The broadcast mark's box sat 1.5 units high in its 24 grid — the arcs reach
  further above the tower than the tower sits below them — so the sprite's own
  centring guard caught it 7.1% off the optical centre. One `translate` moves
  the whole stamp down; the drawing itself is untouched.

## 2026-10-29 — Reactions with a pulse

- Every reaction glyph in the app now comes from one animated primitive, so a
  unicode emoji and the cat emoji behave the same whether they sit in a chat
  picker, under a post or in a comment thread. A glyph wobbles when you hover or
  focus its tile, springs into place with a small ring when a reaction lands,
  and can idle-bob where that reads better — all in CSS keyframes, so nothing
  extra is downloaded for a hundred-comment thread.
- A reaction pops only when it is *new* to that row. The pill you just added
  arrives with a spring, existing pills stay still until touched, and a chat
  chip that gains a reaction pops too. The old tile-wide `scale-110` hover zoom
  is gone, so the emoji moves instead of the button.
- Icons answer the pointer as well: Reply, React, Delete, the vote chevron and
  the fold arrows lift a pixel on hover and give under a press.
- All of it is switched off by `prefers-reduced-motion` and by the app's own
  reduced-motion switch, the same way the cat emoji already were.

## 2026-10-29 — One comment thread, nested for everyone

- Comments finally thread. A reply is grouped under the comment it answers
  instead of sitting somewhere later in a flat chronological list, a branch says
  how many replies it holds and folds away, and indentation stops growing at six
  levels so a long argument cannot squeeze the text into a column. A page that
  arrives without its parent — deleted, or older than the last hundred rows —
  keeps its replies as a top-level comment rather than losing the branch.
- Every reply can be voted on, reacted to with the app's own emoji and cat
  emoji, answered again, or deleted by whoever wrote it. Deleting asks first,
  then soft-deletes: the row stays as a tombstone while anything still answers
  it, and vanishes once nothing does. Replies pointing at a tombstone say so
  instead of looking like they answer nobody.
- The four surfaces are one component now. The full-screen post sheet, the
  thread that drops open under a feed card, the desktop discussion pane and
  reel comments all mount `CommentSection`, so reply, votes, reactions and
  delete are identical by construction — reel comments had none of them before.
  Votes and reactions used to be fetched one comment at a time; a page of
  comments is now two reads total.
- Reactions open a tray with six quick emoji, a wider grid and the cat set,
  the composer grows with the draft, keeps it when a send fails, sends on Enter
  and breaks the line on Shift+Enter, and a signed-out reader gets a sign-in
  path instead of a dead box. `@mentions`, `#tags`, links and GIF/sticker
  bodies keep the chips they had.

## 2026-10-28 — Story text moves again on a phone

- Pressing the move handle blurred the caret, that blur closed the editor, and
  the handle unmounted while the finger was still holding it. iOS answers an
  unmounting capture target with `pointercancel`, so the drag died on its first
  move — text simply would not move on mobile. A live gesture now claims the
  layer and the caret's blur is ignored for that one layer until release, where
  the text commits as before; a blur from anywhere else still closes the editor.
- The layer follows the pointer's delta instead of its grab point, re-read from
  the stage every frame. When the phone keyboard collapses under the gesture the
  stage resizes, and grab-point maths applied the stage's own movement to the
  layer — flinging the words across the canvas.
- The handle is a 40px touch target that drops the caret itself, so the keyboard
  gets out of the way before the finger starts moving.

## 2026-10-28 — The cover vignette, and a wash that reaches the fold

- The profile cover carries an edge vignette: light falls from the top centre,
  the corners roll into the theme colour and a faint 1px rim keeps the edge
  crisp, so a banner reads as a surface with light on it instead of a flat
  rectangle pasted above the name. It sits under the avatar scrim, so the
  overlap and the buttons are unaffected.
- The profile wash now fills the scroll pane. The container stopped at
  `min-h-[70vh]`, so a short profile ended on a hard line where the gradient
  stopped and the app background began; it now cancels the pane's own gutters
  and grows to fill it, and the theme runs to both edges without a seam.

## 2026-10-28 — Reel party, and mentions in every comment

- Reels can be watched together. The people icon beside Upload opens a room;
  the host's swipe, play, pause and seek are broadcast over a Supabase Realtime
  channel and guests follow the same feed and playhead. A six-character code or
  `/reels?party=CODE` link is the whole invite, presence counts the room and
  says when the host leaves, and nothing is written to a table — closing the
  tabs ends the party.
- Reel comments now draw `@mentions` through the caption renderer, and post
  comments use the same chip, so a mention is highlighted and one tap from the
  profile on both surfaces instead of plain text.
- The Purify subscriber mark is redrawn as an amethyst cat-ear crest with a
  two-stroke halo, inner vignette, inset rim and a white lotus over a gold
  flame. The sprite keeps the mark filter-free for 20px rows and share cards.
- Badge artwork is fetched with a version query, so a browser-cached sprite
  cannot keep showing the previous drawing after a deploy.

## 2026-10-28 — Verified is its own blue seal

- The `verified` badge is redrawn from the supplied mark: a twelve-lobed azure
  seal with a thick white check, a two-stroke blue halo (no filter — it stays
  cheap in a 20px name row and on the canvas share export), an inner vignette
  that darkens the scallops, an inset rim and a specular edge. It is one vector
  symbol, so the same art is used beside names, in the badge tray, on `/badges`,
  in share cards and in the reels creator pill.
- The reels “Verified” pill now uses an azure border and tint instead of lime,
  so the identity mark no longer reads as one more tier badge.
- The profile preview puts its badge tray on the name row, immediately right of
  the name — the same place the full profile already had it — instead of under
  the handle. The worn badge keeps its ring, and details still open as a sheet
  so the Message / Follow row stays clear.
- `VerifiedSeal` is redrawn to the same seal for any surface that needs the
  mark without the badge row.

## 2026-10-28 — The cover holds the wash, and the spider retires

- A gradient profile no longer paints a dark 3:1 plate over its own cover. With
  no banner photo, the header's banner box is glass
  (`GRADIENT_COVER_BACKGROUND` in `src/lib/banner.ts`), so the theme runs from
  the very top of the profile; the faint bottom lift keeps the avatar and name
  readable where they overlap it.
- The profile theme now fills the surface it is painted on instead of stopping
  at an 820px band, and it gains a vignette (`PROFILE_VIGNETTE`): the wash fades
  darker toward the edges and the bottom, so it reads as light on a surface
  rather than a flat rectangle that visibly cuts off partway down. The solid
  tint underneath is unchanged, so a very tall profile still lands without a
  seam. The same theme feeds the preview sheet, the editor and the profile card.
- The **Web Slinger** profile effect is retired: its art is no longer in the
  effects registry, and `20261109000000_retire_web_slinger.sql` deletes the
  catalogue row, cascading ownership away. It can no longer be bought, worn or
  drawn anywhere; Silk Veil keeps its own silk scene.
- Tapping a chat composer lands on the newest message for real now. The old
  one-shot `scrollTop` write ran before the on-screen keyboard resized the list,
  so the jump stopped short. The shared `scrollChatToLatest` helper repeats the
  jump across the next frames and follows `visualViewport` while the keyboard
  settles — on `/dm/$userId`, `/g/$id` and `/r/$slug`.

## 2026-10-28 — Chat: reaction pills, Discord hover actions, clean media

- Reaction chips are a row again. The shared chip row carried `flex-wrap` but
  not `flex`, so each pill became its own block and reactions stacked vertically
  in DMs, groups and realms. Chips are now 26px Discord-style pills on one
  wrapping line, with a quiet lime tint for the ones you added.
- A photo that fails to load says so and offers **Retry**, instead of collapsing
  into an empty grey sliver where the picture should be.
- Image-only messages no longer carry the words “📷 Image”: the composer stops
  writing that placeholder, and older messages hide it, so a photo stands alone.
- Desktop gets Discord's affordance: hovering a message shows a small toolbar
  with quick-react (opens the reaction picker) and more (opens the actions).
  Touch keeps the long-press sheet, and the DM menu no longer dims the whole
  conversation on a desktop popover.
- Jumping to a message is a soft lime wash that fades out, not a hard 2px ring
  drawn around the full-width row.
- Tapping a chat's composer now lands on the newest message; realm chat was the
  one surface that left the reader scrolled up.

## 2026-10-28 — Toasts show their whole sentence

- The toast pill was clipping itself: `truncate` on the title, plus a hard
  `max-w-[46%]` on the message, so a receipt like "Cancelled — 10 Paws fee / 90
  Paws came back to your wallet." was cut off in the middle of the numbers.
- The card wraps now. Title and message share one line when they fit; when they
  do not, the message drops to a second line, indented past the type dot. Width
  is still content-driven and the corners still read as a capsule, so a short
  receipt looks exactly as it did. The cap moved from 21rem to 23rem, which is
  enough for a typical two-clause receipt on one line on a phone.

## 2026-10-28 — Finished bounties leave the board, story text drags

- `/drops` lists only work that can still be acted on. A paid, cancelled or
  expired escrow bounty is finished, and so is a legacy open call whose every
  claim has been taken; `activeBounties()` filters both the board and the "Your
  desk" tab, so a completed bounty no longer sits in the list as a dead row.
- Story text can be dragged again. The "Drag to move" handle committed the edit
  on press, which unmounted the element holding the pointer capture — iOS
  cancels the pointer of a captured element that leaves the DOM, so the drag
  died on its first move. Text now commits when the finger lifts.
- Dragging is direct manipulation now: the layer follows the point you grabbed
  instead of snapping its centre under your finger, a tap only selects (no new
  undo step), pointer capture is guarded against Safari's throw on detached
  nodes, and dropping a layer on the trash works — the drop used to read a
  stale state closure and never fired.

## 2026-10-28 — The badge emblems, minted as one set

- Every emblem in `public/badges/badges.svg` is redrawn on one system: a
  same-colour round-join silhouette stroke (one corner radius across the set), a
  single top-left tier gradient, an engraved inset rim, one ink glyph with a 1.7
  stroke floor, and one white specular. Nothing in the art depends on detail
  that dies at the 20px name row.
- Three legibility bugs went with it: the Early Member ring hid its own numeral
  inside the hole (it is a gold coin now), the Rising Star's ink centre read as a
  hole (now white), and the Top Rizzler crown was heavy enough to look like a
  hole punched in the shield.
- Silhouettes no longer repeat: HypeSquad's bolt sits in a diamond rather than a
  third shield, Night Owl is a true two-arc crescent, the 30-day flame moved into
  a hex crest, and Meme Lord / Streamer / Creator keep distinct tiles.
- `tests/badge-artwork.test.mjs` rasterises every emblem at 240px (draws, not
  clipped, centred, sane coverage) and compares all twenty at 20px in colour, so
  a future edit cannot quietly ship a blank or look-alike badge.

## 2026-10-24 — The trending rail reads as a feed card

- The rail between the composer and "LATEST DROPS" is now an ink card of its
  own (`--brand-ink-2`, same as a post) with taller padding and extra space
  above and below, so it no longer hugs either neighbour.
- "Trending" and its icon are lime and set as a small uppercase section label;
  the chips sit on one non-wrapping row that scrolls sideways. Each chip is a
  fixed-height pill with a subtle border, lime `#`, paper-white tag name and a
  small muted count badge on the right (compact numbers via `formatCount`).

## 2026-10-24 — Feed cards keep their ink text in Paper mode

### The unreadable card
- `.feed-post-card` paints itself with the fixed ink token (`--brand-ink-2`) in
  every mode, but it inherited the page's text palette. In Paper mode that
  palette flips to `#15151a`, so the display name and caption rendered at
  1.02:1 against the card — black on black — while the muted handle stayed
  visible.
- The card now re-declares the ink palette for its own subtree when the page is
  in Paper mode (`--foreground`, `--muted-foreground`, `--primary` and the
  hairline border), so its name, caption, handle, footer and tag links read
  exactly as they do in dark mode (16.4:1 for body text) and lime mentions are
  unchanged. The rule is scoped to the card, so paper surfaces such as
  "Suggested for you" keep their dark text, and dark/AMOLED modes are untouched.

## 2026-10-23 — Four name-row marks, and a frame that clears the name

### The frame no longer covers the display name
- Ivory Filigree is drawn at 1.5× the avatar box. The header only reserved the
  photo's height, so the frame's lower edge sat on top of the display name in
  the preview sheet and on the profile page. The identity block now reserves
  the frame's real overhang (`--avatar-overhang`), which is 0 for vector rings
  and 25% of the avatar when a cut-out frame is worn — so the name clears the
  art without adding space for members who wear nothing.

### One row, four marks, no plate
- The badge line beside a name is now exactly four marks — Verified, Streamer,
  Bounty Hunter and Purify — in that order. The `/badges` shelf already reads
  the same list, so Main Character, Voice of the Realms and the RIZZ Team mark
  cannot come back even though old `user_badges` rows still exist.
- Feed and forum name rows now read that lineup too, instead of rendering every
  earned award and a "+N" overflow chip. A post can show all four marks without
  a second row.
- The preview sheet's badges lose the rounded tray: plain marks under the
  handle, like Discord, instead of a floating pill beside it.

## 2026-10-23 — Profile effects stop at the tab line, with real transparency

### The hero clip
- The worn scene used to spill past the banner across the stats, bio and tab
  bar, and a full-profile wash tinted the whole timeline. The profile now wraps
  its header, stats, bio and tab rule in one clipped hero: the scene and the
  wash end on the same line as the profile gradient, and nothing paints over
  the posts below.
- The scene box keeps its banner anchor, so the avatar/name block still sits
  above it, while the wash sits at the hero's backdrop layer and never takes a
  tap.

### The plate is gone, not faded
- Petal Bloom is re-rendered with a real alpha channel (VP9/WebM keyed from its
  luminance) and a transparent PNG poster, so the clip composites as itself:
  no `mix-blend-mode: screen`, no 30% opacity, and no dark rectangle where the
  plate used to be. It sits inside the hero clip on the profile, and the feed's
  preview sheet now carries it too.
- The compact profile card (realms, leaderboards, hover) wears the same avatar
  decoration and profile effect as the full profile; it previously dropped
  both.

### One pass per visit
- The scene's silk sway and the wash play once when the profile opens, then
  hold still (`fx-once`) instead of looping forever under the tab bar.

## 2026-10-23 — Profile preview sheet: one surface, one height, one cover

### The empty gradient band above the cover
- The sheet's tinted surface lived on the static Radix box while only the
  content was draggable, so every pull slid the cover down and left a tall
  empty band of the profile's gradient above it. The radius, safe-area padding
  and theme tint now live on the dragged card itself: the whole sheet moves as
  one object and nothing can separate from its own background.
- A swipe past the threshold keeps travelling from the finger's last position
  and closes when it is off screen, instead of snapping to 0 and then playing a
  second, unrelated close animation.

### The jump when the profile arrived
- The loading skeleton now mirrors the finished anatomy (3:1 cover, overlapping
  avatar, identity, both action rows, bio block, member-since row, activity),
  so the sheet keeps its height while the profile row loads.
- The panel no longer scales from 0.985 on arrival — only the sheet itself
  fades and settles once, so the cover never nudges after the sheet is open.

### One motion, one cover
- `styles.css` had two `.profile-sheet` open/close keyframe sets; the later one
  silently overrode the other. The preview keeps its documented fade-and-settle
  and the account sheet keeps its rise.
- Image banners now paint on an opaque base colour. The `background` shorthand
  had reset background-color, so a cover that was still decoding — or failed —
  showed the sheet's tinted theme through it, which read as the cover swapping
  images. The banner URL is still derived only from the selected profile; there
  is no rotation, and neither render path calls randomness.
- An avatar nested inside a row that already owns a preview no longer opens a
  second sheet on top of it; the row's trigger owns the one preview.

## 2026-10-23 — Two premium pieces: Petal Bloom and Ivory Filigree

### Petal Bloom — a full-profile decoration
- The petal clip runs behind the profile header, cards and buttons as a
  screen-blended wash: the clip's black plate vanishes in the blend, so no alpha
  channel or heavy overlay is needed on mobile. Page intensity is 72% of the
  banner wash, which keeps text at full contrast.
- It is muted, looping, inline-playing and `pointer-events-none`, so every tap
  still lands on the profile underneath. `prefers-reduced-motion` — and the
  member's own reduced-motion setting — swaps it for a still poster.
- One decoder per page: the header skips page-wide effects, and the overlay is
  mounted once on the profile route.

### Ivory Filigree — a cut-out avatar frame
- The frame was traced off the clip into a transparent RGBA PNG (no white
  plate), scaled to 1.5× the avatar so its square opening lands just inside the
  photo edge. It is drawn *behind* the avatar, so the photo masks the frame's
  inner edge instead of the ornament covering the face.
- A slow drift keeps it alive; reduced motion freezes it.

### Both cost 2,099 Paws or $1.99 on card
- Seeded through `purchase_profile_effect`, so the price, the wallet and the
  one-per-category rule all stay server-side. The shop card shows the Paws price
  with the card price beside it and opens the real profile for a preview.

## 2026-10-23 — The effects shop: chubby frames and silk profile scenes

### Two shelves, priced in Paws
- `/shop` is back with exactly two categories: **avatar decorations** (a frame
  around the photo) and **profile effects** (a scene over the banner). Cards are
  live art with rarity, price, owned and worn states; the wallet sits in the
  header with a link to earn Paws from bounties.
- Unlocking, wearing and removing all go through the existing server RPCs
  (`purchase_profile_effect`, `equip_profile_effect`,
  `unequip_profile_effect`), so the wallet and the one-per-category rule stay
  server-side. The browser still never writes `user_profile_effects`.

### Art drawn in the app, on transparency
- **Chubby Cloud** is a single scalloped cream ring with blush cheeks and lime
  sparkles; **Chubby Paws** pads six fat paws around the rim; **Chubby Bloom**
  circles plump hearts with tiny leaves. All three are inline SVG with no plate
  and no bitmap, so they sit directly on the banner.
- **Web Slinger** and **Silk Veil** stretch sagging corner webs over the banner
  with a small spider swaying on a thread. Motion is transform/opacity only and
  stops for `prefers-reduced-motion` or the profile's reduced-motion setting.

### Preview, then wear it
- Tapping a card opens the effect on the member's own 3:1 banner, avatar and
  name using the real `ProfileHeader`, so the preview is the finished look.
- Worn cosmetics render on the full profile and in the feed's profile preview
  sheet — visitors see exactly what the member equipped.
- The new migration seeds the catalogue and clears the old rights-review hold;
  apply it to Supabase for the shelves to populate.

## 2026-10-23 — One badge tray, and a preview that opens on the cover

### The sheet starts with the banner
- The phone preview no longer has a black grab-handle strip between the sheet
  edge and the cover: the banner meets the rounded top edge and a small capsule
  grabber floats over it. The banner itself stays draggable, as before.
- The compact header now uses the same 3:1 cover as every other surface, so the
  preview reads as a taller card instead of a cropped strip.

### Badges read as one object
- `BadgeLine` grew a `tray` variant: a rounded, hairline-bordered row. The
  preview's five marks moved out of the display-name row and into that tray on
  the handle row — one row, 26px marks instead of 20px specks.
- The full profile's name-row marks go up to 24px for the same legibility.

### Archive removed
- The `/badges` "Classic RIZZ badges" archive card is gone. Those awards still
  live in the catalog grid and keep their own detail panel, so nothing is lost.

## 2026-10-23 — Screen share that connects, rounds that keep running

### Screen share
- The screen transceiver is negotiated in every call, so a muted video track
  arrives even when nobody is sharing. The stage counted that as a share and
  painted a black window over the call for everyone; only a live, unmuted track
  is published now, and `mute`/`unmute`/`ended` re-evaluate it.
- Capture retries with plain constraints when a browser rejects the frame-rate
  hints, and failure messages carry the browser's own explanation.
- Built-in games are canvases, so they stream through `canvas.captureStream`:
  no picker, no permission, and it works on phones, where the Screen Capture
  API does not exist. `Share` on a phone also falls back to the mounted game,
  and a browser with no capture path says so in one sentence.

### Rounds keep running
- The call view stays mounted when minimized — invisible, scroll unlocked — so
  the in-call game, shared screens and the participant grid survive leaving the
  call and browsing the feed. Portalled sheets close on the way out.
- The game overlay drops to its pill when the call view closes and stays laid
  out rather than `display:none`, so a canvas game keeps its size and its
  frames keep flowing in the background.

## 2026-10-22 — Inline badge glyphs and a five-mark showcase

### One SVG per badge
- `BadgeGlyph` draws Main Character, Bounty, Purify, Verified and Streamer as
  inline 32×32 hexagons with their own accent and loop. `Badge` routes those
  five slugs to it; legacy slugs keep the sprite. 16px is static until hover,
  24px+ idle, 64px adds a one-time entrance; all motion is transform/opacity/
  dashoffset and freezes under `prefers-reduced-motion`.

### Showcase page
- The shelf is the five profile marks, not thirteen; counts and the progress
  bar measure that list. Progress is clamped (`Math.min(current, target)`,
  width capped at 100) and reads **Completed** instead of a negative number.
- The page is wrapped in `.badges-page`: warm ink surfaces, cream type,
  Bricolage/DM Sans, a red accent, and scoped rules that replace the lime chips,
  borders and Award button. Cards fade up in a 40ms stagger.

## 2026-10-22 — Five marks, live counters, Rizzy sells Purify

### The profile badge lineup is fixed
- A profile shows five marks at most, in one order: **Verified, Streamer,
  Purify, Bounty Hunter, Main Character**. Everything else a member owns lives
  only on `/badges`.
- `streamer` is a real catalog badge now — a purple mic disc in the sprite,
  its own `BADGE_SET` entry — so it can be earned, drawn and counted.
- All five name-row marks use `AnimatedBadge` (aura + seven motes) and every
  mark is a button into `/badges`.

### Activity numbers are doors
- Posts opens the Activity tab and scrolls to it; Followers/Following open
  their lists; Badges opens the gallery; Paws opens `/drops`. The four-cell
  strip and the lifetime grid now share the same `openActivity()` map.

### Purify is introduced by Rizzy
- The `/purify` page opens with a Rizzy card that explains the tier in the
  mascot's voice, so the upgrade is introduced instead of discovered.
- `20261103000000_purify_gift.sql` gifts a year of Purify to the `jimmy` demo
  account and fixes the guard so migrations (where `auth.role()` is null) can
  still write the entitlement while signed-in clients cannot.

## 2026-10-22 — Badges: a shelf, a limit and a living mark

### Badges are links, not popouts
- `BadgeDetailDialog` is deleted. A badge on the full profile, the preview card,
  the hover card or the Badges section now navigates to `/badges`; that removes
  the mobile popout that opened half off-screen.

### Five marks, Purify first
- Profile name rows cap at five badges (`withPurifyBadge(...).slice(0, 5)`), and
  a Pure member's mark is prepended, so the subscriber badge is never the one
  that gets cut.
- The Purify star is a real sprite symbol (`#purify`) added to
  `public/badges/badges.svg`; it is not a `badges` row, so it can never be
  awarded by hand or kept after a subscription ends. The badge page shows it
  only to an active subscriber.

### Genuine particle motion
- `AnimatedBadge` draws seven motes and a soft aura around the mark on one CSS
  timeline. Only `transform` and `opacity` animate, with `will-change` on the
  motes, so five badges cost the compositor and never repaint the name row.
- `prefers-reduced-motion` freezes the motes; nothing shakes or bounces.

## 2026-10-22 — Purify: the $1/month tier

### One entitlement, written by Stripe only
- `profiles.purify_until` is the whole entitlement: Pure while the timestamp is
  in the future. `stripe_customer_id` / `stripe_subscription_id` let a webhook
  find the member. A `BEFORE UPDATE` trigger copies the old values back whenever
  the writer is not `service_role`, so a member can never grant themselves
  Purify from the client.
- `src/lib/purify.ts` owns the price, the benefits, the 10 MB/50 MB chat caps
  and `usePurify()`. Enforcement sits behind `VITE_PURIFY_ENFORCED`: the gates
  ship now, the app stays free until billing is connected, and nothing shrinks
  before then (the legacy 15 MB chat cap is kept).

### Checkout and webhook
- `POST /api/purify/checkout` opens a Stripe subscription Checkout session for
  `$1 / month` (REST + fetch, no SDK in the server bundle) and returns 503 with
  a readable message until `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` exist.
- `POST /api/purify/webhook` verifies `stripe-signature` over the raw body with
  Web Crypto (5-minute tolerance), then grants or clears `purify_until` from
  `checkout.session.completed`, `invoice.paid` and subscription status events.

### What Purify unlocks
- Profile gradients and banner photo uploads ask for Purify; clearing a gradient
  or removing a banner stays free, and existing banners/gradients are kept.
- GIFs are a Purify feature inside the shared `GifPicker` (emoji and stickers
  stay free); chat images go from 10 MB free to 50 MB with Purify.
- `/purify` is the only billing page: price, five benefits, active-until line
  and the checkout button. Settings links to it.

## 2026-10-22 — Effects retired, clean DM photos, shared popout motion

### The effects shelf is gone
- Deleted the whole cosmetic system: the `/effects` store, the four effect
  renderers and their CSS, `effect-registry`, `effects`, `useEquipped` and the
  receipt helper. The More sheet, command palette, voice commands, settings hub,
  `/drops` and the profile "Use Paws" button no longer point at it.
- One shared `ProfileHeader` still paints every surface (settings preview, card,
  preview sheet, full profile); it now renders the plain avatar instead of an
  equipped decoration. `IncomingCallRinger` uses the same plain avatar.
- `20261101000000_retire_effects.sql` clears `profile_effects`; owners cascade
  with it, so no profile can keep wearing a retired overlay. The tables and the
  Paws ledger stay for history.

### DM photos own their frame
- A photo in a DM no longer sits inside the green outgoing bubble. Any message
  with an attachment uses `message-bubble--media` (no gradient, border, shadow
  or padding), and its caption renders under the photo in `.chat-media-caption`
  — same width as the image, normal line height, emoji at text size.

### Popouts open like one object
- The desktop profile preview and the badge detail card share `.popout-card`:
  a 220ms rise-and-settle open and a 150ms close, collapsing to 1ms under
  `prefers-reduced-motion`. Phones keep the existing spring sheet.

## 2026-10-22 — Profile editor in parts

### One part per screen
- `/settings/profile` is no longer one long form. It opens a hub with the live
  preview and three rows — **Photo, name & bio**, **Banner & glow**, and
  **Interests** — each showing what is currently set (display name, banner
  preset, `3 / 6`).
- Tapping a row opens that part on its own screen (`?part=identity|banner|interests`),
  with a back link to the hub, so the back button and a shared URL both work.
- Saving is per part: name/bio, glow colour and interests each write only their
  own columns instead of one button rewriting the whole profile. Banner photo
  and gradient still apply the moment they are tapped, as before.

## 2026-10-22 — Profile Activity tab and effects that fit the card

### Activity replaces the games rail
- The profile's middle tab is now **Activity**. It keeps the lifetime counters
  (Posts, Likes, Comments, Reactions, Followers, Following, Badges, Paws) — all
  read from rows the page already loads, so no extra round trips — and lists
  the newest posts, reels, realms and communities with relative timestamps.
- The first-party arcade shelf is gone from the profile; `/games` still hosts
  the whole arcade, and the in-call game strip is untouched.

### Settings: back, joined date, no tour row
- The Settings hub has a back control in its header (history back, falling
  back to the feed), matching the chevron every sub-page already had.
- The live profile preview now carries `Joined Oct 2026` beside `@handle`,
  with the Rizz mark, exactly like the full profile. `profiles.created_at` is
  now part of the auth profile type so any surface can read it.
- The welcome tour is first-run only. The replay event, `startWelcomeTour`,
  the Settings row and both account-menu entries are gone; the host starts the
  coach marks only while `tutorial_seen` is false and never reopens them after
  the single completion write.

### Preview card: a glow, not a ring
- The preview avatar no longer draws a hard accent ring. `ProfileHeader` takes
  an `avatarGlow` colour and paints a two-stop accent halo (22px at 45%, 64px
  at 18%) behind the photo — quiet enough for a banner photo, still readable.
  The full profile keeps no halo; an equipped avatar decoration replaces it.
- The avatar is aligned to the left edge of the header gutter (only an 8%
  overhang allowance remains) on every profile surface, instead of being
  pushed right by a `10% + 8px` inset.

### Effects that fit the preview card
- Every surface (preview sheet, hover card, settings preview, full profile)
  renders the same `ProfileHeader`, so an equipped Puppy Love, Bloodweb or
  Dark Moon shows on all of them — `tests/profile-effects.render.test.tsx`
  now renders all three slots together and locks that wiring.
- Dark Moon's moon sits fully inside the banner now (it used to lose its top
  edge on the short card) and Puppy Love's card crop is anchored to the banner
  floor, so Biscuit stands on the frame instead of floating mid-banner.
- No profile card is downloadable: the download action and renderer are gone.

## 2026-10-21 — Profile pass: one gradient everywhere, Main/Games tabs, tappable badges

### One gradient, painted across the whole profile
- `src/lib/banner.ts` is the single source of truth: sixteen presets plus a
  custom two-colour sheet with an angle, and one shared `ProfileHeader` for the
  settings preview, hover card, popup and full profile.
- The chosen gradient now paints the full profile page behind the banner and
  content as a darkened theme; uploaded banner images stay independent and still
  own the 3:1 banner box.

### Motion: fades, not slides
- The profile preview panel, mobile sheet and activity switch fade and settle
  with a hair of scale instead of travelling in from the side or bottom. Hover
  lifts are replaced by scale/brightness and border emphasis, and the tab
  underline fades rather than sweeping.

### Profile page
- Name row with the verified seal, up to six tappable badge marks, presence,
  join date and the header actions (Message / Follow / Edit profile / share and
  a block menu) sitting beside the name instead of in a separate toolbar.
- A four-cell stats strip (Posts / Followers / Following / Paws), an About Me
  card that holds the bio and interests, and stronger Discord-style buttons.
- Tabs are now **Main · Games · Paws**. Main keeps posts, reels, realms and
  groups behind a compact activity switcher with crossfade transitions; Games
  adds a real arcade shelf (nine first-party games, the member's device-local
  win count, and a straight in to `/games`).
- Saving your profile in Settings now takes you to your full profile instead of
  leaving you on the editor.

### Badges you can tap
- Any badge on the profile name row, the showcase and the preview opens a
  Discord-style popout: big vector emblem, tier, meaning, earned date, and — for
  the owner — one tap to wear it beside their name or clear it.
- The badge chip itself lifts on hover and shows focus rings, so badges are
  real controls rather than decoration.

### Effects shop
- Shelf filters for the three slots, an owned-only toggle, a three-step "unlock
  → wear → shows everywhere" strip, stronger full-width CTAs (Equip, Unlock,
  Remove), and an "Earn N more Paws" link when the wallet is short.

## 2026-10-21 — One profile size, clean presence, gradient banners and a real shop

### One profile, two ways in
- The preview sheet and the profile card now share the same proportions:
  160/176px banner, 96px avatar, 22px name, 400px desktop popout and the same
  90dvh mobile cap. The preview also gets a visible close button.
- The presence dot was painting **behind** the photo, leaving a clipped crescent
  and making Online/DND look broken. It now sits above the avatar everywhere and
  uses the real Discord shapes (circle, idle moon, DND minus) instead of a flat
  colour dot. Custom-status badges sit above the photo too.

### Puppy Love fits the banner it is on
- Biscuit is measured with a ResizeObserver: cards get the full pup at a smaller
  scale, short shop previews step down again, and wide banners get a top-anchored
  bust. `xMidYMin` keeps his head in frame instead of cropping it, and the ground
  shadow scales with him.
- Every Puppy Love instance now namespaces its SVG gradients and filters with
  `useId`. Two copies on one page (a feed card plus an open preview) used to
  resolve `url(#plx-…)` against the first SVG and could flatten or grey out.
- The preview banner clips its effects, so hearts, bokeh and paws can no longer
  spill over the name and About Me rows.

### Gradient banners like Discord
- Profile settings gain a **Banner gradient** picker with seven presets plus
  None, a live preview and a remove-image action. An uploaded banner still wins;
  the chosen preset follows the member to previews, cards, the account menu and
  the full profile.
- Migration `20261101000000_profile_banner_gradient.sql` adds
  `profiles.banner_gradient` and teaches `get_profile_card()` to return it,
  `accent_color` and the featured badge.

### The effects shop is a shop
- A wallet panel shows Paws, collection progress and how many looks are worn.
  Cards now carry status pills, detail chips and a shop-style receipt flow.
- Unlock now opens a **Review order** sheet first: item, slot, rarity, wallet
  balance, the spend and the balance after. The server confirms the price and
  the receipt opens only after the Paws transfer succeeds.
- Every purchase opens an **Order complete** receipt with order id, account,
  item, slot, rarity, price, balance after and status. Receipts download as a
  styled standalone HTML page or a plain-text copy, and recent orders stay on
  the device so they can be opened again.

## 2026-10-21 — Unlock fixed, and every look gains another layer of detail

### Unlocking actually reaches the server
- The shop called the untyped Supabase helper as a detached function, so
  `purchase_profile_effect` died before the request left the browser with
  "Cannot read properties of undefined (reading 'rest')". The helper now calls
  `from`/`rpc` on the client itself, which fixes unlocks and the same latent
  failure in the leaderboard, profile-card and badge-sync calls.

### Bloodweb: a second web at the photo edge
- Added a fine rim web sized to survive a 40px avatar, with capillary forks,
  ten glowing junction nodes, two hanging drops, and light pulses travelling
  around the collar. The original outer web and slow breath remain.

### Dark Moon: a colder, deeper night
- The moon gains crater rims, a shading crescent and a blurred cloud band.
  Cold stars twinkle, a wide beam sweeps the card, ground mist drifts, ash
  falls, and the branch grows bark ridges, hanging twigs and leaves. Ravens
  now bob on individual delays and have feather rows plus a catchlight.

### Puppy Love: a finished hoodie
- Biscuit gets a ribbed cuff, drawstrings with aglets, a zipper, kangaroo
  pocket, stitched seams, ear fluff, forehead tufts and cheek highlights.
  Bokeh breathes behind him and the strings sway with the head.

### The shelf shows the detail
- Effect previews are 192px tall with a dot-grid stage and a **Live preview**
  label. Cards gain slot/motion/transparency chips, an **Owned** state, and a
  tinted outline when a look is worn.

## 2026-10-21 — Profile previews at Discord scale, an accent glow and a real seal

### The avatar is lit, not boxed
- The profile card now draws the member's accent as a **soft glow** instead of a
  hard colour ring: a dark separator, a close bloom and a wide, faint halo. A
  blue accent reads as blue light around the photo rather than a blue hoop.

### The preview has room to breathe
- The popout/preview banner grows from 128px to **176–192px** and the avatar
  from 88px to **104px**, so the sheet reads like Discord's profile panel
  instead of a cramped mini-card. The profile card itself follows at 184px/96px.
- The desktop popout widens to 400px; phones keep the swipe-down sheet.

### A verified seal worth the name
- The thin circle-and-tick beside verified names is replaced by a **scalloped
  lime seal** with a bold dark check, a gradient fill and a faint brand glow.
  It renders sharp at 22–24px on profile cards, previews and the full profile.

## 2026-10-21 — Three wearable looks: Bloodweb, Dark Moon and Puppy Love

### One look per slot, worn together
- The cosmetics catalogue is a **three-slot wardrobe** now: **Bloodweb** wraps
  the avatar, **Puppy Love** plays across the banner, and **Dark Moon** frames the
  whole profile. Each slot equips independently through the secure
  `equip_profile_effect()` RPC, so a member can wear all three at once.
- **Bloodweb**: an original transparent vector collar of red veins and glowing
  nodes that breathes and pulses around the photo at any avatar size.
- **Dark Moon**: a gothic frame with a bone-white moon, black branches, four
  red-eyed ravens and cold light falling across the banner. Vector and
  reduced-motion aware like Puppy Love.
- A profile frame has its own `profile_frame` enum value, separate from the old
  nameplate type that nothing uses.

### The effects page is a real shelf
- `/effects` is now a three-card gallery with live previews of the actual art,
  Paws balance, one-slot-per-type ownership, **Unlock · 1,400 Paws** for looks
  the member does not own, **Equip** for owned ones and **Remove** for the worn
  one. Purchases go through the server wallet RPC; no direct table writes.
- Equipping or removing invalidates the shared `equipped` cache, so the profile
  page, account menu, profile cards and previews update at once.
- Migration `20261031000000_profile_frame_type.sql` adds the frame slot and
  `20261031000100_bloodweb_dark_moon.sql` seeds the two looks; Puppy Love keeps
  its row and owners.

## 2026-10-21 — Rizzy floats over the real feed, and the account menu grows up

### The welcome tour is a coach-mark layer, not a slide deck
- The eight-scene card is gone. Rizzy now appears as a **transparent cat over the
  live feed**, with a dimmed page, a soft spotlight around the real control and a
  small speech bubble pointing at it.
- Steps spotlight the real composer, stories strip, first post and like button,
  Realms and Bounties in the sidebar (More on phones), and the account menu.
  **Try it** focuses the actual composer or presses the actual heart, so the
  tour verifies the feature instead of describing it.
- New members finish profile setup and land on `/feed`, where the tour starts by
  itself; replay is one row in the account menu and Settings → Welcome tour.
  A pending invite still hands them back to the invite when the tour closes.
- `RizzyTour.tsx` and its 1,600-line deck stylesheet are deleted.

### The desktop account menu reads as a panel
- Instead of one tall 340px list, desktop opens a **540px two-column panel** with
  the effect-bearing banner, identity and stat block across the top, Account and
  More columns below, and Sign out pinned after a hairline.
- Phones keep the compact single-column sheet, now with the replay row.

### One equipped effect, every surface
- Puppy Love now rides along on the **account menu banner**, profile card
  dialogs, profile previews and the full profile, not only the profile page. One
  `useEquipped` query per surface keeps the owner and visitors in sync.

## 2026-10-21 — A lighter long-press menu, a compact realm description

### Reactions moved behind one icon
- Long-pressing a message no longer opens a permanent reaction tray. The menu
  header keeps the author, time and text, with a single **smiley** at the right
  edge of the message; tapping it swaps the sheet to a compact picker with six
  quick reactions, a collapsible wider emoji grid and the twelve cat emoji.
  The actions list is the default view again, so Pin/Reply/Delete are visible
  without scrolling.
- The picker only mounts after the smiley is tapped and the action sheet's
  rise is trimmed from the primitive's 500ms to **200ms** (`150ms` out), with a
  reduced-motion override. Opening the menu is cheaper and feels immediate.
- The redundant expand icon in the header is gone; “View message” stays in the
  action list.

### The realm description stops eating the screen
- The full description used to print as three lines of body copy above the
  room tabs. It is now a one-line strip with a chevron; tapping expands the
  full text in place (line breaks preserved), tapping again collapses it.

### Profile menu matches Discord's order
- Message/Follow (or View Full Profile on your own card) now sit directly under
  the identity block, above the stats and bio, so nobody scrolls past a long
  bio to send a message.

## 2026-10-21 — Puppy Love replaces the Web Slinger, and the tour greets new members

### Biscuit takes over the banner
- The Spider-Man-style Web Slinger effect is **gone**: component, scene CSS,
  docs and tests are removed. In its place is **Puppy Love** (`fx-puppy-love`),
  an original RIZZ character: Biscuit, a floppy-eared pup in a lime hoodie and
  heart-shaped shades, leaning into the banner with a waving paw and hearts
  floating off the edge.
- The scene is transparent inline SVG again — no raster art, no stage, no
  full-canvas rectangle — and keeps the safety rails: `pointer-events: none`,
  `aria-hidden`, off-screen pause, `prefers-reduced-motion` still frame and a
  low-end-device fallback.
- `20261030000000_puppy_love_effect.sql` **renames the existing catalogue row**
  instead of deleting it, so anyone already wearing the old effect keeps their
  fitted effect (and its uuid) under the new name, then removes every other
  cosmetic.
- `tests/puppy-love-effect.test.mjs` guards the one-effect catalogue, the
  transparent scene, the dog's parts, the motion fallbacks and the migration.

### The welcome tour is a real welcome
- New members are now sent to `/tutorial` **before** a pending invite is
  handled, on login, signup and the join page; the invite stays pending and the
  tour hands them back to it when they finish or skip. Finishing writes
  `tutorial_seen` once, and the app shell keeps holding the feed until it is set.
- The first scene greets the member by the name they just chose (“Hey Jimmy —
  welcome to RIZZ”), with a larger mascot on a lime halo, the RIZZ wordmark
  behind Rizzy, and Feed · Realms · Voice · DMs chips.
- Tour copy now describes what actually ships: Puppy Love, one profile effect,
  and no removed avatar decorations or nameplates.

## 2026-10-21 — Every badge gets its own emblem, and the preview sheet swipes

### One symbol per award
- The four legacy awards that borrowed someone else's art now have their own
  emblems: **RIZZ Team** (crest with rising bars), **Main Character**
  (spotlight star), **Voice of the Realms** (voice bubble with a waveform) and
  **The Rizz** (crowned gem). Early Supporter's shield no longer stands in for
  HypeSquad Bravery, which becomes a bolt.
- Profile previews and profile cards run the earned list through
  `distinctBadges()`, so a row never repeats the same emblem when two awards
  resolve to one symbol. `tests/badge-sprite.test.mjs` now fails if a catalog
  award reuses a symbol (the documented `no-cap`/`verified` alias excepted).
- The gallery cards are display cases: a tier-coloured wash, the emblem on a
  tinted pedestal, a rarity label, worn/locked state, and a slim progress bar
  tinted to the badge instead of the same primary lime for all twelve.

### The preview is a drawer now
- On phones the profile preview rises from the bottom edge with a short spring
  overshoot and can be pulled down from the grab handle **or the banner**,
  snapping back when the drag is short. Closing accelerates away at a fixed
  240ms, and `prefers-reduced-motion` collapses both animations.
- Paws, badge count and member-since sit in a three-tile stat row, the worn
  badge is called out under the presence line, and the banner is taller so the
  avatar and its ring have room to breathe.

## 2026-10-21 — Web Slinger is the only effect, and badges go on your profile

### The four cinematic loops are retired
- The cosmetics catalogue is back to a single entry: **Web Slinger**
  (`fx-web-slinger`, mythic profile effect). Sakura Bloom, Arcane Nexus and
  Sakura Storm are gone from the catalogue, the renderer, the profile header and
  the effects page, along with the four-loop build/check scripts under
  `scripts/effects/` and the `public/effects/cinematic/` clips they produced.
- The effect is drawn as **transparent inline SVG** again: an original masked
  web-slinger — red-and-blue suit, black web lattice, white lenses — crouched on
  a strand with both hands slinging. No raster asset, no background, nothing to
  clip.
- `ProfileEffect` renders `null` for any slug outside the catalogue, so a stale
  `profile_effects` row from the old gallery can never resurrect a removed
  overlay. Avatar decorations and nameplates are trimmed to plain avatars and
  names, keeping their exact sizes and layout.
- **Paws stay.** The wallet, bounty rewards, ledger and the Paws tab on the
  profile are untouched; only the shop catalogue they pointed at is reduced.
- `npm run test` now runs `tests/web-slinger-effect.test.mjs` (the transparency,
  single-entry, layering and migration guards) as well as
  `tests/game-sessions.test.mjs`.

### Badges you choose to wear
- The profile gains a **Badges** section under the bio. Members press **Equip
  badges**, pick up to three earned badges, and the row shows for every visitor.
  The choice persists in `profiles.badges` and display is earned-gated on read,
  so a hand-edited column can never show an emblem the member does not hold.
- Equipping before the migration reports a readable "needs the latest database
  migration" message instead of a PostgREST error, and a silent RLS no-op is no
  longer reported as a save.
- `supabase/migrations/20261029000000_web_slinger_only.sql` retires the old
  catalogue rows and keeps the Web Slinger seeded.

## 2026-10-21 — Everyone plays their own game in the call

### One session per person, not one per channel
- GAME BOT is now a **map of sessions keyed by host** (`src/lib/game-sessions.ts`, pure and DB-free).
  Jimmy can run Krunker while Bob runs Skribbl, and relaunching only replaces
  that host's session. Before this, one launch replaced the channel game for
  everybody.
- `viewFor` decides what a client shows: the game it explicitly joined, then
  its own session, then nothing. Only your own launch auto-expands the overlay,
  so somebody else's game can no longer hijack your screen.
- Launch/pause/end travel on `vc-game-bot:<channelId>`; who is watching whom
  travels in Supabase presence. A session id guards delayed broadcasts, so a
  stale end or an older launch cannot remove or revive a newer session.

### Joining is explicit and never destructive
- New **Games in call** strip in the VC (`GameSessionsBar.tsx`): one card per
  host with the game art, viewer count, live/paused state, **Join game**, a
  Leave that keeps the host playing, and a game-stream toggle on your own card.
  The Games page and the realm Games menu list other people's sessions the same
  way.
- `stopIntent` distinguishes **leave** from **stop**: leaving a joined game
  never ends the host's game and never deletes your own background session.
- Hosts can share a **room / team code** and an optional **invite link**. Joiners
  open the host's full link (safe `http(s)` only, cleared if invalid); the host
  keeps the base URL, so sharing a link never reloads their own game.

### Streaming only the game
- `startGameShare()` (`src/lib/game-capture.ts`) asks for a browser tab/window
  with `displaySurface: "browser"` and `monitorTypeSurfaces: "exclude"`, prefers
  the current tab, then crops the track to the mounted game surface with Region
  Capture. Every game surface is marked `data-rizz-game-surface`, and the
  largest visible one wins.
- Browsers without Region Capture still stream the tab, and the stage says to
  pick the game window; stopping a game also stops a game stream instead of
  leaving a share pointed at an empty surface.

### Checks
- `tests/game-sessions.test.mjs` (13 checks) locks the session rules, join
  links and stale-end guard; `tests/game-sessions-bar.render.test.tsx` renders
  the strip to prove Join game, host controls and the live label. The first is
  wired into `bun run test`.

## 2026-10-20 — Cinematic effects: four transparent loops, real previews

- **The old effects catalogue is replaced by four cinematic profile
  effects.** Web Slinger, Sakura Bloom, Arcane Nexus and Sakura Storm are cut
  from the supplied reel at 24fps, 1600×480, ~9.6s. Avatar decorations and
  nameplates are no longer part of the gallery.
- **Every asset has a real alpha plane.** The cherry and spider checkerboards
  are removed with saturation/body mattes; the arcane ring is luma-keyed and
  its Gemini watermark is cleared. The videos are VP9 + `ALPHA_MODE=1`; the
  posters are RGBA PNG frames from the same loops. Chromium playback at
  1600×480 was verified over both light and dark backgrounds.
- **The stage plays the loop; the cards are frames from it.** No stand-in
  Lottie thumbnail is used. Poster-first playback covers slow loads, blocked
  autoplay, Safari/Firefox and reduced-motion visitors without a black box.
- **The buy sheet is wired, but honest.** Prices and a checkout-link
  integration point are present; `COSMETICS_ENABLED` is still false, so the
  sheet offers a per-effect, on-device save-for-launch marker instead of
  charging. There is no server-side launch list or entitlement webhook yet.
  The Web Slinger clip is flagged `rightsReview` because it is supplied
  Spider-Man footage, and its checkout stays locked.
- **Profile previews are opt-in and labelled.** `/u/<username>?previewEffect=
  <slug>` renders the loop on the banner with a Preview pill; it never equips.
- `npm run effects:build-cinematic` and `npm run effects:check-cinematic` were
  added. The old Lottie pipeline remains in the repository for reference but
  is no longer used by the catalogue.

## 2026-10-20 — Web Slinger: swing, land, hold (two compositions)

- **The effect is now a character, not a silhouette.** A fully articulated
  masked web-slinger with separate limbs, a chest hinge at the pelvis, a
  neck hinge, sculpted hands/boots, rim light and an original spider emblem.
  No Marvel, Sony or Disney assets; every path is drawn in this repository.
- **The swing is solved, not keyframed by eye.** The hand follows a real
  pendulum around `[1080, -240]` on a 340-unit rope, the root is back-solved
  from the hand, and the web line is rebuilt at every keyframe. The banner
  camera pushes in from 0.45 to 0.9 across the arc.
- **Two assets, one rig.** The 512×512 avatar decoration is a close scene with
  the head, raised glove and web line clear of the disc; the new 1200×420
  banner shows the full swing, release, 360° rotation, crouch landing, perch
  and zip-out. The profile banner plays the wide file full-bleed with
  `preserveAspectRatio="xMidYMid slice"`; the avatar keeps the square file.
- **The avatar scene was rebuilt** around the new rig: it drops in on the line,
  settles, breathes and scans, then zips out. Its placement now aligns the
  scene's disc exactly over the real avatar, so the contact sheet is the app
  composition rather than an approximation.
- **Fixed two Lottie bugs that made the real player show the wrong thing.**
  Lottie's layer and shape-group arrays run top-to-bottom; the scenes are
  built bottom-to-top, so an opaque sky covered the banner and the torso hid
  its own emblem in lottie-web even though the stills looked right.
  `lottieZOrder` now flips sibling groups and the layer array while keeping
  paint items and the transform in place. Separately, animated 1D trim paths
  need an explicit `e` on every keyframe or lottie-web fails to build the
  layer; `trim()` fills them in.
- **The checker now proves paint, not just parsing.** It seeks twice (lottie
  updates transforms and visibility on different ticks), requires at least
  40/120 painted paths and 4 coloured gradient stops at frame 60, validates
  animated-shape geometry, and plays all 240 frames of both files. It also
  checks the 1200×420 banner and its 380 kB budget alongside the 512×512
  avatar.
- **Still preview-only.** `COSMETICS_ENABLED` remains false: the gallery shows
  both compositions through the existing `preview` props, but nothing can be
  equipped or worn. Equip/persistence stays on the existing auth/backend path;
  no new migration.
- **Honest limitation:** there is no browser in this Termux environment. The
  files were played through the real lottie-web build in jsdom and rasterised
  with `rsvg-convert`, which caught the z-order, trim and placement failures
  above — but real mobile/desktop visual QA is still outstanding.

## 2026-10-20 — Effects has a page

- `/effects` was still a "Coming soon" card with a notify button. The pieces
  existed in the catalogue and rendered on profiles, but there was nowhere in
  the app to actually see them.
- It is now a gallery: every catalogue piece, grouped into avatar
  decorations, nameplates and profile effects, with a live preview stage at the
  top. Tapping a tile swaps the stage.
- **Web Slinger is the default selection.** The avatar-decoration variant plays
  in a square stage built around the avatar — the format Discord uses — and the
  banner variant is listed under profile effects with the rendered still as its
  tile, so only one Lottie plays at a time.
- Avatar decorations preview in the square format; nameplates and banner
  effects preview on a mock profile with the real avatar, the banner edge and
  the username, so the placement is the placement people will get.
- Previews come from a new `preview` prop on `ProfileEffect`, `AvatarDecoration`
  and `Nameplate`. The `COSMETICS_ENABLED` killswitch still stops anything from
  being _worn_; it no longer hides what exists. The page says "Preview only"
  and keeps the notify-me chip while equipping stays closed.
- The Effects destination in the nav and in Settings no longer carries a
  "soon" badge.

## 2026-10-20 — Equip badges on the profile

### The profile gains a badge section you control
- The profile page now has a **Badges** section under the bio: members press
  **Equip badges**, tap up to three earned badges, and the showcase appears
  there for everyone who visits. The choice persists in `profiles.badges` —
  the showcase column the profile-card migration introduced, which nothing
  wrote until now.
- Display is earned-gated on read (`showcaseBadges` in `badge-set.ts`), so a
  hand-edited column can never show an emblem the member does not hold, and
  until something is equipped the section falls back to the full earned row
  the page already showed — no profile loses badges.
- Before `20261020010000_profile_card.sql` is applied the section still
  renders; equipping reports a readable "needs the latest database migration"
  message instead of a PostgREST error (the same best-effort pattern as
  featured badges), and a silent RLS no-op is no longer reported as a save.

## 2026-10-20 — Badges redrawn in Discord's language

- The badge sprite (`public/badges/badges.svg`) is redrawn as hand-authored
  vector emblems in one shared 24-unit language: each emblem has its own
  silhouette, a two-stop metal, a rim light and an inner shadow, so a row of
  badges reads as a set rather than clip art.
- `src/components/BadgeIcon.tsx` slices the sprite, so every surface — profile,
  feed credits, leaderboard, badge shelf, profile card — draws the same emblem
  at any size without a second asset. `tests/badge-sprite.test.mjs` guards the
  sprite ids, the slice map and the shared geometry.

## 2026-10-20 — Badge names: HypeSquad Bravery and Verified Creator

### Two badges renamed, no award lost

- **Early Rizzer → HypeSquad Bravery.** The first-wave badge takes the
  house-badge presentation it was modelled on: the name, a one-line flavor
  ("First in, no hesitation. Joined RIZZ in the first wave.") and the story in
  the card below, instead of a description doing all three jobs.
- **Channel Founder → Verified Creator.** Creating a channel was always a
  creator milestone, so the catalog keeps one creator badge, not two that read
  almost the same. Existing Founder awards move onto Verified Creator
  (deduplicated), and the profile-card verified check — which already accepted
  either slug — keeps working.
- Migration `20261026000000_badge_renames.sql` is rerun-safe, and a no-op on
  databases where `badge_set_v2` already removed the old rows.
- Both new slugs joined the profile's legacy shelf, so holders see the renamed
  badge beside their name and in the share card instead of losing it to the
  catalog filter.

## 2026-10-20 — Story composer: typing, living text, Instagram-style templates

### Typing works past the first letter

- Editing a story text layer re-focused and re-selected the whole span on every
  keystroke (the focus lived in a `ref` callback, which React re-runs on each
  render), so every new letter replaced the previous one and typing appeared to
  stop after one character. Focus + select now happen once, when the editor
  opens; the caret stays where you left it.
- Template photo slots could not be tapped at all: the drag handler on the
  overlay captured the pointer on `pointerdown`, which swallowed the slot's
  click, so the picker never opened. Slots own their press now.

### Living text

- New **Live text** tool (and a **Live** toggle in the text toolbar): the words
  breathe with a soft glow in the editor, and stay alive after posting — Share
  records a 3 s clip with the text animated per frame instead of flattening it
  into a still.
- Reduced-motion users get a static preview; the clip still posts.

### New text spawns below centre

- Adding a text layer dropped it at the exact centre — on the middle of the
  photo, and straight over a template's centre slot. It now spawns in the same
  lower band the phrase stickers already use, draggable from there.

### Templates behave like Instagram's frames

- A template owns its slots and sample text; anything you added by hand is kept
  when you switch layouts.
- Photos already in slots follow across to the new layout instead of being
  dropped, and filling a slot jumps to the next empty one, so a 4-up grid fills
  in four taps.
- Double-tap a filled slot to swap its photo; the first empty slot is selected
  when a template is applied; Blank keeps your background.

### RIZZ Companion removed

- The floating Lil Rizz orb, its preference, the Settings toggle, its dead
  server function and its animations are gone.

## 2026-10-20 — Badges are earned, not handed out

### Earning

- The collection's progress bars existed but nothing ever awarded the badge:
  every badge was still an admin INSERT.
- Earning now syncs on app open and on tab refocus: the server re-measures the
  rules, awards whatever is already met and returns only the new slugs, which
  arrive as one non-stacking toast. Awarding is idempotent — re-syncing never
  duplicates and never revokes.
- Rules: join (Newcomer, so the very first badge is instant), 100 likes across
  posts and stories, 100 messages across realms/channels/DMs, a 00:00–04:00 UTC
  message, a single 50-like post, one bounty (drop claim), a 7 or 30 day
  activity streak, and top 10 all-time by rizz score. Early Supporter stays
  "joined in RIZZ's first 30 days".
- **Verified** and **Game Champ** remain team awards: verification is a human
  decision, and arcade wins are recorded per device (`rizz:arcade:wins`), so
  there is no account-level result to measure.

### Correctness

- Early Supporter's bar measured _account age_ ("30 days old"), which contradicts
  the name and would have shown 30/30 for everyone. It no longer has a bar — it
  is awarded from the first account's join date instead.

### Security

- `award_badge(_user, _slug)` was `SECURITY DEFINER` with the default PUBLIC
  grant, so any signed-in client could award itself any badge, mythic included.
  It is now revoked from clients; awards come from `sync_my_badges()` (measured
  rules, self only) or an admin action.

### Backend

- Migration `20261025000000_badge_earning.sql` seeds the 12-badge collection with
  `earn_rule` / `earn_target`, adds `badge_progress()` and `sync_my_badges()`,
  and closes the `award_badge` grant. Until it is applied the sync is a no-op and
  everything else keeps working.

## 2026-10-20 — Web Slinger: a cinematic profile effect, built as one asset

### The effect

- A new **Web Slinger** profile effect: a masked web-slinger looms out of the dark behind the avatar, webbing reaches in from the edges, a spider sigil burns behind the hero at the climax, and the scene loops without a seam.
- The character is **original work** — a masked web-slinger in the red-and-blue spider aesthetic, drawn from scratch as bezier paths. No Marvel, Sony or Disney assets are used, referenced or required.
- It is **one asset for two places**: `public/effects/fx-web-slinger.json` is a Lottie file, which is what Discord's profile effects are and what the RIZZ app plays through `lottie-web`. 512×512, 30fps, 240 frames (8s), ~80 kB.

### Where it plays

- **`deco-web-slinger`** (avatar decoration) sits behind the avatar, the way Discord draws a profile effect, with the lenses peeking out at the upper left.
- **`fx-web-slinger`** (profile effect) anchors to the left of the profile banner, so the hero looms behind the avatar that overlaps it.
- The player loads the animation only when it scrolls into view, keeps it sharp at any size, and holds the hero moment under `prefers-reduced-motion`.

### Built, not hand-waved

- The whole effect is procedural: the geometry, the gradients, the web physics (trim paths on bezier strands) and the timeline live in `scripts/effects/`, so it can be re-tuned without an After Effects round trip.
- `npm run effects:build` regenerates the Lottie, a still and a contact sheet; `npm run effects:check` loads the file into the real player and steps through every one of the 240 frames.
- `docs/web-slinger-effect.md` has the asset manifest, the scene breakdown, the timeline and the Discord integration steps — including the honest part: Discord's profile effects are a Shop feature with no public upload API, so the file is the deliverable and publishing it is a client-side action.

## 2026-10-20 — Messages, groups, replies, badges and rizz: ten fixes in one pass

### Messages stop breaking one character per line

- A short message like "Hi" rendered as **H / i**, and longer ones wrapped mid-word. The bubble was sized with `width: fit-content` inside the message trigger, which is a shrink-to-fit box, so the browser resolved the width against an indefinite available width and sized the bubble to its _minimum_ content — a single glyph. The bubble now uses `width: max-content` with an absolute cap, and the 44px tap target moved to the height, where it can no longer eat the padding.
- The conversation column is capped and centred (`max-w-3xl`), so messages line up with the composer instead of hugging the far left of a wide screen — and the far right of it for outgoing messages. The group chat got the same column.
- The time chip moved inside the message block, so consecutive messages are 8px apart rather than 40px.

### Leaving a conversation

- The header back arrow is a real 44px button with a label, and **Escape** now leaves the conversation. The only way out used to be the browser's own back button.

### Group chats can be created again

- The **New group** sheet had a member _counter_ but no member _list_ — "0 selected (0/5)" with nothing to tap, because the only way to add someone was a double-tap on an inbox row. The sheet now has a searchable picker of the people you have DMs with (exactly the set the server accepts), a search field, and a scrollable body. The button says how many spots are left, and the sheet no longer opens wider than the screen.

### Replies have a shape

- Post comments carry a real `parent_comment_id`, but the three renderers only asked "does this comment have a parent?" and answered with one hard-coded indent — so a reply to a reply sat at the same level as a reply to a comment. Depth is now derived from the parent chain (`src/lib/comment-tree.ts`) and every level indents further, in the post sheet, the side discussion and the inline thread.
- Forum replies indent past depth three instead of flattening out, and a nested reply now names who it replies to.

### Notifications link to the post

- "New Comment" is gone. The comment behind the notification is recovered and shown, the post it belongs to is named, and the whole row is a link to that post.
- New route **`/p/<post id>`** renders a single post — the post permalink. `?comment=<id>` opens straight into the thread. **Copy link** on a post now copies that permalink.

### Badges show how far along you are

- Every measurable badge has a progress bar and a count: "42 / 100 · 58 to go" on the card and in the inspector. Likes received, messages sent, best post, day streak, bounties claimed, leaderboard rank, badges held and account age are all measured from the tables the app already reads.
- Arcade wins are recorded on the device (like the games' own best scores), so **Game Champ** can show progress too.

### "Bring 1 freind" reads "Bring 1 friend"

- Bounty titles and descriptions are corrected on the way out for unambiguous misspellings, and the **New bounty** dialog offers a one-tap "Did you mean…?" before the typo is saved.

### Rizz is actually earnable

- Rizz was not earnable: `profiles.rizz_score` was only ever set by an admin gift, so every creator on the board read **0**. It is now earned — a post is +5, a like received +2, a comment received +3, a reaction received +1, a badge +25.
- **Rizz is earned, not shared.** There is no common pool and no fixed supply: a pool would make the board zero-sum, so your gain would be somebody else's loss and the number would stop meaning anything. Every event is worth a fixed number of points and the board ranks contributions.
- The server does the awarding through the rizz migration (which now carries the award triggers, and puts `profiles` in the realtime publication so the live board is actually live). Until that migration is deployed, the app credits you for the things that happen on your own device — the posts you make and the badges you earn — capped at 250 a day, and it stops the moment the server answers, so nothing is counted twice.

### Buttons line up

- The **Status** row in the account menu had a 10px icon where every other row had a 28px tile, so its label sat 18px left of every other label in the same menu. The icon column is now the same width everywhere, in the menu and in the help sheet.

## 2026-10-18 — Featured badge: wear one crest beside your name

### Pick a badge to wear

- The badge inspector now has **Feature badge** next to Share. It saves the choice to `profiles.featured_badge` and swaps to **Worn · remove**; one badge at a time, and the helper line explains what it does. Previously this button was a toast placeholder that saved nothing.
- Owned badges show a lime **Worn** chip in the collection grid, so the equipped one is visible without opening the inspector.

### Where it shows

- **Public profile:** the vector badge sits right of your display name, beside the nameplate effect.
- **Profile hover card:** same mark beside the name, and the badge sheet labels that award **Worn**.
- Only badges the member actually earned are rendered, so a stale column value can never fake an award.

### Backend

- Migration `20261024000000_featured_badge.sql` adds the nullable `featured_badge` column, rejects featuring a badge you don't hold, and clears the feature if that badge is revoked. Reads degrade to “nothing featured” until the migration is applied, so profiles keep loading on older databases.

## 2026-10-17 — Navigation & discovery: What's happening, grouped More sheet, pins and recents

### What's happening (`/pulse`)

- New **What's happening** page: unread DMs and notifications with one-tap **Continue**, **live voice rooms** across your realms (participant avatars, host, start time) with a **Join** button that deep-links straight to the channel (`/r/<slug>?room=<id>`), and your realm list for one-tap **Open**.
- Useful empty states everywhere: "you're all caught up", "no live rooms" with a way into Realms, and a realm-discovery card when you haven't joined one yet. The live section refreshes every 30s.
- Entry points: a hero card at the top of the mobile More sheet, the first destination in the desktop sidebar, and the command palette.

### Mobile More sheet

- Destinations are grouped into **Create / Communities / Play / You** instead of one flat grid (which had been duplicating Feed, Reels, Messages and Saved from the bottom nav).
- **Games** is reachable on mobile again — it had no entry point at all after `d6abd50` removed it. It sits in the Play group and in the command palette.
- **Pinned** and **Recent** shortcut chips at the top of the sheet (localStorage). **Edit** mode turns the tiles into pin toggles so no tiny nested buttons are needed; recents update automatically as you browse.
- A **Search** button opens the same command palette as ⌘K, and the sheet shows a **What's happening** hero card.

### Search & desktop

- Command palette now jumps to **What's happening**, **Games** and **Effects**; the desktop sidebar gained a visible Search row and the What's happening item.

## 2026-10-17 — Story composer: Lens tool removed

- The **Lens** option (face-effects studio) is gone from the story composer toolbar — stories compose with Media, Sets, Text, Mention, Sticker, Brush, Motion, Layers, Filter, Tune, BG and audience as before.

## 2026-10-17 — GAME BOT overlays: action & open-world games, rotate, real art

### More games, fixed embeds

- Fixed the two that refused to run: **Poxel.io** now points at its own site (the CrazyGames embed was dead) and **Slither.io** is gone — replaced by hosts that actually frame: **Diep.io**, **Zombs Royale**, **Venge.io**, **Ev.io** and **Kirka.io**.
- New **Open World** shelf: **Minecraft Classic**, **Miniblox** (direct site), **Bloxd.io** and **Voxiom.io** — 22 games total across Action / Open World / 2 Player / Party / Creative / Puzzle.
- **Smash Karts**, **Basketball Stars** and **Miniblox** moved off CrazyGames embeds to their standalone sites.

### Games play as an overlay in GAME BOT, in the call

- `GameOverlayHost` (mounted at the app root) shows a live game as a Discord-style overlay over the app whenever you're in a voice call and GAME BOT has a session — for **everyone in the channel**, no matter who launched.
- Each person can minimize it to a floating pill, take it fullscreen, or rotate it; pause / resume / stop are shared. Late joiners sync via a `game-bot-request` broadcast.
- Like music, games are call-only now — launching outside a call points you at a voice channel first (Games page links straight to Realms).
- The VC gamepad button and GAME BOT tile open the Games menu instead of navigating away; the tile shows the live game's icon and state, and the MUSIC BOT tile opens the shared music sheet.

### Rotate + chrome

- The RIZZ browser grew a **rotate** button (a container-query 90° turn for portrait phones) with an orientation-lock attempt when fullscreen; fullscreen, pause, blocked-embed fallback and reload all stay.

### Real art + lime theme

- Cards carry the games' own cover art and icons (og:image / touch icon / favicon) with an emoji fallback and a slow drift animation; the shelf, the overlay and the Games page wear the lime + Bricolage RIZZ theme.

## 2026-10-17 — The games section plays ready-made games

### What the hub shows now

- The `/games` hub, the realm Games menu and the in-call gamepad now lead with ready-made games — **Poxel.io**, **Krunker.io**, **Shell Shockers**, **Slither.io**, **OvO**, **Smash Karts**, **Basketball Stars**, **8 Ball Pool**, **Skribbl.io**, **Gartic Phone**, **PixelCanvas**, **PixelWar**, **Miniblox**, **2048**, plus **PlayPager Chess and Checkers** boards.
- Every entry was header-checked before shipping: no `X-Frame-Options` and no `frame-ancestors`, so the game actually runs inside the RIZZ browser (bare .io domains, CrazyGames `/embed/` titles, PlayPager `/embed/` boards, the static 2048). Anything that later refuses framing falls back to an "open in new tab" card instead of hanging on a spinner.

### RIZZ browser, Discord-style fullscreen

- Games open in a RIZZ chrome bar (icon, title, traffic dots) with the cat-mark loader over near-black, a paused overlay for GAME BOT pauses, and a real browser-fullscreen button — the game takes the whole screen, Esc exits, the bar stays available.
- FPS titles get `allow-pointer-lock` in the iframe sandbox so mouselook works.

### GAME BOT sync, from anywhere

- New `useGameBot` hook (`src/lib/game-bot.ts`) owns the shared GAME BOT state on `vc-game-bot:<roomId>`; the `/games` page, the realm Games menu and the VC surfaces all read the same broadcast, so launch / pause / resume stay in sync for everyone in the channel.
- Launching a game while in a call broadcasts to the room; outside a call it opens as a solo stage.

### Realm voice bar

- The realm voice bar now has Games and Music icon buttons, opening the ready-made Games menu and the MUSIC BOT Music menu.

### Kept

- The fifteen built-in games, their engines and their checks stay in the tree (`src/lib/games/`, `GameStage`, `bun run arcade:check`) — the hub just no longer surfaces them.

## 2026-10-16 — Fifteen games in the hub: chess, checkers, arcade action, puzzles

### 12 new games, all instant and account-free

- **Board:** **Chess** (you vs a depth-3 search — castling, en passant, promotion, checkmate, promotion picker, hint, engine difficulty), **Checkers** (American draughts: captures mandatory, longest chain enforced, crowning), **Connect Four** (depth-5 engine that takes a win and blocks a line), **Tic-Tac-Toe** (perfect play, so a draw is the real goal), **Reversi** (legal-move dots, flip counts, corner-aware AI, automatic passing).
- **Puzzle:** **2048** (arrows/WASD or swipe, correct single-merge rule, best tile remembered), **Minesweeper** (three sizes, first click always safe, flood reveal, flag mode for touch, right-click on desktop), **Sudoku** (generated with a unique solution, conflict highlighting, hint, difficulty, timer), **Memory Match** (6/8/12 pairs of the app's own cat emojis, moves + time).
- **Arcade action:** **Breakout** (edge hits angle the ball, three balls, levels speed up), **Neon Void** (vertical shooter: drag to fly, hold to fire, waves every 120 points, two-hit enemies), **Reaction Rush** (30 seconds, lit tiles, streaks multiply, misses break them).
- Every rule lives in a plain module under `src/lib/games/` (chess, checkers, connect4, tictactoe, reversi, g2048, minesweeper, sudoku, breakout, shooter), so the games are simulations with a board drawn over them — which is what makes them testable and what keeps them working over a voice call.

### Why not just embed free games

- Third-party .io sites refuse framing, want an account, and put an ad wall in front of the thing the user asked for. First-party games start on tap, work in the in-call overlay, and cannot be taken down by someone else's X-Frame-Options header.

### Checks

- `bun run arcade:check` now drives every engine headlessly (60+ assertions): **chess perft** (1, 20, 400, **8902** — the published node counts, which prove castling, en passant and promotion rather than "it did not throw"), mate-in-one, checkers forced captures and crowning, Connect Four win/block, perfect tic-tac-toe, Reversi flips, 2048 merge rules, Minesweeper first-click safety and flood, Sudoku uniqueness + solver round-trip, Breakout clear-out over 5,000 frames, shooter waves, plus the original arena/snake/rally checks.
- That script earned its keep again: it caught the 2048 engine merging a row twice (`[2,2,2,2]` became `[8]`, not `[4,4]`) because the line helper was passed a cell index where it wanted a row/column number.
- `bun run games:render` renders all 15 built-in games through `GameStage` and fails if any of them stops rendering.

### Hub polish for a longer shelf

- Filter row grew "Action / Board games / Puzzles" alongside Everything, Instant play, Party and Web games; cards lay out three-up on desktop, and the hero says how many games there are.

## 2026-10-16 — Games hub: three games you can actually play, over the call

### Why the old activities felt empty

- The controller button opened a bottom sheet whose three entries were _other sites_ — Jackbox, skribbl and a 2048 page — so "Play" meant leaving RIZZ, making an account somewhere, and reading a room code off someone else's screen. Nothing was playable in-app, and the phone got a plain full-screen iframe with no voice controls on it.

### Three built-in games, instant and account-free

- **Pixel Arena** — an `.io`-style pixel arena (steer with pointer, WASD or touch drag; eat pixels to grow, bigger blobs eat smaller ones, six rival bots, live size/best/rank chips, instant respawn).
- **Neon Snake** — grid snake against three rival snakes that score their turns by reachable space and food distance, so they cut you off instead of wandering. Food speeds the tick up from 118ms to 68ms.
- **Pixel Rally** — paddles, a ball that accelerates every hit, first to seven, solo vs a CPU that sharpens as the rally grows, or two players on one screen (drag/arrows at the bottom, A/D at the top).
- All three run as React components on a canvas — no iframe, no signup, no lobby — which is exactly why they can be drawn _behind_ the voice controls.
- `useArcade` owns the canvas, DPR, resize, input and the throttled stats bridge, so a game never re-renders per frame and never competes with the call for CPU.

### The Games hub (`/games`)

- The in-call gamepad button now opens a dedicated hub: hero with the promise (instant, fullscreen, voice on top), a "Live in voice" strip with "Jump back in"/"End", filters (Everything / Instant play / Arcade / Party / Web games), search, and cards carrying their badges, controls and a Play button that says what it will really do.
- Outside a call, **Play now** starts a built-in game full screen right there (`GamePlayOverlay`, with a real browser-fullscreen toggle). A web game opens in a new tab and copies its invite link.
- In a call, **Play in call** starts the activity for the room and drops _you_ straight into the game — no tapping "Join game" on your own launch.

### Games over voice (the Discord-activities part)

- `VoiceActivityOverlay` makes the game the background and turns the voice UI into a translucent dock floating over it: speaking rings, muted badges, camera tiles for anyone on video, mute/deafen/leave, who is in the call, the room code for web games, and a chevron that collapses the dock to a single pill.
- The overlay's grid button swaps to the voice-first layout on desktop (game in the side panel via `ActivityPanel`, which now renders built-ins too), and the panel's expand button comes back.
- The join banner says what will actually happen ("Plays here · no sign-up" vs "Voice keeps running"), and once anyone opens a game the participant tiles show "Playing …".

### Fixes that came out of testing the games

- A games' realtime channel is now **one shared store per voice room** (`src/lib/activities.ts`): the hub, the call view and the room all attach to the same channel instead of racing three `channel()` calls on one topic, and the "N playing" flag is per consumer so a watcher can no longer clear the flag of the window that is playing.
- The Pixel Rally CPU literally could not miss (0.06 error against a 0.10 hit window, re-aiming every frame), so a match never ended. It now has a paddle speed slower than the ball's lateral travel plus a reaction delay: beatable, and it still punishes lazy paddles. Caught by `scripts/arcade-check.ts`.
- Two-player mode's second paddle used W/S in the help text but was wired to A/D in the physics. Now A/D everywhere, including the game metadata.
- App-wide shortcuts (g-then-x, `?`, `.`) stay out of the way while a game is on screen, so pressing G and D mid-round no longer navigates to DMs.
- `scripts/arcade-check.ts` (`bun run arcade:check`) drives all three simulations headlessly: growth, deaths and respawns, grid integrity, scoring up to a win, CPU beatability, duo input and NaN checks.

## 2026-10-13 — Realm forums: themed forum surface, per-forum settings, forum notifications

### The forum surface

- Forum channels (`kind = "forum"`) swap the message list for their own surface under `src/components/forum/`, built from the same tokens as the feed redesign so forums, feed and chat read as one app.
- **Hero header:** banner with a gradient overlay, forum icon/emoji, name, description, post count and a "New post" button; it collapses into a slim sticky header on scroll.
- **Sticky filter bar:** search field, sort dropdown and horizontally scrolling tag chips, each tag carrying its own colour and emoji.
- **Post cards:** 16px radius, soft shadow, thumbnail, title, 2-line preview, tag chips, avatars of recent repliers, reply and like counts, last activity. Pinned posts get a highlighted border, locked ones a lock icon, solved ones a green check badge.
- **Layout switcher:** Card, Compact list and Gallery (masonry for image posts), remembered per user in `rizz:forum-prefs` — together with comfortable/compact density, font scale and hide-read-posts. The forum's admin defaults apply until a member picks their own, and a per-room override lets a gallery board and a text board differ.
- **Motion:** staggered card fade-in, press-scale on tap, skeleton loaders, smooth expand/collapse for replies.
- **Themes:** dark, light and AMOLED black. Ink over an accent colour is chosen by real WCAG contrast (`readableInk` in `forum-content.ts`) instead of a fixed white/black guess, so tags and statuses stay legible on any background.

### Post page

- Optional cover image, large title, author card (avatar, role colour, badges, join date), tags and a reaction bar.
- Replies render as a clean thread with thin connector lines for nesting, an "OP" badge on the author's replies, role-coloured names, and the chosen **Best answer** highlighted with a green border pinned under the post.
- Rich embeds reuse the app's existing players: image galleries open in the media viewer, fenced code becomes a copyable code block, YouTube uses the same official iframe the reels use, and music links play through `MusicPlayer`.
- The reply box is sticky on mobile and expands when focused.

### Per-forum settings (moderators, with live preview)

- `ForumSettingsSheet` edits banner, icon, accent colour, description and the pinned guidelines post; default layout, default sort and card density; custom tags (name, colour, emoji) with an optional required-tag rule; custom statuses (Open / In progress / Solved / Closed …) with colours; post templates that render as a form when creating a post; the custom reaction set and allowed attachment types; slowmode, who can post or reply, and auto-archive after N days of inactivity.

### Notifications

- Two new types — `forum_reply` (someone replied to your thread) and `forum_tag` (a new post in a tag you follow) — rendered on the Notifications screen with a deep link straight to the thread through `?room=` and `?post=`.

### Data

- `supabase/migrations/20261018000000_realm_forums.sql`: `realm_forums` (per-room appearance and rules), taxonomy (`realm_forum_tags`, `realm_forum_statuses`, `realm_forum_templates`), content (`realm_forum_posts`, `realm_forum_replies`, reactions and likes) and member state (`realm_forum_reads`, `realm_forum_tag_follows`, `realm_forum_mutes`), each with RLS (17 policies).

## 2026-10-13 — Story likes and privacy, any-source music, Voice & Sound, chat rhythm, 69 face lenses

### Stories are their own feature, and likes finally save

- **Why likes failed:** there was nothing to write to. `public.stories` had `view_count` and no `like_count`, and there was no `story_likes` table at all — the heart only flipped a local flag, so nothing was saved, no count was ever shown, and a second tap silently re-inserted the same row. `story_reactions` covers emoji reactions, not likes.
- **Why the view counter was also stuck at 0:** `bump_story_views` is a plain trigger, so its `UPDATE public.stories` ran as the _viewer_ — and the only UPDATE policy on `stories` is the author's. RLS matched zero rows, so `view_count` never moved. Both counters are now `SECURITY DEFINER`, and existing stories are recomputed from the `story_views` rows that were recorded.
- **Fix:** new `story_likes` table (own-rows policies, author can see who liked), `stories.like_count`, a `bump_story_likes` trigger, and a `StoryViewer` like button that is optimistic, shows the real count, and rolls back the flag _and_ the count when the write fails. Double-tap likes with a heart burst.
- **Audience, enforced in RLS:** `everyone` / `followers only` / `close friends` plus a hide-from list (`stories.hidden_from`). `followers` is a new value on `post_visibility`, `can_view_story()` applies it, and the old expiry-only policies were replaced — a private story is not readable through a direct PostgREST call either. The composer has a privacy panel and a people picker before posting.
- **Unseen rings:** the gradient ring now means "new since you last looked" (tracked per device), instead of always looking the same.
- **Mentions in stories:** the story text editor and the new caption field use the same `@` picker as chat, and captions render mentions/tags as real links.
- **Replies stay DMs:** a story reply is inserted into `direct_messages` with `story_id`, so it lands in the author's inbox — the story is never rendered as a chat message.

### MUSIC BOT plays more than Apple (and pasted links actually resolve)

- **Why only Apple Music ever played:** `/play` sent a typed song name to the iTunes Search API and, for anything that looked like a link, queued the raw URL as the _title_ with `preview_url = null`. So a YouTube link produced a chat card reading "https://youtu.be/…" with no artwork, no metadata and no audio — and the in-call bot, whose only playback path was `<audio src={preview_url}>`, could not sing it.
- **Fix:** `src/lib/music-sources.ts` classifies a link (YouTube watch / youtu.be / shorts / playlists / music.youtube.com, Apple Music, direct audio files) and `src/lib/music-resolve.ts` resolves it per provider on the server — YouTube through its public oEmbed endpoint (no API key), Apple through the existing search, audio files by checking the content type. Each provider is one entry in a registry, so adding one is a case, not a rewrite.
- **Playback:** one `MusicPlayer` handles every source — an `<audio>` element for Apple previews and direct files, and the official YouTube IFrame Player API for YouTube. **YouTube is never downloaded or extracted.** Play/pause/seek/volume/loop/end-of-track behave identically for all three.
- **Errors:** video unavailable (100), embedding blocked (101/150), region-locked, invalid link and not-audio all map to friendly copy with a skip to the next track; the queue keeps the track so it can retry.
- **Player features:** the voice-channel panel gained a now-playing card, seek bar, restart, skip, loop, shuffle, inline volume and the upcoming queue; queued-track cards play inline instead of showing a dead title.

### Voice & Sound settings

- New **Settings → Voice & Sound**: master (0–200%), separate music / voice & TTS / notification sliders, mute-everything, Test sound, input + output device pickers, mic sensitivity and noise suppression. Stored in `rizz:sound` and applied live — no playback restart.
- Per-realm bot volume override on top of the music slider, plus quick volume + mute inside the player.
- Honest limits, stated in the UI: the browser caps streamed media at 100%, while the notification tones are generated here and do go above it; output-device selection is hidden where `setSinkId` doesn't exist.

### Chat rhythm (Realms chat)

- Message spacing is now theme tokens: ~3px between consecutive lines from one author, ~18px between groups (5-minute grouping window), with the date divider adding its own gap.
- Consecutive messages group under one avatar/name/time, and the time appears in the avatar gutter on hover (desktop); on touch the long-press preview carries it.
- Added `Today` / `Yesterday` / dated separators, a comfortable line height token, 14px side padding, and media/embed cards with their own spacing.

### Face effects — 69 lenses on one shared warp shader

- `src/lib/face-effects.ts` is a data-driven registry of all 69 effects (16 warp, 8 reactive, 12 overlays, 8 beauty, 12 filters, 8 world, 5 fun) with per-effect parameters and a default intensity. New lenses are rows, not code.
- **One shared GPU mesh-warp shader** drives every warp effect: a subdivided grid displaced in the vertex shader from `uWarp[6]` (centre, radius, signed strength) plus `uSwirl`. No CPU pixel loops anywhere in the warp path.
- Tracking is MediaPipe Face Landmarker, imported lazily from its pinned CDN bundle (no new dependency, so the repo's three lockfiles and the Render `npm ci` step are untouched) and it asks for **blendshapes** — `jawOpen`, `mouthPucker`, `tongueOut`, `eyeBlinkLeft/Right`, `browInnerUp`, `mouthSmileLeft/Right` — so the reactive lenses respond to the right expression instead of guessing from geometry. Head roll/yaw/pitch come from landmarks and drive the overlays.
- The studio (camera or gallery photo) has the effect carousel above the capture button, tap-to-apply, an intensity slider for every effect, and the "No face found — showing the original image" hint. Sustained frame rate under 24fps halves the render resolution until it recovers above 28fps, and the measured fps is shown.
- **Scope, stated plainly:** `Background Replace` and `Face Swap` are registered but marked unavailable in the UI — the first needs a segmentation model that isn't bundled, the second needs a two-face texture transfer. Nothing pretends to work: those two say what they need. The 30fps target is implemented as the guard above but has not been measured on a mid-range phone from this environment.

### Story editor status (section 2 of the brief)

- Added: privacy picker before posting, mention/tag people in story text and captions, the lens tool, 44px touch targets, a scrollable toolbar that survives 375px, and safe-area handling.
- Already present and kept: 9:16 canvas, pinch/rotate/drag/tap/swipe-down gestures, text with fonts/colours, stickers, filters, gradient backgrounds, undo, trash-drop.
- **Not built:** the drawing brush, story music picker, GIF picker and crop/trim trimmer. They are additive tools on top of the existing canvas model and are the natural next step, not something this pass silently dropped.

## 2026-10-13 — Channels & permissions crash, silent MUSIC BOT, message actions, Discord-style mobile pass

### "Channels & permissions" no longer takes the page down

- Opening Options → **Channels & permissions** replaced the realm with "This page didn't load".
- Cause: the same duplicate-topic bug as the voice-join crash, in a second place. `useChannelPermissions` subscribed to the fixed topic `realm-channel-permissions-<realmId>`, and the realm page _and_ the sheet body both use that hook — so opening the sheet subscribed an already-joined channel, `subscribe()` threw inside an effect, and React escalated it to the route error boundary.
- Fix: every consumer of `useChannelPermissions` gets its own topic (`...-<instanceId>` via `useId`) and subscribes through `subscribeSafely`, so the composer hint and the moderation sheet watch the same data without sharing a channel. The realm settings panel uses the same hook and is covered by the same fix.

### MUSIC BOT sings in the call (it was keyed to the wrong id)

- Cause: the queue is keyed by the **realm channel** id (`realm_rooms.id`), but the in-call bot passed `call.roomId`, which is the **voice_rooms row** id. Every lookup missed, so the bot stood in the call with an empty queue and never made a sound — the track really was queued, it was just invisible to the bot.
- Fix: the in-call bot and its `skip` now use `call.channelId`. Queuing in the channel's music panel and joining that channel's call is enough for everyone in the call to hear the same song, and the panel's local preview steps aside so the track never plays twice, out of sync.
- Autoplay: a track queued by someone else starts with no gesture of mine, which browsers refuse. The bot now resumes on the first tap or key press anywhere in the call (the mic/camera buttons count), instead of waiting for a dedicated button.
- Honesty: when a track has no playable preview (Apple Music shares 30-second previews only, and pasted links have none) the bot tile and the panel now say so instead of sitting silent.

### Long-press on a message

- The menu no longer covers what you pressed: it opens with the author, the time and the message text at the top, and `View message` opens the whole message full size with a copy button.
- On phones the menu is a **bottom action sheet** (Discord-style) rather than a popover over the conversation, so the chat stays readable.
- Deleting your own message in a _text channel_ now removes it from the list: the handler patched only the realm-level cache, so a message in a channel stayed on screen after being deleted and looked like the delete had failed.
- Realm owners and moderators can remove anyone's message; if the row is not theirs to delete (a bot message, or a moderation-only policy) the moderation RPC is used instead of refusing with "you can only delete messages you sent".

### Mobile top bar and feed hero

- Top bar is Discord's arrangement and one tidy row on any phone: logo, round search button, then the bell, status pill and avatar on the right.
- Feed hero is compact (smaller avatar, tighter heading, one action row with Share/Reels/Explore) so more of the feed is visible without scrolling.

### @ mentions and / commands

- Both pickers now match: section label on top, one row per entry with the avatar leading, the name and secondary line, the owning app or handle pushed to the right, an accent bar on the highlighted row, and a keyboard-hint footer. The slash list keeps its app strip.

## 2026-10-13 — Fix: "This page didn't load" when joining a voice channel

### What happened

- Joining a voice channel on `/r/<slug>` crashed the route into the root error page ("This page didn't load").

### Why (the actual cause)

1. `useMusicQueue` subscribed to the realtime topic `music-queue-<realmId>`, and supabase-js keeps **one channel per topic per client** — a second `channel(topic)` call hands back the _existing_ instance.
2. That instance is already joined, so calling `subscribe()` on it throws `tried to subscribe multiple times. 'subscribe' can only be called a single time per channel instance`.
3. The MUSIC BOT work added a **second live consumer** of that queue (the channel's music panel _and_ the in-call bot), so the double subscribe happened exactly when a call started — inside a `useEffect`, which React escalates to the route error boundary. The whole page died instead of one feature failing.

### Fix

- `useMusicQueue` now gives every consumer its own topic (`music-queue-<realmId>-<instanceId>` via `useId`), so the panel, the queue sheet and the in-call bot never fight over one channel. This also removes the same latent crash when opening the Queue sheet while on a voice channel.
- Added `src/lib/realtime.ts` with two helpers: `subscribeSafely` (a duplicate-topic subscribe is not fatal — the channel is already live and handlers attached before it still receive events) and `findJoinedChannel` (reuse a live channel and leave its cleanup alone).
- Applied them to the other places where one client can hold the same topic twice: the DM header's "Call in progress" watcher, the incoming-call ringer's decline signal, the call screen's own subscribe, and the shared presence singleton (whose teardown is asynchronous, so a listener arriving right after the last one left could be handed a channel that was still closing).
- `MusicBotBoundary` now wraps the bot's audio owner: the bot is an optional extra on top of a call, so if it ever does throw the user loses the singing bot, not the page.

### How to confirm

- Join a voice channel in a realm whose channel already has a track queued: the call opens full screen, the page stays up, and no "tried to subscribe multiple times" error appears in the console.
- Open the Queue sheet while in the call, and hang up: neither action reloads the page.

## 2026-10-13 — Full-screen calls, MUSIC BOT in the call, Discord-style pickers

### Voice calls take the whole screen

- Why: The expanded call was a bottom sheet capped at 92% height, so tiles, the participant list and the controls had to share a cramped area — the one thing a call needs is room.
- Fix: The call view is now a full-screen layer above the app shell, with safe-area padding, a whole-viewport participant grid and a minimize button that drops back to the chat without ending the call. Audio is unaffected while minimized (it is owned by the provider, not the view).

### MUSIC BOT joins the call and sings

- Why: The bot only ever queued songs into `music_queue`. Nothing played unless you tapped a preview on your own device, so "/play" looked like it did nothing.
- Fix: The bot is now a call participant. Its tile sits with the other people, the header count includes it, and its track plays for everyone in the channel through an audio element owned by the voice provider (so minimizing the call does not cut the song). A queued track starts automatically, `Tap to let MUSIC BOT sing` appears when the browser blocks autoplay, and when a preview ends the bot skips the queue on so it keeps singing. The music panel shows an "In call / Singing in call" chip and its layout stacks on phones.
- Honest scope: tracks are the 30-second iTunes preview clips already stored in the queue, each client plays the same queue item from 0, and previews are start-synced on queue changes rather than sample-synced. Streaming full tracks to a channel needs a server-side audio worker, which this repo does not have.

### Reels: REALMS rail removed

- Why: The realm rail sat in the reels header next to upload and pushed the other controls around on small screens.
- Fix: Reels no longer render it; `ReelsRealmRail` stays in the repo for other surfaces.

### Discord-style mention and slash pickers

- Why: The mention list stacked the name over the handle and the slash menu buried the owning app in the middle of the row, so both read as generic autocompletes rather than the pattern people know.
- Fix: Mentions are one row per member — avatar, bold name, handle pushed to the right edge — under a "Frequently used" / "Members" heading. Slash commands put the app name at the right edge and gained Discord's quick-pick icon strip under the list.

### Emoji, GIF and sticker picker

- Why: The picker was a small popover with one long unsectioned emoji scroll, which is awkward on a phone.
- Fix: It is now a bottom sheet with a drag handle, safe-area padding and a scrolling body, keeping the Emoji / GIFs / Stickers tabs and search. Emoji gained a "Top emoji" quick row, sticky per-section headings and a category strip that jumps to a section.

## 2026-10-13 — UI phases 3–11: calls, counts, stories and import

### DM calls (phase 9)

- Why: The DM call screen built its own STUN-only list, so it ignored the TURN credentials the deployment already serves and failed on restrictive Wi-Fi, VPN and mobile networks while telling the user nothing useful.
- Why: Video started at 720p with no codec preference or bitrate cap, the microphone was published raw (no filtering), and a dropped connection had no recovery path — the screen just said the network failed.
- Fix: `/call/<userId>` now pulls ICE servers from `/api/turn-credentials` (STUN fallback + an honest "no TURN relay configured" note), prefers VP8 with H264 as fallback, caps video at 540p/800 kbps on phones and 720p/1.5 Mbps on desktop, enables `autoGainControl`, routes the mic through a voice-cleanup AudioWorklet (high-pass + noise gate, Web Audio filter fallback, raw mic as the last resort), restarts ICE up to three times with a visible "Reconnecting…" state, shows a poor-connection badge from live RTP stats, holds a screen wake lock, and offers "Tap to enable sound" when remote autoplay is blocked.
- Perfect negotiation replaces the hand-rolled offers: `onnegotiationneeded` handles camera changes, and an offer collision is resolved by the polite peer rolling back instead of both sides deadlocking.
- The RNNoise WASM binary could not be added here (no network access to fetch it, no npm registry), so the worklet implements a conservative gate + high-pass filter instead. It never gates to silence, and the mode is labelled honestly in the console.

### Incoming calls and "Call in progress"

- Why: A ring vanished after 30 seconds with no sound on desktop and no haptic at all, so calls were easy to miss.
- Fix: The ring window is 45 seconds and the sheet vibrates while it is up (best-effort; browsers without vibration simply stay silent).
- Why: Once a call started, anyone in the conversation had no way to tell it was happening.
- Fix: The DM header now watches presence on this conversation's call channel and shows a "Call in progress · Join" pill that opens the call. The watcher uses its own presence key and never tracks, so it is never counted as a participant.

**Not implemented — needs backend work:** the brief's "missed call appears in the chat with a Call back button" and the `start_call`/`join_call`/`end_call` RPCs rely on `calls` and `call_participants` tables that do not exist in this repository's Supabase schema (`backend-sql/` ships only `10_push`…`13_tts`, and `src/integrations/supabase/types.ts` has no call tables). Adding them as frontend-only UI would show buttons that cannot write anywhere, so that item is left out until the call tables land. The current call flow uses realtime presence/broadcast signalling only, which is why it works without them.

### Like / comment counts (phase 8)

- Why: `formatCount` rolled 999,999,999 up to "1000M": the millions branch rounded before it ever checked the billions threshold.
- Fix: One `compact()` helper per unit, with rollover at 999,500, so counts read 999K, 1M, 999M, 1B and never print a 1000 prefix. Verified against 23 fixed cases plus 682 rollover samples in Node.

### Chat stories (phase 10)

- Why: Playback could not go faster than 2x, and the message delays, typing bubble and speech rate were not tied to the speed pill.
- Fix: Added 3x (speaking rate clamps at 3), and the typing bubble and auto-advance now divide their base delay by the selected speed.
- Added an author-only **Import JSON** screen that accepts the documented `chapters → scenes → messages` schema (or an already-flat `lines`/`choices` file), converts it into the saved story shape and inserts it through the author's own session so the existing RLS policies apply. `src/data/room4b.json` is the placeholder example.
- The importer is pure and unit-tested: role-based voice mapping, encounter-order fallback for unnamed casts, scene-relative `goto` targets and friendly errors for invalid JSON, missing chapters or empty text.

### Desktop and chat layout (phases 3, 4, 11)

- Why: On a wide screen the DM page was a single stretched column, so switching conversations meant leaving the chat for `/dms`.
- Fix: `/dm/<userId>` now renders a thread rail beside the conversation from `lg` up, sharing the same `["dm-threads", user.id]` query as `/dms` so both views always agree.

## 2026-10-13 — Realm settings, voice-channel music and the feed

### Mobile scrolling stopped at the first screen

- Why: The app shell treated every `/r/...` path as a chat, so `/r/<slug>/settings` was rendered in a column with `overflow-hidden` and no scroller of its own. On a phone, nothing below the fold could be reached.
- Fix: Only real chat surfaces (DMs, groups, stories and `/r/<slug>` itself) take over the viewport. Realm settings keeps the shell header, the bottom navigation and a scrolling column.

### Channel permissions moved into realm settings

- Why: Per-channel permissions lived in a sheet behind a small "Per-channel" button, and on phones that sheet never opened.
- Fix: The same UI is now a first-class "Channel permissions" section of `/r/<slug>/settings` (channel picker, who may write, who may react). The sheet is still used from the realm chat, and both render one shared body so the two cannot drift apart.

### MUSIC BOT is a voice-channel feature

- Why: `/play` queued into whatever channel it was typed in while the music RPCs refused voice rooms — the opposite of where a music bot belongs — and the `/play` entry also appeared in channels where it always failed.
- Fix: `music_add` and the `/queue`, `/np`, `/skip`, `/stop` runner now require a voice channel, and `realm_slash_commands` offers MUSIC BOT in voice channels only (everything else in text channels only). Voice channels gained a music panel: a `/play` input, now playing with a tap-to-preview player, skip, clear and the queue sheet.

### Feed design

- Why: The feed opened with a bare heading, so the first screen carried no sense of who was reading or what was new.
- Fix: Added a greeting hero with live state and real drop counts, section rules for Stories and Latest drops, a "Share something" button that focuses the composer, and a caught-up footer with a refresh.

## 2026-10-04 — Screenshot-focused UI fixes

### Phase 5: DM message actions

- Why: The message popover was translucent, leaving chat content readable behind the action list.
- Why: Voice and video call controls were included in a message-specific menu.
- Fix: Added a dimmed, blurred backdrop, an opaque action panel, six quick reactions plus an expanded picker, and removed call actions from the menu.

### Phase 6: Story viewer

- Why: The fixed story viewer was rendered inside the app shell's stacking context.
- Why: The global header and navigation had a higher stacking order and covered the story.
- Fix: Rendered the viewer through the shared body-level full-screen layer so it covers the shell and locks background scrolling.

### Phase 7: Reels

- Why: The external-video placeholder did not make the source or next action clear.
- Why: The reel-upload button sat over the bottom action row and could cover Remix.
- Fix: Added a source-branded poster card with an Open original link, moved reel upload to the top of the reel area, and hid the global create-post button on Reels.

No official oEmbed thumbnail is present in the current reel data, so the external card uses a branded poster rather than fetching or rehosting media.

## 2026-10-04 — Room 4B story and narration

- Expanded the four existing Room 4B branches with complete closing sequences and distinct endings.
- Set story playback to exact 1x, 1.5x, and 2x rates.
- Prefer different installed system voices by character and language, with separate pitch and volume profiles when devices expose fewer voices.
- Kept narration on browser-native speech synthesis; this does not require an API key or paid voice service.
