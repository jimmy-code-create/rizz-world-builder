-- ============ WEB SLINGER RETIRES ============
-- The spider-silk scene is gone from the app: its art is no longer in the
-- effects registry, so a row for this slug would render nothing. Removing the
-- catalogue row also removes ownership (user_profile_effects.effect_id is
-- ON DELETE CASCADE), which means no member can keep it equipped and no shop
-- card can outlive the art it sells.
--
-- Idempotent: the DELETE only matches the retired slug.

DELETE FROM public.profile_effects
WHERE slug = 'fx-web-slinger';

NOTIFY pgrst, 'reload schema';
