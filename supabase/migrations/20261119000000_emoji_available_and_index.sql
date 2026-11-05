-- One emoji lookup that works outside a realm.
--
-- Three things this fixes:
--
--  1. `/api/emojis/available` reads every emoji for every realm the viewer has
--     joined in a single query. That is an `IN (…)` over `realm_id`, so it
--     needs a plain btree index; the existing one is partial (`status =
--     'active'`) and cannot serve the unfiltered read on older rows.
--  2. A DM message written by somebody outside the emoji's realm could not
--     resolve the token to a picture. `emoji_public` is the household-safe
--     version of `emoji_lookup`: id, name, url, animated — never the realm,
--     never the uploader.
--  3. An emoji can now be uploaded for one account instead of one realm
--     (`realm_id IS NULL AND owner_id = auth.uid()`), which is what the
--     picker's "Private" section stores.

CREATE INDEX IF NOT EXISTS idx_realm_custom_emoji_realm_id
  ON public.realm_custom_emoji (realm_id);

-- ------------------------------------------------------------- private emoji
ALTER TABLE public.realm_custom_emoji
  ALTER COLUMN realm_id DROP NOT NULL;

ALTER TABLE public.realm_custom_emoji
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- A private emoji is owned by exactly one account; a realm emoji by exactly one
-- realm. The old UNIQUE (realm_id, name) still holds for realm rows, and a
-- private row is unique per owner because realm_id is NULL and Postgres treats
-- NULLs as distinct, hence the explicit partial index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_realm_custom_emoji_private_name
  ON public.realm_custom_emoji (owner_id, name)
  WHERE realm_id IS NULL;

ALTER TABLE public.realm_custom_emoji
  DROP CONSTRAINT IF EXISTS realm_custom_emoji_scope_check;
ALTER TABLE public.realm_custom_emoji
  ADD CONSTRAINT realm_custom_emoji_scope_check
  CHECK (realm_id IS NOT NULL OR owner_id IS NOT NULL);

-- Readers: a private emoji is visible only to its owner. Realm emoji keep the
-- existing `can_read_realm` rule.
DROP POLICY IF EXISTS realm_custom_emoji_read ON public.realm_custom_emoji;
CREATE POLICY realm_custom_emoji_read ON public.realm_custom_emoji
  FOR SELECT TO authenticated
  USING (
    (realm_id IS NOT NULL AND public.can_read_realm(realm_id))
    OR (realm_id IS NULL AND owner_id = auth.uid())
  );

-- --------------------------------------------------------------- resolution
-- Public resolution by id. Deliberately no membership check: a token in a
-- message already travelled to whoever can read that message, and this returns
-- nothing but the picture.
CREATE OR REPLACE FUNCTION public.emoji_public(_ids uuid[])
RETURNS TABLE (
  id uuid,
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
  SELECT e.id, e.name, e.url, e.animated, e.status
  FROM public.realm_custom_emoji AS e
  WHERE e.id = ANY(_ids)
  LIMIT 200;
$fn$;

REVOKE ALL ON FUNCTION public.emoji_public(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emoji_public(uuid[]) TO authenticated;

-- -------------------------------------------------------------- private save
CREATE OR REPLACE FUNCTION public.save_private_emoji(_name text, _url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_name text := lower(btrim(coalesce(_name, '')));
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in first');
  END IF;
  IF v_name !~ '^[a-z0-9_]{2,32}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Names use a-z, 0-9 and _ (2 to 32 characters)');
  END IF;
  IF coalesce(_url, '') !~ '^https://' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That image link is not valid');
  END IF;

  INSERT INTO public.realm_custom_emoji (realm_id, owner_id, name, url, kind, created_by)
  VALUES (NULL, v_user, v_name, _url, 'emoji', v_user)
  ON CONFLICT (owner_id, name) WHERE realm_id IS NULL
  DO UPDATE SET url = EXCLUDED.url
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'name', v_name);
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_private_emoji(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_private_emoji(text, text) TO authenticated;
