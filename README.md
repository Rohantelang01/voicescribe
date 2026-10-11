<div align="center">

<img src="public/logo.svg" alt="VoiceScribe logo" width="96" />

# VoiceScribe

**From voice to viral subtitles — transcribe, sync, transform.**

Open-source AI audio suite for creators: voiceover studio, audio cleanup, fast speech-to-SRT transcription, live sync preview, and subtitle transformation for Reels, Shorts & podcasts. Hindi-first, but multilingual by design.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-61dafb)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)
![License: MIT](https://img.shields.io/badge/License-MIT-amber)

</div>

---

## ✨ Features

### 1. Voiceover Studio
- Multi-project **Gemini API key pool** with per-model quota tracking and one-click rotation.
- **Custom voice personas** (tone, age, pacing, directorial prompts) with JSON import/export — plus a one-click **AI Character Builder prompt**: paste it into ChatGPT/Claude/Gemini, answer its questions, import the JSON it returns (Roman-Hinglish voicing enforced by default).
- **Smart script chunker** — splits long scripts at sentence boundaries so voice quality never degrades.
- **Local FFmpeg mastering chain**: de-rumble, noise reduction (`afftdn`), vocal leveling, EBU R128 loudness normalization, silence trimming.

### 2. Audio Cleaner & Merger
- One-click denoise/level/normalize for any recording.
- Combine multiple voiceover parts with zero-drift concatenation.

### 3. Audio → SRT Transcription
- **Groq Whisper** (`whisper-large-v3-turbo`, `whisper-large-v3`) with word-level timestamps.
- **Gemini** dedicated transcribe model + Flash multimodal models (see [`docs/MODELS.md`](docs/MODELS.md)).
- **Auto language detect** or manual selection across **25 languages** (Hindi, Hinglish-Roman, English + 22 more).
- **Chunked transcription** for long audio (60s silence-cut WAV slices) — prevents the well-known Whisper "skipped middle chunk" problem.
- **Sync Fix toolkit**: proportional re-time, ±offset, timeline stretch, plus a **Live Sync Preview** (Reel 9:16 / 16:9 mock player with karaoke transcript).

### 4. SRT Transformer & Cleaner
- One click: **Devanagari ↔ Roman Hinglish**, **translation**, **grammar cleanup against your exact script**, **viral caption styling**, or **fully custom instructions**.
- Timestamps are **locked** — only subtitle text changes, never timing.
- Runs on Groq (GPT-OSS, Qwen) and Gemini Flash text models with automatic fallback.

### 5. Asset Vault & Sessions
- Last 20 audios + 20 SRTs auto-saved in **IndexedDB** (FIFO), with readable titles, source labels, sizes and dates.
- **Reload-proof sessions** — your pipeline (audio, SRT, script, active tab) survives refresh and tab switches; long tasks keep running in the background.

---

## 🚀 Quickstart

### Prerequisites
- **Node.js 20.19+** (Next.js 16 requirement — check with `node --version`), **pnpm 10+** (or npm), **FFmpeg**, **Git**

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg
```

### Install & Run

```bash
git clone https://github.com/<your-username>/voicescribe.git
cd voicescribe
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Or use the launcher:

```bash
./start.sh
```

---

## 🔑 API Keys (all free-tier friendly)

Keys are stored **only in your browser** (`localStorage`) — they never touch any database of ours.

| Provider | Where to get it | Used for |
|---|---|---|
| [Groq Console](https://console.groq.com/keys) | Free account → API key (`gsk_…`) | Whisper transcription + GPT-OSS/Qwen text transforms |
| [Google AI Studio](https://aistudio.google.com/app/apikey) | Free API key (`AIza…`) | Gemini TTS, transcription & text models |

Add them via the **Keys** button in the header. You can add multiple Gemini projects to multiply daily quotas.

> **Privacy note:** transcription and AI transforms run on Groq/Google servers, so audio/text is sent to those providers when you click Generate/Transform. Everything else (keys, vault, session) stays in your browser.

---

## 🧠 Transcription Engines

| Engine | Speed | Notes |
|---|---|---|
| Groq `whisper-large-v3-turbo` | Ultra fast (default) | 99+ languages, word timestamps |
| Groq `whisper-large-v3` | Slower, most accurate | Best for difficult audio |
| Gemini `3.5-transcribe` | Dedicated STT | Very low quota — use sparingly |
| Gemini Flash / Lite family | Fast | Direct SRT output, high quotas |

Details, quotas and fallback chains: [`docs/MODELS.md`](docs/MODELS.md).

---

## 🛠️ Project Structure

```
voicescribe/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── tts/              # Gemini TTS proxy
│   │   │   ├── master/           # FFmpeg multi-part mastering
│   │   │   ├── clean-audio/      # FFmpeg denoise & level
│   │   │   ├── merge-audio/      # Track concatenation
│   │   │   ├── transcribe/       # Whisper + Gemini transcription
│   │   │   ├── transform-srt/    # Subtitle text transforms (timestamps locked)
│   │   │   └── build-persona/    # AI voice-character builder (JSON personas)
│   │   ├── page.tsx              # Tab orchestrator + session persistence
│   │   └── layout.tsx            # App metadata & theme
│   ├── components/
│   │   ├── Header.tsx            # Brand, numbered tabs, keys entry
│   │   ├── ApiKeyModal.tsx       # Key pool & quota manager
│   │   ├── PersonaModal.tsx      # Voice persona builder
│   │   ├── StudioTab.tsx         # Voiceover production studio
│   │   ├── StudioAudioPlayer.tsx # Studio playback engine
│   │   ├── AudioHistoryModal.tsx # Past studio generations browser
│   │   ├── AudioCleanerTab.tsx   # Audio enhancer
│   │   ├── AudioMergerTab.tsx    # Track combiner
│   │   ├── AudioToSrtTab.tsx     # Transcription + sync fix + preview
│   │   ├── SrtCleanerTab.tsx     # SRT transformer
│   │   ├── SrtSyncPreview.tsx    # Shared live sync preview player
│   │   ├── LeftSidebarVault.tsx  # Asset vault sidebar
│   │   └── ...
│   └── lib/
│       ├── personas.ts           # Built-in voice personas & voice catalog
│       ├── persona-builder-prompt.ts # AI Character Builder system prompt
│       ├── tts-projects.ts       # Gemini key pool + quota bookkeeping
│       ├── tts-splitter.ts       # Smart script chunker (sentence boundaries)
│       ├── tts-audio-store.ts    # Studio generation history store
│       ├── srt-chunker.ts        # SRT build / parse / limit engine
│       ├── audio-chunker.ts      # 60s silence-cut WAV splitter
│       ├── audio-storage.ts      # IndexedDB asset vault (20+20 FIFO)
│       ├── pipeline-persist.ts   # Reload-proof session snapshots
│       ├── pipeline-store.ts     # Cross-tab handoff helpers
│       ├── feature-titles.ts     # Renamable tab titles (localStorage)
│       ├── title-generator.ts    # Smart titles for vault items
│       └── ...
├── docs/
│   ├── USAGE.md                  # End-to-end workflow guide
│   ├── ARCHITECTURE.md           # Data flow & API reference
│   └── MODELS.md                 # Model catalog, quotas & fallbacks
├── public/
│   ├── logo.svg                  # Brand mark
│   └── favicon.svg               # Browser icon
└── start.sh                      # Linux/macOS launcher
```

---

## 📚 Docs

- [`INSTALLATIONGUIDE.md`](INSTALLATIONGUIDE.md) — install on your system, step by step (Linux / macOS / Windows)
- [`docs/USAGE.md`](docs/USAGE.md) — step-by-step workflows for each tab
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data flow, API routes, storage
- [`docs/MODELS.md`](docs/MODELS.md) — engines, quotas, fallback behavior

---

## 🤝 Contributing

Issues and pull requests are welcome. For larger changes, please open an issue first to discuss what you'd like to change.

```bash
pnpm lint     # ESLint
pnpm build    # Production build check
```

---

## 📄 License

MIT — see [LICENSE](LICENSE).
