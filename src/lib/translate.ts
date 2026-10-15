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

/** Bidirectional dictionary for offline/fallback translation across all supported languages */
const MULTI_DICTIONARY: Record<string, Record<string, string>> = {
  // English base
  hello: { en: "hello", es: "hola", fr: "bonjour", de: "hallo", ja: "こんにちは", hi: "नमस्ते", pt: "olá" },
  hi: { en: "hi", es: "hola", fr: "salut", de: "hallo", ja: "やあ", hi: "नमस्ते", pt: "oi" },
  hey: { en: "hey", es: "hola", fr: "salut", de: "hey", ja: "ねえ", hi: "अरे", pt: "ei" },
  welcome: { en: "welcome", es: "bienvenido", fr: "bienvenue", de: "willkommen", ja: "ようこそ", hi: "स्वागत है", pt: "bem-vindo" },
  "good morning": { en: "good morning", es: "buenos días", fr: "bonjour", de: "guten morgen", ja: "おはようございます", hi: "शुभ प्रभात", pt: "bom dia" },
  "good afternoon": { en: "good afternoon", es: "buenas tardes", fr: "bon après-midi", de: "guten tag", ja: "こんにちは", hi: "शुभ दोपहर", pt: "boa tarde" },
  "good night": { en: "good night", es: "buenas noches", fr: "bonne nuit", de: "gute nacht", ja: "おやすみなさい", hi: "शुभ रात्रि", pt: "boa noite" },
  vibe: { en: "vibe", es: "vibra", fr: "ambiance", de: "vibe", ja: "バイブス", hi: "वाइब", pt: "vibe" },
  vibes: { en: "vibes", es: "vibras", fr: "bonnes ondes", de: "stimmung", ja: "雰囲気", hi: "माहौल", pt: "vibrações" },
  server: { en: "server", es: "servidor", fr: "serveur", de: "server", ja: "サーバー", hi: "सर्वर", pt: "servidor" },
  community: { en: "community", es: "comunidad", fr: "communauté", de: "community", ja: "コミュニティ", hi: "समुदाय", pt: "comunidade" },
  friend: { en: "friend", es: "amigo", fr: "ami", de: "freund", ja: "友達", hi: "दोस्त", pt: "amigo" },
  friends: { en: "friends", es: "amigos", fr: "amis", de: "freunde", ja: "友達", hi: "दोस्त", pt: "amigos" },
  realm: { en: "realm", es: "reino", fr: "royaume", de: "reich", ja: "レルム", hi: "रेल्म", pt: "reino" },
  realms: { en: "realms", es: "reinos", fr: "royaumes", de: "reiche", ja: "レルム", hi: "रेल्म्स", pt: "reinos" },
  drop: { en: "drop", es: "lanzamiento", fr: "sortie", de: "drop", ja: "ドロップ", hi: "ड्रॉप", pt: "lançamento" },
  drops: { en: "drops", es: "lanzamientos", fr: "sorties", de: "drops", ja: "ドロップ", hi: "ड्रॉप्स", pt: "lançamentos" },
  badge: { en: "badge", es: "insignia", fr: "badge", de: "abzeichen", ja: "バッジ", hi: "बैज", pt: "emblema" },
  badges: { en: "badges", es: "insignias", fr: "badges", de: "abzeichen", ja: "バッジ", hi: "बैज", pt: "emblemas" },
  post: { en: "post", es: "publicación", fr: "publication", de: "beitrag", ja: "投稿", hi: "पोस्ट", pt: "post" },
  posts: { en: "posts", es: "publicaciones", fr: "publications", de: "beiträge", ja: "投稿", hi: "पोस्ट्स", pt: "posts" },
  comment: { en: "comment", es: "comentario", fr: "commentaire", de: "kommentar", ja: "コメント", hi: "टिप्पणी", pt: "comentário" },
  comments: { en: "comments", es: "comentarios", fr: "commentaires", de: "kommentare", ja: "コメント", hi: "टिप्पणियाँ", pt: "comentários" },
  like: { en: "like", es: "me gusta", fr: "j'aime", de: "gefällt mir", ja: "いいね", hi: "पसंद", pt: "curtir" },
  share: { en: "share", es: "compartir", fr: "partager", de: "teilen", ja: "シェア", hi: "साझा करें", pt: "compartilhar" },
  creator: { en: "creator", es: "creador", fr: "créateur", de: "creator", ja: "クリエイター", hi: "निर्माता", pt: "criador" },
  creators: { en: "creators", es: "creadores", fr: "créateurs", de: "creators", ja: "クリエイター", hi: "रचनाकार", pt: "criadores" },
  check: { en: "check", es: "mira", fr: "regarde", de: "schau", ja: "チェック", hi: "देखें", pt: "olha" },
  "check this out": { en: "check this out", es: "mira esto", fr: "regardez ça", de: "schau dir das an", ja: "これをチェック", hi: "इसे देखें", pt: "olha só isso" },
  awesome: { en: "awesome", es: "increíble", fr: "génial", de: "großartig", ja: "最高", hi: "शानदार", pt: "incrível" },
  fire: { en: "fire", es: "fuego", fr: "le feu", de: "feuer", ja: "アツい", hi: "आग", pt: "fogo" },
  cool: { en: "cool", es: "genial", fr: "super", de: "cool", ja: "かっこいい", hi: "बढ़िया", pt: "legal" },
  love: { en: "love", es: "amor", fr: "amour", de: "liebe", ja: "大好き", hi: "प्यार", pt: "amor" },
  happy: { en: "happy", es: "feliz", fr: "heureux", de: "glücklich", ja: "嬉しい", hi: "खुश", pt: "feliz" },
  today: { en: "today", es: "hoy", fr: "aujourd'hui", de: "heute", ja: "今日", hi: "आज", pt: "hoje" },
  now: { en: "now", es: "ahora", fr: "maintenant", de: "jetzt", ja: "今", hi: "अब", pt: "agora" },
  new: { en: "new", es: "nuevo", fr: "nouveau", de: "neu", ja: "最新", hi: "नया", pt: "novo" },
  best: { en: "best", es: "mejor", fr: "meilleur", de: "bester", ja: "一番", hi: "सर्वश्रेष्ठ", pt: "melhor" },
  ready: { en: "ready", es: "listo", fr: "prêt", de: "bereit", ja: "準備完了", hi: "तैयार", pt: "pronto" },
  "let's go": { en: "let's go", es: "vamos", fr: "c'est parti", de: "los geht's", ja: "行こう", hi: "चलो शुरू करें", pt: "vamos lá" },
  "what do you think": { en: "what do you think", es: "¿qué opinas?", fr: "qu'en pensez-vous ?", de: "was denkst du?", ja: "どう思う？", hi: "आप क्या सोचते हैं?", pt: "o que você acha?" },
  poll: { en: "poll", es: "encuesta", fr: "sondage", de: "umfrage", ja: "アンケート", hi: "पोल", pt: "enquete" },
  thanks: { en: "thanks", es: "gracias", fr: "merci", de: "danke", ja: "ありがとう", hi: "धन्यवाद", pt: "obrigado" },
  "thank you": { en: "thank you", es: "muchas gracias", fr: "merci beaucoup", de: "vielen dank", ja: "ありがとうございます", hi: "बहुत धन्यवाद", pt: "muito obrigado" },
};

export function detectSourceLang(text: string): string {
  // Check Devanagari script (Hindi)
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  // Check Japanese characters (Hiragana / Katakana / Kanji)
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return "ja";

  const lower = text.toLowerCase();
  // Check Portuguese distinct vocabulary & accents
  if (/\b(você|está|não|obrigad[oa]|muito|fazer|também|comigo|tarde|noite|beleza|galera)\b/.test(lower) || /[ãõç]/.test(lower)) {
    return "pt";
  }
  // Check Spanish distinct vocabulary
  if (/\b(hola|gracias|buenos|días|tardes|amigo|para|pero|estoy|hacer|todos)\b/.test(lower) || /[¿¡ñ]/.test(lower)) {
    return "es";
  }
  // Check French distinct vocabulary
  if (/\b(bonjour|salut|merci|très|avec|pour|bienvenue|soir|monde)\b/.test(lower) || /[œæçèéêëàâùûîï]/.test(lower)) {
    return "fr";
  }
  // Check German distinct vocabulary
  if (/\b(hallo|danke|bitte|guten|morgen|nicht|sehr|freund|wie|alles)\b/.test(lower) || /[äöüß]/.test(lower)) {
    return "de";
  }

  return "en";
}

function fallbackTranslate(text: string, targetLang: string): string {
  let translated = text;

  // Build list of all source words across all languages pointing to targetLang
  const lookup: { source: string; target: string }[] = [];
  for (const [, langMap] of Object.entries(MULTI_DICTIONARY)) {
    const targetWord = langMap[targetLang];
    if (!targetWord) continue;

    for (const [sLang, sWord] of Object.entries(langMap)) {
      if (sLang === targetLang) continue;
      lookup.push({ source: sWord, target: targetWord });
    }
  }

  // Sort by length descending so multi-word phrases match first
  lookup.sort((a, b) => b.source.length - a.source.length);

  for (const item of lookup) {
    const escaped = item.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    translated = translated.replace(regex, (match) => {
      if (match[0] === match[0].toUpperCase() && item.target.length > 0) {
        return item.target[0].toUpperCase() + item.target.slice(1);
      }
      return item.target;
    });
  }

  return translated;
}

export async function translateText(text: string, targetLang?: string): Promise<string> {
  const lang = targetLang || loadPrefs().language || "en";
  if (!text || !text.trim()) return text;

  const detectedSource = detectSourceLang(text);
  if (detectedSource === lang) {
    // Already in target language
    return text;
  }

  const cacheKey = `${detectedSource}->${lang}:${text}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  // 1. First attempt: Google Translate public API (handles any source -> any target flawlessly)
  try {
    const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(gUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.[0])) {
        const fullTranslation = data[0].map((item: any) => item[0]).join("");
        if (fullTranslation && fullTranslation.trim()) {
          translationCache.set(cacheKey, fullTranslation);
          return fullTranslation;
        }
      }
    }
  } catch {
    // Continue to next provider
  }

  // 2. Second attempt: MyMemory API with autodetect or detected pair
  try {
    const pair = `${detectedSource}|${lang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data?.responseData?.translatedText && typeof data.responseData.translatedText === "string") {
        const result = data.responseData.translatedText;
        if (!result.includes("MYMEMORY WARNING")) {
          translationCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch {
    // Ignore and proceed to fallback
  }

  // 3. Fallback: comprehensive multi-lingual dictionary
  const fallback = fallbackTranslate(text, lang);
  translationCache.set(cacheKey, fallback);
  return fallback;
}
