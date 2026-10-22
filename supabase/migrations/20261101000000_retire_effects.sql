-- ============ EFFECTS RETIRED ============
-- The effects shelf is gone. Removing the catalogue rows cascades to
-- user_profile_effects (effect_id ON DELETE CASCADE), so no member can keep an
-- overlay equipped on their profile and no retired slug can be re-equipped.
-- The tables stay in place: purchase history and the wallet ledger are kept,
-- only the wearable cosmetics are gone. Idempotent.

DELETE FROM public.profile_effects;

NOTIFY pgrst, 'reload schema';
