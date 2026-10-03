ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS source_platform TEXT;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_source_platform_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_source_platform_check
  CHECK (
    source_platform IS NULL
    OR (
      media_type IS NOT DISTINCT FROM 'video'
      AND source_platform IN ('instagram', 'youtube', 'rednote')
    )
  );