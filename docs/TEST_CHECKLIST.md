# RIZZ Test Checklist

## Web Slinger — the single profile effect (this pass)

- [ ] `/effects` shows one card: the Web Slinger at banner size, with the avatar disc in place. No other effects, decorations or nameplates are listed anywhere.
- [ ] Equip it: the toast confirms, `/u/<you>` shows the hero in the banner, and the scene is still there after a reload.
- [ ] Open the same profile in a second browser (or signed out, after the migration): the effect is visible to visitors, not just the owner.
- [ ] Inspect the effect: the host and SVG have no background, no `<img>` and no full-canvas rect; the character is complete from mask to boots; webs leave both hands; the profile banner colour shows through the gaps.
- [ ] Click the avatar, name, edit/follow buttons and the tab bar: all still work — the effect never intercepts a pointer.
- [ ] Enable OS reduced motion: the scene becomes a still with the strands drawn and the motes at rest. Disable it: the loop resumes.
- [ ] On a phone-width banner the figure stays centred and complete; on a low-end device (`navigator.hardwareConcurrency <= 2`) it renders still.
- [ ] Scroll the banner out of view and back: animations pause off screen and resume without a jump.
- [ ] Remove the effect from `/effects`: the banner returns to its plain banner image/gradient.
- [ ] Without `20261029000000_web_slinger_only.sql`, equipping still shows the effect for you and the toast says it is saved on this device.
- [ ] `bun tests/web-slinger-effect.test.mjs` passes (13 checks); `bun tsc -b --noEmit` passes.

## Profile badge showcase (this pass)

- [ ] Own profile: a **Badges** section sits under the bio/Into block with an **Equip badges** button; other members see the showcase row instead of the button.
- [ ] Press **Equip badges**, tap a badge: the tile reads "On", the counter shows `1/3`, and the badge appears in the section for visitors.
- [ ] Try a fourth badge: the toast explains the 3-badge cap; unequip one and the fourth equips.
- [ ] Unequip everything: the section falls back to the full earned row the profile already showed — nothing disappears for visitors.
- [ ] A profile with no equipped badges shows visitors the earned row exactly as before (existing flow preserved).
- [ ] A slug in `profiles.badges` the member never earned does not render in the showcase.
- [ ] Until `20261020010000_profile_card.sql` is applied, equipping toasts "Badge showcase needs the latest database migration" — never a raw database error.
- [ ] `bun tests/profile-badges.test.mjs` passes (7 checks) and `bun tests/profile-badges.render.test.tsx` passes (8 checks, renders the real section).

## Badge artwork (this pass)

- [ ] `/badges`: every emblem renders with its gradient fill, engraved rim and ink glyph at grid size and in the inspector (120px) — nothing blank, black or clipped.
- [ ] A 20px badge beside a name (feed author, profile row, hover card, tooltip chip) is still readable: silhouette plus glyph, no mush.
- [ ] Top Rizzler and Early Supporter read as shields with the black chevron; verified badges read as lime seals with an ink check.
- [ ] Verified Creator shows the creator seal (play glyph), not the member Verified check.
- [ ] Night Owl keeps its light crescent — it must not look like a missing badge next to the silver medallions.
- [ ] Share a badge: the exported PNG carries the new artwork (canvas pulls the symbol from the sprite).
- [ ] Locked badges stay greyscale at 35% and do not lift on hover.

## Badge renames (this pass)

- [ ] A member who held Early Rizzer now shows **HypeSquad Bravery** on their profile, badge shelf and share card — same award date, new name.
- [ ] A member who held Channel Founder shows **Verified Creator** and holds exactly one row for it (the merge must not duplicate).
- [ ] On a fresh database the migration is a no-op: applying it twice changes nothing and throws no error.
- [ ] `/badges` → Archive lists the renamed badges with the new names; searching "Bravery" finds HypeSquad Bravery.
- [ ] Creating a new realm grants neither badge (the old channel-founder trigger is gone).

## Story composer: typing, living text, templates (this pass)

- [ ] Open a story, add **Text**, and type a full sentence without stopping: every letter lands, the caret follows, and Backspace deletes one character at a time (it used to keep only the last letter).
- [ ] Type `@` inside the story text: the mention picker appears and picking someone inserts the handle instead of eating the sentence.
- [ ] Press **Live text** in the tool row: a text layer opens with the Live toggle on; the words breathe in the editor.
- [ ] Tap **Text** on a photo story: the label appears below the centre — not stacked on the middle of the photo or a template's centre slot — and drags anywhere.
- [ ] Tune a layer's Live toggle from the text toolbar: on/off both update the preview immediately.
- [ ] Share a story with a live layer and no motion overlay picked: the post is a 3s clip where the text keeps moving (not a still), and the caption is still written.
- [ ] With reduced motion enabled in the OS, the editor shows the text still; posting still produces the clip.
- [ ] Apply **Grid 4** from Sets: four dashed slots appear, the first is selected, and tapping a slot opens the picker (previously the tap was swallowed by dragging).
- [ ] Fill the first slot: selection jumps to the next dashed slot, so four taps fill the grid.
- [ ] Add your own text and sticker, then switch to **Grid 2**: your text and sticker survive, the grid re-shapes, and the photo already placed carries across to the first new slot.
- [ ] Double-tap a filled slot: the picker opens and replaces that photo.
- [ ] Apply **Blank**: layout layers clear, your own text/stickers remain, and the background is not forced back.
- [ ] Apply **Polaroid** then post: the frame border and the handwritten caption are in the exported image.
- [ ] Story text export matches the editor (position, font, colour, size) for both a preset template caption and a hand-typed one.

## RIZZ Companion removed (this pass)

- [ ] No floating Lil Rizz orb on any signed-in route, including feed, DMs and realms.
- [ ] Settings → Preferences no longer lists a RIZZ Companion row and the page still saves the other switches.
- [ ] Account → clear local cache still works and no longer special-cases the companion key.

## Badge earning (this pass)

- [ ] Open `/badges` as a fresh account: Newcomer is already unlocked (the first sync awards it) and the other cards show their progress bars.
- [ ] Send 100 messages across a realm, a channel and a DM, then reopen the app: Chatterbox unlocks, the toast names it once, and reloading does not repeat the toast.
- [ ] Send one message at 02:00 UTC: Night Owl unlocks. Repeat on a clean account at 05:00: it stays locked.
- [ ] Claim a drop: Bounty Hunter unlocks (its bar reads 1 / 1).
- [ ] Get a post to 50 likes: Meme Lord unlocks — one hit post is enough, other posts' likes do not matter.
- [ ] Post on seven consecutive days (or seed backdated posts): 7 Day Streak unlocks; skip a day and the bar resets to the new run.
- [ ] Comment on each of the last three days without posting: the streak bar still shows 3 (comments count as activity).
- [ ] Move into the all-time top 10 with test scores: Top Rizzler unlocks; stay at #11 on a fresh account and it does not.
- [ ] A brand-new account created long after launch never gets Early Supporter, and the earliest account always does. Its card carries no bar (account age is not the rule).
- [ ] Verified and Game Champ never auto-unlock: they are team awards.
- [ ] Before the badge-earning migration is applied the app still loads: no toast, no error, no crash from the missing RPCs.
- [ ] Reload several times: nothing is awarded twice and nothing is revoked.

## Games hub and activities in the call (this pass)

- [ ] The gamepad button in the voice call opens `/games` (the call keeps running; the mini bar stays at the bottom of the page with a way back in).
- [ ] `/games` lists Pixel Arena, Neon Snake and Pixel Rally with "No sign-up" / "Fullscreen" / "Runs in RIZZ" chips, plus the web games from `src/data/games.json`.
- [ ] Outside a call, "Play now" opens the game full screen immediately — no account prompt, no new tab, and the fullscreen button works (hidden on iPhone Safari, which has no element fullscreen).
- [ ] Pixel Arena: blob follows the pointer, WASD and touch drag; eating pixels grows the size chip; a bigger rival eats you and the respawn card appears; "New arena" restarts.
- [ ] Neon Snake: arrows/WASD and swipes turn the snake; food grows it and speeds the tick up (score chip climbs); hitting a wall or a body shows the respawn card and the rival snakes keep playing.
- [ ] Pixel Rally: drag or arrows move the bottom paddle, rallies speed the ball up, the CPU does sometimes miss, first to 7 shows the win card, and the toggle switches to two players (top paddle uses A and D).
- [ ] While any game is on screen, the app-wide shortcuts stay quiet (pressing G then D does not navigate to DMs mid-round, and Space does not scroll the page).
- [ ] In a voice channel, "Play in call" starts the activity: the launcher lands straight in the game, everyone else sees the "X started Y" banner, and the header count/participant tiles show "Playing …" for those with it open.
- [ ] The overlay draws the game as the background with the voice dock floating over it: speaking rings light up, mute/deafen/leave work, video participants appear as tiles in the dock, and H is not needed to keep talking.
- [ ] The dock hides with the chevron and comes back from the "Voice · N in call" pill.
- [ ] On desktop, the grid button on the overlay swaps to the voice-first side panel, and its expand button goes back to full screen with voice on top.
- [ ] Ending the game (starter or voice host) closes it for everyone and toasts "Game ended"; leaving only closes your own copy.
- [ ] The hub lists 15 built-in games plus the web ones; the Action / Board games / Puzzles filters each show the right set and search narrows it.
- [ ] Chess: tap a white piece to see its squares, move, and the engine replies; castling works once f1/g1 are empty, a pawn on the 7th offers the promotion picker, and Hint highlights a real move. Checkmate/stalemate text matches the board.
- [ ] Checkers: when a capture exists only the captures are offered, a multi-jump lands in one tap, a man reaching the far rank shows a crown, and losing all pieces ends the game.
- [ ] Connect Four: the engine drops into a winning column when it has one and blocks your three, and four in a row highlights.
- [ ] Tic-Tac-Toe: the engine never loses and "Play as O" lets it move first.
- [ ] Reversi: legal squares are dotted, placing flips every sandwiched disc, and having no move auto-passes.
- [ ] 2048: swiping merges like tiles once per slide, a merged tile does not merge again, and the board locks with a score card when there are no moves.
- [ ] Minesweeper: the first tap is never a mine, an empty cell opens its neighbourhood, flag mode marks a cell, and the timer runs.
- [ ] Sudoku: cells clash in red, Hint fills a correct cell, a full correct grid reports solved.
- [ ] Memory Match: 6/8/12 pairs deal a different set each time and matched pairs stay face up.
- [ ] Breakout: the ball angles off the paddle edge, lives tick down on a miss, and clearing the wall advances the level.
- [ ] Neon Void: holding fires, waves get denser, pink enemies survive one hit, and game over shows score + best.
- [ ] Reaction Rush: a tile lights up, fast taps score more, ignoring a tile breaks the streak, and the round ends at 30s.
- [ ] In all of them the in-call overlay still floats the voice dock over the board and the app shortcuts stay quiet.
- [ ] `bun run arcade:check` and `bun run games:render` both pass (headless rules checks and a render of every built-in game).

## Story likes, any-source music, Voice & Sound, chat rhythm, face lenses (this pass)

### Stories
- [ ] Tap ❤️ on a story: the count goes up immediately; reload — it is still up, and a second tap removes it.
- [ ] Block the write (go offline) and tap ❤️: the flag and the count both snap back, with an error toast — nothing is left showing a like that was not saved.
- [ ] Double-tap a story: a heart bursts and the story gets liked once (a single tap never unlikes it).
- [ ] Open your own story: the button shows "N ❤"; the insights sheet lists views and shows the same like count.
- [ ] A story you have already watched loses its gradient ring; a new story from anyone brings the gradient back.
- [ ] Post with audience **Followers only** from an account that follows nothing: a second account that does not follow the author cannot see it (check the strip and direct API access).
- [ ] Post with **Close friends** and verify only close friends see it; add someone to **Hide from** and confirm they don't, even though the audience includes them.
- [ ] Reply to a story: it arrives as a normal DM in the author's inbox and no story bubble appears in any chat.
- [ ] Type `@` in a story caption and in a story text overlay: the member picker appears and inserting a mention renders as a link in the viewer.

### Music
- [ ] `/play` a song name → Apple preview, title, artwork and provider chip appear.
- [ ] `/play https://youtu.be/…` → real title, thumbnail and provider chip "YouTube", and the track plays through the embedded player (no download).
- [ ] `/play https://open.spotify.com/track/…` → "That link isn't supported yet" and nothing is queued.
- [ ] `/play https://youtube.com/playlist?list=…` → queues the playlist and plays it.
- [ ] `/play <direct .mp3 URL>` → plays inline, seek bar works.
- [ ] Join the channel's call: MUSIC BOT sings a YouTube track as well as an Apple one.
- [ ] Play a private/deleted video: the player shows "That video is unavailable" and skips to the next track.
- [ ] A video with embedding disabled shows "This track can't be embedded" and skips.
- [ ] Loop, restart, skip, queue list and inline volume all work in the voice-channel panel.

### Voice & Sound
- [ ] Settings → Voice & Sound opens and every slider saves (reload keeps the values).
- [ ] Moving the music slider changes a playing track's volume without restarting it.
- [ ] Test sound is audible; mute-everything silences it and shows the "you're muted" hint.
- [ ] A value above 100% on music shows "capped at 100%" for streamed media; the notification slider does go louder.
- [ ] Mic sensitivity changes when the speaking ring lights up; noise suppression shows as on/off for the next call.
- [ ] Input device picker lists devices after mic permission is granted; output picker is hidden where the browser has no `setSinkId`.
- [ ] Per-realm override changes only that realm's bot volume and can be reset.

### Chat rhythm
- [ ] Consecutive messages from one author sit ~3px apart; a new author gets ~18px.
- [ ] A day change inserts Today/Yesterday/dated separator, and the hover time appears in the avatar gutter on desktop (not on touch).
- [ ] At 375px, message side padding and media cards look right and nothing overflows.
- [ ] Changing `--chat-gap-same` / `--chat-gap-group` in `src/styles.css` visibly re-tunes the whole chat.

### Face lenses
- [ ] The story editor's Lens tool opens the studio and the camera permission prompt appears; denying it shows Retry + Pick a photo.
- [ ] Every category is reachable and the carousel swipes; tapping a lens applies it, tapping it again removes it.
- [ ] Intensity changes live for a warp (Big Eyes) and for a filter (Pixel 8-bit).
- [ ] With no face in frame, "No face found — showing the original image" appears and the frame is untouched.
- [ ] A gallery photo gets real detection (ears/hats track the head in the still).
- [ ] Reactive lenses respond to the right expression: jawOpen for fire breath, pucker for kiss burst, tongueOut for dog tongue.
- [ ] The fps badge appears; deliberately slowing the device drops it to "low" (half resolution) and it recovers.
- [ ] Background Replace and Face Swap show their "needs …" note instead of a broken result.
- [ ] Capture returns the frame into the story composer, where text/stickers/filters layer on top of it.

## Screenshot-focused changes

- [ ] On mobile, opening a story covers the app header and bottom navigation, respects safe areas, and prevents background scrolling.
- [ ] On desktop, the story viewer is above the app shell and closes with its close control or swipe gesture.
- [ ] In a DM, long-pressing a message dims and blurs the chat while keeping the selected message and menu readable.
- [ ] The DM menu shows six quick reactions and a working additional-reactions control; it has no voice/video call actions.
- [ ] Copy, reply, report, and available delete actions still work from the DM menu.
- [ ] Room 4B can be played in Hindi and English through all four story branches, reaches a distinct ending on each path, and replays from the start.
- [ ] Room 4B offers 1x, 1.5x, 2x and 3x narration rates; at 2x/3x the typing bubble and auto-advance are visibly faster, and the spoken rate changes with the pill.
- [ ] Room 4B selects distinct installed voices for narrator, player, Asha, Kabir, and Echo where available; pitch and volume profiles distinguish characters when only one system voice is available.
- [ ] On mobile Reels, the global create-post button is hidden and reel upload does not overlap Remix or the action rail.
- [ ] External Reels show the original source and an Open original link; no video is downloaded or rehosted.
- [ ] Verify the external-video card at full-screen Reel size and in the compact post-embed size.

## Realm chat, voice and pickers (this pass)

- [ ] Options → "Channels & permissions" opens the sheet on mobile and desktop and never shows "This page didn't load"; switching channels in the sheet and flipping a member's switch both work.
- [ ] The realm composer still reflects a per-channel write block set from that sheet.
- [ ] Queue a song in a voice channel's music panel, then join that channel's call: MUSIC BOT appears as a participant and the song is audible to everyone in the call (first tap starts it if the browser blocks autoplay).
- [ ] A track with no preview audio says so on the bot tile instead of sitting silent; skip/stop still work from the call.
- [ ] The music panel's local preview does not play over the in-call bot (no doubled, out-of-sync audio).
- [ ] Long-pressing a message shows the author, time and text at the top of the menu; on a phone the menu arrives as a bottom sheet that does not cover the conversation.
- [ ] "View message" opens the full message with a working copy button.
- [ ] Delete your own message in a text channel and in the realm's own channel: it disappears in both, not just the second.
- [ ] As realm owner (and as a moderator), delete someone else's message from the long-press menu: it is removed for everyone and disappears without a reload.
- [ ] The @ mention picker and the / command picker show the section label, row layout, right-aligned app/handle and the keyboard-hint footer.
- [ ] With owner and moderator roles, the moderation actions (pin, reaction roles, delete for everyone) are all visible; a plain member sees only their own delete plus report.

## Broader regression checks from the project spec

- [ ] Calls: PC to PC.
- [ ] Calls: mobile to mobile.
- [ ] Calls: PC to mobile.
- [ ] Calls: mobile to PC.
- [ ] Group invite preview and join work for a full URL and a bare invite code.
- [ ] Block and unblock work from the DM and privacy settings.
- [ ] Group members can send messages and receive updates without duplicate messages.
- [ ] Like and comment counts stay correct after rapid taps and realtime updates.
- [ ] Story layout works for media and text stories without overlapping captions or global navigation.
- [ ] Reel layout has no Remix overlap; official embeds and original-site cards remain distinct.
- [ ] Chat-story playback offers 1x, 1.5x, 2x and 3x, and each selection changes narration speed exactly.
- [ ] Chat-story characters use distinct voices, and each voice can be previewed or muted.

## Build checks

- [x] `npm run build`
- [x] `npx tsc --noEmit`
- [ ] Verify authenticated screens in the running preview after the existing Supabase environment is available. The workflow starts, but the preview currently stops at the missing Supabase configuration; no authentication bypass or environment change was made.

## Full-screen call, MUSIC BOT and picker checks

- [ ] Joining a voice channel opens a full-screen call: tiles fill the screen, safe areas are respected, the chat sits behind it, and the minimize (⌄) button returns to the chat with the call still running and everyone's audio still playing.
- [ ] `/play <song>` in a voice channel: MUSIC BOT appears as a participant tile with the track title, the header count includes it, and the track plays with nobody tapping anything.
- [ ] With browser autoplay blocked, "Tap to let MUSIC BOT sing" appears and starts playback on tap.
- [ ] When a preview finishes the bot moves to the next queued song instead of going silent; Pause on the tile stops it for that listener only.
- [ ] The music panel shows "Singing in call" for the current track, and its form stacks on a phone with a full-width Play button.
- [ ] Reels no longer show the REALMS chip row; upload is the only control at the top-left.
- [ ] Typing `@` shows one row per member (avatar, bold name, handle right-aligned) under a "Frequently used"/"Members" heading, and Enter picks without sending.
- [ ] Typing `/` shows commands with the app name right-aligned and the quick-pick icon strip underneath; tapping an icon runs that command.
- [ ] The emoji button opens a bottom sheet with a drag handle, Emoji/GIFs/Stickers tabs, search, a "Top emoji" row, section headings and a category strip that scrolls to a section.

## Phases 3–11 checks added in this pass

- [ ] DM call: TURN credentials are requested from `/api/turn-credentials`; with no relay configured the screen says "No TURN relay configured…" instead of pretending the call can always connect.
- [ ] DM call: video starts and the encoder is capped (540p on a phone, 720p on desktop); the camera can be switched on mid-call without breaking audio.
- [ ] DM call: "Enhanced noise cancellation on/off" toggles without dropping the call, and background hum noticeably drops when it is on.
- [ ] DM call: pulling the Wi-Fi for a few seconds shows "Reconnecting…" and the call recovers; after three failed ICE restarts the troubleshooting message appears.
- [ ] DM call: remote audio blocked by autoplay shows "Tap to enable sound", and tapping it produces sound.
- [ ] DM call combinations, each in both directions: PC→PC, mobile→mobile, PC→mobile, mobile→PC.
- [ ] Incoming call on a phone vibrates while the sheet is up and auto-dismisses after 45 seconds.
- [ ] With a call already running between two accounts, the other account's DM header shows the "Call in progress · Join" pill, and tapping it joins the call. The pill disappears when the call ends.
- [ ] Missed calls in the chat with a "Call back" button are **not** implemented: they need the `calls` / `call_participants` backend that this repo does not ship yet.
- [ ] Counts: a post at 999,999,999 reads "1B" (never "1000M"), and 1,240 reads "1.2K".
- [ ] Chat stories: "Import JSON" accepts `src/data/room4b.json`, saves it under your account and opens the player; a malformed file shows a friendly error instead of a crash.
- [ ] Chat stories: importing a file while signed out, or that your account may not create, is refused by RLS with a message rather than a partial story.
- [ ] Desktop (≥1024px): opening a DM shows the thread rail on the left with the open conversation highlighted, and switching threads keeps the chat scrolled to the newest message.
- [ ] Mobile (390px): the DM page is still a single column and the thread rail is hidden.