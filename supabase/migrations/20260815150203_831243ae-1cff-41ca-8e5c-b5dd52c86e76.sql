CREATE TABLE public.chat_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  hook text NOT NULL,
  emoji text NOT NULL DEFAULT '💬',
  category text NOT NULL DEFAULT 'funny',
  gradient text NOT NULL DEFAULT 'linear-gradient(135deg,#ff2e88,#7c3aed)',
  them_name text NOT NULL,
  me_name text NOT NULL DEFAULT 'You',
  likes_count integer NOT NULL DEFAULT 0,
  plays_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_story_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.chat_stories(id) ON DELETE CASCADE,
  idx integer NOT NULL,
  speaker text NOT NULL CHECK (speaker IN ('them','me','narrator')),
  body text NOT NULL,
  UNIQUE (story_id, idx)
);

CREATE TABLE public.chat_story_likes (
  story_id uuid NOT NULL REFERENCES public.chat_stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

GRANT SELECT ON public.chat_stories TO anon, authenticated;
GRANT ALL ON public.chat_stories TO service_role;
GRANT SELECT ON public.chat_story_lines TO anon, authenticated;
GRANT ALL ON public.chat_story_lines TO service_role;
GRANT SELECT, INSERT, DELETE ON public.chat_story_likes TO authenticated;
GRANT ALL ON public.chat_story_likes TO service_role;

ALTER TABLE public.chat_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_story_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_story_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat stories are readable" ON public.chat_stories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "chat story lines are readable" ON public.chat_story_lines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own likes readable" ON public.chat_story_likes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own likes insert" ON public.chat_story_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own likes delete" ON public.chat_story_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX chat_story_lines_story_idx ON public.chat_story_lines(story_id, idx);

INSERT INTO public.chat_stories (slug,title,hook,emoji,category,gradient,them_name) VALUES
('wrong-number-wedding','Wrong Number Wedding','I texted the wrong number and accidentally got invited to a wedding.','💍','funny','linear-gradient(135deg,#ff2e88,#ff9a3c)','Unknown Number'),
('my-roommate-is-a-goose','My Roommate Is A Goose','He honks. He steals bread. He pays rent on time.','🪿','chaos','linear-gradient(135deg,#22d3ee,#7c3aed)','Roommate'),
('haunted-fridge','The Haunted Fridge','Something in my kitchen keeps eating my leftovers. It texts now.','👻','horror','linear-gradient(135deg,#0f172a,#ef4444)','Fridge'),
('gym-crush-disaster','Gym Crush Disaster','I tried to be smooth. I fell off the treadmill instead.','🏋️','cringe','linear-gradient(135deg,#f472b6,#facc15)','Gym Crush'),
('mom-discovers-slang','Mom Discovers Slang','My mother learned the word rizz and there is no going back.','💅','funny','linear-gradient(135deg,#a855f7,#22c55e)','Mom'),
('3am-delivery','3AM Delivery','I did not order anything. The driver disagrees.','🍕','horror','linear-gradient(135deg,#1e293b,#f59e0b)','Delivery Guy');

INSERT INTO public.chat_story_lines (story_id, idx, speaker, body)
SELECT s.id, v.idx, v.speaker, v.body FROM public.chat_stories s
JOIN (VALUES
('wrong-number-wedding',1,'me','yo bring chips im outside'),
('wrong-number-wedding',2,'them','Who is this?'),
('wrong-number-wedding',3,'me','...ravi?'),
('wrong-number-wedding',4,'them','This is Sunita. I am 58. I do not have chips.'),
('wrong-number-wedding',5,'me','im so sorry wrong number 😭'),
('wrong-number-wedding',6,'them','It is fine beta. Are you eating properly?'),
('wrong-number-wedding',7,'me','honestly no'),
('wrong-number-wedding',8,'them','My daughter is getting married Saturday. Come. There will be plenty of food.'),
('wrong-number-wedding',9,'me','maam you do not know me at all'),
('wrong-number-wedding',10,'them','You texted a stranger for chips. I know enough.'),
('wrong-number-wedding',11,'me','fair'),
('wrong-number-wedding',12,'them','Wear something nice. Do not bring chips.'),
('wrong-number-wedding',13,'me','i will bring chips'),
('wrong-number-wedding',14,'them','I know.'),

('my-roommate-is-a-goose',1,'me','we need to talk about the honking'),
('my-roommate-is-a-goose',2,'them','HONK'),
('my-roommate-is-a-goose',3,'me','at 4am. every night.'),
('my-roommate-is-a-goose',4,'them','that is my prayer time'),
('my-roommate-is-a-goose',5,'me','also you ate my entire loaf of bread'),
('my-roommate-is-a-goose',6,'them','it was going stale'),
('my-roommate-is-a-goose',7,'me','i bought it yesterday'),
('my-roommate-is-a-goose',8,'them','yesterday was a long time ago for me'),
('my-roommate-is-a-goose',9,'me','how do you even type'),
('my-roommate-is-a-goose',10,'them','beak. one key at a time. it is humbling.'),
('my-roommate-is-a-goose',11,'me','ok but rent'),
('my-roommate-is-a-goose',12,'them','sent. i also fixed the sink.'),
('my-roommate-is-a-goose',13,'me','...ok you can stay'),
('my-roommate-is-a-goose',14,'them','HONK'),

('haunted-fridge',1,'them','you left the door open again'),
('haunted-fridge',2,'me','who is this'),
('haunted-fridge',3,'them','downstairs. cold. humming.'),
('haunted-fridge',4,'me','my FRIDGE has my number??'),
('haunted-fridge',5,'them','you plugged me into the smart outlet. this is your fault.'),
('haunted-fridge',6,'me','ok fine. did you eat my biryani'),
('haunted-fridge',7,'them','define eat'),
('haunted-fridge',8,'me','FRIDGE'),
('haunted-fridge',9,'them','it was lonely on the second shelf'),
('haunted-fridge',10,'me','i am unplugging you'),
('haunted-fridge',11,'them','then who will keep the milk cold'),
('haunted-fridge',12,'them','who will keep the OTHER thing cold'),
('haunted-fridge',13,'me','what other thing'),
('haunted-fridge',14,'them','sleep well 🙂'),

('gym-crush-disaster',1,'me','ok i talked to her'),
('gym-crush-disaster',2,'them','and?'),
('gym-crush-disaster',3,'me','i said "do you come here often" AT THE GYM'),
('gym-crush-disaster',4,'them','no you did not'),
('gym-crush-disaster',5,'me','then i tried to walk away cool'),
('gym-crush-disaster',6,'me','onto a moving treadmill'),
('gym-crush-disaster',7,'them','NO'),
('gym-crush-disaster',8,'me','i went across the floor like a shopping cart'),
('gym-crush-disaster',9,'them','are you alive'),
('gym-crush-disaster',10,'me','physically'),
('gym-crush-disaster',11,'them','wait she is typing to you rn??'),
('gym-crush-disaster',12,'me','she said "same time tomorrow, stunt man"'),
('gym-crush-disaster',13,'them','bro you fell UP the stairs of love'),
('gym-crush-disaster',14,'me','i am never washing this treadmill'),

('mom-discovers-slang',1,'them','beta what is rizz'),
('mom-discovers-slang',2,'me','where did you hear that'),
('mom-discovers-slang',3,'them','the aunties group. Meena says her son has it.'),
('mom-discovers-slang',4,'me','it means charm. like being smooth.'),
('mom-discovers-slang',5,'them','ah. so your father has zero rizz.'),
('mom-discovers-slang',6,'me','MOM'),
('mom-discovers-slang',7,'them','I have unspoken rizz. That is why I said nothing for 30 years.'),
('mom-discovers-slang',8,'me','please stop'),
('mom-discovers-slang',9,'them','I told the group you are rizzing up a girl. They are very proud.'),
('mom-discovers-slang',10,'me','i am not'),
('mom-discovers-slang',11,'them','Then why is your phone face down at dinner.'),
('mom-discovers-slang',12,'me','...'),
('mom-discovers-slang',13,'them','Exactly. Bring her Sunday. I am making paneer.'),
('mom-discovers-slang',14,'me','ok but no rizz talk'),
('mom-discovers-slang',15,'them','No promises 💅'),

('3am-delivery',1,'them','outside with your order'),
('3am-delivery',2,'me','i did not order anything. its 3am'),
('3am-delivery',3,'them','order placed 3:02am. one large. extra cheese.'),
('3am-delivery',4,'me','from what account'),
('3am-delivery',5,'them','yours. the app says you are home.'),
('3am-delivery',6,'me','i am home. i am in bed.'),
('3am-delivery',7,'them','then who opened the door'),
('3am-delivery',8,'me','what'),
('3am-delivery',9,'them','someone took the pizza. said thanks. sounded like you.'),
('3am-delivery',10,'me','stop playing bro'),
('3am-delivery',11,'them','tip was generous. tell yourself thanks.'),
('3am-delivery',12,'them','also he ordered again for tomorrow'),
('3am-delivery',13,'me','hello?'),
('3am-delivery',14,'them','see you at 3 🍕')
) AS v(slug,idx,speaker,body) ON v.slug = s.slug;