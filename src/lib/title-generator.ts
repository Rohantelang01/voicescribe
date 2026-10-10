/**
 * Smart Title Generator for Audio & Subtitle files
 * Extracts a concise 3 to 5 word topic title from script text or speech transcripts.
 */

const STOP_WORDS = new Set([
  "namaste", "hello", "hi", "doston", "dosto", "friends", "guys",
  "aaj", "aajke", "is", "video", "me", "hum", "baat", "karenge",
  "welcome", "back", "to", "my", "channel", "in", "this", "today",
  "we", "are", "going", "discuss", "about", "yeh", "hai", "kya", "aur",
  "shuru", "karte", "hain", "so", "let", "start", "watch", "until", "end"
]);

/**
 * Generates a clean 3-5 word title from text content (Hindi, Hinglish, or English)
 */
export function generateSmartTitle(text: string, fallbackPrefix = "Audio Track"): string {
  if (!text || !text.trim()) {
    return `${fallbackPrefix} #${Math.floor(100 + Math.random() * 900)}`;
  }

  // Clean lines & special chars
  const firstChunk = text.trim().split(/[\n\.\?\!।]+/)[0] || text.trim();
  const words = firstChunk
    .replace(/[^\w\s\u0900-\u097F]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return `${fallbackPrefix} #${Math.floor(100 + Math.random() * 900)}`;
  }

  // Filter conversational intros/stop words
  const meaningfulWords = words.filter(
    (w) => !STOP_WORDS.has(w.toLowerCase().trim())
  );

  const selected = meaningfulWords.length >= 3 ? meaningfulWords : words;
  const titleWords = selected.slice(0, 5);

  let formattedTitle = titleWords
    .map((w) => {
      // Capitalize first letter of Latin words, keep Devanagari intact
      if (/^[a-zA-Z]/.test(w)) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
      return w;
    })
    .join(" ");

  if (formattedTitle.length > 40) {
    formattedTitle = formattedTitle.slice(0, 37).trim() + "...";
  }

  return formattedTitle || `${fallbackPrefix} #${Math.floor(100 + Math.random() * 900)}`;
}
