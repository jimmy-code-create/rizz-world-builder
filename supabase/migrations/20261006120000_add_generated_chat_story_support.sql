ALTER TABLE public.chat_stories
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS video_type text,
  ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE public.chat_story_lines
  ADD COLUMN IF NOT EXISTS body_en text NOT NULL DEFAULT '';

ALTER TABLE public.chat_story_choices
  ADD COLUMN IF NOT EXISTS label_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reply_body_en text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_stories_video_type_check'
      AND conrelid = 'public.chat_stories'::regclass
  ) THEN
    ALTER TABLE public.chat_stories
      ADD CONSTRAINT chat_stories_video_type_check
      CHECK (video_type IS NULL OR video_type IN ('horror_hallway', 'cyberpunk_neon', 'rain_window', 'cozy_room'));
  END IF;
END $$;

GRANT INSERT, DELETE ON public.chat_stories TO authenticated;
GRANT INSERT, DELETE ON public.chat_story_lines TO authenticated;
GRANT INSERT, DELETE ON public.chat_story_choices TO authenticated;

DROP POLICY IF EXISTS "authenticated users create stories" ON public.chat_stories;
CREATE POLICY "authenticated users create stories"
  ON public.chat_stories FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "authors delete their stories" ON public.chat_stories;
CREATE POLICY "authors delete their stories"
  ON public.chat_stories FOR DELETE TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "authors add story lines" ON public.chat_story_lines;
CREATE POLICY "authors add story lines"
  ON public.chat_story_lines FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_stories
      WHERE chat_stories.id = chat_story_lines.story_id
        AND chat_stories.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authors delete story lines" ON public.chat_story_lines;
CREATE POLICY "authors delete story lines"
  ON public.chat_story_lines FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_stories
      WHERE chat_stories.id = chat_story_lines.story_id
        AND chat_stories.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authors add story choices" ON public.chat_story_choices;
CREATE POLICY "authors add story choices"
  ON public.chat_story_choices FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_stories
      WHERE chat_stories.id = chat_story_choices.story_id
        AND chat_stories.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authors delete story choices" ON public.chat_story_choices;
CREATE POLICY "authors delete story choices"
  ON public.chat_story_choices FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_stories
      WHERE chat_stories.id = chat_story_choices.story_id
        AND chat_stories.created_by = auth.uid()
    )
  );
