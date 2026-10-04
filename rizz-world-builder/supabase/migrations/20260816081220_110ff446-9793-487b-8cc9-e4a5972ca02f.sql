ALTER TABLE public.chat_story_lines ADD COLUMN IF NOT EXISTS next_idx integer;
ALTER TABLE public.chat_story_lines ADD COLUMN IF NOT EXISTS chapter text;
ALTER TABLE public.chat_stories ADD COLUMN IF NOT EXISTS word_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.chat_stories ADD COLUMN IF NOT EXISTS is_branching boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.chat_story_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.chat_stories(id) ON DELETE CASCADE,
  at_idx integer NOT NULL,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  reply_body text NOT NULL,
  goto_idx integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_story_choices_story_idx ON public.chat_story_choices(story_id, at_idx, position);

GRANT SELECT ON public.chat_story_choices TO anon;
GRANT SELECT ON public.chat_story_choices TO authenticated;
GRANT ALL ON public.chat_story_choices TO service_role;

ALTER TABLE public.chat_story_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat story choices are readable by everyone"
ON public.chat_story_choices FOR SELECT
USING (true);