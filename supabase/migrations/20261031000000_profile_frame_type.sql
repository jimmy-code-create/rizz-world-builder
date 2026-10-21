-- ============ PROFILE FRAME SLOT ============
-- Frames are their own wearable slot: a member can wear an avatar decoration,
-- a banner effect and a frame at the same time, exactly like Discord. The
-- value lives in its own migration so the catalogue insert runs after the enum
-- change is committed.

ALTER TYPE public.profile_effect_type ADD VALUE IF NOT EXISTS 'profile_frame';
