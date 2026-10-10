// ─────────────────────────────────────────────────────────────
// pipeline-store.ts
// Shared Studio Pipeline for Seamless Audio & Subtitle Handoffs
// ─────────────────────────────────────────────────────────────

export interface PipelineVoiceoverPart {
  id: string;
  partNumber: number;
  title: string;
  dataUrl: string;
  durationSeconds: number;
}

/**
 * Converts a base64 / dataURL into a standard browser File object
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "audio/wav";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}
