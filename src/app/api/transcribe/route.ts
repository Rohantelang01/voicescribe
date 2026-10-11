import { NextRequest, NextResponse } from "next/server";
import {
  generateCustomSrt,
  enforceSrtLimits,
  buildCuesFromSegments,
  cuesToSrt,
  parseSrtCues,
} from "@/lib/srt-chunker";

export const maxDuration = 120;

/**
 * Returns the optimal Whisper lead-in context prompt based on mode.
 * New modes: "auto" | "manual" (+ legacy "devanagari" | "roman" | "english").
 * IMPORTANT: In Whisper, the prompt is NOT an instruction, but an autoregressive prefix!
 * Auto mode me khaali/custom prompt hi bhejo taaki decoder confuse na ho.
 */
function getWhisperPrompt(scriptStyle: string, language: string, customPrompt?: string): string {
  if (customPrompt && customPrompt.trim()) {
    return customPrompt.trim();
  }
  // Legacy modes (purane saved requests ke liye backward compatible)
  if (scriptStyle === "devanagari") {
    return "नमस्ते, यह एक हिंदी ऑडियो रिकॉर्डिंग है। इसमें स्पष्ट और शुद्ध हिंदी भाषा में बातचीत हो रही है। कृपया सभी शब्दों को केवल शुद्ध देवनागरी लिपि में ही लिखें।";
  }
  if (scriptStyle === "roman") {
    return "नमस्ते, यह एक हिंदी ऑडियो रिकॉर्डिंग है। इसमें स्पष्ट और शुद्ध हिंदी भाषा में बातचीत हो रही है।";
  }
  if (scriptStyle === "english") {
    return "Educational speech transcription translated into natural, fluent English subtitles.";
  }
  // New: manual mode — language-specific light hint, auto mode — no hint
  if (scriptStyle === "manual" && language && language !== "auto") {
    const names: Record<string, string> = {
      hi: "हिंदी",
      en: "English",
      bn: "বাংলা",
      mr: "मराठी",
    };
    const n = names[language] || language;
    return `This is a ${n} audio recording with clear speech.`;
  }
  return "";
}

/**
 * High-precision transliterator for Indian social media captions (Instagram Reels / YouTube Shorts)
 * Strictly preserves cue numbers, timestamps, and Hindi phonetics without translating meaning.
 */
async function transliterateToRomanHinglish(
  srtText: string,
  groqApiKey?: string,
  geminiApiKey?: string
): Promise<string> {
  if (!srtText || (!groqApiKey && !geminiApiKey)) return srtText;

  const systemPrompt = `You are a specialized Indian subtitle transliterator for viral Instagram Reels and YouTube Shorts.
Your ONLY task: Convert Devanagari Hindi text inside SRT subtitle cues into natural, conversational Roman Hinglish (Latin alphabet), exactly as Hindi speakers type on WhatsApp and social media.

CRITICAL NON-NEGOTIABLE RULES:
1. DO NOT translate the meaning into English words!
   - 'नमस्ते' -> 'Namaste' (NEVER 'Hello')
   - 'दोस्तों' -> 'doston' (NEVER 'friends')
   - 'आज हम बात करेंगे' -> 'Aaj hum baat karenge' (NEVER 'Today we will talk')
   - 'यह बहुत महत्वपूर्ण है' -> 'Yeh bahut mahatvapurna hai' (NEVER 'This is very important')
   - 'शुरू करते हैं' -> 'Shuru karte hain' (NEVER 'Let\\'s begin')
2. If a word is already in English (e.g. 'AI', 'video', 'system', 'tech', 'channel'), KEEP IT in English.
3. Keep all cue numbers and timestamps (00:00:00,000 --> 00:00:00,000) 100% EXACTLY unchanged.
4. Output ONLY valid raw SRT content, with no markdown code blocks (\`\`\`), no preamble, and no conversational explanation.`;

  // 1. Try Groq free-tier text models (Llama is plan me nahi hai)
  if (groqApiKey) {
    const groqModels = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];
    for (const model of groqModels) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqApiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: srtText },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content && content.includes("-->")) {
            return content.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
          }
        }
      } catch (e) {
        console.warn(`[Groq transliteration attempt with ${model} failed]:`, e);
      }
    }
  }

  // 2. Fallback to Gemini if Groq is unavailable or failed
  if (geminiApiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      const res = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${systemPrompt}\n\nHere is the input SRT:\n\n${srtText}` },
              ],
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content && content.includes("-->")) {
          return content.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
        }
      }
    } catch (e) {
      console.warn("[Gemini transliteration fallback failed]:", e);
    }
  }

  return srtText;
}

/**
 * Gemini models jinke paas user ke account me quota hai (RPM/RPD > 0).
 * - gemini-3.5-transcribe: dedicated STT (quota bahut kam: ~1 RPM / 25 RPD).
 *   Ye PLAIN transcript deta hai (SRT nahi) + Files API upload mangta hai.
 * - Flash multimodal models: audio + SRT prompt seedha generateContent par kaam karte hain.
 * Legacy gemini-1.5-flash retired hai → 2.5-flash-lite par map hota hai.
 */
const GEMINI_FLASH_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
]);

function resolveGeminiModel(engine: string): string {
  if (engine === "gemini-3.5-transcribe") return "gemini-3.5-transcribe";
  if (engine === "gemini-1.5-flash") return "gemini-2.5-flash-lite"; // retired → closest quota model
  if (GEMINI_FLASH_MODELS.has(engine)) return engine;
  return "gemini-3.1-flash-lite"; // highest quota (15 RPM / 500 RPD) fallback
}

/**
 * Plain transcript (bina timestamps) ko duration par proportional baant kar SRT banao.
 * durationSec client bhejta hai (audio element metadata); fallback = 128kbps estimate.
 */
function transcriptToSrt(
  transcript: string,
  durationSec: number,
  opts: { maxWordsPerLine: number; minWordsPerLine: number; ignoreDuration: boolean }
): string {
  const clean = (transcript || "").replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
  if (!clean) return "";
  // Agar model ne seedha SRT de diya to wahi use karo
  if (clean.includes("-->")) {
    return enforceSrtLimits(clean, opts);
  }
  const safeDuration = durationSec > 0 && isFinite(durationSec) ? durationSec : 60;
  const cues = buildCuesFromSegments(
    [{ start: 0, end: safeDuration, text: clean.replace(/\n+/g, " ") }],
    { ...opts, targetWordsPerLine: opts.maxWordsPerLine - 1 }
  );
  return cuesToSrt(cues);
}

/**
 * Gemini Files API (resumable) upload — gemini-3.5-transcribe aur badi files ke liye zaroori.
 * Returns { fileUri, mimeType } jo generateContent me fileData ban kar jata hai.
 */
async function uploadToGeminiFilesApi(
  audioBuffer: Buffer,
  mimeType: string,
  apiKey: string,
  displayName: string
): Promise<{ fileUri: string; mimeType: string }> {
  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(audioBuffer.length),
        "X-Goog-Upload-Header-Content-Type": mimeType,
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    }
  );
  if (!startRes.ok) {
    const t = await startRes.text().catch(() => "");
    throw new Error(`Gemini Files API init failed (${startRes.status}): ${t.slice(0, 200)}`);
  }
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini Files API ne upload URL nahi diya");

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
    },
    body: new Uint8Array(audioBuffer),
  });
  if (!uploadRes.ok) {
    const t = await uploadRes.text().catch(() => "");
    throw new Error(`Gemini file upload failed (${uploadRes.status}): ${t.slice(0, 200)}`);
  }
  const fileInfo = await uploadRes.json();
  const name = fileInfo?.file?.name || fileInfo?.name;
  const fileMime = fileInfo?.file?.mimeType || mimeType;
  if (!name) throw new Error("Gemini Files API ne file reference nahi diya");
  return {
    fileUri: `https://generativelanguage.googleapis.com/v1beta/${name}`,
    mimeType: fileMime,
  };
}

/** generateContent response se text nikalo (candidates + interactions shapes dono). */
function extractGeminiText(data: unknown): string {
  const d = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    output_text?: string;
    outputText?: string;
  };
  const fromCandidates = d?.candidates?.[0]?.content?.parts
    ?.map((p) => p?.text || "")
    .join("\n")
    .trim();
  if (fromCandidates) return fromCandidates;
  if (typeof d?.output_text === "string" && d.output_text.trim()) return d.output_text.trim();
  if (typeof d?.outputText === "string" && d.outputText.trim()) return d.outputText.trim();
  return "";
}

/**
 * Urdu-script misdetect fix: Whisper auto-detect me pehle window(s) ko kabhi
 * Urdu (Perso-Arabic) samajh leta hai jabki audio Hindi hai. Sirf unhi lines
 * ko Devanagari me badlo, baaki EXACT same. Timestamps ko haath mat lagao.
 */
async function fixUrduScriptToDevanagari(
  srtText: string,
  groqApiKey: string
): Promise<{ fixed: string; changed: number }> {
  const cues = parseSrtCues(srtText);
  const hitIds = new Set(
    cues.filter((c) => /[\u0600-\u06FF]/.test(c.text)).map((c) => c.id || 0)
  );
  if (!hitIds.size) return { fixed: srtText, changed: 0 };

  const system =
    "You convert Urdu (Perso-Arabic script) subtitle lines into Hindi Devanagari script with the SAME meaning. " +
    "Input/output format is strictly \"ID|text\", same IDs, same order, same line count, no explanation. " +
    "Convert ONLY lines containing Perso-Arabic characters. Lines already in Devanagari or English must be returned EXACTLY unchanged.";

  const outById = new Map<number, string>();
  const models = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];
  for (let i = 0; i < cues.length; i += 40) {
    const batch = cues.slice(i, i + 40);
    if (!batch.some((c) => hitIds.has(c.id || 0))) {
      for (const c of batch) outById.set(c.id || 0, c.text);
      continue;
    }
    const user = batch.map((c) => `${c.id}|${c.text}`).join("\n");
    let out = "";
    for (const m of models) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
          body: JSON.stringify({
            model: m,
            temperature: 0.1,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        out = (data.choices?.[0]?.message?.content || "").trim();
        if (out) break;
      } catch {
        /* next model */
      }
    }
    if (!out) throw new Error("Urdu fix ke liye Groq text model fail");
    for (const line of out.split(/\r?\n/)) {
      const mline = line.match(/^\s*(\d+)\s*[|:>\-]\s*(.+?)\s*$/);
      if (mline) outById.set(parseInt(mline[1], 10), mline[2]);
    }
  }

  let changed = 0;
  const finalCues = cues.map((c) => {
    const t = outById.get(c.id || 0);
    if (t && t !== c.text && !/[\u0600-\u06FF]/.test(t)) changed++;
    return { ...c, text: t && !/[\u0600-\u06FF]/.test(t) ? t : c.text };
  });
  return { fixed: cuesToSrt(finalCues), changed };
}
/** Whisper segments se coverage/gap stats — beech me chhoota speech pakadne ke liye. */function whisperTimingStats(
  whisperData: { segments?: Array<{ start: number; end: number }> },
  totalDuration: number
): { coveragePct: number; largestGapSec: number; largestGapAt: number } {
  const segs = (whisperData?.segments || [])
    .filter((s) => typeof s?.start === "number" && typeof s?.end === "number" && s.end > s.start)
    .sort((a, b) => a.start - b.start);
  const total = totalDuration > 0 ? totalDuration : segs.length ? segs[segs.length - 1].end : 0;
  if (!segs.length || total <= 0) return { coveragePct: 0, largestGapSec: 0, largestGapAt: 0 };
  let covered = 0;
  let curEnd = -1;
  let largestGapSec = 0;
  let largestGapAt = 0;
  for (const s of segs) {
    if (curEnd >= 0 && s.start > curEnd) {
      const gap = s.start - curEnd;
      if (gap > largestGapSec) {
        largestGapSec = gap;
        largestGapAt = curEnd;
      }
    }
    if (s.end > curEnd) {
      covered += s.end - Math.max(s.start, curEnd < 0 ? s.start : curEnd);
      curEnd = s.end;
    }
  }
  return {
    coveragePct: Math.round(Math.min(1, covered / total) * 100),
    largestGapSec: Math.round(largestGapSec * 10) / 10,
    largestGapAt: Math.round(largestGapAt * 10) / 10,
  };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let audioBuffer: Buffer | null = null;
    let groqApiKey = "";
    let geminiApiKey = "";
    let engine = "groq-whisper-turbo"; // groq-whisper-turbo | groq-whisper-v3 | gemini-3.5-transcribe | gemini-2.5-flash | gemini-1.5-flash (legacy)
    let scriptStyle = "auto"; // "auto" | "manual" (+ legacy "devanagari" | "roman" | "english")
    let language = "auto";
    let maxWordsPerLine = 8;
    let minWordsPerLine = 5;
    let targetWordsPerLine = 6;
    let ignoreDuration = true;
    let customPrompt = "";
    let durationSeconds = 0;
    let audioFileName = "audio.mp3";
    let audioMimeType = "audio/mp3";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      groqApiKey = (formData.get("groqApiKey") as string) || "";
      geminiApiKey = (formData.get("geminiApiKey") as string) || "";
      engine = (formData.get("engine") as string) || "groq-whisper-turbo";
      scriptStyle = (formData.get("scriptStyle") as string) || "auto";
      language = (formData.get("language") as string) || "auto";
      customPrompt = (formData.get("prompt") as string) || "";

      if (formData.get("maxWordsPerLine")) {
        maxWordsPerLine = parseInt(formData.get("maxWordsPerLine") as string, 10) || 8;
      }
      if (formData.get("minWordsPerLine")) {
        minWordsPerLine = parseInt(formData.get("minWordsPerLine") as string, 10) || 5;
      }
      if (formData.get("ignoreDuration") !== null) {
        ignoreDuration = formData.get("ignoreDuration") === "true";
      }
      if (formData.get("durationSeconds")) {
        durationSeconds = parseFloat(formData.get("durationSeconds") as string) || 0;
      }

      const file = formData.get("audio") as File | null;
      if (file && file.size > 0) {
        audioBuffer = Buffer.from(await file.arrayBuffer());
        if (file.name) audioFileName = file.name;
        if (file.type) audioMimeType = file.type;
      }
    } else {
      const body = await req.json();
      groqApiKey = body.groqApiKey || "";
      geminiApiKey = body.geminiApiKey || "";
      engine = body.engine || "groq-whisper-turbo";
      scriptStyle = body.scriptStyle || "auto";
      language = body.language || "auto";
      customPrompt = body.prompt || "";
      if (typeof body.maxWordsPerLine === "number") maxWordsPerLine = body.maxWordsPerLine;
      if (typeof body.minWordsPerLine === "number") minWordsPerLine = body.minWordsPerLine;
      if (typeof body.ignoreDuration === "boolean") ignoreDuration = body.ignoreDuration;
      if (typeof body.durationSeconds === "number") durationSeconds = body.durationSeconds;

      if (body.audioDataUrl && typeof body.audioDataUrl === "string") {
        const commaIdx = body.audioDataUrl.indexOf(",");
        const base64 = commaIdx !== -1 ? body.audioDataUrl.substring(commaIdx + 1) : body.audioDataUrl;
        audioBuffer = Buffer.from(base64, "base64");
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json(
        { error: "No valid audio data provided for subtitle generation" },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // EXACT UPLOAD SIZE: Groq/Gemini transcription response me `bytes`
    // wapas nahi aata (billing seconds par hoti hai), isliye client ko
    // bheja gaya exact size yahin se report karte hain. `audioBuffer`
    // wahi bytes hain jo provider ko forward hote hain (multipart ka
    // ~200-300 bytes boundary overhead chhod kar).
    // ─────────────────────────────────────────────────────────────
    const uploadBytes = audioBuffer.length;
    const uploadMB = Math.round((uploadBytes / 1024 / 1024) * 100) / 100;
    const uploadMeta = {
      bytes: uploadBytes,
      mb: uploadMB,
      display: uploadMB >= 1 ? `${uploadMB} MB` : `${Math.round(uploadBytes / 1024)} KB`,
      fileName: audioFileName,
      mimeType: audioMimeType,
    };

    // ─────────────────────────────────────────────────────────────
    // ENGINE OPTION 1: GEMINI
    // (a) gemini-3.5-transcribe = dedicated STT. Files API upload REQUIRED,
    //     output PLAIN transcript hota hai → duration par SRT me baanto.
    // (b) Flash models = multimodal generateContent, seedha SRT output.
    // ─────────────────────────────────────────────────────────────
    if (engine.startsWith("gemini")) {
      const finalGeminiKey = (geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
      if (!finalGeminiKey) {
        return NextResponse.json(
          { error: "Gemini API Key is required. Please enter it in API Settings." },
          { status: 400 }
        );
      }
      const geminiModel = resolveGeminiModel(engine);
      const srtOpts = { maxWordsPerLine, minWordsPerLine, ignoreDuration };

      // ── (a) DEDICATED TRANSCRIBE MODEL ──
      if (geminiModel === "gemini-3.5-transcribe") {
        try {
          // Step 1: Files API upload (inline base64 is model par reliable nahi)
          const { fileUri, mimeType } = await uploadToGeminiFilesApi(
            audioBuffer,
            audioMimeType,
            finalGeminiKey,
            audioFileName
          );

          // Step 2: generateContent + fileData (language hint sirf manual mode me)
          const normLang = (language || "auto").toLowerCase();
          const bodies: Record<string, unknown>[] = [];
          const baseContents = [
            {
              parts: [
                ...(customPrompt.trim()
                  ? [{ text: `Vocabulary hint (names/terms may appear): ${customPrompt.trim()}` }]
                  : []),
                { fileData: { fileUri, mimeType } },
              ],
            },
          ];
          if (normLang && normLang !== "auto" && normLang !== "hinglish") {
            bodies.push({
              contents: baseContents,
              generationConfig: { audioTranscriptionConfig: { languageCodes: [normLang] } },
            });
          }
          bodies.push({ contents: baseContents }); // plain fallback

          let rawTranscript = "";
          let lastErr = "";
          for (const payload of bodies) {
            const tRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-transcribe:generateContent?key=${finalGeminiKey}`,
              { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
            );
            if (!tRes.ok) {
              lastErr = await tRes.text().catch(() => "");
              // 429/quota par dobara try ka fayda nahi — turant bahar
              if (tRes.status === 429) break;
              continue;
            }
            rawTranscript = extractGeminiText(await tRes.json());
            if (rawTranscript) break;
          }
          if (!rawTranscript) {
            return NextResponse.json(
              {
                error: `No transcript returned from Gemini 3.5 Transcribe. Model quota is very constrained (~1 RPM / 25 RPD) — please retry shortly or switch to a Gemini Flash model. ${lastErr.slice(0, 180)}`,
              },
              { status: 502 }
            );
          }

          // Step 3: plain transcript → duration-proportional SRT
          const effDuration =
            durationSeconds > 0 ? durationSeconds : (audioBuffer.length * 8) / 128000;
          let finalSrt = transcriptToSrt(rawTranscript, effDuration, srtOpts);
          const isRoman = scriptStyle === "roman";
          if ((isRoman || (scriptStyle === "manual" && language === "hinglish")) && /[\u0900-\u097F]/.test(finalSrt)) {
            finalSrt = await transliterateToRomanHinglish(finalSrt, groqApiKey, finalGeminiKey);
          }
          return NextResponse.json({
            success: true,
            engine: geminiModel,
            srtContent: finalSrt,
            srtFilename: `gemini-transcribe-${Date.now()}.srt`,
            segmentsCount: (finalSrt.match(/-->/g) || []).length,
            scriptStyle,
            upload: uploadMeta,
            timing: { coveragePct: 100, largestGapSec: 0, largestGapAt: 0, retried: false, estimated: true },
            note: "Plain-transcript model: timestamps distributed proportionally across audio duration.",
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Unknown Gemini error";
          return NextResponse.json(
            { error: `Gemini 3.5 Transcribe failed: ${msg}. Quota is limited — try Gemini Flash.` },
            { status: 502 }
          );
        }
      }

      // ── (b) FLASH MULTIMODAL MODELS (seedha SRT) ──
      const audioBase64 = audioBuffer.toString("base64");
      let generatedSrt = "";

      // Real duration anchor — Gemini timestamps guess karta hai aur lambe audio me
      // dheere-dheere drift karta hai (known bug). Exact kul length dene se drift kam hota hai.
      const effTotalSec =
        durationSeconds > 0 ? durationSeconds : (audioBuffer.length * 8) / 128000;
      const durationAnchor =
        durationSeconds > 0
          ? `TOTAL AUDIO DURATION IS EXACTLY ${effTotalSec.toFixed(1)} SECONDS. First cue must start near 00:00:00,000 and the LAST cue must end near ${effTotalSec.toFixed(1)}s. Distribute all cue timestamps proportionally across this exact duration — do NOT compress or stretch beyond it.`
          : `Estimate timestamps proportionally across the full audio length.`;

      // Legacy devanagari/roman/english supported; new auto/manual simple hai
      const isRoman = scriptStyle === "roman";
      const scriptInstruction =
        scriptStyle === "devanagari"
          ? "CRITICAL REQUIREMENT: Output MUST be 100% pure Hindi in Devanagari script (देवनागरी लिपि, जैसे 'नमस्ते दोस्तों, आज हम बात करेंगे'). DO NOT use English/Latin alphabet for Hindi words."
          : isRoman
          ? "CRITICAL REQUIREMENT: Output MUST be natural conversational Roman Hinglish (Latin alphabet, e.g. 'Namaste doston, aaj hum baat karenge...'). DO NOT translate into English words."
          : scriptStyle === "english"
          ? "CRITICAL REQUIREMENT: Translate the spoken speech into clear, fluent English subtitles in standard SRT format."
          : scriptStyle === "manual" && language && language !== "auto"
          ? `Transcribe the audio speech verbatim in "${language}" language with natural code-switching preserved. Output subtitles in the same spoken language/script.`
          : "Detect the spoken language automatically and transcribe the audio speech verbatim with natural code-switching. Output subtitles in the same spoken language/script.";

      const flashUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${finalGeminiKey}`;
        const flashPayload = {
          contents: [
            {
              parts: [
                {
                  text: `You are an expert audio subtitler and speech recognition model.
Your task: Transcribe the attached audio file into standard SRT subtitle format with accurate timestamps.

${scriptInstruction}

${durationAnchor}

FORMATTING REQUIREMENTS:
1. Standard SRT sequential format:
   1
   00:00:00,000 --> 00:00:02,400
   Subtitle text here

2. Strictly 5 to 8 words per cue for fast-paced viral reading.
3. Synchronize timestamps accurately with speech timing.
4. Output ONLY valid raw SRT content. Do NOT include markdown code fences (\`\`\`), do NOT include conversational greetings or explanations.`,
                },
                {
                  inlineData: {
                    mimeType: audioMimeType,
                    data: audioBase64,
                  },
                },
              ],
            },
          ],
        };

        const flashRes = await fetch(flashUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(flashPayload),
        });

        if (!flashRes.ok) {
          const errData = await flashRes.json().catch(() => ({}));
          const msg: string = errData?.error?.message || `Gemini audio transcription failed (${flashRes.status})`;
          const quotaHint =
            flashRes.status === 429
              ? " Rate/quota limit reached (RPM/RPD) — please wait briefly or try another Flash model."
              : flashRes.status === 404
              ? ` Model '${geminiModel}' is not available for this key/region — try another Flash model.`
              : "";
          return NextResponse.json({ error: `${msg}.${quotaHint}` }, { status: 502 });
        }

        const flashData = await flashRes.json();
        const rawOutput = extractGeminiText(flashData);
        if (!rawOutput) {
          return NextResponse.json({ error: "Gemini did not return any subtitle text from the audio" }, { status: 400 });
        }
        generatedSrt = rawOutput.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();

      // Flash ne SRT ki jagah plain text diya to duration par baant do
      if (!generatedSrt.includes("-->")) {
        const effDuration =
          durationSeconds > 0 ? durationSeconds : (audioBuffer.length * 8) / 128000;
        generatedSrt = transcriptToSrt(generatedSrt, effDuration, {
          maxWordsPerLine,
          minWordsPerLine,
          ignoreDuration,
        });
      }
      let finalSrt = enforceSrtLimits(generatedSrt, {
        maxWordsPerLine,
        minWordsPerLine,
        ignoreDuration,
      });

      // ONLY transliterate if Roman script was explicitly requested AND text still has Devanagari
      if (
        (scriptStyle === "roman" || (scriptStyle === "manual" && language === "hinglish")) &&
        /[\u0900-\u097F]/.test(finalSrt)
      ) {
        finalSrt = await transliterateToRomanHinglish(finalSrt, groqApiKey, finalGeminiKey);
      }

      const finalSegmentsCount = (finalSrt.match(/-->/g) || []).length;
      return NextResponse.json({
        success: true,
        engine: geminiModel,
        srtContent: finalSrt,
        srtFilename: `gemini-subtitles-${Date.now()}.srt`,
        segmentsCount: finalSegmentsCount,
        scriptStyle,
        upload: uploadMeta,
        timing: { coveragePct: 100, largestGapSec: 0, largestGapAt: 0, retried: false, estimated: true },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ENGINE OPTION 2: GROQ WHISPER (TURBO OR V3)
    // ─────────────────────────────────────────────────────────────
    const finalGroqKey = (groqApiKey || process.env.GROQ_API_KEY || "").trim();
    if (!finalGroqKey) {
      return NextResponse.json(
        { error: "Groq API Key is not configured. Please enter your Groq API key in Settings." },
        { status: 400 }
      );
    }

    const whisperModel = engine === "groq-whisper-v3" ? "whisper-large-v3" : "whisper-large-v3-turbo";
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" });

    let finalSrt = "";

    let groqTiming:
      | { coveragePct: number; largestGapSec: number; largestGapAt: number; retried: boolean }
      | undefined;

    // CASE A: User requested English translation of foreign/Hindi speech
    if (scriptStyle === "english" && language !== "en") {
      const transFormData = new FormData();
      transFormData.append("file", audioBlob, "audio.mp3");
      transFormData.append("model", "whisper-large-v3");
      transFormData.append("response_format", "verbose_json");
      transFormData.append("temperature", "0");
      const enPrompt = customPrompt || "Educational speech translated into clear, fluent English subtitles.";
      transFormData.append("prompt", enPrompt);

      const transRes = await fetch("https://api.groq.com/openai/v1/audio/translations", {
        method: "POST",
        headers: { Authorization: `Bearer ${finalGroqKey}` },
        body: transFormData,
      });

      if (!transRes.ok) {
        const errJson = await transRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: errJson?.error?.message || `Groq Whisper translation failed (${transRes.status})` },
          { status: 502 }
        );
      }

      const transData = await transRes.json();
      finalSrt = generateCustomSrt(transData, {
        maxWordsPerLine,
        minWordsPerLine,
        targetWordsPerLine,
        ignoreDuration,
      });
    } else {
      // CASE B: Auto-detect ya Manual transcription
      // Whisper 30s internal chunks me chalti hai — beech ke chunks kabhi skip ho jate
      // hain (known model bug, temperature=0 par zyada). Isliye gap detect karke
      // 1 baar temperature fallback (0.4) se retry, behtar coverage wali run rakho.
      const normLang = (language || "auto").toLowerCase();
      const promptText = getWhisperPrompt(scriptStyle, normLang, customPrompt);

      const callWhisper = async (temperature: string) => {
        const fd = new FormData();
        fd.append("file", audioBlob, "audio.mp3");
        fd.append("model", whisperModel);
        fd.append("response_format", "verbose_json");
        fd.append("temperature", temperature);
        // Auto mode: language param MAT bhejo — Whisper khud 99+ languages me se detect karega.
        // Manual mode: selected language bhejo. Legacy devanagari/roman: hi force.
        if (normLang && normLang !== "auto") {
          fd.append("language", normLang);
        } else if (scriptStyle === "devanagari" || scriptStyle === "roman") {
          fd.append("language", "hi");
        }
        fd.append("timestamp_granularities[]", "word");
        fd.append("timestamp_granularities[]", "segment");
        if (promptText) fd.append("prompt", promptText);
        const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${finalGroqKey}` },
          body: fd,
        });
        if (!r.ok) {
          const errJson = await r.json().catch(() => ({}));
          throw new Error(errJson?.error?.message || `Groq Whisper failed (${r.status})`);
        }
        return r.json();
      };

      let whisperData: {
        text?: string;
        segments?: Array<{ id?: number; start: number; end: number; text: string }>;
        words?: Array<{ word: string; start: number; end: number }>;
      };
      try {
        whisperData = await callWhisper("0");
      } catch (e: unknown) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Groq Whisper failed" },
          { status: 502 }
        );
      }
      const hasSegments =
        whisperData.segments && Array.isArray(whisperData.segments) && whisperData.segments.length > 0;
      const hasWords =
        whisperData.words && Array.isArray(whisperData.words) && whisperData.words.length > 0;

      if (!hasSegments && !hasWords) {
        return NextResponse.json({ error: "Whisper did not detect any speech in the audio" }, { status: 400 });
      }

      const estTotal =
        durationSeconds > 0 ? durationSeconds : (audioBuffer.length * 8) / 128000;
      let stats = whisperTimingStats(whisperData, estTotal);
      let didRetry = false;
      // Bada gap (>12s) ya kam coverage (<60%) = model ne beech chhoda → 1 retry
      if ((stats.largestGapSec > 12 || stats.coveragePct < 60) && estTotal > 30) {
        try {
          const retryData = await callWhisper("0.4");
          const retryStats = whisperTimingStats(retryData, estTotal);
          didRetry = true;
          if (retryStats.coveragePct > stats.coveragePct) {
            whisperData = retryData;
            stats = retryStats;
          }
        } catch {
          // retry fail = pehli run hi rakho
        }
      }

      finalSrt = generateCustomSrt(whisperData, {
        maxWordsPerLine,
        minWordsPerLine,
        targetWordsPerLine,
        ignoreDuration,
      });
      groqTiming = { ...stats, retried: didRetry };
    }

    finalSrt = enforceSrtLimits(finalSrt, {
      maxWordsPerLine,
      minWordsPerLine,
      ignoreDuration,
    });

    // ONLY convert to Roman Hinglish when explicitly selected
    if (scriptStyle === "roman") {
      finalSrt = await transliterateToRomanHinglish(finalSrt, finalGroqKey, geminiApiKey);
    }

    // Urdu-script misdetect: auto/hi target me Perso-Arabic dikhe to Devanagari me badlo.
    // (Manual "ur" chuna ho to Urdu sahi hai — fix skip.)
    let scriptFix: { needed: boolean; fixed: boolean; changed: number } | undefined;
    const langNormFx = (language || "auto").toLowerCase();
    const wantsHindi =
      langNormFx === "auto" ||
      langNormFx === "hi" ||
      scriptStyle === "devanagari" ||
      scriptStyle === "roman";
    if (/[\u0600-\u06FF]/.test(finalSrt) && wantsHindi && langNormFx !== "ur") {
      if (finalGroqKey) {
        try {
          const { fixed, changed } = await fixUrduScriptToDevanagari(finalSrt, finalGroqKey);
          if (changed > 0) {
            finalSrt = enforceSrtLimits(fixed, { maxWordsPerLine, minWordsPerLine, ignoreDuration });
          }
          scriptFix = { needed: true, fixed: changed > 0, changed };
        } catch (e) {
          console.warn("Urdu script auto-fix fail:", e);
          scriptFix = { needed: true, fixed: false, changed: 0 };
        }
      } else {
        scriptFix = { needed: true, fixed: false, changed: 0 };
      }
    }

    const finalSegmentsCount = (finalSrt.match(/-->/g) || []).length;

    return NextResponse.json({
      success: true,
      engine: whisperModel,
      srtContent: finalSrt,
      srtFilename: `subtitles-${Date.now()}.srt`,
      segmentsCount: finalSegmentsCount,
      scriptStyle,
      upload: uploadMeta,
      timing: groqTiming
        ? { ...groqTiming, estimated: false }
        : { coveragePct: 100, largestGapSec: 0, largestGapAt: 0, retried: false, estimated: false },
      scriptFix,
      limits: {
        maxWordsPerLine,
        minWordsPerLine,
        ignoreDuration,
      },
    });
  } catch (err: any) {
    console.error("[Transcribe Route Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate subtitles" },
      { status: 500 }
    );
  }
}
