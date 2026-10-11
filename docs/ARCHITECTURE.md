# VoiceScribe — Architecture

## Overview

Next.js 16 (App Router) + React 19 + Tailwind CSS 4. All tabs stay mounted (hidden with CSS) so long-running transcriptions survive tab switches. API keys live in the browser (`localStorage`); audio/subtitles persist in `IndexedDB`.

## Data flow

```
Browser tab  →  Next.js API route (localhost)  →  Groq / Google cloud
   (UI)            (multipart, batching,           (Whisper / Gemini /
                    retries, SRT assembly)         Flash / TTS)
```

Audio **does** leave your machine for transcription/transforms (that's where the models run). Key/project management and the asset vault never leave the browser.

## API routes (`src/app/api/`)

| Route | Input | Output | Notes |
|---|---|---|---|
| `tts` | text + voice + key | WAV audio | Gemini TTS proxy |
| `master` | parts + filters | mastered WAV | FFmpeg chain, EBU R128 |
| `clean-audio` | audio | cleaned audio | denoise / level / trim |
| `merge-audio` | tracks | concatenated audio | zero-drift concat |
| `transcribe` | audio + engine + language | SRT + timing meta | Whisper/Gemini, gap-retry, Urdu-script fix |
| `transform-srt` | SRT + task + model | transformed SRT | batched `ID\|text` (~30 cues / ~2500 chars, max 15 batches), original timestamps re-attached |
| `build-persona` | 1–2 line character brief | persona JSON | AI voice-character builder (Groq/Gemini text models, same fallback chains) |

## Key libraries (`src/lib/`)

| Module | Role |
|---|---|
| `personas.ts` | Built-in voice personas + Gemini voice catalog |
| `persona-builder-prompt.ts` | AI Character Builder system prompt (Roman Hinglish default) |
| `tts-projects.ts` | Gemini key pool + per-model quota bookkeeping (cycle resets midnight Pacific) |
| `tts-splitter.ts` | Smart script chunker — splits at sentence boundaries |
| `tts-audio-store.ts` | Studio generation history store |
| `srt-chunker.ts` | Parse/build SRT, word-count & duration enforcement, proportional splitting |
| `audio-chunker.ts` | Decode → 16 kHz mono → silence-cut 60s WAV slices (browser-side) |
| `audio-storage.ts` | Asset vault: 20 audios + 20 SRTs, FIFO, `IndexedDB` |
| `pipeline-persist.ts` | Session snapshots: text in `localStorage`, audio blobs in `IndexedDB` |
| `pipeline-store.ts` | Cross-tab handoff helpers (`dataUrlToFile`, part types) |
| `feature-titles.ts` | Renamable tab titles (`localStorage`, live-synced) |
| `title-generator.ts` | Smart vault titles from transcript content |

## Frontend (`src/components/`)

- `page.tsx` orchestrates tabs and persists the pipeline session on every change (restore on load).
- `AudioToSrtTab.tsx` — upload (XHR with real progress events), chunked transcription loop, sync-fix tools.
- `SrtSyncPreview.tsx` — shared mock-player preview (Reel 9:16 / 16:9, transport, karaoke cue list).
- `SrtCleanerTab.tsx` — inputs (SRT/audio/script) + task cards + model pickers + preview.
- `LeftSidebarVault.tsx` — vault tabs with play/copy/download/send-to-tab actions, human-readable source labels.

## Establishing sync honesty

- Upload progress uses only real `XMLHttpRequest.upload` events; completion shows **measured** seconds.
- Transcription progress is elapsed-time based (indeterminate by nature) — labelled as such.
- Whisper word timestamps are ground truth; Gemini Flash timestamps are estimates (see Sync Fix tools).
