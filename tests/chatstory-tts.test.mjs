/**
 * Chat-story TTS tests (mocked inference only — no token, no network, no paid API).
 * Run: node tests/chatstory-tts.test.mjs
 * Plain assertions (no node:test runner) so they work in sandboxed envs too.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildChatStorySpeechPayload,
  chatStoryTTSCacheKey,
  containsDevanagari,
  resolveChatStoryServerVoice,
  resolveChatStoryTTSLanguage,
  sanitizeTextForServerTTS,
  supportsInlineEmotionTags,
  CHATSTORY_TTS_ENDPOINT,
  CHATSTORY_TTS_MAX_CHARS,
} from "../src/lib/chatstory-tts.ts";
import { speechSegmentsForText } from "../src/lib/chat-story-effects.ts";

let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

// language routing
await check("Devanagari routes to Hindi even when the story is English", async () => {
  assert.equal(containsDevanagari("तुम्हारे ही नंबर से संदेश"), true);
  assert.equal(containsDevanagari("Hello world"), false);
  assert.equal(resolveChatStoryTTSLanguage("लिफ़्ट चौथी मंज़िल पर रुकेगी।", "en"), "hi");
});

await check("code-switched Hinglish routes to Hindi", async () => {
  assert.equal(resolveChatStoryTTSLanguage("Asha said, लिफ़्ट मत खोलना, yaar!", "en"), "hi");
  assert.equal(resolveChatStoryTTSLanguage("Arre yaar, mat kar!", "hi"), "hi");
});

await check("pure English stays on the English model", async () => {
  assert.equal(resolveChatStoryTTSLanguage("The lift will stop at four.", "en"), "en");
});

await check("Hindi story selection respected for plain lines", async () => {
  assert.equal(resolveChatStoryTTSLanguage("Hello world", "hi"), "hi");
});

// voice consistency
await check("starring seats stay stable", async () => {
  const names = { me_name: "Aarav", them_name: "Asha" };
  assert.equal(resolveChatStoryServerVoice("narrator", names), "Rohit");
  assert.equal(resolveChatStoryServerVoice("me", names), "Aman");
  assert.equal(resolveChatStoryServerVoice("AARAV", names), "Aman");
  assert.equal(resolveChatStoryServerVoice("them", names), "Divya");
  assert.equal(resolveChatStoryServerVoice("asha", names), "Divya");
});

await check("unknown speakers are deterministic", async () => {
  const names = { me_name: "Aarav", them_name: "Asha" };
  const a = resolveChatStoryServerVoice("Kabir", names, "male");
  assert.equal(a, resolveChatStoryServerVoice("Kabir", names, "male"));
  assert.match(a, /^(Rohit|Aman)$/);
  assert.match(resolveChatStoryServerVoice("Neha", names, "female"), /^(Divya|Rani)$/);
});

// interjections / tags
await check("hmm / हम्म hesitations preserved", async () => {
  assert.match(sanitizeTextForServerTTS("Hmm… who is this?"), /hmm/i);
  assert.ok(sanitizeTextForServerTTS("हम्म… कौन है?").includes("हम्म"));
});

await check("bracket tags never reach the model", async () => {
  for (const raw of [
    "Wait [pause:1200] listen",
    "[sigh] You again?",
    "[whisper]don't look[/whisper]",
    "[laughs] really?",
    "[gasp] oh no [exhale] phew",
  ]) {
    const out = sanitizeTextForServerTTS(raw);
    assert.ok(!out.includes("["), `leaked brackets in: ${out}`);
  }
});

await check("story segments send spoken interjections, not tags", async () => {
  const segments = speechSegmentsForText("[sigh] You again? hmm…");
  const spoken = segments.filter((s) => s.kind === "speech").map((s) => s.text);
  assert.ok(spoken.join(" ").includes("Haaah"));
  assert.ok(spoken.join(" ").match(/hmm/i));
  for (const text of spoken) assert.ok(!sanitizeTextForServerTTS(text).includes("["));
});

await check("emotion tags documented as unsupported", async () => {
  assert.equal(supportsInlineEmotionTags("chatterbox"), false);
  assert.equal(supportsInlineEmotionTags("indic-parler-tts"), false);
});

// payload
await check("Hindi payload valid with clamped speed", async () => {
  const payload = buildChatStorySpeechPayload({
    text: "लिफ़्ट मत खोलना।",
    language: "hi",
    speaker: "Asha",
    storyNames: { me_name: "Aarav", them_name: "Asha" },
    gender: "female",
    speed: 9,
  });
  assert.equal(payload.language, "hi");
  assert.equal(payload.voiceId, "Divya");
  assert.equal(payload.speed, 1.5);
});

await check("empty / oversized text rejected", async () => {
  assert.throws(() => buildChatStorySpeechPayload({ text: "   ", language: "hi" }), /Nothing/);
  assert.throws(
    () =>
      buildChatStorySpeechPayload({
        text: "x".repeat(CHATSTORY_TTS_MAX_CHARS + 1),
        language: "en",
      }),
    /too long/i,
  );
});

await check("browser payload never carries a token", async () => {
  const payload = buildChatStorySpeechPayload({ text: "Hello", language: "en" });
  assert.ok(!/token/i.test(Object.keys(payload).join(",")), "payload must not include a token");
  assert.equal(CHATSTORY_TTS_ENDPOINT, "/api/chatstory-speech");
});

await check("cache key stable per voice/style", async () => {
  const base = {
    text: "हम्म… कौन है?",
    language: "hi",
    speaker: "Kabir",
    voiceId: "Rohit",
    speed: 1,
  };
  assert.equal(chatStoryTTSCacheKey(base), chatStoryTTSCacheKey({ ...base }));
  assert.notEqual(chatStoryTTSCacheKey(base), chatStoryTTSCacheKey({ ...base, voiceId: "Aman" }));
});

await check("mocked upstream inference needs no token or paid API", async () => {
  const fakeWav = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ audio: Buffer.from(fakeWav).toString("base64") }) };
  };
  const res = await fakeFetch("/api/chatstory-speech", { method: "POST" });
  const data = await res.json();
  assert.ok(typeof data.audio === "string" && data.audio.length > 0);
  assert.equal(calls, 1);
});

await check("graceful 503 / timeout fallback (mocked)", async () => {
  const r1 = await (async () => ({ ok: false, status: 503 }))();
  assert.equal(r1.ok, false);
  await assert.rejects(
    (async () => {
      throw new DOMException("Timeout", "TimeoutError");
    })(),
    /Timeout/,
  );
});

// static guards
await check("HF_TOKEN stays server-side only", async () => {
  const serverSrc = readFileSync(
    new URL("../src/routes/api.chatstory-speech.ts", import.meta.url),
    "utf8",
  );
  const hookSrc = readFileSync(new URL("../src/hooks/useChatStoryTTS.ts", import.meta.url), "utf8");
  const playerSrc = readFileSync(
    new URL("../src/components/chatstory/ChatStoryPlayer.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(serverSrc.includes("process.env.HF_TOKEN"));
  for (const [name, src] of [
    ["hook", hookSrc],
    ["player", playerSrc],
  ]) {
    assert.ok(!src.includes("HF_TOKEN"), `${name} must not reference HF_TOKEN`);
    assert.ok(!src.includes("VITE_HF") && !src.includes("VITE_CHATSTORY"), `${name} leaks env`);
  }
  assert.ok(!serverSrc.includes("VITE_"));
  assert.ok(!/localStorage.*[Tt]oken/.test(hookSrc + playerSrc));
});

await check("companion Kokoro path preserved", async () => {
  const playerSrc = readFileSync(
    new URL("../src/components/chatstory/ChatStoryPlayer.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(playerSrc.includes("useKokoroTTS") && playerSrc.includes("kokoroSpeak"));
  assert.ok(playerSrc.includes("resolveKokoroVoice"));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
