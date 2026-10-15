-- Badge set v2: exactly 5 canonical badges. This replaces the whole set —
-- applying it deletes old badge rows and their awards (old auto-award
-- triggers are NULL-safe and become no-ops; admin grants keep working).
-- Rerunning is safe (delete + reseed lands on the same 5 rows).
DELETE FROM public.user_badges;
DELETE FROM public.badges;

INSERT INTO public.badges (slug, name, description, icon, color, rarity, animated, glow_color, tier) VALUES
('founder', 'Founder', 'The originals. Awarded by the RIZZ team.', ':cat_gg:', '#ff4d6d', 'mythic', false, '#ff4d6d', 5),
('main-character', 'Main Character', 'Content that moves the room. Creator program, 25+ posts with 500+ reactions.', ':cat_hype:', '#a855f7', 'epic', false, '#a855f7', 4),
('voice-of-realm', 'Voice of the Realm', 'When they talk, rooms fill. Hosted 25+ voice realms.', ':cat_music:', '#a855f7', 'epic', false, '#a855f7', 4),
('the-rizz', 'The Rizz', 'Not just rizz. The Rizz. #1 on the leaderboard / 500K+ Rizz.', ':cat_cool:', '#ff4d6d', 'mythic', false, '#ff4d6d', 5),
('no-cap', 'No Cap', 'Real one. No cap. Identity verified.', ':cat_love:', '#3b82f6', 'rare', false, '#3b82f6', 3);
