# VoiceScribe — Model Catalog

Quotas change often — treat the numbers below as guidance, and check your provider console for the current limits.

## Transcription (Audio → SRT)

| Engine id | Provider model | Strength |
|---|---|---|
| `groq-whisper-turbo` | `whisper-large-v3-turbo` | Default. Ultra fast, 99+ languages, word timestamps |
| `groq-whisper-v3` | `whisper-large-v3` | Most accurate Whisper; best for difficult audio |
| `gemini-3.5-transcribe` | `gemini-3.5-transcribe` | Dedicated STT, but very low quota (~1 RPM) |
| `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | Recommended Gemini path (highest quota) |
| `gemini-3.5-flash-lite`, `gemini-2.5-flash-lite`, `gemini-*-flash` | same family | High-quota multimodal SRT output |
| `gemini-1.5-flash` (legacy) | → auto-mapped to `gemini-2.5-flash-lite` | Retired model id; kept working via mapping |

Behavior notes (`src/app/api/transcribe/route.ts`):

- **Auto mode** sends no `language` hint — Whisper detects it. If the first window is misdetected as Urdu script while the target is Hindi, affected lines are auto-converted to Devanagari (Groq text model, timestamps untouched).
- **Gap retry**: if Whisper leaves a >12s gap or coverage drops below 60%, one retry with higher temperature runs automatically and the better run wins.
- **Long audio**: the client splits >2.5 min audio into 60s silence-cut WAV chunks and merges results with offsets.
- **Gemini Flash** receives the exact audio duration in its prompt to reduce timestamp drift; plain-text outputs are re-timed proportionally.

## Text transforms (SRT Cleaner)

| Provider | Models (with fallback order) |
|---|---|
| Groq | `openai/gpt-oss-20b` → `openai/gpt-oss-120b` → `qwen/qwen3.8-27b` |
| Gemini | `gemini-3.1-flash-lite` (default), full Flash/Lite family selectable |

`src/app/api/transform-srt/route.ts` sends ~30-cue `ID|text` batches and re-attaches the **original** timestamps, so transforms can never corrupt timing. Missing lines fall back to the original text.

## Text-to-speech (Studio)

Gemini TTS voices (e.g. Kore, Aoede, Zephyr, Puck, Charon, Fenrir, Enceladus and newer Flash TTS models) — managed through the persona system and key pool.
