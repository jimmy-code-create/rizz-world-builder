ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'creator';

CREATE OR REPLACE FUNCTION public.get_post_author_flags(_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  is_creator boolean,
  is_verified_creator boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    requested.user_id,
    EXISTS (
      SELECT 1
      FROM public.user_roles AS ur
      WHERE ur.user_id = requested.user_id
        AND ur.role::text = 'creator'
    ) AS is_creator,
    EXISTS (
      SELECT 1
      FROM public.user_badges AS ub
      JOIN public.badges AS b ON b.id = ub.badge_id
      WHERE ub.user_id = requested.user_id
        AND b.slug = 'verified_creator'
    ) AS is_verified_creator
  FROM unnest(COALESCE(_user_ids, ARRAY[]::uuid[])) AS requested(user_id)
  WHERE requested.user_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_post_author_flags(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_post_author_flags(uuid[]) TO anon, authenticated;
