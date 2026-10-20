-- Badge earning system.
--
-- Before this migration a badge could only appear through an admin INSERT or a
-- handful of legacy triggers (first post, first drop, channel founder, rizz
-- milestones) that no longer match the catalog. This adds the missing half:
-- criteria the server can actually measure, a progress read for the badge
-- shelf, and a self-sync that awards whatever the member has already earned.
--
-- Three properties matter:
--   * Membership is derived, never asserted. `sync_my_badges()` only reads
--     activity (posts, likes, messages, stories, profile row) — a client cannot
--     ask for a badge by slug, and cannot act for anyone but itself.
--   * It is idempotent. user_badges has (user_id, badge_id) as its primary key,
--     so re-syncing awards nothing new and revokes nothing.
--   * Rerunning this file is safe: the seed upserts by slug.

-- ============ EARN METADATA ============
ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS earn_rule text,
  ADD COLUMN IF NOT EXISTS earn_target integer;

COMMENT ON COLUMN public.badges.earn_rule IS
  'How the badge is earned: join | likes | messages | night | post_likes | bounties | rank | streak | early_join. NULL means a team award.';
COMMENT ON COLUMN public.badges.earn_target IS
  'Threshold the measured value has to reach. Ignored by the join/night/early_join rules.';

-- ============ THE 12-BADGE COLLECTION ============
-- Mirrors BADGE_SET in src/lib/badge-set.ts (slug, name, flavor, tier, accent).
-- The legacy rows from badge_set_v2 stay untouched as the Archive shelf; their
-- earn_rule is NULL, which reads as a team award.
INSERT INTO public.badges
  (slug, name, description, icon, color, rarity, animated, glow_color, tier, earn_rule, earn_target)
VALUES
  ('rookie',        'Newcomer',        'Join RIZZ and claim your first badge.',            ':cat_gg:',    '#C6FF1A', 'common',    false, '#C6FF1A', 1, 'join',       1),
  ('smooth-talker', 'Chatterbox',      'Send 100 messages across RIZZ chats.',              ':cat_music:', '#F2F2F2', 'common',    false, '#F2F2F2', 1, 'messages',   100),
  ('rising-star',   'Rising Star',     'Earn 100 likes across your posts and stories.',     ':cat_hype:',  '#FFC93C', 'rare',      false, '#FFC93C', 2, 'likes',      100),
  ('night-owl',     'Night Owl',       'Take part in RIZZ between midnight and 4am.',       ':cat_cool:',  '#8B5CF6', 'rare',      false, '#8B5CF6', 2, 'night',      1),
  ('verified',      'Verified',        'Verified by a RIZZ admin.',                        ':cat_love:',  '#2EE6C5', 'rare',      false, '#2EE6C5', 2, 'manual',     NULL),
  ('streak-7',      '7 Day Streak',    'Show up on RIZZ seven days in a row.',              ':cat_gg:',    '#FFB020', 'rare',      false, '#FFB020', 2, 'streak',     7),
  ('meme-lord',     'Meme Lord',       'Make a post that reaches 50 likes.',                ':cat_hype:',  '#FF5FA2', 'epic',      false, '#FF5FA2', 3, 'post_likes', 50),
  ('bounty-hunter', 'Bounty Hunter',   'Complete a RIZZ bounty.',                           ':cat_cool:',  '#FF7A1A', 'epic',      false, '#FF7A1A', 3, 'bounties',   1),
  ('streak-30',     '30 Day Streak',   'Show up on RIZZ thirty days in a row.',             ':cat_hype:',  '#FF3B30', 'epic',      false, '#FF3B30', 3, 'streak',     30),
  ('top-rizzler',   'Top Rizzler',     'Reach the top 10 on the RIZZ leaderboard.',         ':cat_gg:',    '#C6FF1A', 'legendary', false, '#C6FF1A', 4, 'rank',       10),
  ('game-champ',    'Game Champ',      'Win ten RIZZ games.',                               ':cat_gg:',    '#FFC93C', 'legendary', false, '#FFC93C', 4, 'manual',     NULL),
  ('og',            'Early Supporter', 'Your account joined in RIZZ''s first 30 days.',      ':cat_love:',  '#C6FF1A', 'mythic',    false, '#C6FF1A', 5, 'early_join', 1)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  color       = EXCLUDED.color,
  rarity      = EXCLUDED.rarity,
  glow_color  = EXCLUDED.glow_color,
  tier        = EXCLUDED.tier,
  earn_rule   = EXCLUDED.earn_rule,
  earn_target = EXCLUDED.earn_target;

-- ============ SUPPORTING INDEXES ============
-- Progress and sync count a single member's rows, so each counter gets a
-- (author, time) index it can answer from without a heap scan.
CREATE INDEX IF NOT EXISTS idx_group_messages_author_time
  ON public.group_messages (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_time
  ON public.direct_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_author_time
  ON public.stories (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_author_time
  ON public.messages (author_id, created_at DESC);

-- ============ MEASUREMENT ============
-- One row per badge in the live collection: the measured value, the goal, and
-- whether it is met right now. `badge_progress_for` is internal (it exposes
-- message counts, which are nobody else's business); the authenticated wrapper
-- below is fixed to auth.uid().
CREATE OR REPLACE FUNCTION public.badge_progress_for(_user uuid)
RETURNS TABLE (slug text, rule text, progress integer, goal integer, met boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_likes    integer;
  v_messages integer;
  v_peak     integer;
  v_night    integer;
  v_bounties integer;
  v_rank     integer;
  v_streak   integer;
  v_early    boolean;
BEGIN
  IF _user IS NULL THEN
    RETURN;
  END IF;

  -- Likes received: every like on your posts plus every like on your stories.
  SELECT
    COALESCE((SELECT sum(p.like_count) FROM public.posts AS p WHERE p.author_id = _user), 0)
    + COALESCE((SELECT sum(s.like_count) FROM public.stories AS s WHERE s.author_id = _user), 0)
  INTO v_likes;

  -- Messages sent: realm/group messages, legacy channel messages and DMs.
  -- Same three sources the collection's own counter reads, so the bar and the
  -- award never disagree.
  SELECT
    (SELECT count(*) FROM public.group_messages AS gm WHERE gm.author_id = _user)
    + (SELECT count(*) FROM public.messages AS m WHERE m.author_id = _user)
    + (SELECT count(*) FROM public.direct_messages AS dm WHERE dm.sender_id = _user)
  INTO v_messages;

  -- Bounties completed: one claim on a drop counts.
  SELECT count(*) FROM public.drop_claims AS dc WHERE dc.user_id = _user INTO v_bounties;

  -- Best single post: the peak like_count is what "make a post that reaches 50"
  -- means, so one hit post is enough however many posts you have.
  SELECT COALESCE(max(p.like_count), 0)
  INTO v_peak
  FROM public.posts AS p
  WHERE p.author_id = _user;

  -- Night owl is counted in UTC. The app has no per-member timezone on the
  -- server, and a fixed window keeps the rule honest instead of guessing.
  SELECT (
    EXISTS (
      SELECT 1 FROM public.group_messages AS gm
      WHERE gm.author_id = _user
        AND extract(hour FROM gm.created_at AT TIME ZONE 'UTC') < 4
    )
    OR EXISTS (
      SELECT 1 FROM public.direct_messages AS dm
      WHERE dm.sender_id = _user
        AND extract(hour FROM dm.created_at AT TIME ZONE 'UTC') < 4
    )
  )::int INTO v_night;

  -- All-time rank on the same cached score the leaderboard reads.
  SELECT r.rank INTO v_rank
  FROM (
    SELECT p.id,
           row_number() OVER (ORDER BY p.rizz_score DESC, p.created_at ASC) AS rank
    FROM public.profiles AS p
    WHERE COALESCE(p.rizz_score, 0) > 0
  ) AS r
  WHERE r.id = _user;

  -- Current streak: consecutive days with any activity, ending today or
  -- yesterday (a streak is not broken until a full day passes with nothing).
  v_streak := COALESCE((
    WITH days AS (
      SELECT DISTINCT (t.at AT TIME ZONE 'UTC')::date AS day
      FROM (
        SELECT p.created_at AS at FROM public.posts AS p
          WHERE p.author_id = _user AND p.created_at > now() - interval '90 days'
        UNION ALL
        SELECT gm.created_at FROM public.group_messages AS gm
          WHERE gm.author_id = _user AND gm.created_at > now() - interval '90 days'
        UNION ALL
        SELECT dm.created_at FROM public.direct_messages AS dm
          WHERE dm.sender_id = _user AND dm.created_at > now() - interval '90 days'
        UNION ALL
        SELECT m.created_at FROM public.messages AS m
          WHERE m.author_id = _user AND m.created_at > now() - interval '90 days'
        UNION ALL
        SELECT pc.created_at FROM public.post_comments AS pc
          WHERE pc.author_id = _user AND pc.created_at > now() - interval '90 days'
        UNION ALL
        SELECT s.created_at FROM public.stories AS s
          WHERE s.author_id = _user AND s.created_at > now() - interval '90 days'
        UNION ALL
        SELECT sl.created_at FROM public.story_likes AS sl
          WHERE sl.user_id = _user AND sl.created_at > now() - interval '90 days'
      ) AS t
    ),
    anchor AS (
      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM days WHERE day = current_date) THEN current_date
        WHEN EXISTS (SELECT 1 FROM days WHERE day = current_date - 1) THEN current_date - 1
      END AS start_day
    )
    SELECT CASE
      WHEN (SELECT start_day FROM anchor) IS NULL THEN 0
      ELSE COALESCE((
        SELECT min(g)
        FROM generate_series(0, 89) AS g
        WHERE NOT EXISTS (
          SELECT 1 FROM days WHERE day = (SELECT start_day FROM anchor) - g
        )
      ), 90)
    END
  ), 0);

  -- Early supporter: joined within 30 days of the very first account, so the
  -- window moves with the project instead of hard-coding a launch date.
  SELECT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = _user
      AND p.created_at <= (SELECT min(q.created_at) FROM public.profiles AS q) + interval '30 days'
  ) INTO v_early;

  RETURN QUERY
  SELECT
    b.slug,
    COALESCE(b.earn_rule, 'manual') AS rule,
    CASE COALESCE(b.earn_rule, 'manual')
      WHEN 'join'       THEN 1
      WHEN 'likes'      THEN v_likes
      WHEN 'messages'   THEN v_messages
      WHEN 'night'      THEN v_night
      WHEN 'bounties'   THEN v_bounties
      WHEN 'post_likes' THEN v_peak
      WHEN 'rank'       THEN COALESCE(v_rank, 0)
      WHEN 'streak'     THEN v_streak
      WHEN 'early_join' THEN CASE WHEN v_early THEN 1 ELSE 0 END
      ELSE 0
    END AS progress,
    COALESCE(b.earn_target, 1) AS goal,
    CASE COALESCE(b.earn_rule, 'manual')
      WHEN 'join'       THEN true
      WHEN 'likes'      THEN v_likes >= COALESCE(b.earn_target, 100)
      WHEN 'messages'   THEN v_messages >= COALESCE(b.earn_target, 100)
      WHEN 'night'      THEN v_night >= 1
      WHEN 'bounties'   THEN v_bounties >= COALESCE(b.earn_target, 1)
      WHEN 'post_likes' THEN v_peak >= COALESCE(b.earn_target, 50)
      WHEN 'rank'       THEN COALESCE(v_rank, 2147483647) <= COALESCE(b.earn_target, 10)
      WHEN 'streak'     THEN v_streak >= COALESCE(b.earn_target, 7)
      WHEN 'early_join' THEN v_early
      ELSE false
    END AS met
  FROM public.badges AS b
  WHERE b.slug = ANY (ARRAY[
    'rookie', 'smooth-talker', 'rising-star', 'night-owl', 'verified', 'streak-7',
    'meme-lord', 'bounty-hunter', 'streak-30', 'top-rizzler', 'game-champ', 'og'
  ])
  ORDER BY COALESCE(b.tier, 9), b.slug;
END
$function$;

REVOKE ALL ON FUNCTION public.badge_progress_for(uuid) FROM PUBLIC, anon, authenticated;

-- ============ SELF-SERVICE RPCs ============
-- Read my own progress. Never takes a user id: the caller can only ever see
-- their own counters.
CREATE OR REPLACE FUNCTION public.badge_progress()
RETURNS TABLE (slug text, rule text, progress integer, goal integer, met boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  RETURN QUERY SELECT * FROM public.badge_progress_for(me);
END
$function$;

REVOKE ALL ON FUNCTION public.badge_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.badge_progress() TO authenticated;

-- Award everything already earned, and report what was new so the client can
-- celebrate it. Badges are never revoked here: losing a like or a streak does
-- not take back something you already unlocked.
CREATE OR REPLACE FUNCTION public.sync_my_badges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  me      uuid := auth.uid();
  awarded jsonb := '[]'::jsonb;
  r       record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  FOR r IN
    SELECT p.slug
    FROM public.badge_progress_for(me) AS p
    WHERE p.met AND p.rule <> 'manual'
    ORDER BY p.slug
  LOOP
    INSERT INTO public.user_badges AS ub (user_id, badge_id)
    SELECT me, b.id FROM public.badges AS b WHERE b.slug = r.slug
    ON CONFLICT (user_id, badge_id) DO NOTHING;

    IF FOUND THEN
      awarded := awarded || to_jsonb(r.slug);
    END IF;
  END LOOP;

  RETURN awarded;
END
$function$;

REVOKE ALL ON FUNCTION public.sync_my_badges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_badges() TO authenticated;

-- ============ CLOSE THE OLD DOOR ============
-- award_badge(_user, _slug) was SECURITY DEFINER with the default PUBLIC grant,
-- so any signed-in client could call it and hand itself any badge, including
-- mythic ones. Triggers keep working (they run as the function owner); clients
-- no longer can.
REVOKE ALL ON FUNCTION public.award_badge(uuid, text) FROM PUBLIC, anon, authenticated;
