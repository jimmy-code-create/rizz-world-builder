-- ============ BOUNTY PRESENTATION: TAGS, HEADING COLOUR, COVERS ============
-- The posting form now lets every member (not just Paws-prize posters):
--   * add up to five Reddit-style tags,
--   * choose the colour of the bounty title on the card,
--   * attach a compressed cover image.
--
-- This migration keeps the new fields safe server-side. The browser may still
-- insert free open calls directly, so the trigger below is the gatekeeper for
-- title/description lengths, tag shape and the six-digit heading colour.
-- Escrowed bounties keep using post_paws_bounty(); the wrapper at the bottom
-- adds the colour without duplicating the wallet/escrow body.

-- Older deployments may predate the trust migration; make the tag column
-- idempotent here so this migration is safe on its own.
ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS heading_color text NOT NULL DEFAULT '#f2efe6';

ALTER TABLE public.drops
  DROP CONSTRAINT IF EXISTS drops_heading_color_check;
ALTER TABLE public.drops
  ADD CONSTRAINT drops_heading_color_check
  CHECK (heading_color ~ '^#[0-9a-fA-F]{6}$');

CREATE INDEX IF NOT EXISTS drops_tags_gin ON public.drops USING gin (tags);

-- ============ SERVER-SIDE PRESENTATION RULES ============
CREATE OR REPLACE FUNCTION public.validate_bounty_presentation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tag text;
  v_tags text[] := '{}';
BEGIN
  NEW.heading_color := lower(coalesce(nullif(btrim(NEW.heading_color), ''), '#f2efe6'));
  IF NEW.heading_color !~ '^#[0-9a-f]{6}$' THEN
    RAISE EXCEPTION 'Pick a valid six-digit heading colour.';
  END IF;

  IF char_length(btrim(coalesce(NEW.title, ''))) < 3 THEN
    RAISE EXCEPTION 'Give the bounty a title.';
  END IF;
  IF char_length(NEW.title) > 80 THEN
    RAISE EXCEPTION 'Keep the title under 80 characters.';
  END IF;
  IF char_length(coalesce(NEW.description, '')) > 2000 THEN
    RAISE EXCEPTION 'Keep the description under 2000 characters.';
  END IF;
  IF char_length(coalesce(NEW.requirements, '')) > 2000 THEN
    RAISE EXCEPTION 'Keep the requirements under 2000 characters.';
  END IF;
  IF coalesce(array_length(NEW.tags, 1), 0) > 5 THEN
    RAISE EXCEPTION 'Keep it to five tags.';
  END IF;

  -- Normalise the same way the composer does: lowercase, hyphenated, no
  -- leading #, no duplicates, and at most 24 characters each.
  FOREACH v_tag IN ARRAY coalesce(NEW.tags, '{}') LOOP
    v_tag := left(
      lower(regexp_replace(btrim(v_tag), '[^a-zA-Z0-9_-]+', '-', 'g')),
      24
    );
    v_tag := regexp_replace(v_tag, '^-+|-+$', '', 'g');
    IF v_tag <> '' AND NOT (v_tag = ANY(v_tags)) THEN
      v_tags := array_append(v_tags, v_tag);
    END IF;
  END LOOP;
  NEW.tags := v_tags;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_bounty_presentation_t ON public.drops;
CREATE TRIGGER validate_bounty_presentation_t
  BEFORE INSERT OR UPDATE OF title, description, requirements, tags, heading_color
  ON public.drops
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_bounty_presentation();

-- ============ POSTING AN ESCROW BOUNTY WITH A COLOUR ============
-- The 10-argument function owns the escrow arithmetic. This wrapper validates
-- the colour, delegates to it, then writes the presentation column in the same
-- transaction. Keeping one copy of the wallet logic is deliberate: a duplicate
-- body here would be the first thing to drift.
CREATE OR REPLACE FUNCTION public.post_paws_bounty(
  _title text,
  _description text,
  _requirements text,
  _prize integer,
  _hours integer,
  _media_url text DEFAULT NULL,
  _premium_only boolean DEFAULT false,
  _proof_type text DEFAULT 'any',
  _min_trust text DEFAULT 'any',
  _tags text[] DEFAULT '{}',
  _heading_color text DEFAULT '#f2efe6'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_color text := lower(btrim(coalesce(_heading_color, '#f2efe6')));
  v_result jsonb;
BEGIN
  IF v_color !~ '^#[0-9a-f]{6}$' THEN
    RAISE EXCEPTION 'Pick a valid six-digit heading colour.';
  END IF;

  v_result := public.post_paws_bounty(
    _title,
    _description,
    _requirements,
    _prize,
    _hours,
    _media_url,
    _premium_only,
    _proof_type,
    _min_trust,
    _tags
  );

  UPDATE public.drops
  SET heading_color = v_color
  WHERE id = (v_result ->> 'id')::uuid;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.post_paws_bounty(
  text, text, text, integer, integer, text, boolean, text, text, text[], text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_paws_bounty(
  text, text, text, integer, integer, text, boolean, text, text, text[], text
) TO authenticated;

COMMENT ON COLUMN public.drops.heading_color IS
  'Six-digit hex colour used for the bounty title on the card.';
COMMENT ON COLUMN public.drops.tags IS
  'Up to five lowercase discovery tags, also used by the /drops?tag= filter.';
