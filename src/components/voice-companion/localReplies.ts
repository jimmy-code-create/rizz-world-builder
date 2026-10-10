const replySets: Array<{ match: RegExp; replies: string[] }> = [
  {
    match: /\b(hi|hey|hello|yo|what's up)\b/i,
    replies: ["Hey! I’m Lil Rizz. What’s the vibe?", "Yo, I’m here. What are we getting into?"],
  },
  {
    match: /\b(joke|make me laugh|funny)\b/i,
    replies: ["I tried to write a joke about Wi-Fi, but the connection was weak.", "My favorite social plan is a group chat that actually picks a time."],
  },
  {
    match: /\b(bored|nothing to do|entertain)\b/i,
    replies: ["Quick challenge: send a friend the most oddly specific compliment you can think of.", "Pick a song you loved years ago and give it a comeback tour."],
  },
  {
    match: /\b(sad|down|rough|bad day|upset)\b/i,
    replies: ["I’m sorry it’s been a rough one. Want to tell me what happened?", "That sounds heavy. You don’t have to make it sound okay for me."],
  },
  {
    match: /\b(friend|friends|group|chat)\b/i,
    replies: ["Good people make even the quiet moments feel like a plan. Who’s been on your mind?", "A low-pressure check-in can go a long way. Is there someone you want to message?"],
  },
  {
    match: /\b(thanks|thank you)\b/i,
    replies: ["Anytime. I’m right here.", "You got it. Glad I could hang for a minute."],
  },
  {
    match: /\b(help|advice|should i|what do i do)\b/i,
    replies: ["I can help you think it through. What matters most to you in this situation?", "Let’s slow it down. What’s the part you’re most unsure about?"],
  },
];

export function getLocalCompanionReply(input: string) {
  const normalized = input.trim();
  if (!normalized) return "I missed that. Want to say it one more time?";

  const match = replySets.find((entry) => entry.match.test(normalized));
  if (!match) {
    return "I’m listening. Want to tell me a little more so I can keep up?";
  }

  const seed = normalized.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return match.replies[seed % match.replies.length] ?? match.replies[0]!;
}
