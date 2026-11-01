-- Realm emoji reactions were rejected by the toggle, not the table.
--
-- `20261111000000_shared_realm_emoji.sql` widened the column CHECK to 64
-- characters, but `toggle_post_reaction` kept its own `1..16` guard. A
-- `ce:<emoji id>` key is 39 characters, so the RPC raised "Invalid reaction"
-- before the insert ever reached the widened column — exactly the error
-- members saw when they reacted with a realm emoji.
--
-- Replaces the function with the same body and a 64-character bound, and
-- repeats the column widening so this file alone is enough to fix it.
-- Idempotent: safe to run before, after or instead of 20261111000000.

ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_emoji_check;
ALTER TABLE public.post_reactions
  ADD CONSTRAINT post_reactions_emoji_check
  CHECK (length(emoji) BETWEEN 1 AND 64);

CREATE OR REPLACE FUNCTION public.toggle_post_reaction(_post_id uuid, _emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_author uuid;
BEGIN
  IF auth.uid() IS NULL OR length(coalesce(_emoji, '')) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;
  SELECT author_id INTO v_author FROM public.posts WHERE id = _post_id;
  IF NOT FOUND OR public.is_blocked_pair(auth.uid(), v_author) THEN
    RAISE EXCEPTION 'Post not found or not available to this user';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.post_reactions
    WHERE post_id = _post_id AND user_id = auth.uid() AND emoji = _emoji
  ) THEN
    DELETE FROM public.post_reactions
    WHERE post_id = _post_id AND user_id = auth.uid() AND emoji = _emoji;
  ELSE
    INSERT INTO public.post_reactions(post_id, user_id, emoji)
    VALUES (_post_id, auth.uid(), _emoji)
    ON CONFLICT (post_id, user_id, emoji) DO NOTHING;
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'emoji', grouped.emoji, 'count', grouped.reaction_count, 'mine', grouped.mine
    ) ORDER BY grouped.emoji), '[]'::jsonb)
    FROM (
      SELECT emoji, count(*)::integer AS reaction_count,
        bool_or(user_id = auth.uid()) AS mine
      FROM public.post_reactions WHERE post_id = _post_id GROUP BY emoji
    ) grouped
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.toggle_post_reaction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_post_reaction(uuid, text) TO authenticated;
