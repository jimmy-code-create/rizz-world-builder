-- RIZZ post count repair and soft-delete support. Safe to re-run.
-- Comment replies count once each; deleted rows never contribute to counts.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid
    REFERENCES public.post_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS post_comments_active_post_created_idx
  ON public.post_comments(post_id, created_at, id)
  WHERE deleted_at IS NULL;

-- Preserve the existing select/insert/delete policies while adding the ability
-- for an author to soft-delete their own comment and reply to an active comment.
DROP POLICY IF EXISTS "Users update own comments" ON public.post_comments;
CREATE POLICY "Users update own comments" ON public.post_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION public.sync_post_interaction_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_old_post_id uuid;
  v_new_post_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old_post_id := OLD.post_id; END IF;
  IF TG_OP <> 'DELETE' THEN v_new_post_id := NEW.post_id; END IF;

  IF v_old_post_id IS NOT NULL THEN
    UPDATE public.posts p SET
      comment_count = (
        SELECT count(*)::integer FROM public.post_comments c
        WHERE c.post_id = v_old_post_id AND c.deleted_at IS NULL
      ),
      like_count = (
        SELECT count(*)::integer FROM public.post_likes l
        WHERE l.post_id = v_old_post_id
      )
    WHERE p.id = v_old_post_id;
  END IF;

  IF v_new_post_id IS NOT NULL AND v_new_post_id IS DISTINCT FROM v_old_post_id THEN
    UPDATE public.posts p SET
      comment_count = (
        SELECT count(*)::integer FROM public.post_comments c
        WHERE c.post_id = v_new_post_id AND c.deleted_at IS NULL
      ),
      like_count = (
        SELECT count(*)::integer FROM public.post_likes l
        WHERE l.post_id = v_new_post_id
      )
    WHERE p.id = v_new_post_id;
  ELSIF TG_OP = 'UPDATE' AND v_new_post_id IS NOT NULL THEN
    UPDATE public.posts p SET
      comment_count = (
        SELECT count(*)::integer FROM public.post_comments c
        WHERE c.post_id = v_new_post_id AND c.deleted_at IS NULL
      ),
      like_count = (
        SELECT count(*)::integer FROM public.post_likes l
        WHERE l.post_id = v_new_post_id
      )
    WHERE p.id = v_new_post_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_post_likes ON public.post_likes;
CREATE TRIGGER trg_post_likes
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_interaction_counts();
DROP TRIGGER IF EXISTS trg_post_comments ON public.post_comments;
CREATE TRIGGER trg_post_comments
  AFTER INSERT OR DELETE OR UPDATE OF post_id, deleted_at ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_interaction_counts();

-- One-time repair for rows that drifted before these triggers were installed.
UPDATE public.posts p SET
  like_count = (SELECT count(*)::integer FROM public.post_likes l WHERE l.post_id = p.id),
  comment_count = (
    SELECT count(*)::integer FROM public.post_comments c
    WHERE c.post_id = p.id AND c.deleted_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.get_post_counts(_post_ids uuid[])
RETURNS TABLE(post_id uuid, like_count integer, comment_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id,
    (SELECT count(*)::integer FROM public.post_likes l WHERE l.post_id = p.id),
    (SELECT count(*)::integer FROM public.post_comments c
      WHERE c.post_id = p.id AND c.deleted_at IS NULL)
  FROM public.posts p
  WHERE p.id = ANY(coalesce(_post_ids, '{}'));
$function$;
REVOKE ALL ON FUNCTION public.get_post_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_post_counts(uuid[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verification: any returned row has a stale stored counter.
SELECT p.id AS post_id, p.like_count AS stored_likes,
  (SELECT count(*)::integer FROM public.post_likes l WHERE l.post_id = p.id) AS actual_likes,
  p.comment_count AS stored_comments,
  (SELECT count(*)::integer FROM public.post_comments c
    WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS actual_comments
FROM public.posts p
WHERE p.like_count IS DISTINCT FROM
      (SELECT count(*)::integer FROM public.post_likes l WHERE l.post_id = p.id)
   OR p.comment_count IS DISTINCT FROM
      (SELECT count(*)::integer FROM public.post_comments c
        WHERE c.post_id = p.id AND c.deleted_at IS NULL)
ORDER BY p.created_at DESC;

-- Rollback: drop the two counter triggers and get_post_counts(); restore the
-- prior count triggers before dropping sync_post_interaction_counts(). Keep the
-- new count values and deleted_at/parent_comment_id columns unless a reviewed
-- data migration has preserved soft-deleted comments and their replies.