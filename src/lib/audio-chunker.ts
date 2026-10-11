/**
 * Audio Chunker — lambi audio ko 60s WAV (16kHz mono) tukdon me baantna.
 *
 * Kyun: Whisper audio ko andar hi andar 30s windows me chalata hai aur lambi
 * file me beech ke windows kabhi drop kar deta hai (10-40s gayab, baaki sync).
 * Chhote tukde bhejne par har tukda poora transcribe hota hai — miss ki gunjaish
 * lagbhag khatam. Cut hamesha khamoshi (silence) par lagta hai taaki shabd na kate.
 */

export interface AudioChunk {
  blob: Blob;
  fileName: string;
  /** Poori audio me is tukde ki shuruaat (seconds) — timestamps me jodne ke liye */
  offsetSec: number;
  durationSec: number;
  index: number;
  total: number;
}

export class ChunkDecodeError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ChunkDecodeError";
  }
}

const TARGET_SR = 16000;
const FRAME_SEC = 0.25; // energy napne ki khidki
const SILENCE_ABS = 0.06; // isse kam avg amplitude = khamoshi
const MIN_CHUNK_SEC = 30; // tukda kam se kam itna lamba

function encodeWav16Mono(samples: Float32Array, sampleRate: number): Blob {
  const len = samples.length;
  const buffer = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + len * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, "data");
  v.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * File ko decode karke `targetChunkSec` ke khamoshi-cut tukdon me baanto.
 * Har tukda 16kHz mono WAV hota hai (Whisper ki pasandida diet + chhota upload).
 */
export async function splitAudioToChunks(
  file: File,
  targetChunkSec = 60
): Promise<{ chunks: AudioChunk[]; totalDuration: number }> {
  if (typeof window === "undefined") {
    throw new ChunkDecodeError("Browser me hi chunking ho sakti hai");
  }
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new ChunkDecodeError("Is browser me audio decode support nahi hai");

  const raw = await file.arrayBuffer();
  const ctx = new AC();
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(raw);
  } catch {
    throw new ChunkDecodeError("Audio decode nahi ho paya — single-pass se try hoga");
  } finally {
    try {
      await ctx.close();
    } catch {
      /* ignore */
    }
  }

  const totalDuration = buf.duration;
  if (!totalDuration || !isFinite(totalDuration)) {
    throw new ChunkDecodeError("Audio duration pata nahi chali");
  }

  // Mono mix + 16kHz downsample (seedha average — speech ke liye kaafi)
  const ch0 = buf.getChannelData(0);
  const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
  const ratio = buf.sampleRate / TARGET_SR;
  const totalMono = Math.max(1, Math.floor(buf.length / ratio));
  const mono = new Float32Array(totalMono);
  for (let i = 0; i < totalMono; i++) {
    const s = Math.min(buf.length - 1, Math.floor(i * ratio));
    mono[i] = ch1 ? (ch0[s] + ch1[s]) / 2 : ch0[s];
  }

  // Energy frames (khamoshi dhoondhne ke liye)
  const frameSamples = Math.floor(TARGET_SR * FRAME_SEC);
  const frameCount = Math.max(1, Math.floor(totalMono / frameSamples));
  const energy = new Float32Array(frameCount);
  for (let f = 0; f < frameCount; f++) {
    const start = f * frameSamples;
    const end = Math.min(totalMono, start + frameSamples);
    let sum = 0;
    for (let i = start; i < end; i++) sum += Math.abs(mono[i]);
    energy[f] = sum / Math.max(1, end - start);
  }
  const energyAt = (sec: number): number => {
    const idx = Math.floor(sec / FRAME_SEC);
    if (idx < 0 || idx >= frameCount) return Infinity;
    return energy[idx];
  };

  // Cut points: nominal har targetChunkSec, ± me sabse khamosh jagah
  const cuts: number[] = [0];
  const n = Math.ceil(totalDuration / targetChunkSec);
  for (let i = 1; i < n; i++) {
    const nominal = (totalDuration * i) / n;
    const prev = cuts[cuts.length - 1];
    let best = nominal;
    let bestE = energyAt(nominal);
    for (let t = Math.max(prev + MIN_CHUNK_SEC, nominal - 4); t <= nominal + 2; t += FRAME_SEC) {
      if (t <= prev + 5 || t >= totalDuration - 5) continue;
      const e = energyAt(t);
      if (e < bestE) {
        bestE = e;
        best = t;
      }
    }
    // Sirf tabhi shift karo jab sahi me khamoshi mili, warna nominal par kato
    cuts.push(bestE < SILENCE_ABS ? best : nominal);
  }
  cuts.push(totalDuration);

  const chunks: AudioChunk[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const sSec = cuts[i];
    const eSec = cuts[i + 1];
    if (eSec - sSec < 5) continue; // bahut chhota tukda bekar
    const sSample = Math.floor((sSec / totalDuration) * totalMono);
    const eSample = Math.min(totalMono, Math.floor((eSec / totalDuration) * totalMono));
    const blob = encodeWav16Mono(mono.slice(sSample, eSample), TARGET_SR);
    chunks.push({
      blob,
      fileName: `chunk-${i + 1}-of-${cuts.length - 1}.wav`,
      offsetSec: sSec,
      durationSec: eSec - sSec,
      index: i,
      total: cuts.length - 1,
    });
  }
  if (!chunks.length) throw new ChunkDecodeError("Tukde nahi ban paye");

  // total sahi karo (chhote tukde skip hue hon to)
  chunks.forEach((c, i) => {
    c.index = i;
    c.total = chunks.length;
  });
  return { chunks, totalDuration };
}
