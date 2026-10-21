-- Final banner-gradient schema.
--
-- Earlier builds stored `banner_gradient` as a text preset id (signal, aurora,
-- …). The editor and every profile surface now store one validated object:
--   {"c1":"#rrggbb","c2":"#rrggbb","angle":160}
-- This migration lands after the text-column migration, converts any legacy
-- preset ids in place, and keeps get_profile_card() returning the object as
-- JSON instead of stringifying it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_mode text;

-- 1) Text column → jsonb, mapping the old preset ids to their actual colours.
-- An ALTER COLUMN ... USING expression cannot contain a subquery, so resolve
-- the preset ids with a normal UPDATE first and keep the cast itself trivial.
-- The helper also turns malformed/unknown text into NULL instead of aborting
-- the migration.
CREATE OR REPLACE FUNCTION public._banner_gradient_json(_value text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
BEGIN
  RETURN btrim(_value)::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$fn$;

DO $do$
DECLARE
  v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'banner_gradient';

  IF v_type = 'text' THEN
    UPDATE public.profiles AS p
    SET banner_gradient = jsonb_build_object(
      'c1', preset.c1,
      'c2', preset.c2,
      'angle', 160
    )::text
    FROM (VALUES
      ('signal',   '#a3e635', '#15803d'),
      ('aurora',   '#38bdf8', '#6366f1'),
      ('ember',    '#fb923c', '#dc2626'),
      ('ocean',    '#38bdf8', '#1d4ed8'),
      ('orchid',   '#f0abfc', '#7e22ce'),
      ('moon',     '#94a3b8', '#334155'),
      ('gold',     '#fde047', '#b45309'),
      ('violet',   '#c4b5fd', '#4c1d95'),
      ('rose',     '#fda4af', '#9f1239'),
      ('forest',   '#86efac', '#14532d'),
      ('sunset',   '#fb923c', '#831843'),
      ('neon',     '#22d3ee', '#a3e635'),
      ('ice',      '#e0f2fe', '#0369a1'),
      ('candy',    '#f9a8d4', '#60a5fa'),
      ('midnight', '#312e81', '#020617'),
      ('cherry',   '#fb7185', '#7f1d1d')
    ) AS preset(id, c1, c2)
    WHERE p.banner_gradient IS NOT NULL
      AND regexp_replace(lower(btrim(p.banner_gradient)), '^preset[:-]', '') = preset.id;

    ALTER TABLE public.profiles
      ALTER COLUMN banner_gradient TYPE jsonb
      USING public._banner_gradient_json(banner_gradient);
  END IF;
END
$do$;

DROP FUNCTION IF EXISTS public._banner_gradient_json(text);

-- 2) A jsonb column may still hold preset ids as JSON strings.
UPDATE public.profiles
SET banner_gradient = mapped.gradient
FROM (
  SELECT id, jsonb_build_object('c1', c1, 'c2', c2, 'angle', 160) AS gradient
  FROM (VALUES
    ('signal',   '#a3e635', '#15803d'),
    ('aurora',   '#38bdf8', '#6366f1'),
    ('ember',    '#fb923c', '#dc2626'),
    ('ocean',    '#38bdf8', '#1d4ed8'),
    ('orchid',   '#f0abfc', '#7e22ce'),
    ('moon',     '#94a3b8', '#334155'),
    ('gold',     '#fde047', '#b45309'),
    ('violet',   '#c4b5fd', '#4c1d95'),
    ('rose',     '#fda4af', '#9f1239'),
    ('forest',   '#86efac', '#14532d'),
    ('sunset',   '#fb923c', '#831843'),
    ('neon',     '#22d3ee', '#a3e635'),
    ('ice',      '#e0f2fe', '#0369a1'),
    ('candy',    '#f9a8d4', '#60a5fa'),
    ('midnight', '#312e81', '#020617'),
    ('cherry',   '#fb7185', '#7f1d1d')
  ) AS preset(id, c1, c2)
) AS mapped
WHERE public.profiles.banner_gradient IS NOT NULL
  AND jsonb_typeof(public.profiles.banner_gradient) = 'string'
  AND mapped.id = lower(btrim(public.profiles.banner_gradient #>> '{}'));

-- 3) Drop anything that is neither a valid gradient object nor null.
UPDATE public.profiles
SET banner_gradient = NULL
WHERE banner_gradient IS NOT NULL
  AND NOT (
    jsonb_typeof(banner_gradient) = 'object'
    AND banner_gradient ? 'c1'
    AND banner_gradient ? 'c2'
    AND jsonb_typeof(banner_gradient -> 'c1') = 'string'
    AND jsonb_typeof(banner_gradient -> 'c2') = 'string'
    AND (banner_gradient ->> 'c1') ~* '^#[0-9a-f]{6}$'
    AND (banner_gradient ->> 'c2') ~* '^#[0-9a-f]{6}$'
    AND (
      NOT (banner_gradient ? 'angle')
      OR (
        jsonb_typeof(banner_gradient -> 'angle') = 'number'
        AND (banner_gradient ->> 'angle')::numeric BETWEEN 0 AND 360
        AND (banner_gradient ->> 'angle')::numeric % 1 = 0
      )
    )
  );

-- 4) Lock the final shape.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_banner_mode_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_banner_mode_check
  CHECK (banner_mode IS NULL OR banner_mode IN ('image', 'gradient', 'none'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_banner_gradient_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_banner_gradient_check
  CHECK (
    banner_gradient IS NULL
    OR (
      jsonb_typeof(banner_gradient) = 'object'
      AND banner_gradient ? 'c1'
      AND banner_gradient ? 'c2'
      AND jsonb_typeof(banner_gradient -> 'c1') = 'string'
      AND jsonb_typeof(banner_gradient -> 'c2') = 'string'
      AND (banner_gradient ->> 'c1') ~* '^#[0-9a-f]{6}$'
      AND (banner_gradient ->> 'c2') ~* '^#[0-9a-f]{6}$'
      AND (
        NOT (banner_gradient ? 'angle')
        OR (
          jsonb_typeof(banner_gradient -> 'angle') = 'number'
          AND (banner_gradient ->> 'angle')::numeric BETWEEN 0 AND 360
          AND (banner_gradient ->> 'angle')::numeric % 1 = 0
        )
      )
    )
  );

COMMENT ON COLUMN public.profiles.banner_mode IS
  'image | gradient | none. Null keeps the legacy inference (image, else gradient, else none).';
COMMENT ON COLUMN public.profiles.banner_gradient IS
  'Optional gradient: {"c1":"#rrggbb","c2":"#rrggbb","angle":0-360}.';

-- 5) The card RPC must carry the gradient as JSON, not as a stringified object.
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
      'banner_mode', v_profile->>'banner_mode',
      'banner_gradient', v_profile->'banner_gradient',
      'accent_color', v_profile->>'accent_color',
      'bio', v_profile->>'bio',
      'pronouns', v_profile->>'pronouns',
      'status_text', v_profile->>'status_text',
      'featured_badge', v_profile->>'featured_badge',
      'verified', EXISTS (
        SELECT 1 FROM public.user_badges ub
        JOIN public.badges b ON b.id = ub.badge_id
        WHERE ub.user_id = _user_id AND b.slug IN ('verified', 'verified_creator')
      ),
      'created_at', v_profile->>'created_at',
      'reduced_motion', coalesce((v_profile->>'reduced_motion')::boolean, false),
      'updated_at', v_profile->>'updated_at',
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

NOTIFY pgrst, 'reload schema';
