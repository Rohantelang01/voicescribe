import { NextRequest, NextResponse } from "next/server";
import { parseSrtCues, cuesToSrt, enforceSrtLimits } from "@/lib/srt-chunker";

export const maxDuration = 120;

export type TransformTask =
  | "romanize"
  | "devanagari"
  | "translate-en"
  | "translate-hi"
  | "clean"
  | "captions"
  | "custom";

/** Groq text models — user ke free tier me sirf ye hain (Llama access nahi hai).
 * Pehla = requested, baaki fallback. */
const GROQ_CHAIN = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
];

/** Gemini text models (user quota wale). */
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

function resolveGeminiTextModel(model: string): string {
  if (GEMINI_TEXT_MODELS.has(model)) return model;
  return "gemini-3.1-flash-lite";
}

function taskInstruction(task: TransformTask, customInstruction: string, hasScript: boolean): string {
  const scriptLine = hasScript
    ? "An ORIGINAL exact script is provided as ground truth below. Jab SRT me galti lage to script se correct shabd lo — meaning mat badlo."
    : "";
  switch (task) {
    case "romanize":
      return `Convert ONLY the subtitle text from Devanagari Hindi into natural conversational Roman Hinglish (Latin alphabet, jaise WhatsApp par likhte hain: 'Namaste doston, aaj hum baat karenge'). Hindi words ko translate MAT karo ('doston' rahe, 'friends' NA bane). Jo shabd pehle se English me hain unhe English hi rakho. ${scriptLine}`;
    case "devanagari":
      return `Convert ONLY the subtitle text into 100% pure Hindi in Devanagari script (jaise 'नमस्ते दोस्तों, आज हम बात करेंगे'). Roman Hinglish ya English-mixed shabdon ko sahi Devanagari me likho — meaning mat badlo. Technical/brand English shabdon ko waise hi rehne do. ${scriptLine}`;
    case "translate-en":
      return `Translate ONLY the subtitle text into clear, fluent, natural English subtitles. Viral-video style: short, punchy lines. ${scriptLine}`;
    case "translate-hi":
      return `Translate ONLY the subtitle text into natural Hindi (Devanagari script) subtitles. Bol-chaal wali Hindi, shuddh lekin viral style. ${scriptLine}`;
    case "clean":
      return `Fix ONLY spelling mistakes, grammar aur galat sunai diye shabd in the subtitle text. Filler words (um, uh, aaa) hatao. Meaning, language aur script bilkul same rakho. ${scriptLine}`;
    case "captions":
      return `Rewrite ONLY the subtitle text as punchy viral captions (Reels/Shorts style): 3-6 words per line feel, HOOK words capital me, emoji bilkul NA lagao. Language aur script same rakho, meaning mat badlo. ${scriptLine}`;
    case "custom":
      return customInstruction.trim() || "Improve the subtitle text slightly without changing meaning.";
    default:
      return "Improve the subtitle text slightly without changing meaning.";
  }
}

async function callGroqChat(
  apiKey: string,
  model: string,
  system: string,
  user: string
): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      // Ek atka batch poori 15-batch queue ko infinite na latkaye
      signal: AbortSignal.timeout(60000),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error(`Groq ${model} timed out after 60s (batch stuck)`);
    }
    throw e;
  }
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `Groq ${model} failed (${res.status})`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return (typeof content === "string" ? content : String(content ?? "")).trim();
}

async function callGeminiText(
  apiKey: string,
  model: string,
  system: string,
  user: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error(`Gemini ${model} timed out after 60s (batch stuck)`);
    }
    throw e;
  }
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const msg: string = errJson?.error?.message || `Gemini ${model} failed (${res.status})`;
    throw new Error(res.status === 429 ? `${msg}. Quota exceeded — please retry later or choose another model.` : msg);
  }
  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("\n").trim() || "";
  return text.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
}

/** "12|subtitle text" lines me se id->text map nikalo. */
function parseIdTextLines(output: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s*[|:>\-]\s*(.+?)\s*$/);
    if (m) map.set(parseInt(m[1], 10), m[2]);
  }
  return map;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const srt: string = body.srt || "";
    const task: TransformTask = body.task || "romanize";
    const customInstruction: string = body.customInstruction || "";
    const script: string = (body.script || "").trim();
    const provider: string = body.provider === "gemini" ? "gemini" : "groq";
    const groqApiKey: string = (body.groqApiKey || "").trim();
    const geminiApiKey: string = (body.geminiApiKey || "").trim();
    const projectName: string = (body.projectName || "").trim();
    const maxWordsPerLine = typeof body.maxWordsPerLine === "number" ? body.maxWordsPerLine : 8;
    const minWordsPerLine = typeof body.minWordsPerLine === "number" ? body.minWordsPerLine : 5;

    if (!srt.trim() || !srt.includes("-->")) {
      return NextResponse.json({ error: "Valid SRT content do (timestamps ke saath)" }, { status: 400 });
    }
    if (task === "custom" && !customInstruction.trim()) {
      return NextResponse.json({ error: "Custom task ke liye instruction likho" }, { status: 400 });
    }

    const cues = parseSrtCues(srt);
    if (!cues.length) {
      return NextResponse.json({ error: "SRT me koi cue parse nahi hua" }, { status: 400 });
    }

    // Batching: ~30 cues ya ~2500 chars per request (quota + timeout safe)
    const batches: typeof cues[] = [];
    let cur: typeof cues = [];
    let curChars = 0;
    for (const c of cues) {
      if (cur.length >= 30 || curChars + c.text.length > 2500) {
        batches.push(cur);
        cur = [];
        curChars = 0;
      }
      cur.push(c);
      curChars += c.text.length;
    }
    if (cur.length) batches.push(cur);
    if (batches.length > 15) {
      return NextResponse.json(
        { error: `SRT bahut lambi hai (${cues.length} cues). Pehle tukdon me baant kar bhejo.` },
        { status: 400 }
      );
    }

    const instruction = taskInstruction(task, customInstruction, !!script);
    const system = `You are an Indian subtitle text transformer for Reels/Shorts creators.
${instruction}

STRICT OUTPUT RULES:
1. Input lines are in "ID|text" format. Reply in EXACT same "ID|text" format, same IDs, same order, same line count.
2. Transform ONLY the text part. IDs mat badlo, koi line mat jodo/girao, koi explanation mat likho.
3. Timestamps tumhe diye hi nahi ja rahe — isliye timing ki chinta mat karo, sirf text badlo.`;
    const scriptBlock = script ? `\n\nORIGINAL EXACT SCRIPT (ground truth, sirf reference ke liye):\n${script.slice(0, 6000)}` : "";

    const groqModels =
      provider === "groq"
        ? [body.model, ...GROQ_CHAIN].filter(Boolean).filter((m, i, a) => a.indexOf(m) === i)
        : [];
    const geminiModel = resolveGeminiTextModel(body.model || "gemini-3.1-flash-lite");

    // Identity: kaunsa project/key quota kha raha hai (UI badge ke liye).
    // Groq single key hai → sirf last4 (poori key kabhi wapas nahi bhejte).
    const keyHint =
      provider === "groq" && groqApiKey.length >= 4 ? `••••${groqApiKey.slice(-4)}` : "";
    const identity = provider === "groq" ? (keyHint || "Groq key") : projectName || "Gemini key";

    // NDJSON progress stream: lambi queue (439 cues = 15 batches) me frontend
    // har batch par live counter dikhata hai. Mid-stream failure par error line.
    const encoder = new TextEncoder();
    const send = (controller: ReadableStreamDefaultController, obj: unknown) =>
      controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const outById = new Map<number, string>();
          let usedModel = "";
          for (let bi = 0; bi < batches.length; bi++) {
            const batch = batches[bi];
            const user = `Transform these ${batch.length} subtitle lines (IDs ${batch[0].id}–${batch[batch.length - 1].id}):\n${batch
              .map((c) => `${c.id}|${c.text}`)
              .join("\n")}${scriptBlock}`;

            let out = "";
            let lastErr = "";
            let attemptModel = "";
            if (provider === "groq") {
              if (!groqApiKey) {
                send(controller, { type: "error", error: "Groq API Key is required. Please set it in API Settings." });
                controller.close();
                return;
              }
              for (const m of groqModels.length ? groqModels : GROQ_CHAIN) {
                attemptModel = m;
                send(controller, { type: "progress", batch: bi + 1, of: batches.length, model: m, identity });
                try {
                  out = await callGroqChat(groqApiKey, m, system, user);
                  if (out) {
                    usedModel = m;
                    break;
                  }
                } catch (e) {
                  lastErr = e instanceof Error ? e.message : String(e);
                }
              }
            } else {
              if (!geminiApiKey) {
                send(controller, { type: "error", error: "Gemini API Key is required. Please set it in API Settings." });
                controller.close();
                return;
              }
              attemptModel = geminiModel;
              send(controller, { type: "progress", batch: bi + 1, of: batches.length, model: geminiModel, identity });
              try {
                out = await callGeminiText(geminiApiKey, geminiModel, system, user);
                usedModel = geminiModel;
              } catch (e) {
                lastErr = e instanceof Error ? e.message : String(e);
              }
            }
            if (!out) {
              send(controller, {
                type: "error",
                error: `Batch ${bi + 1}/${batches.length} failed on ${attemptModel || provider} [${identity}]: ${lastErr || "No output returned"}`,
              });
              controller.close();
              return;
            }
            const parsed = parseIdTextLines(out);
            for (const c of batch) {
              const t = parsed.get(c.id || 0);
              if (t) outById.set(c.id || 0, t);
            }
            send(controller, { type: "progress", batch: bi + 1, of: batches.length, model: usedModel || attemptModel, identity, doneBatches: bi + 1 });
          }

          // Original timestamps bilkul same — sirf text replace, missing = original
          const finalCues = cues.map((c) => ({ ...c, text: outById.get(c.id || 0) || c.text }));
          let finalSrt = cuesToSrt(finalCues);
          finalSrt = enforceSrtLimits(finalSrt, {
            maxWordsPerLine,
            minWordsPerLine,
            ignoreDuration: true,
          });

          send(controller, {
            type: "done",
            success: true,
            provider,
            model: usedModel,
            identity,
            srtContent: finalSrt,
            cuesCount: finalCues.length,
            transformedCount: outById.size,
            batches: batches.length,
            task,
          });
          controller.close();
        } catch (e) {
          send(controller, { type: "error", error: e instanceof Error ? e.message : "Transform failed" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  } catch (err: unknown) {
    console.error("[Transform SRT Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transform failed" },
      { status: 500 }
    );
  }
}
