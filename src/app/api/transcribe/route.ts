import { NextRequest, NextResponse } from "next/server";
import { generateCustomSrt, enforceSrtLimits } from "@/lib/srt-chunker";

export const maxDuration = 120;

/**
 * Returns the optimal Whisper lead-in context prompt based on scriptStyle.
 * IMPORTANT: In Whisper, the prompt is NOT an instruction, but an autoregressive prefix!
 * It MUST match the target script/language to avoid confusing the decoder.
 */
function getWhisperPrompt(scriptStyle: string, customPrompt?: string): string {
  if (customPrompt && customPrompt.trim()) {
    return customPrompt.trim();
  }

  if (scriptStyle === "devanagari") {
    // 100% Devanagari Hindi lead-in context to prime Whisper for Pure Hindi
    return "नमस्ते, यह एक हिंदी ऑडियो रिकॉर्डिंग है। इसमें स्पष्ट और शुद्ध हिंदी भाषा में बातचीत हो रही है। कृपया सभी शब्दों को केवल शुद्ध देवनागरी लिपि में ही लिखें।";
  }

  if (scriptStyle === "roman") {
    // Lead-in for initial Devanagari decoding (which is then cleanly transliterated)
    return "नमस्ते, यह एक हिंदी ऑडियो रिकॉर्डिंग है। इसमें स्पष्ट और शुद्ध हिंदी भाषा में बातचीत हो रही है।";
  }

  if (scriptStyle === "english") {
    return "Educational speech transcription translated into natural, fluent English subtitles.";
  }

  // Auto / code-switched
  return "नमस्ते, इस ऑडियो में हिंदी और तकनीकी अंग्रेजी शब्दों का स्वाभाविक प्रयोग है।";
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

  // 1. Try Groq with ultra-fast llama-3.1-8b-instant, then llama-3.3-70b-versatile
  if (groqApiKey) {
    const groqModels = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"];
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

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let audioBuffer: Buffer | null = null;
    let groqApiKey = "";
    let geminiApiKey = "";
    let engine = "groq-whisper-turbo"; // "groq-whisper-turbo" | "groq-whisper-v3" | "gemini-3.5-transcribe" | "gemini-2.5-flash"
    let scriptStyle = "devanagari"; // "devanagari" | "roman" | "english" | "auto"
    let language = "hi";
    let maxWordsPerLine = 8;
    let minWordsPerLine = 5;
    let targetWordsPerLine = 6;
    let ignoreDuration = true;
    let customPrompt = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      groqApiKey = (formData.get("groqApiKey") as string) || "";
      geminiApiKey = (formData.get("geminiApiKey") as string) || "";
      engine = (formData.get("engine") as string) || "groq-whisper-turbo";
      scriptStyle = (formData.get("scriptStyle") as string) || "devanagari";
      language = (formData.get("language") as string) || (scriptStyle === "english" ? "en" : "hi");
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

      const file = formData.get("audio") as File | null;
      if (file && file.size > 0) {
        audioBuffer = Buffer.from(await file.arrayBuffer());
      }
    } else {
      const body = await req.json();
      groqApiKey = body.groqApiKey || "";
      geminiApiKey = body.geminiApiKey || "";
      engine = body.engine || "groq-whisper-turbo";
      scriptStyle = body.scriptStyle || "devanagari";
      language = body.language || (scriptStyle === "english" ? "en" : "hi");
      customPrompt = body.prompt || "";
      if (typeof body.maxWordsPerLine === "number") maxWordsPerLine = body.maxWordsPerLine;
      if (typeof body.minWordsPerLine === "number") minWordsPerLine = body.minWordsPerLine;
      if (typeof body.ignoreDuration === "boolean") ignoreDuration = body.ignoreDuration;

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
    // ENGINE OPTION 1: GEMINI (3.5 TRANSCRIBE OR 2.5 FLASH)
    // ─────────────────────────────────────────────────────────────
    if (engine.startsWith("gemini")) {
      const finalGeminiKey = (geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
      if (!finalGeminiKey) {
        return NextResponse.json(
          { error: "Gemini API Key is required. Please enter it in API Settings." },
          { status: 400 }
        );
      }

      const audioBase64 = audioBuffer.toString("base64");
      let generatedSrt = "";

      const scriptInstruction =
        scriptStyle === "devanagari"
          ? "CRITICAL REQUIREMENT: Output MUST be 100% pure Hindi in Devanagari script (देवनागरी लिपि, जैसे 'नमस्ते दोस्तों, आज हम बात करेंगे'). DO NOT use English/Latin alphabet for Hindi words."
          : scriptStyle === "roman"
          ? "CRITICAL REQUIREMENT: Output MUST be natural conversational Roman Hinglish (Latin alphabet, e.g. 'Namaste doston, aaj hum baat karenge...'). DO NOT translate into English words."
          : scriptStyle === "english"
          ? "CRITICAL REQUIREMENT: Translate the spoken speech into clear, fluent English subtitles in standard SRT format."
          : "Transcribe the audio speech verbatim with natural code-switching.";

      const geminiModel = engine === "gemini-1.5-flash" ? "gemini-1.5-flash" : "gemini-2.5-flash";
      const flashUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${finalGeminiKey}`;
        const flashPayload = {
          contents: [
            {
              parts: [
                {
                  text: `You are an expert audio subtitler and speech recognition model.
Your task: Transcribe the attached audio file into standard SRT subtitle format with accurate timestamps.

${scriptInstruction}

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
                    mimeType: "audio/mp3",
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
          return NextResponse.json(
            { error: errData?.error?.message || `Gemini audio transcription failed (${flashRes.status})` },
            { status: 502 }
          );
        }

        const flashData = await flashRes.json();
        const rawOutput = flashData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!rawOutput) {
          return NextResponse.json({ error: "Gemini did not return any subtitle text from the audio" }, { status: 400 });
        }
        generatedSrt = rawOutput.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();

      let finalSrt = enforceSrtLimits(generatedSrt, {
        maxWordsPerLine,
        minWordsPerLine,
        ignoreDuration,
      });

      // ONLY transliterate if Roman script was explicitly requested AND text still has Devanagari
      if (scriptStyle === "roman" && /[\u0900-\u097F]/.test(finalSrt)) {
        finalSrt = await transliterateToRomanHinglish(finalSrt, groqApiKey, finalGeminiKey);
      }

      const finalSegmentsCount = (finalSrt.match(/-->/g) || []).length;
      return NextResponse.json({
        success: true,
        engine,
        srtContent: finalSrt,
        srtFilename: `gemini-subtitles-${Date.now()}.srt`,
        segmentsCount: finalSegmentsCount,
        scriptStyle,
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
      // CASE B: Transcription in Devanagari, Roman Hinglish, or Pure English
      const whisperFormData = new FormData();
      whisperFormData.append("file", audioBlob, "audio.mp3");
      whisperFormData.append("model", whisperModel);
      whisperFormData.append("response_format", "verbose_json");
      whisperFormData.append("temperature", "0");

      // Force language 'hi' for Hindi to ensure Whisper's acoustic decoder works with 100% fidelity
      if (language && language !== "auto") {
        whisperFormData.append("language", language);
      } else if (scriptStyle === "devanagari" || scriptStyle === "roman") {
        whisperFormData.append("language", "hi");
      }

      whisperFormData.append("timestamp_granularities[]", "word");
      whisperFormData.append("timestamp_granularities[]", "segment");

      // Set prompt that MATCHES the script so Whisper decoder is never confused by foreign tokens
      const promptText = getWhisperPrompt(scriptStyle, customPrompt);
      whisperFormData.append("prompt", promptText);

      const whisperResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${finalGroqKey}` },
        body: whisperFormData,
      });

      if (!whisperResponse.ok) {
        const errJson = await whisperResponse.json().catch(() => ({}));
        return NextResponse.json(
          { error: errJson?.error?.message || `Groq Whisper failed (${whisperResponse.status})` },
          { status: 502 }
        );
      }

      const whisperData = await whisperResponse.json();
      const hasSegments = whisperData.segments && Array.isArray(whisperData.segments) && whisperData.segments.length > 0;
      const hasWords = whisperData.words && Array.isArray(whisperData.words) && whisperData.words.length > 0;

      if (!hasSegments && !hasWords) {
        return NextResponse.json({ error: "Whisper did not detect any speech in the audio" }, { status: 400 });
      }

      finalSrt = generateCustomSrt(whisperData, {
        maxWordsPerLine,
        minWordsPerLine,
        targetWordsPerLine,
        ignoreDuration,
      });
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

    const finalSegmentsCount = (finalSrt.match(/-->/g) || []).length;

    return NextResponse.json({
      success: true,
      engine: whisperModel,
      srtContent: finalSrt,
      srtFilename: `subtitles-${Date.now()}.srt`,
      segmentsCount: finalSegmentsCount,
      scriptStyle,
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
