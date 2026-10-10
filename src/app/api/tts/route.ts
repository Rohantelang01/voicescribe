import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

/**
 * Converts raw 16-bit linear PCM audio buffer to standard RIFF/WAVE container.
 * This allows all modern HTML5 <audio> players and browsers to play the audio natively.
 */
function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for uncompressed PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      text,
      voiceName = "Kore",
      model = "gemini-2.5-flash-preview-tts",
      apiKey: clientKey,
      directorPrompt,
    } = body as {
      text: string;
      voiceName?: string;
      model?: string;
      apiKey?: string;
      directorPrompt?: string;
    };

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text is required to generate speech" }, { status: 400 });
    }

    const cleanText = text.trim();
    if (cleanText.length > 15000) {
      return NextResponse.json(
        { error: "Text length exceeds maximum recommended limit (15,000 characters). Please split into smaller parts." },
        { status: 400 }
      );
    }

    const apiKey = (clientKey || process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured. Please enter your Google Cloud Gemini API key in Settings." },
        { status: 400 }
      );
    }

    let promptText = cleanText;
    if (directorPrompt && typeof directorPrompt === "string" && directorPrompt.trim()) {
      promptText = `[DIRECTORIAL AUDIO PROFILE & CONSISTENCY LOCK]
${directorPrompt.trim()}

[AUDIO SYNTHESIS INSTRUCTION]
Synthesize ONLY the exact spoken transcript below. Read the text strictly adhering to the specified vocal persona, exact age, pitch register, timbre, and pace without any tone/pitch drifting between segments.

[TRANSCRIPT TO SPEAK]
${cleanText}`;
    }

    const targetModel = model || "gemini-2.5-flash-preview-tts";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    const requestPayload: Record<string, any> = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName || "Kore",
            },
          },
        },
      },
    };

    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    const elapsedMs = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg =
        errorData?.error?.message ||
        `Google Gemini API responded with status ${response.status}: ${response.statusText}`;

      if (response.status === 429) {
        return NextResponse.json(
          {
            error: "Gemini API Rate Limit Reached (429). Google AI Studio limits requests per minute. Please switch project key or wait 10-15 seconds and retry.",
            details: errorMsg,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: errorMsg, status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find(
      (p: any) => p?.inlineData?.mimeType && p?.inlineData?.data
    );

    if (!audioPart?.inlineData?.data) {
      return NextResponse.json(
        {
          error: "No audio data was returned by the Gemini TTS model. Check if text is valid or contains unsupported characters.",
          details: data,
        },
        { status: 502 }
      );
    }

    const rawMime = audioPart.inlineData.mimeType as string;
    const base64Data = audioPart.inlineData.data as string;

    const rateMatch = rawMime.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

    const pcmBuffer = Buffer.from(base64Data, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, sampleRate, 1, 16);
    const wavBase64 = wavBuffer.toString("base64");
    const audioDataUrl = `data:audio/wav;base64,${wavBase64}`;

    const durationSeconds = +(pcmBuffer.length / (sampleRate * 2)).toFixed(2);

    return NextResponse.json({
      success: true,
      audioDataUrl,
      durationSeconds,
      sampleRate,
      voiceName,
      model: targetModel,
      elapsedMs,
      sizeBytes: wavBuffer.length,
      usageMetadata: data?.usageMetadata || null,
      characterCount: cleanText.length,
    });
  } catch (err: any) {
    console.error("[TTS Route Error]:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred while generating audio" },
      { status: 500 }
    );
  }
}
