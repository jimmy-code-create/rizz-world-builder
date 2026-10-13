-- Focused probe for the bot-ratings directory payload: bot_directory() has to
-- report both the community score and the caller's own rating. Run it against a
-- scratch database that already has the migrations applied.
CREATE OR REPLACE FUNCTION pg_temp.expect(l text, ok boolean, d text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE '% % % %', CASE WHEN coalesce(ok,false) THEN 'PASS' ELSE 'FAIL' END,
    l, CASE WHEN coalesce(ok,false) THEN '' ELSE '<<<' END, coalesce(left(d,200),'');
END $$;

DO $x$
DECLARE
  e uuid := '22222222-2222-2222-2222-222222222222';
  rizz_bot uuid;
  res jsonb;
  entry jsonb;
BEGIN
  SELECT id INTO rizz_bot FROM public.bots WHERE is_builtin AND name = 'RIZZ BOT';
  IF rizz_bot IS NULL THEN
    RAISE NOTICE 'SKIP ratings: RIZZ BOT is not in this database';
    RETURN;
  END IF;

  -- Standalone: this probe is runnable on its own, so make sure the caller has
  -- an account before rating as them.
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (e, 'repro-rater@probe.test', '{"username":"repro_rater","display_name":"Repro Rater"}')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (e, 'repro_rater', 'Repro Rater')
  ON CONFLICT (id) DO NOTHING;

  -- bot_directory() reports my_rating relative to the caller, so become them
  -- before asking. (Without this the previous version of this probe could never
  -- pass: my_rating came back null and the comparison silently failed.)
  PERFORM set_config('request.jwt.claim.sub', e::text, false);

  res := public.rate_bot(rizz_bot, 3, 'repro: a three');
  PERFORM pg_temp.expect('ratings: a rating can be recorded', coalesce(res->>'ok','') = 'true', res::text);

  SELECT dir INTO entry
  FROM jsonb_array_elements(public.bot_directory(NULL)) AS dir
  WHERE dir->>'bot_id' = rizz_bot::text;

  -- "At least one rating" is deliberate: the other probes rate this same bot,
  -- so the count is not a fixed number, while the caller's own 3 stars are.
  PERFORM pg_temp.expect('ratings: the directory carries the score',
    entry IS NOT NULL
    AND (entry->>'rating_count')::int >= 1
    AND (entry->>'my_rating')::int = 3,
    coalesce(entry::text, 'no directory row for RIZZ BOT'));
END;
$x$;
