-- Phase 0 — one emoji system for the whole app.
--
-- A custom emoji used to live inside one realm's chat: `:name:` tokens were
-- expanded against that realm's list and nowhere else. Now the same row powers
-- posts, comments, messages and reactions, so the table needs three things it
-- did not have: a moderation state, a per-realm cap, and a way for one query to
-- return every emoji the viewer may use.
--
-- A reaction key is either a unicode emoji (`🔥`) or `ce:<emoji id>`. The old
-- CHECK on `post_reactions.emoji` capped the column at 16 characters, which a
-- 39-character key would violate, so it is widened here.

-- ---------------------------------------------------------------- reactions
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_emoji_check;
ALTER TABLE public.post_reactions
  ADD CONSTRAINT post_reactions_emoji_check
  CHECK (length(emoji) BETWEEN 1 AND 64);

-- ---------------------------------------------------------------- realms
-- Whether this realm's emoji may be used outside it. On by default: a member
-- who uploads an emoji expects to use it in a post, not only in one channel.
ALTER TABLE public.realms
  ADD COLUMN IF NOT EXISTS allow_external_emoji boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------- emoji rows
ALTER TABLE public.realm_custom_emoji
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.realm_custom_emoji
  DROP CONSTRAINT IF EXISTS realm_custom_emoji_status_check;
ALTER TABLE public.realm_custom_emoji
  ADD CONSTRAINT realm_custom_emoji_status_check
  CHECK (status IN ('active', 'removed'));

CREATE INDEX IF NOT EXISTS idx_realm_emoji_active
  ON public.realm_custom_emoji (realm_id)
  WHERE status = 'active';

-- An animated file is any of the formats the picker animates. Stored rather
-- than derived in the client so the renderer can pause it under reduced-motion
-- without fetching the file first.
ALTER TABLE public.realm_custom_emoji
  ADD COLUMN IF NOT EXISTS animated boolean NOT NULL DEFAULT false;

UPDATE public.realm_custom_emoji
SET animated = true
WHERE animated = false
  AND (url ILIKE '%.gif' OR url ILIKE '%.webp' OR url ILIKE '%.webm');

-- ---------------------------------------------------------------- reports
CREATE TABLE IF NOT EXISTS public.realm_emoji_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji_id uuid NOT NULL REFERENCES public.realm_custom_emoji(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (emoji_id, reporter_id)
);

ALTER TABLE public.realm_emoji_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realm_emoji_reports_own ON public.realm_emoji_reports;
CREATE POLICY realm_emoji_reports_own ON public.realm_emoji_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

REVOKE ALL ON public.realm_emoji_reports FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.realm_emoji_reports FROM authenticated;
GRANT SELECT ON public.realm_emoji_reports TO authenticated;

-- ---------------------------------------------------------------- cap
-- 50 active emoji per realm. Kept as one constant here rather than a settings
-- table: the number is a product decision, and the message names it so a
-- moderator knows exactly what to do.
CREATE OR REPLACE FUNCTION public.enforce_realm_emoji_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_active integer;
  v_cap constant integer := 50;
BEGIN
  SELECT count(*) INTO v_active
  FROM public.realm_custom_emoji
  WHERE realm_id = NEW.realm_id AND status = 'active';

  IF v_active >= v_cap THEN
    RAISE EXCEPTION 'This realm already has % emojis — remove one first.', v_cap;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_realm_emoji_cap ON public.realm_custom_emoji;
CREATE TRIGGER trg_realm_emoji_cap
  BEFORE INSERT ON public.realm_custom_emoji
  FOR EACH ROW EXECUTE FUNCTION public.enforce_realm_emoji_cap();

-- ---------------------------------------------------------------- use
-- One query for the picker: every active emoji from every realm the caller has
-- joined. `_realm_id` is the realm being viewed, if any — that realm's emoji
-- are always offered even when it does not allow external use.
CREATE OR REPLACE FUNCTION public.joined_realm_emoji(_realm_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  realm_id uuid,
  realm_name text,
  realm_slug text,
  shortcode text,
  url text,
  animated boolean,
  external boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT
    e.id,
    e.realm_id,
    r.name,
    r.slug,
    e.name,
    e.url,
    e.animated,
    r.allow_external_emoji
  FROM public.realm_custom_emoji AS e
  JOIN public.realms AS r ON r.id = e.realm_id
  JOIN public.realm_members AS m ON m.realm_id = e.realm_id AND m.user_id = auth.uid()
  WHERE e.status = 'active'
    AND e.kind = 'emoji'
    AND (r.allow_external_emoji OR r.id = _realm_id)
  ORDER BY r.name ASC, e.name ASC;
$fn$;

REVOKE ALL ON FUNCTION public.joined_realm_emoji(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.joined_realm_emoji(uuid) TO authenticated;

-- Rendering must survive leaving a realm: an old post keeps its picture even
-- when the reader is no longer a member. This returns rows by id for exactly
-- that case, and deliberately includes removed emoji so the renderer can fall
-- back to `:shortcode:` text with the right word.
CREATE OR REPLACE FUNCTION public.emoji_lookup(_ids uuid[])
RETURNS TABLE (
  id uuid,
  realm_id uuid,
  shortcode text,
  url text,
  animated boolean,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT e.id, e.realm_id, e.name, e.url, e.animated, e.status
  FROM public.realm_custom_emoji AS e
  WHERE e.id = ANY(_ids)
  LIMIT 200;
$fn$;

REVOKE ALL ON FUNCTION public.emoji_lookup(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emoji_lookup(uuid[]) TO authenticated;

-- ---------------------------------------------------------------- moderation
CREATE OR REPLACE FUNCTION public.report_realm_emoji(_emoji_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to report an emoji.';
  END IF;

  INSERT INTO public.realm_emoji_reports (emoji_id, reporter_id, reason)
  VALUES (_emoji_id, v_user, nullif(btrim(_reason), ''))
  ON CONFLICT (emoji_id, reporter_id) DO NOTHING;

  RETURN jsonb_build_object('reported', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.report_realm_emoji(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_realm_emoji(uuid, text) TO authenticated;

-- A moderator removes it for everyone. The row is kept, not deleted: deleting
-- it would break every message that already carries its token, and the contract
-- is that a removed emoji degrades to its shortcode instead.
CREATE OR REPLACE FUNCTION public.remove_realm_emoji(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_realm uuid;
  v_role text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to remove an emoji.';
  END IF;

  SELECT realm_id INTO v_realm FROM public.realm_custom_emoji WHERE id = _id;
  IF v_realm IS NULL THEN
    RAISE EXCEPTION 'That emoji no longer exists.';
  END IF;

  SELECT role::text INTO v_role
  FROM public.realm_members
  WHERE realm_id = v_realm AND user_id = v_user;

  IF coalesce(v_role, '') NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only the owner or an admin can remove an emoji.';
  END IF;

  UPDATE public.realm_custom_emoji SET status = 'removed' WHERE id = _id;
  RETURN jsonb_build_object('removed', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.remove_realm_emoji(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_realm_emoji(uuid) TO authenticated;
