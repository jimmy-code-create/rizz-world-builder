
-- Bookmarks (save posts for later)
CREATE TABLE public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, post_id)
);
CREATE INDEX idx_bookmarks_user ON public.bookmarks(user_id, created_at desc);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookmarks read" ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own bookmarks insert" ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bookmarks delete" ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Hashtags: simple table + post_hashtags join, auto-populate via trigger from caption #tags
CREATE TABLE public.hashtags (
  tag text primary key,
  post_count int not null default 0,
  created_at timestamptz not null default now()
);
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hashtags public read" ON public.hashtags FOR SELECT USING (true);

CREATE TABLE public.post_hashtags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag text not null references public.hashtags(tag) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tag)
);
CREATE INDEX idx_post_hashtags_tag ON public.post_hashtags(tag, created_at desc);
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_hashtags public read" ON public.post_hashtags FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.extract_hashtags() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.caption IS NOT NULL THEN
    FOR m IN SELECT DISTINCT lower(substring(t from 2)) FROM regexp_matches(NEW.caption, '#([a-zA-Z0-9_]{2,32})', 'g') AS t LOOP
      INSERT INTO public.hashtags(tag, post_count) VALUES (m, 1)
        ON CONFLICT (tag) DO UPDATE SET post_count = public.hashtags.post_count + 1;
      INSERT INTO public.post_hashtags(post_id, tag) VALUES (NEW.id, m) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS posts_extract_hashtags ON public.posts;
CREATE TRIGGER posts_extract_hashtags AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.extract_hashtags();
