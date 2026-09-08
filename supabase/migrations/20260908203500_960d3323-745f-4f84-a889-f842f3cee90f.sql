INSERT INTO public.chat_stories (slug, title, hook, emoji, category, gradient, them_name, me_name, word_count, is_branching)
VALUES (
  'room-4b',
  'Room 4B: The Door That Texted',
  'A midnight message arrives from a room that should have been empty.',
  '🚪',
  'horror',
  'linear-gradient(135deg,#09090b,#7c2d12)',
  'Room 4B',
  'You',
  620,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  hook = EXCLUDED.hook,
  emoji = EXCLUDED.emoji,
  category = EXCLUDED.category,
  gradient = EXCLUDED.gradient,
  them_name = EXCLUDED.them_name,
  me_name = EXCLUDED.me_name,
  word_count = EXCLUDED.word_count,
  is_branching = EXCLUDED.is_branching;

DELETE FROM public.chat_story_choices
WHERE story_id = (SELECT id FROM public.chat_stories WHERE slug = 'room-4b');

DELETE FROM public.chat_story_lines
WHERE story_id = (SELECT id FROM public.chat_stories WHERE slug = 'room-4b');

INSERT INTO public.chat_story_lines (story_id, idx, speaker, body, next_idx, chapter)
SELECT s.id, v.idx, v.speaker, v.body, v.next_idx, v.chapter
FROM public.chat_stories s
JOIN (VALUES
  ('room-4b', 1, 'narrator', 'रात के 2:13 बजे, खाली गलियारे में एक फोन चमका।', 2, 'scene-1'),
  ('room-4b', 2, 'them', 'क्या तुम अभी भी जाग रहे हो?', 3, 'scene-1'),
  ('room-4b', 3, 'me', 'कौन हो तुम? यह नंबर मेरे फोन में सेव नहीं है।', 4, 'scene-1'),
  ('room-4b', 4, 'them', 'कमरा 4B खुला है। अकेले मत आना।', NULL, 'scene-2'),
  ('room-4b', 10, 'narrator', 'लिफ्ट ने चौथी मंज़िल पर रुकने से पहले तीन बार सांस ली।', 11, 'scene-2'),
  ('room-4b', 11, 'them', 'दरवाज़े के नीचे से रोशनी आ रही है।', 12, 'scene-2'),
  ('room-4b', 12, 'me', 'मैं दरवाज़ा खोल रहा हूँ।', 13, 'scene-3'),
  ('room-4b', 13, 'them', 'नहीं। पहले पूछो कि अंदर कौन है।', NULL, 'scene-3'),
  ('room-4b', 20, 'narrator', 'तुमने दरवाज़े पर हाथ रखा। लकड़ी धड़क रही थी।', 21, 'scene-2'),
  ('room-4b', 21, 'me', 'अंदर कौन है?', 22, 'scene-3'),
  ('room-4b', 22, 'them', 'तुम्हारी आवाज़ अंदर से आई।', 23, 'scene-3'),
  ('room-4b', 23, 'narrator', 'कमरे की लाइट जली। स्क्रीन पर आखिरी संदेश दिखा: अब पीछे मत देखना।', NULL, 'scene-4')
) AS v(slug, idx, speaker, body, next_idx, chapter) ON v.slug = s.slug;

INSERT INTO public.chat_story_choices (story_id, at_idx, position, label, reply_body, goto_idx)
SELECT s.id, v.at_idx, v.position, v.label, v.reply_body, v.goto_idx
FROM public.chat_stories s
JOIN (VALUES
  ('room-4b', 4, 1, 'मैं अकेला नहीं आऊँगा।', 'मैं अपने दोस्त को कॉल कर रहा हूँ।', 10),
  ('room-4b', 4, 2, 'मैं अभी आ रहा हूँ।', 'ठीक है। मैं कमरे के बाहर हूँ।', 20)
) AS v(slug, at_idx, position, label, reply_body, goto_idx) ON v.slug = s.slug;