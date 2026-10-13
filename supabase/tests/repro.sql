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
  res jsonb := '{"ok": true}'::jsonb;
BEGIN
  SELECT id INTO rizz_bot FROM public.bots WHERE is_builtin AND name = 'RIZZ BOT';
  PERFORM pg_temp.expect('ratings: the directory carries the score',
    (SELECT (dir->>'rating_count')::int FROM jsonb_array_elements(public.bot_directory(NULL)) AS dir
      WHERE dir->>'bot_id' = rizz_bot::text) = 1
    AND (SELECT (dir->>'my_rating')::int FROM jsonb_array_elements(public.bot_directory(NULL)) AS dir
      WHERE dir->>'bot_id' = rizz_bot::text) = 3, res::text);
  RAISE NOTICE 'made it past the directory check';
END;
$x$;
