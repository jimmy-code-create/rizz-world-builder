
REVOKE EXECUTE ON FUNCTION public.bump_group_members() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_group_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_group_friends() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pick_giveaway_winners(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pick_giveaway_winners(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
