import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export const maxDuration = 120;

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
    const formData = await req.formData();
    const file = formData.get("audio") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Audio Enhancer Parameters & Presets
    const preset = (formData.get("preset") as string) || "custom";
    const bassBoost = parseFloat((formData.get("bassBoost") as string) || "0");
    const midCut = parseFloat((formData.get("midCut") as string) || "0");
    const presenceBoost = parseFloat((formData.get("presenceBoost") as string) || "0");
    const airBoost = parseFloat((formData.get("airBoost") as string) || "0");

    const compression = (formData.get("compression") as string) || "none"; // "none" | "mild" | "heavy"
    const deesser = formData.get("deesser") === "true";
    const denoise = (formData.get("denoise") as string) || "none"; // "none" | "mild" | "aggressive"
    const highpass = formData.get("highpass") === "true";
    const dynaudnorm = formData.get("dynaudnorm") === "true";
    const loudnorm = (formData.get("loudnorm") as string) || "youtube_14"; // "youtube_14" | "podcast_16" | "none"
    const silenceTrim = (formData.get("silenceTrim") as string) || "none"; // "none" | "moderate" | "fast"
    const resample48k = formData.get("resample48k") !== "false";
    const outputFormat = (formData.get("outputFormat") as string) || "mp3";
    const bitrate = parseInt((formData.get("bitrate") as string) || "320", 10);

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "audio_studio_clean_"));
    const inputExt = path.extname(file.name) || ".mp3";
    const inPath = path.join(tmpDir, `input${inputExt}`);
    const outPath = path.join(tmpDir, `enhanced.${outputFormat}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inPath, buffer);

    const preFilters: string[] = [];
    const filterNames: string[] = [];

    // 1. High-Pass Filter (removes sub-80Hz mic rumble before processing)
    if (highpass) {
      preFilters.push("highpass=f=80");
      filterNames.push("80Hz High-Pass De-Rumble");
    }

    // 2. Denoise (Only for real mic recordings - NEVER for clean AI voice)
    if (denoise === "mild") {
      preFilters.push("afftdn=nr=8:nf=-52:tn=1");
      filterNames.push("Subtle Hiss Reduction");
    } else if (denoise === "aggressive") {
      preFilters.push("afftdn=nr=14:nf=-48:tn=1");
      filterNames.push("Room Noise Suppression");
    }

    // 3. Studio 4-Band Vocal EQ
    if (bassBoost !== 0) {
      preFilters.push(`equalizer=f=140:width_type=q:width=1.2:g=${bassBoost.toFixed(1)}`);
      filterNames.push(`Warmth Chest Boost (${bassBoost > 0 ? "+" : ""}${bassBoost}dB @ 140Hz)`);
    }
    if (midCut !== 0) {
      preFilters.push(`equalizer=f=380:width_type=q:width=1.2:g=${midCut.toFixed(1)}`);
      filterNames.push(`De-Box Clarity Cut (${midCut > 0 ? "+" : ""}${midCut}dB @ 380Hz)`);
    }
    if (presenceBoost !== 0) {
      preFilters.push(`equalizer=f=3200:width_type=q:width=1.4:g=${presenceBoost.toFixed(1)}`);
      filterNames.push(`Vocal Presence & Bite (${presenceBoost > 0 ? "+" : ""}${presenceBoost}dB @ 3.2kHz)`);
    }
    if (airBoost !== 0) {
      preFilters.push(`equalizer=f=10000:width_type=q:width=1.2:g=${airBoost.toFixed(1)}`);
      filterNames.push(`Studio Sheen & Air (${airBoost > 0 ? "+" : ""}${airBoost}dB @ 10kHz)`);
    }

    // 4. De-Esser (Softens harsh sibilance)
    if (deesser) {
      preFilters.push("equalizer=f=6800:width_type=q:width=1.5:g=-2.5");
      filterNames.push("Studio De-Esser (Softens harsh S/Sh frequencies)");
    }

    // 5. Dynamic Vocal Leveling (Smooth, not stacked with extreme compression)
    if (dynaudnorm) {
      preFilters.push("dynaudnorm=f=200:g=11:m=8:p=0.95");
      filterNames.push("Natural Dynamic Vocal Leveler");
    } else if (compression === "mild") {
      preFilters.push("compand=attacks=0.04:decays=0.35:points=-70/-70|-45/-38|-20/-16|0/-2:soft-knee=6:gain=1");
      filterNames.push("Smooth Optical Vocal Leveling");
    } else if (compression === "heavy") {
      preFilters.push("compand=attacks=0.02:decays=0.2:points=-70/-70|-40/-28|-15/-9|0/-1.5:soft-knee=6:gain=2");
      filterNames.push("Punchy Broadcast Vocal Compression");
    }

    // 6. Safe Silence Trimming (Leaves at least 150–250ms breathing so words are NEVER cut)
    if (silenceTrim === "fast") {
      preFilters.push("silenceremove=start_periods=1:start_duration=0.05:start_threshold=-48dB:stop_periods=-1:stop_duration=0.35:stop_threshold=-48dB:stop_silence=0.15");
      filterNames.push("⚡ Fast Reels/Shorts Pacing (Trims pauses >0.35s to 150ms)");
    } else if (silenceTrim === "moderate") {
      preFilters.push("silenceremove=start_periods=1:start_duration=0.05:start_threshold=-50dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-50dB:stop_silence=0.25");
      filterNames.push("Natural Pacing Tightener (Trims pauses >0.5s to 250ms)");
    }

    // 7. TWO-PASS REFERENCE EBU R128 LOUDNORM
    const targetLUFS = loudnorm === "podcast_16" ? -16 : -14;
    let finalFilterGraph = preFilters.length > 0 ? preFilters.join(",") : "anull";

    if (loudnorm !== "none") {
      // PASS 1: Measurement pass
      const pass1Filter = `${finalFilterGraph},loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11:print_format=json`;
      const pass1Args = ["-i", inPath, "-af", pass1Filter, "-f", "null", "-"];

      try {
        const { stderr: pass1Stderr } = await runCommand("ffmpeg", pass1Args);
        const jsonMatch = pass1Stderr.match(/\{\s*"input_i"[\s\S]*?\}/);

        if (jsonMatch) {
          const stats = JSON.parse(jsonMatch[0]);
          // PASS 2: Linear normalization with measured parameters (Zero pumping, pure transparency)
          const pass2Loudnorm = `loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
          finalFilterGraph = `${finalFilterGraph},${pass2Loudnorm}`;
          filterNames.push(`Two-Pass Reference EBU R128 Loudness (${targetLUFS} LUFS Linear)`);
        } else {
          finalFilterGraph = `${finalFilterGraph},loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11`;
          filterNames.push(`EBU R128 Broadcast Normalization (${targetLUFS} LUFS)`);
        }
      } catch (pass1Err) {
        console.warn("[Loudnorm Pass 1 Fallback]:", pass1Err);
        finalFilterGraph = `${finalFilterGraph},loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11`;
        filterNames.push(`Broadcast Normalization (${targetLUFS} LUFS)`);
      }
    }

    // 8. Broadcast 48,000 Hz Resampling
    if (resample48k) {
      finalFilterGraph += ",aresample=48000";
      filterNames.push("Broadcast 48,000 Hz Sinc Upsampling");
    }

    const ffmpegArgs: string[] = ["-y", "-i", inPath, "-af", finalFilterGraph];

    if (outputFormat === "mp3") {
      ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", `${bitrate}k`, "-ac", "1", outPath);
    } else {
      ffmpegArgs.push("-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1", outPath);
    }

    await runCommand("ffmpeg", ffmpegArgs);

    const cleanedBuffer = await fs.readFile(outPath);
    const mime = outputFormat === "mp3" ? "audio/mp3" : "audio/wav";
    const audioDataUrl = `data:${mime};base64,${cleanedBuffer.toString("base64")}`;

    let durationSeconds = 0;
    try {
      const probeRes = await runCommand("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        outPath,
      ]);
      durationSeconds = parseFloat(probeRes.stdout.trim()) || 0;
    } catch (e) {
      durationSeconds = 0;
    }

    return NextResponse.json({
      success: true,
      audioDataUrl,
      durationSeconds,
      originalSizeBytes: buffer.length,
      cleanedSizeBytes: cleanedBuffer.length,
      format: outputFormat,
      filename: `mastered_${file.name.replace(/\.[^/.]+$/, "")}.${outputFormat}`,
      filtersApplied: filterNames,
      presetUsed: preset,
    });
  } catch (err: any) {
    console.error("[Clean Audio Route Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to master audio" },
      { status: 500 }
    );
  } finally {
    if (tmpDir) {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }
}
