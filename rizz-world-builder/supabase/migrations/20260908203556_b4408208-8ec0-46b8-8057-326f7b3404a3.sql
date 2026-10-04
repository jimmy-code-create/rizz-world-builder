REVOKE EXECUTE ON FUNCTION public.award_badge(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_author(uuid, public.post_visibility) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_blocked_pair(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_close_friend(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon, authenticated;