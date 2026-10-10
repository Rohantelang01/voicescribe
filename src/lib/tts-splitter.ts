// ─────────────────────────────────────────────────────────────
// tts-splitter.ts
// Smart Script Splitter for Long Audio & Video Content
// Target: Strict 2 to 2.5 Minutes (~350–390 Words) per chunk.
// Cuts cleanly at Paragraph Boundaries or Sentence Full Stops (. ? ! ।)
// Zero Mid-Sentence Cuts!
// ─────────────────────────────────────────────────────────────

export interface ScriptChunk {
  partIndex: number;
  partNumber: number;
  title: string;
  text: string;
  wordCount: number;
  charCount: number;
  estimatedSeconds: number;
  estimatedMinutes: number;
  audioResult?: any;
  status: "idle" | "generating" | "completed" | "error";
  error?: string | null;
}

/**
 * Normalizes raw scripts that have glued punctuation or headings
 */
export function normalizeScriptText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/([.?!।])([A-Za-z\u0900-\u097F])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z][a-z]+:)/g, "$1\n\n$2")
    .trim();
}

/**
 * Splits a full long script into multiple safe parts.
 * Target: ~350 to 390 words per part (~2.2 to 2.7 mins audio).
 * Gemini TTS maintains pristine voice stability, pacing, and presence when capped under 400 words.
 * Cuts ONLY at sentence full-stops (. ? ! ।) or paragraph ends.
 */
export function splitScriptIntoSafeParts(
  rawScript: string,
  targetWordsPerPart = 360,
  maxWordsPerPart = 400
): ScriptChunk[] {
  const normalized = normalizeScriptText(rawScript);
  if (!normalized) return [];

  // Break by paragraphs first (double line breaks)
  const rawParagraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Break paragraphs larger than 65 words into individual sentences
  // keeping sentence terminal punctuation attached
  const atomicUnits: string[] = [];
  for (const para of rawParagraphs) {
    const pWords = para.split(/\s+/).length;
    if (pWords > 65) {
      const sentences = para
        .split(/(?<=[.?!।]["']?)\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      atomicUnits.push(...sentences);
    } else {
      atomicUnits.push(para);
    }
  }

  const chunks: { text: string; wordCount: number }[] = [];
  let currentUnitList: string[] = [];
  let currentWordCount = 0;

  for (let i = 0; i < atomicUnits.length; i++) {
    const unit = atomicUnits[i];
    const unitWordCount = unit.split(/\s+/).length;

    // Check if adding this unit crosses targetWordsPerPart
    if (currentWordCount + unitWordCount > targetWordsPerPart && currentUnitList.length > 0) {
      chunks.push({
        text: currentUnitList.join("\n\n").trim(),
        wordCount: currentWordCount,
      });
      currentUnitList = [unit];
      currentWordCount = unitWordCount;
    } else {
      currentUnitList.push(unit);
      currentWordCount += unitWordCount;
    }
  }

  // Push remaining units
  if (currentUnitList.length > 0) {
    if (
      chunks.length > 0 &&
      currentWordCount < 60 &&
      chunks[chunks.length - 1].wordCount + currentWordCount <= maxWordsPerPart
    ) {
      const last = chunks[chunks.length - 1];
      last.text = `${last.text}\n\n${currentUnitList.join("\n\n").trim()}`;
      last.wordCount += currentWordCount;
    } else {
      chunks.push({
        text: currentUnitList.join("\n\n").trim(),
        wordCount: currentWordCount,
      });
    }
  }

  // Convert to ScriptChunk objects with titles and telemetry
  return chunks.map((chunk, idx) => {
    const partNum = idx + 1;
    const firstLine = chunk.text.split("\n")[0] || "";
    const cleanFirstLine = firstLine
      .replace(/\[.*?\]/g, "")
      .replace(/^#+\s*/, "")
      .trim();

    let titleSnippet = cleanFirstLine.slice(0, 45).trim();
    if (cleanFirstLine.length > 45) titleSnippet += "...";

    const estSec = Math.round(chunk.wordCount / 2.2); // ~132 WPM delivery
    const estMin = +(estSec / 60).toFixed(1);

    return {
      partIndex: idx,
      partNumber: partNum,
      title: `Part ${partNum}: ${titleSnippet || `Segment ${partNum}`}`,
      text: chunk.text,
      wordCount: chunk.wordCount,
      charCount: chunk.text.length,
      estimatedSeconds: estSec,
      estimatedMinutes: estMin,
      status: "idle",
      error: null,
    };
  });
}
