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
    const count = parseInt((formData.get("filesCount") as string) || "0", 10);
    const outputFormat = (formData.get("outputFormat") as string) || "mp3";
    const bitrate = parseInt((formData.get("bitrate") as string) || "320", 10);
    const normalize = formData.get("normalize") === "true";

    if (count === 0) {
      return NextResponse.json({ error: "No audio files provided" }, { status: 400 });
    }

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "audio_studio_merge_"));
    const inputPaths: string[] = [];

    for (let i = 0; i < count; i++) {
      const file = formData.get(`file_${i}`) as File | null;
      if (file && file.size > 0) {
        const ext = path.extname(file.name) || ".mp3";
        const inPath = path.join(tmpDir, `input_${i}${ext}`);
        const buf = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(inPath, buf);
        inputPaths.push(inPath);
      }
    }

    if (inputPaths.length === 0) {
      return NextResponse.json({ error: "Failed to read input files" }, { status: 400 });
    }

    const outPath = path.join(tmpDir, `merged.${outputFormat}`);
    const N = inputPaths.length;
    const ffmpegArgs: string[] = ["-y"];

    for (const p of inputPaths) {
      ffmpegArgs.push("-i", p);
    }

    let filterComplex = "";
    for (let i = 0; i < N; i++) {
      let f = "aresample=24000:async=1";
      if (normalize) {
        f += ",loudnorm=I=-14:TP=-1.5:LRA=11";
      }
      filterComplex += `[${i}:a]${f}[a${i}]; `;
    }

    let concatInputs = "";
    for (let i = 0; i < N; i++) {
      concatInputs += `[a${i}]`;
    }
    filterComplex += `${concatInputs}concat=n=${N}:v=0:a=1[stitched]; [stitched]asetpts=N/SR/TB`;

    if (normalize) {
      filterComplex += `,loudnorm=I=-14:TP=-1.5:LRA=11[out]`;
    } else {
      filterComplex += `[out]`;
    }

    ffmpegArgs.push("-filter_complex", filterComplex, "-map", "[out]");

    if (outputFormat === "mp3") {
      ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", `${bitrate}k`, "-ac", "1", outPath);
    } else {
      ffmpegArgs.push("-c:a", "pcm_s16le", "-ar", "24000", "-ac", "1", outPath);
    }

    await runCommand("ffmpeg", ffmpegArgs);

    const mergedBuffer = await fs.readFile(outPath);
    const mime = outputFormat === "mp3" ? "audio/mp3" : "audio/wav";
    const audioDataUrl = `data:${mime};base64,${mergedBuffer.toString("base64")}`;

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
      sizeBytes: mergedBuffer.length,
      format: outputFormat,
      filename: `merged_${Date.now()}.${outputFormat}`,
      filesMergedCount: N,
    });
  } catch (err: any) {
    console.error("[Merge Audio Route Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to merge audio files" },
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
