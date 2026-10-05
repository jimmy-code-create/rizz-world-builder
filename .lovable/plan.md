# RIZZ communication polish within the free-credit scope

## Goal
Deliver the highest-impact communication improvements without paid services: cohesive premium popups, reliable free PC/mobile call joining, call waiting and chat, better unsent-message presentation, live in-app notifications, existing browser push integration, and distinct local voices with visible captions in anime chat stories.

## Build order

1. **Restore a clean build**
   - Repair the current TypeScript errors in post and DM message code before adding features.
   - Preserve existing post, poll, reaction, attachment, and deletion behavior.

2. **Premium popup system**
   - Restyle the shared toast system as a compact, nearly opaque glass notification with clear success, error, info, and loading states.
   - Keep popups readable at 390px, above safe areas, with 44px actions and reduced-motion support.
   - Reuse this shared styling instead of creating different popup styles per page.

3. **Free PC/mobile calling**
   - Keep the existing peer-to-peer WebRTC and realtime signaling; no paid TURN relay.
   - Add explicit waiting, joined, reconnecting, declined, and ended states.
   - Synchronize acceptance so other signed-in devices stop ringing after one device answers.
   - Add a lightweight text chat inside an active/waiting call using the existing realtime call channel.
   - Improve call cleanup and end-state messages. Calls will work across PC/mobile on compatible networks; restrictive VPN/Wi-Fi/mobile NAT remains a stated free-mode limitation.

4. **Notifications**
   - Add one global realtime listener for new likes, comments, follows, mentions, group activity, story replies, and calls.
   - Show rich in-app notifications without duplicating alerts on the notifications page.
   - Preserve and connect the existing browser-push preference flow; surface a clear configuration error if the existing free push worker/VAPID setup is incomplete.

5. **Message deletion presentation**
   - Render deleted-for-everyone messages as a restrained “Message unsent” bubble without actions, attachments, or reactions.
   - Keep delete-for-me hidden only for that user and update the conversation immediately.

6. **Story captions and character voices**
   - Strengthen the existing browser-based narrator, player, Asha, Kabir, and Echo voice selection with deterministic fallbacks.
   - Keep exact 1x, 1.5x, and 2x speeds and synchronize the visible caption with the spoken line.
   - Add an honest fallback label when a device exposes only one suitable installed voice.
   - Do not add automatic transcription for uploaded user videos: accurate extraction requires an AI transcription service, which conflicts with the no-paid-service constraint. Existing typed story text remains usable as captions.

7. **Verification**
   - Check desktop and 390px layouts.
   - Exercise two-browser call join, waiting chat, accept/decline/end, notification display, deleted-message display, and story voice playback where browser audio permissions permit.
   - Confirm the latest build has no errors.

## Out of scope for this credit-limited pass
- Paid TURN relay for guaranteed calling on every restricted network.
- AI transcription of audio in uploaded user stories.
- New database tables or destructive schema/data changes.
