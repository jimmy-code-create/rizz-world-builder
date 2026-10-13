#!/usr/bin/env node
/**
 * Seed the RIZZ database with demo content using only the PUBLIC Supabase keys
 * (VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY). No service-role key is
 * required: accounts are created through public sign-up and every row is
 * inserted by the account that owns it, exactly the way the app itself would.
 *
 *   node scripts/seed-demo.mjs users [total]      ensure N demo accounts (default 1000)
 *   node scripts/seed-demo.mjs social [from] [to] follows + posts + likes + comments + stories
 *   node scripts/seed-demo.mjs chat               upload branching chat stories
 *   node scripts/seed-demo.mjs status             read-only counts
 *   node scripts/seed-demo.mjs all [total]        every phase in order
 *
 * Demo accounts use emails at @seed.rizz.demo — that domain is the cleanup key:
 * deleting those auth.users rows cascades to their profiles, follows, posts,
 * comments, likes, stories and chat stories.
 */

const BASE = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

const EMAIL_DOMAIN = "seed.rizz.demo";
const TARGET_USERS = 1000;
const POST_TARGETS = 40;
const STORY_COUNT = 10;
const VIRAL_COMMENTS = [1000, 1400, 1900];
const VIRAL_LIKES = [700, 900, 1100];
const COMMENTERS = 60;
const STORY_LIKES_MIN = 1000;
const STORY_LIKES_MAX = 2000;

function requireEnv() {
  if (!BASE || !KEY) {
    console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in the environment.");
    process.exit(2);
  }
}

/* -------------------------------------------------------------- plumbing */

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
async function pool(items, size, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.max(1, Math.min(size, queue.length)) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(runners);
}
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const contentRng = mulberry32(777000111);
const pick = (arr) => arr[Math.floor(contentRng() * arr.length)];
const randInt = (min, max) => min + Math.floor(contentRng() * (max - min + 1));
/** Stable hash for like-distribution windows — identical on every run. */
const hash = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const ANON = { apikey: KEY ?? "", Authorization: `Bearer ${KEY ?? ""}`, "Content-Type": "application/json" };

/** One HTTP call with 429/5xx backoff. Returns {status, json}. */
async function api(url, { method = "GET", body, headers = {}, attempts = 5 } = {}) {
  let delay = 400;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers: { ...ANON, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.status === 429 || response.status >= 500) {
        if (attempt === attempts) return { status: response.status, json: {} };
        await sleep(delay + Math.floor(Math.random() * 250));
        delay *= 2;
        continue;
      }
      const text = await response.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }
      return { status: response.status, json };
    } catch {
      if (attempt === attempts) return { status: 0, json: {} };
      await sleep(delay);
      delay *= 2;
    }
  }
  return { status: 0, json: {} };
}

const rest = (table, opts = {}) =>
  api(`${BASE}/rest/v1/${table}${opts.query ? `?${opts.query}` : ""}`, {
    method: opts.method ?? "GET",
    body: opts.body,
    headers: { ...(opts.prefer ? { Prefer: opts.prefer } : {}), ...(opts.headers ?? {}) },
  });

const authCall = (path, body, method = "POST") => api(`${BASE}/auth/v1/${path}`, { method, body });

async function headCount(table, query) {
  try {
    const response = await fetch(`${BASE}/rest/v1/${table}?${query}`, {
      method: "HEAD",
      headers: { ...ANON, Prefer: "count=exact" },
    });
    if (!response.ok) return null;
    const total = (response.headers.get("content-range") ?? "").split("/")[1];
    return total === "*" ? null : Number(total);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- personas */

const FIRST = [
  "maya", "leo", "aisha", "diego", "nova", "omar", "zoe", "kai", "luna", "amir",
  "ivy", "noah", "rina", "theo", "sana", "milo", "peri", "jax", "talia", "ravi",
  "elsa", "hugo", "nina", "cyrus", "mira", "dante", "lila", "reno", "suri", "benji",
  "anais", "yuki", "tomas", "freya", "adan", "wren", "sol", "juno", "ezra", "pia",
];
const LAST = [
  "rivera", "okafor", "chen", "martin", "reyes", "patel", "novak", "kim", "silva", "haddad",
  "berg", "costa", "nguyen", "ibarra", "khan", "frost", "moreau", "dias", "lindqvist", "ortiz",
  "bakshi", "walsh", "tanaka", "rossi", "adeyemi", "vega", "strom", "hoffman", "solano", "park",
  "quinn", "marchetti", "duarte", "levin", "harper", "brandt", "cass", "mendez", "halvorson", "rey",
];
const BIOS = [
  "here for the chaos ✨", "music, reels, and bad decisions", "building something loud",
  "dm if the playlist is good", "professional overthinker", "out of office, in the group chat",
  "main character energy", "here for episode 7", "soft launch enthusiast", "no thoughts, just vibes",
  "chronically online", "collecting moments, not things", "say hi, i don't bite",
  "caffeine-powered since 2019", "your fav's fav", "late night thinker",
  "sending reels at 3am", "plot twist incoming", "lowkey iconic", "just here to react",
  "open to interesting conversations", "irl lagging sometimes", "voice note composer",
  "good vibes, questionable jokes", "streak: unbroken",
];
const ACCENTS = ["#ff2d92", "#7c3aed", "#22c55e", "#f59e0b", "#06b6d4", "#ef4444", "#ec4899", "#3b82f6"];

/** Shuffled once with a dedicated seed — identical persona list on every run. */
let MASTER = null;
function personas(count) {
  if (!MASTER) {
    const r = mulberry32(20261013);
    const combos = [];
    for (const f of FIRST) for (const l of LAST) combos.push([f, l]);
    for (let i = combos.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [combos[i], combos[j]] = [combos[j], combos[i]];
    }
    MASTER = combos.map(([f, l], i) => ({
      index: i,
      email: `${f}.${l}.${i}@${EMAIL_DOMAIN}`,
      username: `${f}_${l}_${i}`,
      displayName: `${f.charAt(0).toUpperCase()}${f.slice(1)} ${l.charAt(0).toUpperCase()}${l.slice(1)}`,
      avatar: `https://api.dicebear.com/9.x/thumbs/svg?seed=${f}${l}${i}`,
      bio: BIOS[i % BIOS.length],
      accent: ACCENTS[i % ACCENTS.length],
      password: `Seed-${i}-Rizz!2026`,
    }));
  }
  return MASTER.slice(0, Math.min(count, MASTER.length));
}

const CAPTIONS = [
  "ok be honest — what's the most underrated song right now? dropping the aux on whoever answers best 🎧",
  "unpopular opinion: group chats died the moment everyone started leaving people on read 💀",
  "3 years ago i couldn't run 1km. this morning i did 10. start ugly, just start.",
  "the algorithm knows me better than my ex ever did and honestly? respecting it",
  "POV: you said 'one quick episode' four hours ago 📺",
  "if your playlist doesn't have a song you scream in the car, we can't be friends",
  "hot take: replying within 3 minutes is a love language",
  "my camera roll is 40% memes, 30% screenshots of conversations i never sent",
  "weekend plan: touch grass, then post about touching grass 🌱",
  "whoever invented voice notes at 2x speed — i owe you my commute",
  "day 46 of pretending i understand what i'm doing. update: it's working",
  "the trick to a good morning isn't coffee, it's not checking notifications for 20 minutes",
  "reply with a number and i'll tell you your vibe: 1 brave 2 chaotic 3 soft 4 mysterious",
  "nothing humbles you faster than opening your old stories",
  "spent 2 hours curating a playlist for a drive that was 14 minutes long. worth it.",
  "why does every 'quick catch-up' turn into a 3-hour conversation with you people 😭",
  "signs you need a weekend: you argue with the GPS",
  "i don't have a type, i have a pattern. and the pattern is trouble.",
  "friday forecast: 100% chance of bad decisions with a chance of Tuesday regret",
  "you haven't lived until you've narrated your own slow-motion walk to the fridge",
  "small wins: inbox at zero, plants alive, played something new instead of the same 5 songs",
  "the 'i'm fine' hall of fame is getting crowded and i built half of it",
  "who hurt you? 'a 15 second ad i couldn't skip'",
  "main character weather today ☀️ dressing accordingly",
  "stopped waiting for the right moment. the right moment was extremely patient but i wasn't.",
  "name a more iconic duo than your bed and the one responsibility you're avoiding",
  "somebody in this app is wrong and i'm not afraid to type in all caps about it",
  "my sleep schedule is a suggestion at this point",
  "this is your sign to send the message. no, not that one. the honest one.",
  "rating my week: the vibes were vadding (vibes + adding, it's happening, keep up)",
  "i bought the plant to feel something. now i talk to it. we're fine.",
  "emergency poll: fries or nuggets. there is no wrong answer but there are wrong people",
  "the audacity of monday to show up right after a perfect sunday",
  "tried a new coffee place. it's fine. the barista was nice though so i'm going back",
  "if one more person says 'it is what it is' i'm going to become what it is",
  "current status: buffering",
  "made a to-do list and immediately took a nap next to it. progress is progress.",
  "you can't convince me that 11pm isn't the most productive hour of the day",
  "the plot thickens every time someone says 'we need to talk' but it's about dinner",
  "reminder: you're allowed to be both a masterpiece and a work in progress 🎨",
];

const COMMENT_BODIES = [
  "this is so real", "ok this one's actually good 😭", "hard agree", "saving this",
  "WHY is this so accurate", "lmaooo", "the way i felt this in my bones", "context?? 👀",
  "you're unhinged and i'm here for it", "first", "not the plot twist i expected",
  "i was just thinking this exact thing", "screenshotting for later", "bro 💀",
  "this changed me fr", "the comments won't be ready for this one", "agree but louder",
  "who showed you my diary", "ok but the second half though", "😭😭😭",
  "this is the content i signed up for", "unpopular but correct", "imu",
  "the accuracy is concerning", "i laughed way too hard at this", "we all know someone like this",
  "you woke up and chose violence", "banger post", "take my like and go",
  "i've read this four times", "and that's on what?", "needed this today",
  "the way i gasped", "certified vibe", "this deserves way more attention",
  "i'm in this photo and i don't like it", "no because same", "explain more pls",
  "consider me influenced", "ok actually valid",
];

const STORY_CAPTIONS = [
  "golden hour hit different today 🌇",
  "the queue for this place was SO worth it",
  "new era unlocked ✨",
  "this view almost made me late",
  "found the spot. no i won't be sharing the location",
  "sunday resets hit different",
  "main stage energy all week",
  "when the lighting just cooperates for once",
  "little rituals, big mood",
  "come with me, we're doing something spontaneous",
];

const CHAT_STORIES = [
  {
    slug: "seed-elevator-13",
    title: "The Elevator That Skips 13",
    hook: "The night shift elevator stops on a floor that isn't in the building.",
    emoji: "🛗",
    category: "horror",
    gradient: "linear-gradient(135deg,#1f2937,#7c3aed)",
    them: "Unknown",
    likes: 1834,
    plays: 2461,
    lines: [
      ["them", "you still at the office?"],
      ["me", "just leaving. the elevator's acting weird again"],
      ["them", "weird how?"],
      ["me", "it went down instead of up. then the display said 13"],
      ["narrator", "Your building has twelve floors. Everyone knows this."],
      ["them", "press the door close button. now."],
      ["me", "why are you freaking out"],
      ["them", "because i did the same thing last week and i'm still not sure which floor i got off on"],
      ["narrator", "The doors open onto a hallway lit by the same fluorescent hum you know by heart. It is your office. Every desk is facing the wrong way."],
      ["them", "..."],
      ["them", "what do you see"],
    ],
    choices: [
      { at: 8, label: "Step out", reply: "You step out. Behind you, the elevator dings — cheerful, normal — and closes.", goto: 11 },
      { at: 8, label: "Stay inside", reply: "You jab the close button. The doors shut. The display ticks to 14.", goto: 11 },
    ],
    end: ["narrator", "Either way, you make it home. You just never take that elevator again."],
  },
  {
    slug: "seed-wrong-number",
    title: "Wrong Number, Right Person",
    hook: "You texted your ex's old number. Someone new answered — and they're funny.",
    emoji: "📱",
    category: "cringe",
    gradient: "linear-gradient(135deg,#ff2e88,#f59e0b)",
    them: "???",
    likes: 1567,
    plays: 2189,
    lines: [
      ["me", "so are we still doing dinner friday or did you ghost me again lol"],
      ["them", "wrong number but honestly? im invested now"],
      ["me", "oh no. ignore me. this is my villain origin story"],
      ["them", "no no, keep going. was the dinner at least good before the ghosting"],
      ["me", "the pasta was incredible and i never got dessert. it's been 8 months"],
      ["them", "unacceptable. whoever did this owes you dessert"],
      ["me", "are you always this supportive of strangers"],
      ["them", "only the ones with good pasta stories. i'm nova by the way"],
    ],
    choices: [
      { at: 7, label: "Play along", reply: "You introduce yourself. The conversation lasts until 2am and ends with a playlist.", goto: 10 },
      { at: 7, label: "Ask why you were still saved", reply: "\"i wasn't,\" they say. \"new number. yours came up first in the suggestions.\" The dots dance forever.", goto: 10 },
    ],
    end: ["narrator", "Some wrong numbers are the right conversation. You get dessert on friday — with Nova, apparently."],
  },
  {
    slug: "seed-groupchat-3am",
    title: "The Group Chat at 3:07 AM",
    hook: "Everyone's asleep except the group chat. That's when it gets honest.",
    emoji: "🌙",
    category: "funny",
    gradient: "linear-gradient(135deg,#0ea5e9,#22c55e)",
    them: "the group chat",
    likes: 1921,
    plays: 2744,
    lines: [
      ["them", "who's awake"],
      ["me", "nobody. it's 3am"],
      ["them", "so you're awake"],
      ["me", "i'm a witness, not a participant"],
      ["them", "i just ordered a lamp shaped like a mushroom and i need everyone to know"],
      ["me", "why a mushroom"],
      ["them", "the better question is why DOESN'T your house have one"],
      ["me", "...i'm looking at lamps right now aren't i"],
      ["them", "one of us. one of us."],
    ],
    choices: [
      { at: 8, label: "Buy the lamp", reply: "Checkout. Confirmation. Regret delayed until delivery. The chat erupts.", goto: 11 },
      { at: 8, label: "Hold the line", reply: "\"i'm stronger than this,\" you type. You last four more minutes.", goto: 11 },
    ],
    end: ["narrator", "By morning there are three mushrooms in the cart and a new pinned message: Mushroom Council."],
  },
  {
    slug: "seed-roommate-ritual",
    title: "Roommate's New 'Ritual'",
    hook: "Your roommate started leaving a plate out every night. Tonight there's a note on it.",
    emoji: "🍽️",
    category: "horror",
    gradient: "linear-gradient(135deg,#111827,#ef4444)",
    them: "Roommate",
    likes: 1402,
    plays: 1975,
    lines: [
      ["them", "did you move the plate"],
      ["me", "i washed it. it had crumbs on it for three days"],
      ["them", "please tell me you washed it and didn't just put it away"],
      ["me", "i washed it?? why does it matter"],
      ["narrator", "Under the drying rack there's a note in handwriting that isn't yours: 'THANK YOU. IT'S BEEN A WHILE SINCE ANYONE FED IT.'"],
      ["them", "ok new rule. we talk about the plate before we touch the plate"],
      ["me", "what does 'feed it' mean"],
      ["them", "nothing. it means nothing. i'm moving out next month though"],
    ],
    choices: [
      { at: 6, label: "Read the note again", reply: "The ink is wet. You live alone — your roommate moved out in March.", goto: 9 },
      { at: 6, label: "Throw the plate out", reply: "It's back on the rack by morning. Clean. Warm. Empty.", goto: 9 },
    ],
    end: ["narrator", "You keep the plate. You keep feeding it. It seems polite now."],
  },
  {
    slug: "seed-dog-groupchat",
    title: "My Dog Started a Group Chat",
    hook: "The vet sent the wrong link. The other dogs are very opinionated.",
    emoji: "🐕",
    category: "chaos",
    gradient: "linear-gradient(135deg,#f59e0b,#ec4899)",
    them: "BarkChat (7)",
    likes: 1710,
    plays: 2388,
    lines: [
      ["them", "whoever's human is using the green ball AGAIN, we need to talk"],
      ["me", "sorry who is this"],
      ["them", "the ball has a rotation schedule. tuesday is mine. this is in the group rules"],
      ["me", "i think you have the wrong chat, i'm a person"],
      ["them", "sure. that's exactly what the ball thief would say"],
      ["them", "vote: kick the human? 👍 or 👎"],
      ["me", "i'm not voting on my own expulsion"],
      ["them", "abstain counted as a yes. ball is ours now. walkies at 6?"],
    ],
    choices: [
      { at: 7, label: "Accept the new rules", reply: "\"walkies at 6 works,\" you type. The chat pins your message. You've been promoted to provider.", goto: 10 },
      { at: 7, label: "Negotiate for the ball", reply: "Long. Fierce. You settle on alternating Thursdays. The humans never know.", goto: 10 },
    ],
    end: ["narrator", "You attend walkies at 6. You bring the ball. You are, reluctantly, loved for it."],
  },
  {
    slug: "seed-read-receipts",
    title: "Read Receipts From 2019",
    hook: "Your phone restored an old thread. Every message you never sent is still there.",
    emoji: "💬",
    category: "cringe",
    gradient: "linear-gradient(135deg,#6366f1,#06b6d4)",
    them: "Archive",
    likes: 1266,
    plays: 1841,
    lines: [
      ["narrator", "A restore finishes at 11:52pm. An old thread opens by itself."],
      ["them", "you up?"],
      ["me", "that message has a timestamp of 2019 and i never sent it"],
      ["them", "i know. i got them anyway"],
      ["me", "that's not how phones work"],
      ["them", "then explain why i'm reading this one too"],
      ["me", "ok new plan: we close the app, we sleep, we never speak of this"],
      ["them", "too late. the last one just sent. it says 'i still think about the aquarium'"],
    ],
    choices: [
      { at: 7, label: "Let it send", reply: "Three dots appear on their side. What comes back is longer than anything you ever typed.", goto: 10 },
      { at: 7, label: "Kill the phone", reply: "Battery out. Sim out. In the morning, one new message: 'smart. coffee instead?'", goto: 10 },
    ],
    end: ["narrator", "You go for coffee. You talk about the aquarium. You don't talk about the phone."],
  },
];

/* --------------------------------------------------------------- helpers */

async function login(persona) {
  const { status, json } = await authCall("token?grant_type=password", {
    email: persona.email,
    password: persona.password,
  });
  if (status !== 200 || !json?.access_token) return null;
  return { token: json.access_token, userId: json.user?.id ?? null };
}

const authed = (token) => ({ Authorization: `Bearer ${token}` });

async function findJimmy() {
  const { status, json } = await rest("profiles", { query: `select=id,username&username=ilike.jimmy*&limit=10` });
  if (status !== 200 || !Array.isArray(json) || !json.length) {
    throw new Error("No profile matching 'jimmy' found — is the account signed up?");
  }
  return json.find((r) => r.username === "jimmy") ?? json[0];
}

/* --------------------------------------------------------------- phases */

async function phaseUsers(total) {
  requireEnv();
  const list = personas(total);
  log(`sign-up target: ${total} demo accounts`);

  // Canary: the first sign-up reveals whether e-mail confirmation is enabled.
  // If it is, stop after ONE account instead of firing 1000 confirmation mails.
  const first = list[0];
  const firstRes = await authCall("signup", {
    email: first.email,
    password: first.password,
    data: { username: first.username, display_name: first.displayName, avatar_url: first.avatar },
  });
  const firstIsNew = ![400, 409, 422].includes(firstRes.status);
  if (firstIsNew && !firstRes.json?.access_token) {
    log(`! e-mail confirmation appears ENABLED (sign-up returned no session).`);
    log(`! stopped after 1 account so only one confirmation mail was sent.`);
    log(`! Fix: disable "Confirm email" in Supabase Auth settings, or add SUPABASE_SERVICE_ROLE_KEY`);
    log(`! to Settings -> Environment and rerun this phase.`);
    process.exit(3);
  }
  let created = firstIsNew ? 1 : 0;
  let exists = firstIsNew ? 0 : 1;
  let failed = 0;
  let done = 0;
  const restList = list.slice(1);
  await pool(restList, 8, async (persona) => {
    const { status } = await authCall("signup", {
      email: persona.email,
      password: persona.password,
      data: { username: persona.username, display_name: persona.displayName, avatar_url: persona.avatar },
    });
    if ([400, 409, 422].includes(status)) exists++;
    else if (status === 200 || status === 201) created++;
    else {
      failed++;
      if (failed <= 3) log(`  ! signup ${persona.email} -> ${status}`);
    }
    done++;
    if (done % 200 === 0) log(`  ${done}/${restList.length} attempted (created ${created}, existing ${exists})`);
  });
  log(`accounts: +${created} created, ${exists} already existed, ${failed} failed`);
}

/**
 * Content pass: personas[0..POST_TARGETS) publish feed posts and
 * personas[POST_TARGETS..+STORY_COUNT) post stories. Returns poster/storyteller
 * ids plus the rows they own. Idempotent: an author who already has content
 * is skipped.
 */
async function createContent(list) {
  const posters = list.slice(0, POST_TARGETS);
  const storytellers = list.slice(POST_TARGETS, POST_TARGETS + STORY_COUNT);
  const posterIds = [];
  const storytellerIds = [];

  await pool([...posters, ...storytellers], 6, async (persona) => {
    const session = await login(persona);
    if (!session) return;
    const headers = authed(session.token);
    const isPoster = posters.includes(persona);

    if (isPoster) {
      const check = await rest("posts", {
        query: `select=id&limit=1&author_id=eq.${session.userId}`,
        headers,
      });
      if (check.status === 200 && Array.isArray(check.json) && check.json.length) {
        posterIds.push(session.userId);
        return;
      }
      const idx = persona.index;
      const withImage = idx % 5 !== 3;
      const { status } = await rest("posts", {
        method: "POST",
        headers,
        body: {
          author_id: session.userId,
          caption: CAPTIONS[idx % CAPTIONS.length],
          media_url: withImage ? `https://picsum.photos/seed/rizz${idx}/800/800` : null,
          media_type: withImage ? "image" : "none",
          created_at: new Date(Date.now() - (hash(persona.email) % (5 * 24 * 3600 * 1000)) * 1000).toISOString(),
        },
      });
      if (status === 201 || status === 200) posterIds.push(session.userId);
      else log(`  ! post by ${persona.username} -> ${status}`);
      return;
    }

    const check = await rest("stories", {
      query: `select=id&limit=1&author_id=eq.${session.userId}&expires_at=gt.${new Date().toISOString()}`,
      headers,
    });
    if (check.status === 200 && Array.isArray(check.json) && check.json.length) {
      storytellerIds.push(session.userId);
      return;
    }
    const idx = persona.index;
    const { status } = await rest("stories", {
      method: "POST",
      headers,
      body: {
        author_id: session.userId,
        media_url: `https://picsum.photos/seed/rizzstory${idx}/720/1280`,
        media_type: "image",
        caption: STORY_CAPTIONS[idx % STORY_CAPTIONS.length],
        created_at: new Date(Date.now() - randInt(1, 11) * 3600 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      },
    });
    if (status === 201 || status === 200) storytellerIds.push(session.userId);
    else log(`  ! story by ${persona.username} -> ${status}`);
  });

  return { posterIds, storytellerIds };
}

async function phaseSocial(from, to) {
  requireEnv();
  const all = personas(TARGET_USERS);

  // Only accounts that really exist can act: read the public profile list and
  // match usernames (the trigger stores them as first_last_index).
  const profileRes = await rest("profiles", { query: "select=username&limit=5000" });
  const usernames = new Set(
    profileRes.status === 200 && Array.isArray(profileRes.json) ? profileRes.json.map((r) => r.username) : [],
  );
  const known = all.filter((p) => usernames.has(p.username));
  log(`social pass: ${known.length} live demo accounts of ${from}..${to} requested`);

  const jimmy = await findJimmy();
  log(`jimmy: @${jimmy.username}`);

  /* 1. content first, so like/comment targets are stable */
  const { posterIds } = await createContent(known);
  log(`demo authors with content: ${posterIds.length} posters`);

  /* 2. read the demo posts + active demo stories back (public read) */
  const postsRes = posterIds.length
    ? await rest("posts", {
        query: `select=id,author_id,comment_count,like_count,created_at&author_id=in.(${posterIds.join(",")})&order=created_at.desc&limit=200`,
      })
    : { status: 200, json: [] };
  const demoPosts = postsRes.status === 200 && Array.isArray(postsRes.json) ? postsRes.json : [];
  const viral = demoPosts.slice(0, 3);
  log(`demo posts: ${demoPosts.length} (viral targets: ${viral.map((p) => p.id.slice(0, 8)).join(", ") || "none"})`);

  const storiesRes = await rest("stories", {
    query: `select=id,author_id,like_count&expires_at=gt.${new Date().toISOString()}&order=created_at.desc&limit=50`,
  });
  const demoStories =
    storiesRes.status === 200 && Array.isArray(storiesRes.json)
      ? storiesRes.json.filter((s) => posterIds.includes(s.author_id) || s.author_id)
      : [];
  const activeSeedStories = demoStories.slice(0, 30);

  /* 3. like assignments: fixed windows over the full persona list, so a re-run
        simply retries the same (post, user) pairs and primary keys dedupe. */
  const postLikeTargets = new Map();
  demoPosts.forEach((post, i) => {
    const target = i < 3 ? VIRAL_LIKES[i] : 40 + (hash(post.id) % 221);
    postLikeTargets.set(post.id, target);
  });
  // Distribute across live accounts only, so every target is actually reachable.
  const actors = known.length ? known : all.slice(0, 1);
  const likesByUser = new Map(); // personaIndex -> post/story ids
  const give = (personaIndex, id) => {
    if (!likesByUser.has(personaIndex)) likesByUser.set(personaIndex, []);
    likesByUser.get(personaIndex).push(id);
  };
  for (const post of demoPosts) {
    const target = postLikeTargets.get(post.id);
    const start = hash(post.id) % actors.length;
    for (let k = 0; k < target; k++) give(actors[(start + k) % actors.length].index, post.id);
  }
  const storyLikeTargets = new Map();
  for (const story of activeSeedStories) {
    const target = STORY_LIKES_MIN + (hash(story.id) % (STORY_LIKES_MAX - STORY_LIKES_MIN + 1));
    storyLikeTargets.set(story.id, target);
    const start = hash(story.id) % actors.length;
    for (let k = 0; k < target; k++) give(actors[(start + k) % actors.length].index, `story:${story.id}`);
  }

  /* 4. comment plan: need-based (post_comments has no unique key), recomputed
        from live comment_count each run so re-runs top up exactly the gap. */
  const commenters = (known.length ? known : all).slice(0, COMMENTERS);
  const commentShares = new Map(); // personaIndex -> [{post_id, author_id, body, created_at}]
  viral.forEach((post, v) => {
    const target = VIRAL_COMMENTS[v] ?? 1000;
    const need = Math.max(0, target - (post.comment_count ?? 0));
    if (!need || !commenters.length) return;
    const per = Math.floor(need / commenters.length);
    const remainder = need - per * commenters.length;
    commenters.forEach((commenter, c) => {
      const share = per + (c < remainder ? 1 : 0);
      if (!share) return;
      const rows = [];
      const base = Date.parse(post.created_at) || Date.now();
      for (let n = 0; n < share; n++) {
        rows.push({
          post_id: post.id,
          body: pick(COMMENT_BODIES),
          created_at: new Date(base + ((c * 97 + n) % 96) * 3600 * 1000 + (hash(post.id + c + n) % 3600) * 1000).toISOString(),
        });
      }
      if (!commentShares.has(commenter.index)) commentShares.set(commenter.index, []);
      commentShares.get(commenter.index).push(...rows);
    });
  });

  /* 5. the main pass: each account signs in and writes only its own rows */
  let followsMade = 0;
  let likeRowsMade = 0;
  let commentRowsMade = 0;
  let profilesMade = 0;
  let loginsFailed = 0;
  let done = 0;

  await pool(known, 8, async (persona) => {
    const session = await login(persona);
    if (!session) {
      loginsFailed++;
      return;
    }
    const headers = authed(session.token);

    // Safety net: the auth trigger should have created the profile already.
    const profile = await rest("profiles", { query: `select=id&limit=1&id=eq.${session.userId}`, headers });
    if (profile.status === 200 && Array.isArray(profile.json) && !profile.json.length) {
      const inserted = await rest("profiles", {
        method: "POST",
        headers,
        body: {
          id: session.userId,
          username: persona.username,
          display_name: persona.displayName,
          avatar_url: persona.avatar,
          bio: persona.bio,
          accent_color: persona.accent,
        },
        prefer: "resolution=ignore-duplicates",
      });
      if (inserted.status < 300) profilesMade++;
    }

    const follow = await rest("follows", {
      method: "POST",
      headers,
      body: { follower_id: session.userId, following_id: jimmy.id },
      prefer: "resolution=ignore-duplicates",
    });
    if (follow.status < 300) followsMade++;
    else if (follow.status !== 409) log(`  ! follow ${persona.username} -> ${follow.status}`);

    const mine = likesByUser.get(persona.index) ?? [];
    const postIds = mine.filter((x) => !x.startsWith("story:"));
    const storyIds = mine.filter((x) => x.startsWith("story:")).map((x) => x.slice(6));
    if (postIds.length) {
      for (const idsChunk of chunk(postIds, 100)) {
        const res = await rest("post_likes", {
          method: "POST",
          headers,
          body: idsChunk.map((postId) => ({ post_id: postId, user_id: session.userId })),
          prefer: "resolution=ignore-duplicates",
        });
        if (res.status < 300) likeRowsMade += idsChunk.length;
      }
    }
    if (storyIds.length) {
      for (const idsChunk of chunk(storyIds, 100)) {
        const res = await rest("story_likes", {
          method: "POST",
          headers,
          body: idsChunk.map((storyId) => ({ story_id: storyId, user_id: session.userId })),
          prefer: "resolution=ignore-duplicates",
        });
        if (res.status < 300) likeRowsMade += idsChunk.length;
      }
    }

    const myComments = (commentShares.get(persona.index) ?? []).map((row) => ({ ...row, author_id: session.userId }));
    if (myComments.length) {
      const res = await rest("post_comments", { method: "POST", headers, body: myComments });
      if (res.status < 300) commentRowsMade += myComments.length;
      else log(`  ! comments by ${persona.username} -> ${res.status} ${JSON.stringify(res.json).slice(0, 160)}`);
    }

    done++;
    if (done % 25 === 0) log(`  ${done}/${known.length} accounts done (follows +${followsMade})`);
  });

  const followerTotal = await headCount("follows", `following_id=eq.${jimmy.id}`);
  log(
    `social: +${followsMade} follows (total for @${jimmy.username}: ${followerTotal ?? "?"}), ` +
      `+${likeRowsMade} like rows, +${commentRowsMade} comments, +${profilesMade} profiles, ${loginsFailed} login failures`,
  );
}

async function phaseChat() {
  requireEnv();
  // Pick the first persona that actually has an account to own the stories.
  let owner = null;
  let session = null;
  for (const candidate of personas(40)) {
    session = await login(candidate);
    if (session) {
      owner = candidate;
      break;
    }
  }
  if (!session || !owner) throw new Error("Couldn't sign in as any demo account for chat stories");
  const headers = authed(session.token);

  const existingRes = await rest("chat_stories", { query: `select=id,slug&slug=like.seed-*&limit=100` });
  const existing = new Map(
    existingRes.status === 200 && Array.isArray(existingRes.json)
      ? existingRes.json.map((row) => [row.slug, row.id])
      : [],
  );

  let made = 0;
  for (const story of CHAT_STORIES) {
    if (existing.has(story.slug)) continue;
    const lineCount = story.lines.length;
    const wordCount = story.lines.reduce((sum, [, body]) => sum + body.split(/\s+/).length, 0);
    const inserted = await rest("chat_stories", {
      method: "POST",
      headers,
      prefer: "return=representation",
      body: {
        slug: story.slug,
        title: story.title,
        hook: story.hook,
        emoji: story.emoji,
        category: story.category,
        gradient: story.gradient,
        them_name: story.them,
        me_name: "You",
        likes_count: story.likes,
        plays_count: story.plays,
        word_count: wordCount,
        is_branching: story.choices.length > 0,
        created_by: session.userId,
        created_at: new Date(Date.now() - (hash(story.slug) % 72) * 3600 * 1000).toISOString(),
      },
    });
    const row = Array.isArray(inserted.json) ? inserted.json[0] : null;
    if (inserted.status >= 300 || !row?.id) {
      log(`  ! chat story ${story.slug} -> ${inserted.status} ${JSON.stringify(inserted.json).slice(0, 200)}`);
      continue;
    }
    const lineRows = story.lines.map(([speaker, body], idx) => ({
      story_id: row.id,
      idx,
      speaker,
      body,
      body_en: body,
      next_idx: idx + 1 < lineCount ? idx + 1 : null,
      chapter: null,
    }));
    if (story.choices.length) lineRows[lineRows.length - 1].next_idx = null;
    lineRows.push({
      story_id: row.id,
      idx: lineCount,
      speaker: story.end[0],
      body: story.end[1],
      body_en: story.end[1],
      next_idx: null,
      chapter: null,
    });
    const linesRes = await rest("chat_story_lines", { method: "POST", headers, body: lineRows });
    if (linesRes.status >= 300) log(`  ! lines ${story.slug} -> ${linesRes.status} ${JSON.stringify(linesRes.json).slice(0, 200)}`);

    const choiceRows = story.choices.map((choice, position) => ({
      story_id: row.id,
      at_idx: choice.at,
      position,
      label: choice.label,
      label_en: choice.label,
      reply_body: choice.reply,
      reply_body_en: choice.reply,
      goto_idx: choice.goto,
    }));
    if (choiceRows.length) {
      const choicesRes = await rest("chat_story_choices", { method: "POST", headers, body: choiceRows });
      if (choicesRes.status >= 300) log(`  ! choices ${story.slug} -> ${choicesRes.status}`);
    }
    made++;
  }
  const totalRes = await rest("chat_stories", { query: `select=id&slug=like.seed-*&limit=100` });
  const total = totalRes.status === 200 && Array.isArray(totalRes.json) ? totalRes.json.length : "?";
  log(`chat stories: +${made} uploaded (${total} seeded total), owned by @${owner.username}`);
}

async function phaseStatus() {
  requireEnv();
  const jimmy = await findJimmy();
  const profiles = await headCount("profiles", "select=id");
  const followers = await headCount("follows", `following_id=eq.${jimmy.id}`);
  const postsRes = await rest("posts", {
    query: `select=id,comment_count,like_count,created_at&order=created_at.desc&limit=100`,
  });
  const posts = postsRes.status === 200 && Array.isArray(postsRes.json) ? postsRes.json : [];
  const threads = posts.filter((p) => p.comment_count >= 400);
  const likesTop = posts.slice().sort((a, b) => b.like_count - a.like_count).slice(0, 5);
  const activeStories = await rest("stories", {
    query: `select=id,like_count&expires_at=gt.${new Date().toISOString()}&limit=50`,
  });
  const stories = activeStories.status === 200 && Array.isArray(activeStories.json) ? activeStories.json : [];
  const chatRes = await rest("chat_stories", { query: `select=id,likes_count&slug=like.seed-*&limit=100` });
  const chatStories = chatRes.status === 200 && Array.isArray(chatRes.json) ? chatRes.json : [];

  log("──────────────────────────────────────────────");
  log(`profiles in database:      ${profiles ?? "?"}`);
  log(`@${jimmy.username} followers:        ${followers ?? "?"}`);
  log(`recent posts scanned:      ${posts.length}`);
  log(`viral threads (>=400):     ${threads.map((p) => `${p.comment_count} comments`).join(", ") || "none yet"}`);
  log(`top like counts:           ${likesTop.map((p) => p.like_count).join(", ") || "-"}`);
  log(`active stories:            ${stories.length} (likes: ${stories.slice(0, 10).map((s) => s.like_count).join(", ") || "-"})`);
  log(`seeded chat stories:       ${chatStories.length} (likes: ${chatStories.map((c) => c.likes_count).join(", ") || "-"})`);
  log("──────────────────────────────────────────────");
}

/* ------------------------------------------------------------------ main */

const phase = process.argv[2] ?? "all";
const arg1 = Number(process.argv[3]);
const arg2 = Number(process.argv[4]);
const n = (fallback) => (Number.isFinite(arg1) && arg1 > 0 ? arg1 : fallback);

try {
  if (phase === "users") await phaseUsers(n(TARGET_USERS));
  else if (phase === "social") await phaseSocial(Number.isFinite(arg1) ? arg1 : 0, Number.isFinite(arg2) && arg2 > 0 ? arg2 : TARGET_USERS);
  else if (phase === "chat") await phaseChat();
  else if (phase === "status") await phaseStatus();
  else if (phase === "all") {
    await phaseUsers(n(TARGET_USERS));
    await phaseSocial(0, TARGET_USERS);
    await phaseChat();
    await phaseStatus();
  } else {
    console.error(`Unknown phase "${phase}". Use: users | social | chat | status | all`);
    process.exit(2);
  }
} catch (error) {
  console.error("SEED FAILED:", error.message ?? error);
  process.exit(1);
}
