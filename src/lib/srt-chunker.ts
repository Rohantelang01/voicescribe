/**
 * SRT Chunker & Subtitle Formatting Engine
 *
 * Designed for Shorts, Reels, TikTok and YouTube educational videos:
 * - Word count per subtitle cue: Strictly 6 to 8 words max.
 * - Time duration per subtitle cue: ~1.5 to 2.0 seconds max.
 * - Supports Word-level timestamps from Whisper and robust Segment-level proportional splitting.
 * - Includes post-processing `enforceSrtLimits` to guarantee limits even after transliteration.
 */

export interface SrtChunkOptions {
  /** Target word count per line (default: 7) */
  targetWordsPerLine?: number;
  /** Maximum words per line (default: 8) */
  maxWordsPerLine?: number;
  /** Minimum words per line before allowing a break on punctuation (default: 5) */
  minWordsPerLine?: number;
  /** Maximum duration per subtitle cue in seconds (default: 2.0) */
  maxDurationSeconds?: number;
  /** Minimum duration per subtitle cue in seconds (default: 0.6) */
  minDurationSeconds?: number;
  /** When true, only word count (5-8 words) is enforced; duration limits are ignored */
  ignoreDuration?: boolean;
}

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface WhisperSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
  words?: WhisperWord[];
}

export interface WhisperResponse {
  text?: string;
  duration?: number;
  segments?: WhisperSegment[];
  words?: WhisperWord[];
}

export interface SrtCue {
  id?: number;
  start: number;
  end: number;
  text: string;
}

const DEFAULT_OPTIONS: Required<SrtChunkOptions> = {
  targetWordsPerLine: 7,
  maxWordsPerLine: 8,
  minWordsPerLine: 5,
  maxDurationSeconds: 2.0,
  minDurationSeconds: 0.6,
  ignoreDuration: false,
};

/**
 * Converts seconds to standard SRT timestamp: 00:00:00,000
 */
export function formatSrtTime(seconds: number): string {
  const safeSec = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const pad = (n: number, z = 2) => String(Math.floor(n)).padStart(z, "0");
  const hrs = pad(safeSec / 3600);
  const mins = pad((safeSec % 3600) / 60);
  const secs = pad(safeSec % 60);
  const ms = String(Math.floor((safeSec % 1) * 1000)).padStart(3, "0");
  return `${hrs}:${mins}:${secs},${ms}`;
}

/**
 * Parses standard SRT timestamp (00:00:00,000 or 00:00:00.000) to seconds
 */
export function parseSrtTime(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().replace(".", ",");
  const parts = cleaned.split(":");
  if (parts.length < 3) return 0;

  const hrs = parseFloat(parts[0]) || 0;
  const mins = parseFloat(parts[1]) || 0;
  const [secsPart, msPart] = parts[2].split(",");
  const secs = parseFloat(secsPart) || 0;
  const ms = parseFloat(msPart) || 0;

  return hrs * 3600 + mins * 60 + secs + ms / 1000;
}

/**
 * Converts an array of timed cues into standard .srt file format
 */
export function cuesToSrt(cues: SrtCue[]): string {
  if (!cues || cues.length === 0) return "";
  return cues
    .map((cue, idx) => {
      const start = formatSrtTime(cue.start);
      const end = formatSrtTime(Math.max(cue.start + 0.2, cue.end));
      return `${idx + 1}\n${start} --> ${end}\n${cue.text.trim()}\n`;
    })
    .join("\n");
}

/**
 * Builds timed cues from precise Whisper word-level timestamps.
 * Enforces 6 to 8 words per line and max 2.0s duration.
 */
export function buildCuesFromWords(
  rawWords: WhisperWord[],
  userOptions?: SrtChunkOptions
): SrtCue[] {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  if (!rawWords || rawWords.length === 0) return [];

  // Clean words (remove empty whitespace tokens)
  const words: WhisperWord[] = rawWords
    .map((w) => ({
      word: w.word ? w.word.trim() : "",
      start: typeof w.start === "number" ? w.start : 0,
      end: typeof w.end === "number" ? w.end : 0,
    }))
    .filter((w) => w.word.length > 0);

  if (words.length === 0) return [];

  const cues: SrtCue[] = [];
  let currentWords: WhisperWord[] = [];

  const flushCurrent = () => {
    if (currentWords.length === 0) return;
    const start = currentWords[0].start;
    const end = Math.max(start + options.minDurationSeconds, currentWords[currentWords.length - 1].end);
    const text = currentWords.map((w) => w.word).join(" ");

    cues.push({
      start,
      end,
      text,
    });
    currentWords = [];
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (currentWords.length === 0) {
      currentWords.push(word);
      continue;
    }

    const firstWord = currentWords[0];
    const lastWord = currentWords[currentWords.length - 1];
    const nextDuration = word.end - firstWord.start;
    const count = currentWords.length;
    const silenceGap = word.start - lastWord.end;

    // Conditions to break into next subtitle cue:
    const reachedMaxWords = count >= options.maxWordsPerLine;
    const reachedMaxDuration = !options.ignoreDuration && nextDuration > options.maxDurationSeconds && count >= options.minWordsPerLine;
    const hasSilencePause = silenceGap >= 0.5 && count >= options.minWordsPerLine;
    const isPunctuationBreak =
      /[.?!]$/.test(lastWord.word) && count >= options.minWordsPerLine;

    if (reachedMaxWords || reachedMaxDuration || hasSilencePause || isPunctuationBreak) {
      flushCurrent();
    }

    currentWords.push(word);
  }

  // Flush remaining words
  if (currentWords.length > 0) {
    if (
      cues.length > 0 &&
      currentWords.length <= 2 &&
      cues[cues.length - 1].text.split(/\s+/).length + currentWords.length <= options.maxWordsPerLine
    ) {
      const prev = cues[cues.length - 1];
      prev.text += " " + currentWords.map((w) => w.word).join(" ");
      prev.end = Math.max(prev.end, currentWords[currentWords.length - 1].end);
    } else {
      flushCurrent();
    }
  }

  return cues;
}

/**
 * Builds timed cues from Whisper segment-level transcripts using proportional time distribution.
 */
export function buildCuesFromSegments(
  segments: WhisperSegment[],
  userOptions?: SrtChunkOptions
): SrtCue[] {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  if (!segments || segments.length === 0) return [];

  const cues: SrtCue[] = [];

  for (const seg of segments) {
    const rawText = (seg.text || "").trim();
    if (!rawText) continue;

    const words = rawText.split(/\s+/).filter(Boolean);
    const segStart = Math.max(0, seg.start);
    const segEnd = Math.max(segStart + 0.1, seg.end);
    const segDuration = segEnd - segStart;

    const segWithinDuration = options.ignoreDuration || segDuration <= options.maxDurationSeconds + 0.2;
    if (words.length <= options.maxWordsPerLine && segWithinDuration) {
      cues.push({
        start: segStart,
        end: segEnd,
        text: rawText,
      });
      continue;
    }

    const targetSize = Math.min(options.maxWordsPerLine, Math.max(options.minWordsPerLine, options.targetWordsPerLine));
    const numChunks = options.ignoreDuration
      ? Math.ceil(words.length / targetSize)
      : Math.max(
          Math.ceil(words.length / targetSize),
          Math.ceil(segDuration / options.maxDurationSeconds)
        );

    const wordsPerChunk = Math.ceil(words.length / numChunks);

    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const startFrac = i / words.length;
      const endFrac = Math.min(1, (i + chunkWords.length) / words.length);

      const chunkStart = segStart + startFrac * segDuration;
      const chunkEnd = segStart + endFrac * segDuration;

      cues.push({
        start: chunkStart,
        end: Math.max(chunkStart + options.minDurationSeconds, chunkEnd),
        text: chunkWords.join(" "),
      });
    }
  }

  return cues;
}

/**
 * Generates an SRT string from Whisper response with 6-8 words and ~2s limits.
 */
export function generateCustomSrt(
  whisperData: WhisperResponse,
  options?: SrtChunkOptions
): string {
  if (whisperData.words && Array.isArray(whisperData.words) && whisperData.words.length > 0) {
    const cues = buildCuesFromWords(whisperData.words, options);
    if (cues.length > 0) {
      return cuesToSrt(cues);
    }
  }

  if (whisperData.segments && Array.isArray(whisperData.segments)) {
    const nestedWords: WhisperWord[] = [];
    for (const seg of whisperData.segments) {
      if (seg.words && Array.isArray(seg.words)) {
        nestedWords.push(...seg.words);
      }
    }
    if (nestedWords.length > 0) {
      const cues = buildCuesFromWords(nestedWords, options);
      if (cues.length > 0) {
        return cuesToSrt(cues);
      }
    }

    const cues = buildCuesFromSegments(whisperData.segments, options);
    return cuesToSrt(cues);
  }

  return "";
}

/**
 * Enforces word count (6-8 words) and time limits (~2.0s) on an existing SRT string.
 */
export function enforceSrtLimits(
  rawSrt: string,
  userOptions?: SrtChunkOptions
): string {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  if (!rawSrt || !rawSrt.trim()) return rawSrt;

  const blocks = rawSrt.split(/(?:\r?\n){2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 0) return rawSrt;

  const resultCues: SrtCue[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const arrowIdx = lines.findIndex((l) => l.includes("-->"));
    if (arrowIdx === -1) continue;

    const timeLine = lines[arrowIdx];
    const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim());
    const startSec = parseSrtTime(startStr);
    const endSec = parseSrtTime(endStr);
    const duration = Math.max(0.1, endSec - startSec);

    const text = lines.slice(arrowIdx + 1).join(" ").trim();
    if (!text) continue;

    const words = text.split(/\s+/).filter(Boolean);
    const withinDuration = options.ignoreDuration || duration <= options.maxDurationSeconds + 0.3;

    if (words.length <= options.maxWordsPerLine && withinDuration) {
      resultCues.push({
        start: startSec,
        end: endSec,
        text,
      });
      continue;
    }

    const targetSize = Math.min(options.maxWordsPerLine, Math.max(options.minWordsPerLine, options.targetWordsPerLine));
    const numChunks = options.ignoreDuration
      ? Math.ceil(words.length / targetSize)
      : Math.max(
          Math.ceil(words.length / targetSize),
          Math.ceil(duration / options.maxDurationSeconds)
        );

    const wordsPerChunk = Math.ceil(words.length / numChunks);

    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const startFrac = i / words.length;
      const endFrac = Math.min(1, (i + chunkWords.length) / words.length);

      const chunkStart = startSec + startFrac * duration;
      const chunkEnd = startSec + endFrac * duration;

      resultCues.push({
        start: chunkStart,
        end: Math.max(chunkStart + options.minDurationSeconds, chunkEnd),
        text: chunkWords.join(" "),
      });
    }
  }

  return cuesToSrt(resultCues);
}

/**
 * Parses any standard .srt string into an array of SrtCue objects
 */
export function parseSrtCues(rawSrt: string): SrtCue[] {
  if (!rawSrt || !rawSrt.trim()) return [];

  const blocks = rawSrt.split(/(?:\r?\n){2,}/).map((b) => b.trim()).filter(Boolean);
  const cues: SrtCue[] = [];

  for (let idx = 0; idx < blocks.length; idx++) {
    const lines = blocks[idx].split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const arrowIdx = lines.findIndex((l) => l.includes("-->"));
    if (arrowIdx === -1) continue;

    const timeLine = lines[arrowIdx];
    const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim());
    const startSec = parseSrtTime(startStr);
    const endSec = parseSrtTime(endStr);
    const text = lines.slice(arrowIdx + 1).join(" ").trim();

    if (text) {
      cues.push({
        id: cues.length + 1,
        start: startSec,
        end: endSec,
        text,
      });
    }
  }

  return cues;
}
