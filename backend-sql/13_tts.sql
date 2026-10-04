-- RIZZ Gemini TTS quota and per-scene audio metadata. Safe to re-run.
-- No Gemini, VAPID, or Supabase service key belongs in this SQL file.

CREATE TABLE IF NOT EXISTS public.tts_usage (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  chars integer NOT NULL DEFAULT 0 CHECK (chars >= 0),
  requests integer NOT NULL DEFAULT 0 CHECK (requests >= 0),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.tts_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tts_usage_select_own ON public.tts_usage;
CREATE POLICY tts_usage_select_own ON public.tts_usage
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.tts_usage FROM anon, authenticated;
GRANT SELECT ON public.tts_usage TO authenticated;

CREATE OR REPLACE FUNCTION public.tts_consume(_chars integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_daily_cap constant integer := 20000;
  v_used integer;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to generate voice audio'; END IF;
  IF _chars IS NULL OR _chars < 1 OR _chars > v_daily_cap THEN
    RAISE EXCEPTION 'Requested audio is outside the daily character limit';
  END IF;

  INSERT INTO public.tts_usage(user_id, day, chars, requests)
  VALUES (auth.uid(), v_today, _chars, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET chars = public.tts_usage.chars + EXCLUDED.chars,
        requests = public.tts_usage.requests + 1
    WHERE public.tts_usage.chars + EXCLUDED.chars <= v_daily_cap
  RETURNING chars INTO v_used;

  IF v_used IS NULL THEN
    RAISE EXCEPTION 'Daily voice-generation limit reached'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN greatest(v_daily_cap - v_used, 0);
END;
$function$;
REVOKE ALL ON FUNCTION public.tts_consume(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tts_consume(integer) TO authenticated;

-- Character voice metadata is separate from the authored chat lines so a
-- speaker can keep one consistent voice and style across every scene.
CREATE TABLE IF NOT EXISTS public.chat_story_characters (
  story_id uuid NOT NULL REFERENCES public.chat_stories(id) ON DELETE CASCADE,
  speaker_key text NOT NULL,
  display_name text NOT NULL,
  gemini_voice text NOT NULL DEFAULT 'Kore',
  voice_style text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, speaker_key)
);
ALTER TABLE public.chat_story_characters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_story_characters_read ON public.chat_story_characters;
CREATE POLICY chat_story_characters_read ON public.chat_story_characters
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS chat_story_characters_admin_write ON public.chat_story_characters;
CREATE POLICY chat_story_characters_admin_write ON public.chat_story_characters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.chat_story_characters TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chat_story_characters TO authenticated;

-- Audio is keyed by story/chapter/user because these curated stories do not
-- have a writer-owner column. A user can replace or delete only their own file.
CREATE TABLE IF NOT EXISTS public.chat_story_scene_audio (
  story_id uuid NOT NULL REFERENCES public.chat_stories(id) ON DELETE CASCADE,
  scene_id text NOT NULL,
  generated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_url text NOT NULL,
  audio_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, scene_id, generated_by)
);
ALTER TABLE public.chat_story_scene_audio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_story_scene_audio_read ON public.chat_story_scene_audio;
CREATE POLICY chat_story_scene_audio_read ON public.chat_story_scene_audio
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS chat_story_scene_audio_insert_own ON public.chat_story_scene_audio;
CREATE POLICY chat_story_scene_audio_insert_own ON public.chat_story_scene_audio
  FOR INSERT TO authenticated WITH CHECK (generated_by = auth.uid());
DROP POLICY IF EXISTS chat_story_scene_audio_update_own ON public.chat_story_scene_audio;
CREATE POLICY chat_story_scene_audio_update_own ON public.chat_story_scene_audio
  FOR UPDATE TO authenticated USING (generated_by = auth.uid())
  WITH CHECK (generated_by = auth.uid());
DROP POLICY IF EXISTS chat_story_scene_audio_delete_own ON public.chat_story_scene_audio;
CREATE POLICY chat_story_scene_audio_delete_own ON public.chat_story_scene_audio
  FOR DELETE TO authenticated USING (generated_by = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_story_scene_audio TO authenticated;

INSERT INTO public.chat_story_characters(story_id, speaker_key, display_name)
SELECT DISTINCT l.story_id, l.speaker,
  CASE l.speaker
    WHEN 'them' THEN s.them_name
    WHEN 'me' THEN s.me_name
    ELSE 'Narrator'
  END
FROM public.chat_story_lines l
JOIN public.chat_stories s ON s.id = l.story_id
ON CONFLICT (story_id, speaker_key) DO NOTHING;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('story-audio', 'story-audio', true, 52428800, ARRAY['audio/mpeg'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "Story audio public read" ON storage.objects;
CREATE POLICY "Story audio public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'story-audio');
DROP POLICY IF EXISTS "Users upload own story audio" ON storage.objects;
CREATE POLICY "Users upload own story audio" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'story-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS "Users update own story audio" ON storage.objects;
CREATE POLICY "Users update own story audio" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'story-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'story-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS "Users delete own story audio" ON storage.objects;
CREATE POLICY "Users delete own story audio" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'story-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';

-- Verification
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tts_usage', 'chat_story_characters', 'chat_story_scene_audio')
ORDER BY tablename;
SELECT proname, pg_get_function_identity_arguments(oid) AS arguments
FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'tts_consume';

-- Rollback: drop public.tts_consume(integer), the three new public tables, and
-- the story-audio Storage policies/bucket only after checking that no saved
-- audio is still in use. Keep any uploaded media until it has been exported.