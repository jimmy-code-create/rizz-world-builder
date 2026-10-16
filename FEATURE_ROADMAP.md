# RIZZ Feature Implementation Plan
**Date:** 2026-10-16
**Status:** Ready to Implement

## Phase 1: Quick Wins (This Week)

### 1. Story Reactions & Quick Replies ⚡
**Priority:** CRITICAL - Immediate engagement boost
**Time:** 1 week
**Impact:** 3x engagement on stories

#### Implementation:
- Story viewer with reaction bar (❤️ 😂 😮 😢 🔥 👏)
- Slide-up quick reply (Instagram-style)
- Real-time reaction counts
- Notification to story creator

**Files to Create/Modify:**
- `src/components/story/StoryReactions.tsx` (new)
- `src/components/story/StoryViewer.tsx` (modify)
- `src/lib/story-reactions.ts` (new)
- Database: `story_reactions` table

---

### 2. Game Tournaments & Leaderboards 🎮
**Priority:** HIGH - You have games, just add competition
**Time:** 1 week
**Impact:** Daily active usage spike

#### Implementation:
- Weekly realm tournaments
- Global + per-realm leaderboards
- Tournament badges
- Drop rewards for winners

**Files to Create/Modify:**
- `src/components/games/TournamentCard.tsx` (new)
- `src/components/games/Leaderboard.tsx` (new)
- `src/lib/tournaments.ts` (new)
- Database: `tournaments`, `tournament_participants`, `game_scores`

---

### 3. Haptic Feedback Everywhere 📳
**Priority:** HIGH - Polish, already partially implemented
**Time:** 2 days
**Impact:** Premium feel

#### Implementation:
- Add haptics to all interactions
- Message send, reactions, buttons
- Story transitions
- Voice room join/leave

**Files to Modify:**
- `src/lib/haptics.ts` (enhance existing)
- Add to all Button components
- Add to story transitions
- Add to voice controls

---

### 4. Watch Parties (Video Sync) 🎬
**Priority:** MEDIUM - Reuse music player architecture
**Time:** 3 days
**Impact:** New use case, longer sessions

#### Implementation:
- Sync YouTube video playback in voice rooms
- Chat overlay during watch
- Real-time reactions
- Host controls (play/pause/seek)

**Files to Create/Modify:**
- `src/components/voice/WatchParty.tsx` (new)
- Extend `MusicPlayer` for video
- Add to voice room activities

---

### 5. AI Story Generator 🤖
**Priority:** HIGH - Backend exists, wire it up
**Time:** 3 days
**Impact:** More content = more engagement

#### Implementation:
- "Generate story" button in composer
- AI suggests template + text from user activity
- One-tap to post
- Uses existing story-generation.ts

**Files to Create/Modify:**
- `src/components/StoryComposer.tsx` (add AI button)
- `src/lib/story-generation.ts` (already exists, enhance)
- New endpoint for quick generation

---

## Phase 2: Monetization (Week 2)

### 6. Creator Subscriptions 💰
**Priority:** CRITICAL - Revenue stream
**Time:** 2 weeks
**Impact:** Direct revenue + creator retention

#### Implementation:
- $5/month subscription tier per creator
- Exclusive stories (subscribers only)
- Subscriber badge
- Subscriber-only voice rooms
- Custom emoji for subscribers

**Files to Create/Modify:**
- `src/routes/_app/u.$username.subscribe.tsx` (new)
- `src/components/subscriptions/SubscribeButton.tsx` (new)
- `src/lib/subscriptions.ts` (new)
- Database: `subscriptions`, `subscriber_perks`
- Payment integration: Stripe

---

### 7. Virtual Gifts in Voice Rooms 🎁
**Priority:** HIGH - Live streaming monetization
**Time:** 2 weeks
**Impact:** Major revenue potential

#### Implementation:
- Buy gifts with drops
- Send during voice sessions
- Animated effects in call
- Creator gets 70% revenue share

**Files to Create/Modify:**
- `src/components/voice/GiftMenu.tsx` (new)
- `src/components/voice/GiftAnimation.tsx` (new)
- `src/lib/virtual-gifts.ts` (new)
- Database: `virtual_gifts`, `gift_transactions`

---

### 8. Story Boosts (Paid Promotion) 📈
**Priority:** MEDIUM - Direct revenue
**Time:** 1 week
**Impact:** Proven revenue model

#### Implementation:
- $2-$10 to boost story to explore
- Target by interests/location
- Analytics on views/engagement

**Files to Create/Modify:**
- `src/components/story/BoostDialog.tsx` (new)
- `src/lib/story-boosts.ts` (new)
- Database: `story_boosts`

---

## Phase 3: Viral Growth (Week 3-4)

### 9. Cross-Post to TikTok/Instagram 🔄
**Priority:** CRITICAL - Growth multiplier
**Time:** 1 week
**Impact:** Massive discovery channel

#### Implementation:
- OAuth with TikTok/Instagram
- One-tap cross-post from story
- Auto-add "Made on Rizz" watermark
- Track referral traffic

**Files to Create/Modify:**
- `src/components/story/CrossPostButton.tsx` (new)
- `src/lib/social-integrations.ts` (new)
- OAuth flows for TikTok, Instagram

---

### 10. Invite Contests 👥
**Priority:** HIGH - Referral growth
**Time:** 2 days
**Impact:** Exponential user growth

#### Implementation:
- Invite 5 friends = exclusive badge
- Top referrer weekly = verified badge
- Both get drops on join
- Leaderboard

**Files to Create/Modify:**
- `src/routes/_app/invite.tsx` (new)
- `src/components/InviteLeaderboard.tsx` (new)
- `src/lib/referrals.ts` (enhance)
- Database: `referral_contests`

---

### 11. Rizz Score Algorithm v2 ⭐
**Priority:** MEDIUM - Gamification
**Time:** 3 days
**Impact:** Engagement boost

#### Implementation:
- Public formula display
- Daily/weekly leaderboards
- "Rising star" badge
- Share score to socials

**Files to Create/Modify:**
- `src/routes/_app/leaderboard.tsx` (enhance)
- `src/lib/rizz-score-v2.ts` (new)
- Add transparency to scoring

---

## Phase 4: Creator Tools (Week 4-5)

### 12. Analytics Dashboard 📊
**Priority:** HIGH - Creator retention
**Time:** 1 week
**Impact:** Professional tool

#### Implementation:
- Story views over time
- Audience demographics
- Peak activity hours
- Engagement rate
- Export data

**Files to Create/Modify:**
- `src/routes/_app/analytics.tsx` (new)
- `src/components/analytics/` (new folder)
- `src/lib/analytics.ts` (new)

---

### 13. Scheduled Posts ⏰
**Priority:** MEDIUM - Convenience
**Time:** 3 days
**Impact:** Consistent content

#### Implementation:
- Schedule stories up to 1 week
- Queue view
- Auto-post at chosen time
- Timezone support

**Files to Create/Modify:**
- `src/components/StoryComposer.tsx` (add schedule)
- `src/lib/scheduled-posts.ts` (new)
- Database: `scheduled_stories`
- Cron job for posting

---

### 14. Custom Realm Themes 🎨
**Priority:** MEDIUM - Customization
**Time:** 1 week
**Impact:** Creator ownership

#### Implementation:
- Custom banner/icon upload
- Accent color picker
- Custom emoji set
- Animated entrance effects

**Files to Create/Modify:**
- `src/routes/_app/r.$slug_.settings.tsx` (enhance)
- `src/components/realms/ThemeEditor.tsx` (new)
- Database: `realm_themes`

---

## Phase 5: Advanced Features (Week 5-6)

### 15. Voice Room Recording 🎙️
**Priority:** MEDIUM - Content creation
**Time:** 2 weeks
**Impact:** Voice rooms become content

#### Implementation:
- Optional: Record sessions
- AI clips best moments
- Share highlights to feed
- Privacy controls

**Files to Create/Modify:**
- `src/components/voice/RecordingControls.tsx` (new)
- `src/lib/voice-recording.ts` (new)
- AI highlight generation
- Storage: Audio files

---

### 16. Collab Stories 👥
**Priority:** HIGH - Viral growth
**Time:** 1 week
**Impact:** Duet-style collaboration

#### Implementation:
- Invite friend to co-create
- Split screen or alternating
- Both profiles tagged
- Shared audience

**Files to Create/Modify:**
- `src/components/story/CollabInvite.tsx` (new)
- `src/components/StoryComposer.tsx` (collab mode)
- `src/lib/story-collabs.ts` (new)

---

### 17. Stories Camera (Native Feel) 📸
**Priority:** HIGH - UX improvement
**Time:** 1 week
**Impact:** Instagram-like experience

#### Implementation:
- Swipe front/back camera
- Hold to record video (15-60s)
- Tap for photo
- Real-time filters

**Files to Create/Modify:**
- `src/components/story/NativeCamera.tsx` (new)
- Camera API integration
- Video recording

---

## Implementation Order (Recommended)

### Week 1: Quick Wins
1. ✅ Haptic Feedback (2 days)
2. ✅ Story Reactions (5 days)

### Week 2: Engagement
3. ✅ Game Tournaments (5 days)
4. ✅ AI Story Generator (2 days)

### Week 3: Growth
5. ✅ Invite Contests (2 days)
6. ✅ Watch Parties (3 days)
7. ✅ Scheduled Posts (2 days)

### Week 4: Monetization
8. ✅ Story Boosts (5 days)
9. ✅ Creator Subscriptions (start)

### Week 5: Monetization + Tools
10. ✅ Creator Subscriptions (finish)
11. ✅ Virtual Gifts (start)
12. ✅ Analytics Dashboard (start)

### Week 6: Polish
13. ✅ Virtual Gifts (finish)
14. ✅ Cross-Post Integration
15. ✅ Collab Stories

---

## Database Schema Changes Needed

```sql
-- Story Reactions
CREATE TABLE story_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, user_id, emoji)
);

-- Story Quick Replies
CREATE TABLE story_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id UUID REFERENCES realms(id),
  game_id TEXT NOT NULL,
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  prize_drops INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tournament_participants (
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  rank INTEGER,
  PRIMARY KEY (tournament_id, user_id)
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tier TEXT DEFAULT 'basic',
  price_cents INTEGER NOT NULL,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(creator_id, subscriber_id)
);

-- Virtual Gifts
CREATE TABLE virtual_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cost_drops INTEGER NOT NULL,
  animation_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gift_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id UUID REFERENCES virtual_gifts(id),
  sender_id UUID REFERENCES profiles(id),
  recipient_id UUID REFERENCES profiles(id),
  room_id UUID REFERENCES voice_rooms(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Story Boosts
CREATE TABLE story_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  amount_cents INTEGER NOT NULL,
  target_interests TEXT[],
  views_gained INTEGER DEFAULT 0,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled Stories
CREATE TABLE scheduled_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  story_data JSONB NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  posted BOOLEAN DEFAULT FALSE,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referral Contests
CREATE TABLE referral_contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  prizes JSONB,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Story Collabs
CREATE TABLE story_collabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id),
  inviter_id UUID REFERENCES profiles(id),
  invitee_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Tech Stack Requirements

### New Dependencies:
```json
{
  "stripe": "^14.0.0",
  "node-cron": "^3.0.3",
  "@ffmpeg/ffmpeg": "^0.12.10",
  "canvas": "^2.11.2"
}
```

### External APIs:
- Stripe (payments)
- TikTok API (cross-posting)
- Instagram Graph API (cross-posting)
- FFmpeg (video processing)
- OpenAI (AI story generation - already integrated)

---

## Success Metrics

### Story Reactions:
- Target: 60% of story views result in reaction
- Metric: reaction_rate = reactions / views

### Tournaments:
- Target: 40% participation rate in active realms
- Metric: participants / realm_members

### Subscriptions:
- Target: 5% conversion rate for creators with >100 followers
- Metric: subscribers / followers

### Cross-Posting:
- Target: 20% of stories cross-posted
- Metric: cross_posts / total_stories

### Referrals:
- Target: 1.5 avg invites per user
- Metric: total_invites / total_users

---

## Ready to Start Implementation! 🚀

**Which features should I implement first?**
1. Quick Wins (Haptics + Story Reactions)?
2. Monetization (Subscriptions + Virtual Gifts)?
3. Growth (Cross-posting + Invite Contests)?

Or should I implement them all in the recommended order?
