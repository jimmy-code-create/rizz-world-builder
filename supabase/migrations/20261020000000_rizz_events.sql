-- ============================================================================
-- RIZZ EVENTS: the score pipeline behind the "Top Rizz" leaderboard.
--
-- PROPOSED - NOT APPLIED. Needs explicit OK before running (per project rules:
-- ask before any DB migration).
--
-- What this adds:
--   * rizz_events(user_id, points, reason, created_at) - every score movement
--     is a row here. Only server-side code (service_role / SECURITY DEFINER
--     award_rizz) can insert; clients can read their own + the public board
--     through get_leaderboard, but can never write or edit scores.
--   * get_leaderboard(_period, _viewer, _following_only, _limit, _offset) -
--     returns user_id, score and rank for the period plus prev_rank (the rank
--     in the period before it) so the UI can draw ▲/▼ arrows.
--   * Periods: 'today' (UTC day), 'week' (rolling 7 days), 'all' (profiles.rizz_score).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rizz_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points integer NOT NULL CHECK (points > 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rizz_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rizz_events FROM anon, authenticated;

-- Clients read aggregated boards through get_leaderboard only; no direct
-- SELECT/INSERT/UPDATE/DELETE for anyone but the server role.
DROP POLICY IF EXISTS rizz_events_no_client_access ON public.rizz_events;

CREATE INDEX IF NOT EXISTS idx_rizz_events_user_time
  ON public.rizz_events (created_at, user_id);
CREATE INDEX IF NOT EXISTS idx_rizz_events_user ON public.rizz_events (user_id);

-- Server-side award: bumps the event log AND the cached profiles.rizz_score
-- that "All time" reads. Only service_role (or a SECURITY DEFINER caller)
-- may execute it.
CREATE OR REPLACE FUNCTION public.award_rizz(_user_id uuid, _points integer, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF _points IS NULL OR _points <= 0 THEN
    RAISE EXCEPTION 'Points must be positive';
  END IF;
  INSERT INTO public.rizz_events (user_id, points, reason)
  VALUES (_user_id, _points, coalesce(nullif(btrim(_reason), ''), 'activity'));
  UPDATE public.profiles
  SET rizz_score = coalesce(rizz_score, 0) + _points, updated_at = now()
  WHERE id = _user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.award_rizz(uuid, integer, text) FROM PUBLIC, anon, authenticated;

-- Suggested point values (call award_rizz from your server code / triggers):
--   post created: 5      like received: 2      comment received: 3
--   reaction received: 1  badge earned: 25

-- Leaderboard reader: score + rank + previous-period rank in one call.
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
        WHEN v_since IS NULL THEN coalesce(p.rizz_score, 0)::bigint
        ELSE coalesce((SELECT sum(e.points) FROM public.rizz_events e
                       WHERE e.user_id = p.id AND e.created_at >= v_since), 0)::bigint
      END AS s,
      CASE
        WHEN v_since IS NULL THEN NULL
        ELSE coalesce((SELECT sum(e2.points) FROM public.rizz_events e2
                       WHERE e2.user_id = p.id
                         AND e2.created_at >= v_prev_since
                         AND e2.created_at < v_prev_until), 0)::bigint
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

REVOKE ALL ON FUNCTION public.get_leaderboard(text, boolean, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, boolean, uuid, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
