import { NextRequest, NextResponse } from "next/server";
import { GEMINI_VOICES, parsePersonaMap, PersonaConfig } from "@/lib/personas";

export const maxDuration = 60;

const GROQ_CHAIN = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];

const GEMINI_TEXT_MODELS = new Set([
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

const VOICE_LINES = GEMINI_VOICES.map((v) => `- ${v.name} (${v.gender}) — ${v.tone}`).join("\n");

const SYSTEM = `You design dynamic AI voiceover characters for VoiceScribe (Gemini TTS studio). The user describes the character in 1-2 lines — you decide everything else sensibly with authentic Indian character naming and genre styling.

OUTPUT: ONLY raw JSON (no fences, no explanation), EXACTLY this shape with one unique key:
{"persona_<name><timestamp>": {"id": same key, "name": ..., "title": ..., "domain": ..., "gender": "Female"|"Male", "perceivedAge": "25" (string), "avatarEmoji": "...", "baseVoice": ONE name from VOICE LIST (exact spelling), "pacingNote": "... (~145 WPM)", "directorPrompt": "Speaker: ...\\nGenre: ...\\n\\nVocal Tone & Timbre: ...\\n\\nPacing & Rhythm: ...\\n\\nEnergy & Emotion: ...\\n\\nLanguage & Multilingual Adaptation:\\n- Universal Multilingual Capability: Dynamically adapts to the input transcript language (English, Hindi, Hinglish, regional Indian languages, or global languages) with authentic native pronunciation and fluency while maintaining this character's signature tone.\\n\\nConsistency Lock: ...", "templates": [{"id": "template_...", "title": ..., "topic": ..., "text": "2-4 lines sample script"}], "isBuiltIn": false}}

RULES:
1. baseVoice MUST be exactly one name from VOICE LIST. gender must match it.
2. Character names should be authentic Indian names (e.g. Arya, Kabir, Ananya, Rahul, Meera, Vikram, Dev, Priya, Aarav).
3. MULTILINGUAL & INPUT-ADAPTIVE: The character MUST dynamically adapt to whatever language the user feeds in. The directorPrompt MUST include the "Language & Multilingual Adaptation" section ensuring native fluency in any language.
4. perceivedAge is a string. No avatarUrl. No extra fields. Valid JSON only.

VOICE LIST:
${VOICE_LINES}`;

async function callGroq(apiKey: string, model: string, user: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Groq ${model} failed (${res.status})`);
  }
  const d = await res.json();
  return (d.choices?.[0]?.message?.content || "").trim();
}

async function callGemini(apiKey: string, model: string, user: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature: 0.5 },
      }),
    }
  );
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Gemini ${model} failed (${res.status})`);
  }
  const d = await res.json();
  const t =
    d.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("\n").trim() || "";
  return t.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const description: string = (body.description || "").trim();
    const groqApiKey: string = (body.groqApiKey || "").trim();
    const geminiApiKey: string = (body.geminiApiKey || "").trim();
    let provider: string = body.provider === "gemini" ? "gemini" : "groq";
    if (provider === "groq" && !groqApiKey && geminiApiKey) provider = "gemini";
    if (provider === "gemini" && !geminiApiKey && groqApiKey) provider = "groq";

    if (!description) {
      return NextResponse.json({ error: "Please provide a 1–2 line description of the character" }, { status: 400 });
    }
    if (provider === "groq" && !groqApiKey) {
      return NextResponse.json({ error: "Groq API Key is required. Please set it in API Settings." }, { status: 400 });
    }
    if (provider === "gemini" && !geminiApiKey) {
      return NextResponse.json({ error: "Gemini API Key is required. Please set it in API Settings." }, { status: 400 });
    }

    const user = `Character description: ${description}\nUnique id ke liye timestamp: ${Date.now()}`;
    let out = "";
    let usedModel = "";
    if (provider === "groq") {
      const chain = [body.model, ...GROQ_CHAIN].filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);
      let lastErr = "";
      for (const m of chain.length ? chain : GROQ_CHAIN) {
        try {
          out = await callGroq(groqApiKey, m, user);
          if (out) {
            usedModel = m;
            break;
          }
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
      if (!out) {
        return NextResponse.json({ error: `AI generate fail: ${lastErr}` }, { status: 502 });
      }
    } else {
      const model = GEMINI_TEXT_MODELS.has(body.model) ? body.model : "gemini-3.1-flash-lite";
      try {
        out = await callGemini(geminiApiKey, model, user);
        usedModel = model;
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Gemini generate fail" },
          { status: 502 }
        );
      }
    }

    const map = parsePersonaMap(out);
    if (!map) {
      return NextResponse.json(
        { error: "AI failed to return a valid persona JSON. Please adjust your description and retry." },
        { status: 502 }
      );
    }
    const firstId = Object.keys(map)[0];
    const persona: PersonaConfig = map[firstId];
    return NextResponse.json({ success: true, provider, model: usedModel, personaId: firstId, persona });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate fail" },
      { status: 500 }
    );
  }
}
