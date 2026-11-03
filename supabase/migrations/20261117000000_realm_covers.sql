-- Animated realm covers.
--
-- A still icon is a square; a cover is the wide, moving strip that makes a
-- realm feel alive in discovery. GIF and WebP animate in an <img> with no player,
-- so the column is just a public storage URL.

ALTER TABLE public.realms
  ADD COLUMN IF NOT EXISTS cover_url text;

COMMENT ON COLUMN public.realms.cover_url IS
  'Public URL of the realm cover. GIF/WebP animate; PNG/JPG stay still.';
