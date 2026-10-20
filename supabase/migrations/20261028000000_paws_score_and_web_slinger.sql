-- Paws is the visible score across RIZZ.
--
-- This migration does three things:
--   1. Converts every existing Rizz score into Paws once, so members keep
--      their standing when the profile and leaderboard switch to Paws.
--   2. Makes Web Slinger purchasable. The rights-review gate is cleared in
--      the catalogue; the operator is responsible for holding the rights to
--      the supplied clip.
--   3. Teaches the profile card and leaderboard RPCs to rank by Paws.
--
-- Paws remains protected exactly as before: balances still change only
-- through award_paws() and the shop RPCs.

-- ============ ONE-TIME RIZZ → PAWS TRANSFER ============
DO $$
DECLARE
  v_rows integer;
BEGIN
  CREATE TEMP TABLE _legacy_rizz_paws ON COMMIT DROP AS
  SELECT p.id, p.rizz_score::integer AS amount
  FROM public.profiles p
  WHERE p.rizz_score > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.paw_transactions t
      WHERE t.user_id = p.id
        AND t.kind = 'legacy_rizz_transfer'
    );

  INSERT INTO public.paw_transactions (user_id, amount, kind, reference_id, description)
  SELECT id, amount, 'legacy_rizz_transfer', 'legacy-rizz', 'Legacy balance carried over to Paws'
  FROM _legacy_rizz_paws;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    PERFORM set_config('rizz.paw_writer', 'on', true);

    UPDATE public.profiles p
    SET paw_balance = p.paw_balance + l.amount,
        paw_earned = p.paw_earned + l.amount,
        updated_at = now()
    FROM _legacy_rizz_paws l
    WHERE p.id = l.id;

    PERFORM set_config('rizz.paw_writer', 'off', true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_paw_transactions_kind_time
  ON public.paw_transactions (kind, created_at DESC);

-- ============ WEB SLINGER IS ON SALE ============
UPDATE public.profile_effects
SET rights_review = false
WHERE slug = 'fx-web-slinger';

COMMENT ON COLUMN public.profile_effects.rights_review IS
  'Legacy operator gate. Web Slinger is sold for Paws; keep this false unless a clip must be withdrawn from sale.';

-- ============ PROFILE CARD: PAWS FIELDS + PAWS RANK ============
CREATE OR REPLACE FUNCTION public.get_profile_card(_user_id uuid, _viewer uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile jsonb;
  v_result jsonb;
BEGIN
  SELECT to_jsonb(p) INTO v_profile
  FROM public.profiles p
  WHERE p.id = _user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('deleted', true);
  END IF;

  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile->>'id',
      'username', v_profile->>'username',
      'display_name', v_profile->>'display_name',
      'avatar_url', v_profile->>'avatar_url',
      'banner_url', v_profile->>'banner_url',
      'bio', v_profile->>'bio',
      'pronouns', v_profile->>'pronouns',
      'status_text', v_profile->>'status_text',
      'verified', EXISTS (
        SELECT 1 FROM public.user_badges ub
        JOIN public.badges b ON b.id = ub.badge_id
        WHERE ub.user_id = _user_id AND b.slug IN ('verified', 'verified_creator')
      ),
      'created_at', v_profile->>'created_at',
      'rizz_score', coalesce((v_profile->>'rizz_score')::integer, 0),
      'paw_balance', coalesce((v_profile->>'paw_balance')::integer, 0),
      'paw_earned', coalesce((v_profile->>'paw_earned')::integer, 0),
      'badges', coalesce(v_profile->'badges', '[]'::jsonb)
    ),
    'rank', (
      SELECT count(*) + 1 FROM public.profiles p2
      WHERE coalesce(p2.paw_earned, 0) > coalesce((v_profile->>'paw_earned')::integer, 0)
        AND p2.username IS NOT NULL
    ),
    'followers', (SELECT count(*) FROM public.follows WHERE following_id = _user_id),
    'following', (SELECT count(*) FROM public.follows WHERE follower_id = _user_id),
    'mutual_preview', (
      SELECT coalesce(jsonb_agg(t ORDER BY t.username), '[]'::jsonb) FROM (
        SELECT p3.id, p3.username, p3.display_name, p3.avatar_url
        FROM public.follows f1
        JOIN public.follows f2 ON f2.follower_id = _viewer AND f2.following_id = f1.follower_id
        JOIN public.profiles p3 ON p3.id = f1.follower_id
        WHERE f1.following_id = _user_id AND _viewer IS NOT NULL AND _viewer <> _user_id
        LIMIT 3
      ) t
    ),
    'mutual_total', (
      SELECT count(*) FROM public.follows f1
      JOIN public.follows f2 ON f2.follower_id = _viewer AND f2.following_id = f1.follower_id
      WHERE f1.following_id = _user_id AND _viewer IS NOT NULL AND _viewer <> _user_id
    ),
    'earned_badges', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'slug', b.slug, 'name', b.name, 'icon', b.icon,
        'color', b.color, 'description', b.description
      ) ORDER BY b.tier DESC), '[]'::jsonb)
      FROM public.user_badges ub
      JOIN public.badges b ON b.id = ub.badge_id
      WHERE ub.user_id = _user_id
      LIMIT 8
    ),
    'viewer_follows', EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _viewer AND following_id = _user_id
    ),
    'followed_by_viewer_target', EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _user_id AND following_id = _viewer
    ),
    'blocked_by_viewer', EXISTS (
      SELECT 1 FROM public.blocks
      WHERE blocker_id = _viewer AND blocked_id = _user_id
    ),
    'blocked_viewer', EXISTS (
      SELECT 1 FROM public.blocks
      WHERE blocker_id = _user_id AND blocked_id = _viewer
    ),
    'muted_by_viewer', EXISTS (
      SELECT 1 FROM public.mutes
      WHERE muter_id = _viewer AND muted_id = _user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_profile_card(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_card(uuid, uuid) TO authenticated;

-- ============ LEADERBOARD: PAWS EARNED ============
-- All time uses profiles.paw_earned (lifetime earned, so spending does not
-- knock a member down the board). Periods sum positive ledger entries. The
-- one-time Rizz transfer is deliberately excluded from period boards.
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  _period text DEFAULT 'all',
  _following_only boolean DEFAULT false,
  _viewer uuid DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  score bigint,
  rank bigint,
  prev_rank bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_since timestamptz;
  v_prev_since timestamptz;
  v_prev_until timestamptz;
BEGIN
  IF _period = 'today' THEN
    v_since := date_trunc('day', now());
    v_prev_since := v_since - interval '1 day';
    v_prev_until := v_since;
  ELSIF _period = 'week' THEN
    v_since := now() - interval '7 days';
    v_prev_since := now() - interval '14 days';
    v_prev_until := v_since;
  ELSE
    v_since := NULL;
  END IF;

  RETURN QUERY
  WITH scored AS (
    SELECT
      p.id AS uid,
      p.username,
      p.display_name,
      p.avatar_url,
      CASE
        WHEN v_since IS NULL THEN coalesce(p.paw_earned, 0)::bigint
        ELSE coalesce((
          SELECT sum(t.amount) FROM public.paw_transactions t
          WHERE t.user_id = p.id
            AND t.amount > 0
            AND t.kind <> 'legacy_rizz_transfer'
            AND t.created_at >= v_since
        ), 0)::bigint
      END AS s,
      CASE
        WHEN v_since IS NULL THEN NULL
        ELSE coalesce((
          SELECT sum(t2.amount) FROM public.paw_transactions t2
          WHERE t2.user_id = p.id
            AND t2.amount > 0
            AND t2.kind <> 'legacy_rizz_transfer'
            AND t2.created_at >= v_prev_since
            AND t2.created_at < v_prev_until
        ), 0)::bigint
      END AS ps
    FROM public.profiles p
    WHERE p.username IS NOT NULL
      AND (
        NOT _following_only OR _viewer IS NULL OR EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = _viewer AND f.following_id = p.id
        )
      )
  ),
  positive AS (
    SELECT * FROM scored WHERE s > 0
  ),
  ranked AS (
    SELECT uid, username, display_name, avatar_url, s,
           rank() OVER (ORDER BY s DESC) AS r
    FROM positive
  ),
  prev_ranked AS (
    SELECT uid, rank() OVER (ORDER BY ps DESC) AS pr
    FROM (SELECT uid, ps FROM positive) pp
  )
  SELECT r.uid, r.username, r.display_name, r.avatar_url, r.s, r.r, pr.pr
  FROM ranked r
  LEFT JOIN prev_ranked pr ON pr.uid = r.uid
  ORDER BY r.r
  LIMIT greatest(_limit, 1)
  OFFSET greatest(_offset, 0);
END;
$function$;

NOTIFY pgrst, 'reload schema';
