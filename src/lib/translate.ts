import { loadPrefs } from "./prefs";

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  hi: "हिन्दी",
  pt: "Português",
};

const translationCache = new Map<string, string>();

/** Common social post phrases and word substitutions for offline/fallback translation */
const DICTIONARY: Record<string, Record<string, string>> = {
  es: {
    hello: "hola",
    hi: "hola",
    hey: "hola",
    welcome: "bienvenido",
    "good morning": "buenos días",
    "good afternoon": "buenas tardes",
    "good night": "buenas noches",
    vibe: "vibra",
    vibes: "vibras",
    server: "servidor",
    community: "comunidad",
    friend: "amigo",
    friends: "amigos",
    realm: "reino",
    realms: "reinos",
    drop: "lanzamiento",
    drops: "lanzamientos",
    badge: "insignia",
    badges: "insignias",
    post: "publicación",
    posts: "publicaciones",
    comment: "comentario",
    comments: "comentarios",
    like: "me gusta",
    share: "compartir",
    creator: "creador",
    creators: "creadores",
    check: "mira",
    "check this out": "mira esto",
    awesome: "increíble",
    fire: "fuego",
    cool: "genial",
    love: "amor",
    happy: "feliz",
    today: "hoy",
    now: "ahora",
    new: "nuevo",
    best: "mejor",
    ready: "listo",
    "let's go": "vamos",
    "what do you think": "¿qué opinas?",
    poll: "encuesta",
  },
  fr: {
    hello: "bonjour",
    hi: "salut",
    hey: "salut",
    welcome: "bienvenue",
    "good morning": "bonjour",
    "good afternoon": "bon après-midi",
    "good night": "bonne nuit",
    vibe: "ambiance",
    vibes: "bonnes ondes",
    server: "serveur",
    community: "communauté",
    friend: "ami",
    friends: "amis",
    realm: "royaume",
    realms: "royaumes",
    drop: "sortie",
    drops: "sorties",
    badge: "badge",
    badges: "badges",
    post: "publication",
    posts: "publications",
    comment: "commentaire",
    comments: "commentaires",
    like: "j'aime",
    share: "partager",
    creator: "créateur",
    creators: "créateurs",
    check: "regarde",
    "check this out": "regardez ça",
    awesome: "génial",
    fire: "le feu",
    cool: "super",
    love: "amour",
    happy: "heureux",
    today: "aujourd'hui",
    now: "maintenant",
    new: "nouveau",
    best: "meilleur",
    ready: "prêt",
    "let's go": "c'est parti",
    "what do you think": "qu'en pensez-vous ?",
    poll: "sondage",
  },
  de: {
    hello: "hallo",
    hi: "hallo",
    hey: "hey",
    welcome: "willkommen",
    "good morning": "guten morgen",
    "good afternoon": "guten tag",
    "good night": "gute nacht",
    vibe: "vibe",
    vibes: "stimmung",
    server: "server",
    community: "community",
    friend: "freund",
    friends: "freunde",
    realm: "reich",
    realms: "reiche",
    drop: "drop",
    drops: "drops",
    badge: "abzeichen",
    badges: "abzeichen",
    post: "beitrag",
    posts: "beiträge",
    comment: "kommentar",
    comments: "kommentare",
    like: "gefällt mir",
    share: "teilen",
    creator: "creator",
    creators: "creators",
    check: "schau",
    "check this out": "schau dir das an",
    awesome: "großartig",
    fire: "feuer",
    cool: "cool",
    love: "liebe",
    happy: "glücklich",
    today: "heute",
    now: "jetzt",
    new: "neu",
    best: "bester",
    ready: "bereit",
    "let's go": "los geht's",
    "what do you think": "was denkst du?",
    poll: "umfrage",
  },
  ja: {
    hello: "こんにちは",
    hi: "やあ",
    hey: "ねえ",
    welcome: "ようこそ",
    "good morning": "おはようございます",
    "good afternoon": "こんにちは",
    "good night": "おやすみなさい",
    vibe: "バイブス",
    vibes: "雰囲気",
    server: "サーバー",
    community: "コミュニティ",
    friend: "友達",
    friends: "友達",
    realm: "レルム",
    realms: "レルム",
    drop: "ドロップ",
    drops: "ドロップ",
    badge: "バッジ",
    badges: "バッジ",
    post: "投稿",
    posts: "投稿",
    comment: "コメント",
    comments: "コメント",
    like: "いいね",
    share: "シェア",
    creator: "クリエイター",
    creators: "クリエイター",
    check: "チェック",
    "check this out": "これをチェック",
    awesome: "最高",
    fire: "アツい",
    cool: "かっこいい",
    love: "大好き",
    happy: "嬉しい",
    today: "今日",
    now: "今",
    new: "最新",
    best: "一番",
    ready: "準備完了",
    "let's go": "行こう",
    "what do you think": "どう思う？",
    poll: "アンケート",
  },
  hi: {
    hello: "नमस्ते",
    hi: "नमस्ते",
    hey: "अरे",
    welcome: "स्वागत है",
    "good morning": "शुभ प्रभात",
    "good afternoon": "शुभ दोपहर",
    "good night": "शुभ रात्रि",
    vibe: "वाइब",
    vibes: "माहौल",
    server: "सर्वर",
    community: "समुदाय",
    friend: "दोस्त",
    friends: "दोस्त",
    realm: "रेल्म",
    realms: "रेल्म्स",
    drop: "ड्रॉप",
    drops: "ड्रॉप्स",
    badge: "बैज",
    badges: "बैज",
    post: "पोस्ट",
    posts: "पोस्ट्स",
    comment: "टिप्पणी",
    comments: "टिप्पणियाँ",
    like: "पसंद",
    share: "साझा करें",
    creator: "निर्माता",
    creators: "रचनाकार",
    check: "देखें",
    "check this out": "इसे देखें",
    awesome: "शानदार",
    fire: "आग",
    cool: "बढ़िया",
    love: "प्यार",
    happy: "खुश",
    today: "आज",
    now: "अब",
    new: "नया",
    best: "सर्वश्रेष्ठ",
    ready: "तैयार",
    "let's go": "चलो शुरू करें",
    "what do you think": "आप क्या सोचते हैं?",
    poll: "पोल",
  },
  pt: {
    hello: "olá",
    hi: "oi",
    hey: "ei",
    welcome: "bem-vindo",
    "good morning": "bom dia",
    "good afternoon": "boa tarde",
    "good night": "boa noite",
    vibe: "vibe",
    vibes: "vibrações",
    server: "servidor",
    community: "comunidade",
    friend: "amigo",
    friends: "amigos",
    realm: "reino",
    realms: "reinos",
    drop: "lançamento",
    drops: "lançamentos",
    badge: "emblema",
    badges: "emblemas",
    post: "post",
    posts: "posts",
    comment: "comentário",
    comments: "comentários",
    like: "curtir",
    share: "compartilhar",
    creator: "criador",
    creators: "criadores",
    check: "olha",
    "check this out": "olha só isso",
    awesome: "incrível",
    fire: "fogo",
    cool: "legal",
    love: "amor",
    happy: "feliz",
    today: "hoje",
    now: "agora",
    new: "novo",
    best: "melhor",
    ready: "pronto",
    "let's go": "vamos lá",
    "what do you think": "o que você acha?",
    poll: "enquete",
  },
};

function fallbackTranslate(text: string, targetLang: string): string {
  const dict = DICTIONARY[targetLang];
  if (!dict) return text;

  let translated = text;
  // Sort keys by length descending to match phrases before individual words
  const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

  for (const phrase of sortedKeys) {
    const regex = new RegExp(`\\b${phrase}\\b`, "gi");
    translated = translated.replace(regex, (match) => {
      const replacement = dict[phrase];
      // Preserve first character capitalization
      if (match[0] === match[0].toUpperCase() && replacement.length > 0) {
        return replacement[0].toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }

  return translated;
}

export async function translateText(text: string, targetLang?: string): Promise<string> {
  const lang = targetLang || loadPrefs().language || "en";
  if (!text || !text.trim()) return text;

  const cacheKey = `${lang}:${text}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  // Attempt client-side translation via public endpoint with fallback
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data?.responseData?.translatedText && typeof data.responseData.translatedText === "string") {
        const result = data.responseData.translatedText;
        translationCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Ignore network error and proceed to fallback
  }

  // Fallback to phrase and keyword translation
  const fallback = fallbackTranslate(text, lang);
  translationCache.set(cacheKey, fallback);
  return fallback;
}
