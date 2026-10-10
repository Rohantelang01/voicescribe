import { NextRequest, NextResponse } from "next/server";
import { generateCustomSrt, enforceSrtLimits } from "@/lib/srt-chunker";
import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export const maxDuration = 120;

interface MasterPartInput {
  id: string;
  partNumber: number;
  audioDataUrl: string;
  text?: string;
}

interface MasterOptions {
  silenceCut?: boolean;
  noiseReduction?: boolean;
  toneMatch?: boolean;
  loudnessNormalize?: boolean;
  bitrate?: number;
  generateSrt?: boolean;
  groqApiKey?: string;
  scriptStyle?: "roman" | "devanagari" | "english";
}

async function transliterateToRomanHinglish(srtText: string, groqApiKey: string): Promise<string> {
  if (!srtText || !groqApiKey) return srtText;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are an expert subtitle transliterator. Convert Devanagari Hindi text inside SRT subtitle cues into natural conversational Hinglish (Roman English letters). Rules:\n1. Keep cue numbers and timestamps (00:00:00,000 --> 00:00:00,000) EXACTLY unchanged.\n2. Do NOT translate into English words. ONLY change the script from Devanagari to Roman letters (e.g. 'नमस्ते दोस्तों' -> 'Namaste doston').\n3. Output ONLY the valid raw SRT content.",
          },
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
  } catch (e) {}
  return srtText;
}

function runCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command ${cmd} exited with code ${code}: ${stderr || stdout}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

export async function POST(req: NextRequest) {
  let tmpDir = "";
  try {
    const contentType = req.headers.get("content-type") || "";
    let mode: "raw_wav" | "mastered_mp3" = "mastered_mp3";
    let personaName = "Prof. Arya";
    let options: MasterOptions = {};
    const inputWavPaths: string[] = [];

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "audio_studio_master_"));

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      mode = ((formData.get("mode") as string) || "mastered_mp3") as "raw_wav" | "mastered_mp3";
      personaName = (formData.get("personaName") as string) || "Prof. Arya";
      try {
        options = JSON.parse((formData.get("options") as string) || "{}");
      } catch (e) {
        options = {};
      }

      const partsCount = parseInt((formData.get("partsCount") as string) || "0", 10);
      for (let i = 0; i < partsCount; i++) {
        const file = formData.get(`audio_${i}`) as File | null;
        if (file && file.size > 0) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const filePath = path.join(tmpDir, `input_${i}.wav`);
          await fs.writeFile(filePath, buffer);
          inputWavPaths.push(filePath);
        }
      }
    } else {
      const body = await req.json();
      const {
        parts = [],
        mode: bodyMode = "mastered_mp3",
        options: bodyOptions = {},
        personaName: bodyName = "Prof. Arya",
      } = body as {
        parts: MasterPartInput[];
        mode?: "raw_wav" | "mastered_mp3";
        options?: MasterOptions;
        personaName?: string;
      };

      mode = bodyMode;
      options = bodyOptions;
      personaName = bodyName;

      const validParts = (parts || [])
        .filter((p) => p.audioDataUrl && p.audioDataUrl.startsWith("data:audio/"))
        .sort((a, b) => a.partNumber - b.partNumber);

      for (let i = 0; i < validParts.length; i++) {
        const part = validParts[i];
        const base64Index = part.audioDataUrl.indexOf("base64,");
        if (base64Index === -1) continue;

        const base64Data = part.audioDataUrl.substring(base64Index + 7);
        const audioBuffer = Buffer.from(base64Data, "base64");
        const filePath = path.join(tmpDir, `input_${i}_part${part.partNumber}.wav`);
        await fs.writeFile(filePath, audioBuffer);
        inputWavPaths.push(filePath);
      }
    }

    if (inputWavPaths.length === 0) {
      return NextResponse.json(
        { error: "No valid audio parts were provided or decoded" },
        { status: 400 }
      );
    }

    const {
      silenceCut = false,
      noiseReduction = true,
      toneMatch = true,
      loudnessNormalize = true,
      bitrate = 320,
      generateSrt = true,
      groqApiKey,
    } = options;

    const filtersApplied: string[] = [];

    // ─────────────────────────────────────────────────────────────
    // MODE 1: RAW LOSSLESS WAV CONCAT
    // ─────────────────────────────────────────────────────────────
    if (mode === "raw_wav") {
      const outWavPath = path.join(tmpDir, "merged_raw.wav");

      if (inputWavPaths.length === 1) {
        await fs.copyFile(inputWavPaths[0], outWavPath);
      } else {
        const concatListPath = path.join(tmpDir, "concat_list.txt");
        const listContent = inputWavPaths.map((p) => `file '${p}'`).join("\n");
        await fs.writeFile(concatListPath, listContent, "utf-8");

        await runCommand("ffmpeg", [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          concatListPath,
          "-c",
          "copy",
          outWavPath,
        ]);
      }

      const mergedWavBuffer = await fs.readFile(outWavPath);
      const base64Wav = mergedWavBuffer.toString("base64");
      const audioDataUrl = `data:audio/wav;base64,${base64Wav}`;

      let durationSeconds = 0;
      try {
        const probeRes = await runCommand("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          outWavPath,
        ]);
        durationSeconds = parseFloat(probeRes.stdout.trim()) || 0;
      } catch (e) {
        durationSeconds = Math.round((mergedWavBuffer.length - 44) / 48000);
      }

      return NextResponse.json({
        success: true,
        mode: "raw_wav",
        format: "wav",
        audioDataUrl,
        durationSeconds,
        sizeBytes: mergedWavBuffer.length,
        filename: `arya-raw-merged.wav`,
        partsCount: inputWavPaths.length,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MODE 2: MASTERED MP3 (+ DENOISE + TONEMATCH + LOUDNORM + SRT)
    // ─────────────────────────────────────────────────────────────
    const outMp3Path = path.join(tmpDir, "mastered_mp3.mp3");
    const ffmpegArgs: string[] = ["-y"];

    for (const p of inputWavPaths) {
      ffmpegArgs.push("-i", p);
    }

    const N = inputWavPaths.length;
    let filterComplex = "";

    for (let i = 0; i < N; i++) {
      const partFilters: string[] = ["aresample=24000:async=1"];

      if (noiseReduction) {
        partFilters.push("highpass=f=80,afftdn=nr=10:nf=-50:tn=1");
      }

      if (toneMatch) {
        partFilters.push("dynaudnorm=f=150:g=15:m=10:p=0.9");
      }

      if (loudnessNormalize) {
        partFilters.push("loudnorm=I=-14:TP=-1.5:LRA=11");
      }

      if (silenceCut) {
        partFilters.push("silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB");
      }

      filterComplex += `[${i}:a]${partFilters.join(",")}[norm${i}]; `;
    }

    if (noiseReduction) filtersApplied.push("FFT Noise Reduction & 80Hz High-Pass");
    if (toneMatch) filtersApplied.push("Dynamic Tone & Presence Leveling");
    if (loudnessNormalize) filtersApplied.push("Broadcast EBU R128 Loudness Match (-14 LUFS)");

    if (N === 1) {
      filterComplex += `[norm0]asetpts=N/SR/TB`;
    } else {
      let concatInputs = "";
      for (let i = 0; i < N; i++) {
        concatInputs += `[norm${i}]`;
      }
      filterComplex += `${concatInputs}concat=n=${N}:v=0:a=1[stitched]; `;
      filterComplex += `[stitched]asetpts=N/SR/TB`;
      filtersApplied.push(`Sequential Concat (${N} Parts • No Overlap)`);
    }

    if (loudnessNormalize) {
      filterComplex += `,loudnorm=I=-14:TP=-1.5:LRA=11[mastered]`;
    } else {
      filterComplex += `[mastered]`;
    }

    ffmpegArgs.push(
      "-filter_complex",
      filterComplex,
      "-map",
      "[mastered]",
      "-c:a",
      "libmp3lame",
      "-b:a",
      `${bitrate}k`,
      "-ac",
      "1",
      "-ar",
      "24000",
      outMp3Path
    );

    await runCommand("ffmpeg", ffmpegArgs);

    const masteredMp3Buffer = await fs.readFile(outMp3Path);
    const base64Mp3 = masteredMp3Buffer.toString("base64");
    const audioDataUrl = `data:audio/mp3;base64,${base64Mp3}`;

    let durationSeconds = 0;
    try {
      const probeRes = await runCommand("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        outMp3Path,
      ]);
      durationSeconds = parseFloat(probeRes.stdout.trim()) || 0;
    } catch (e) {
      durationSeconds = Math.round((masteredMp3Buffer.length * 8) / (bitrate * 1000));
    }

    // Optional Groq Whisper SRT Subtitle generation
    let srtContent: string | null = null;
    let srtError: string | null = null;

    if (generateSrt) {
      try {
        const finalGroqKey = (groqApiKey || process.env.GROQ_API_KEY || "").trim();
        if (finalGroqKey) {
          const audioBlob = new Blob([new Uint8Array(masteredMp3Buffer)], { type: "audio/mpeg" });
          const formData = new FormData();
          formData.append("file", audioBlob, "mastered.mp3");
          formData.append("model", "whisper-large-v3-turbo");
          formData.append("response_format", "verbose_json");
          formData.append("language", "hi");
          formData.append("timestamp_granularities[]", "word");
          formData.append("timestamp_granularities[]", "segment");
          formData.append(
            "prompt",
            `Namaste, this is an educational Hinglish lecture by ${personaName}. Hindi speech in Devanagari script, English technical terms in Roman script.`
          );

          const whisperResponse = await fetch(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            {
              method: "POST",
              headers: { Authorization: `Bearer ${finalGroqKey}` },
              body: formData,
            }
          );

          if (whisperResponse.ok) {
            const whisperData = await whisperResponse.json();
            const hasSegments = whisperData.segments && Array.isArray(whisperData.segments) && whisperData.segments.length > 0;
            const hasWords = whisperData.words && Array.isArray(whisperData.words) && whisperData.words.length > 0;

            if (hasSegments || hasWords) {
              const rawSrt = generateCustomSrt(whisperData, {
                maxWordsPerLine: 8,
                minWordsPerLine: 5,
                targetWordsPerLine: 6,
                ignoreDuration: true,
              });
              srtContent = enforceSrtLimits(rawSrt, {
                maxWordsPerLine: 8,
                minWordsPerLine: 5,
                ignoreDuration: true,
              });

              if (options.scriptStyle !== "devanagari") {
                srtContent = await transliterateToRomanHinglish(srtContent, finalGroqKey);
                filtersApplied.push("Roman Letters Subtitles (Hinglish 5-8 Words/Line)");
              } else {
                filtersApplied.push("Groq Whisper Subtitles (5-8 Words/Line)");
              }
            } else {
              srtError = "Whisper did not detect any speech in audio";
            }
          } else {
            const errJson = await whisperResponse.json().catch(() => ({}));
            srtError = errJson?.error?.message || `Groq Whisper failed (${whisperResponse.status})`;
          }
        }
      } catch (whisperErr: any) {
        srtError = whisperErr.message || "Failed to generate subtitles";
      }
    }

    return NextResponse.json({
      success: true,
      mode: "mastered_mp3",
      format: "mp3",
      bitrate: `${bitrate}k`,
      audioDataUrl,
      durationSeconds,
      sizeBytes: masteredMp3Buffer.length,
      filename: `arya-mastered-${bitrate}k.mp3`,
      srtContent,
      srtFilename: `arya-subtitles.srt`,
      hasSrt: !!srtContent,
      srtError,
      filtersApplied,
      partsCount: inputWavPaths.length,
    });
  } catch (err: any) {
    console.error("[Master API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process and master audio" },
      { status: 500 }
    );
  } finally {
    if (tmpDir) {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        // ignore
      }
    }
  }
}
