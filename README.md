# 🎙️ Audio Studio — Open-Source AI Voiceover & Audio Mastering Suite

A fast, private, and customizable audio production suite for content creators, podcasters, and video makers. Built with Next.js 16, Tailwind CSS v4, local FFmpeg, Google Gemini TTS, and Groq Whisper.

---

## ✨ Features at a Glance

- **🔑 Unlimited Gemini API Keys Pool**: Add as many Google Cloud / Gemini API keys as you want with a single click. Rotate across projects to multiply your daily free generation quotas.
- **⚡ Direct On-Screen Quick Switchers**: Switch your active Gemini API key, TTS model, or character persona directly from the top bar or inside each audio box—no digging into settings menus!
- **🎭 Custom Voice Persona Builder**: Create, edit, and duplicate your own AI voice characters. Customize voice tones, age, gender, speed/pacing, directorial prompts, and script templates.
- **📤 Export & Share Personas**: Download custom characters as JSON files and share them with the community or import characters created by others.
- **⏱️ Smart 2–3 Minute Script Chunker**: Splits long scripts (10–60+ minutes) into optimal ~360-word boxes strictly at sentence full-stops (`.`, `?`, `!`, `।`) to prevent voice attention degradation.
- **🎛️ Local FFmpeg Mastering Chain**:
  - Sequential zero-drift concatenation.
  - 80Hz high-pass de-rumble filter.
  - FFT background noise reduction (`afftdn` for fan, AC, and mic hiss).
  - Dynamic vocal leveling (`dynaudnorm`).
  - EBU R128 loudness normalization (-14 LUFS for YouTube, Spotify, and Podcasts).
  - Silence gap trimming (removes dead air > 0.5s).
- **📝 Dual-Engine Subtitle Transcriber**:
  - **Groq Whisper Large v3 Turbo** (Sub-second speed, 2,000 free requests/day, 8h/day audio).
  - **Gemini 3.5 Transcribe** (Google AI word-level timestamps).
- **📱 5–8 Words/Cue Roman Hinglish Subtitles**: Subtitle cues formatted strictly to 5–8 words per line in conversational Roman letters (`"Namaste dosto aaj hum..."`) tailored for high-retention Reels, Shorts, and TikTok.
- **🔒 100% Client-Side Privacy**: All API keys, personas, and audio tracks are saved locally in your browser (`LocalStorage` and `IndexedDB`). Nothing is sent to any third-party database.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
Ensure you have **Node.js 18+**, **pnpm** (or npm), and **FFmpeg** installed:

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg
```

### 2. Clone & Install

```bash
git clone https://github.com/your-username/audio-studio.git
cd audio-studio
pnpm install
```

### 3. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Getting Free API Keys

Audio Studio is designed to run entirely on **100% free-tier cloud APIs**:

1. **Google Gemini TTS**:
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Create an API key.
   - You can create multiple Google Cloud projects to get **10 free requests per model per day** on each project.
   - Supported models:
     - `Gemini 2.5 Flash TTS`
     - `Gemini 3.1 Flash TTS`
     - `Gemini 3.8 Flash TTS`
     - `Gemini 3.8 Flash Lite TTS`

2. **Groq (Whisper Subtitles)**:
   - Go to [Groq Console](https://console.groq.com/keys).
   - Create a free account.
   - Enjoy **2,000 free transcription requests per day** with sub-second latency.

---

## 🎙️ Available Gemini TTS Voices

| Voice | Gender | Tone & Style | Best Used For |
| :--- | :---: | :--- | :--- |
| **Kore** | Female | Warm, lower-medium pitch, rich chest resonance | Documentaries, History, Deep Explainers |
| **Aoede** | Female | Breezy, natural conversational, upbeat | Finance, Tutorials, Vlogs, Commercials |
| **Zephyr** | Female | Soft, gentle, compassionate, steady | Meditation, Bedtime Stories, Guides |
| **Puck** | Male | Energetic, youthful, punchy, casual | Tech Reviews, Gaming, YouTube Shorts |
| **Charon** | Male | Deep, authoritative, grave baritone | Horror, Thriller, True Crime, Movie Trailers |
| **Fenrir** | Male | Resonant, articulate narrative presence | Audiobooks, Biography, Philosophy |
| **Enceladus** | Male | Crisp, bold, executive presentation tone | News reporting, Tech pitches, Announcements |

---

## 🛠️ Project Structure

```
audio-studio/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── tts/             # Gemini TTS PCM-to-WAV proxy
│   │   │   ├── master/          # FFmpeg multi-part mastering & concat
│   │   │   ├── clean-audio/     # FFmpeg standalone denoiser & leveler
│   │   │   ├── merge-audio/     # FFmpeg audio track concat
│   │   │   └── transcribe/      # Dual-engine Groq Whisper & Gemini 3.5
│   │   ├── page.tsx             # Main orchestrator
│   │   └── layout.tsx           # Off-white light theme container
│   ├── components/
│   │   ├── Header.tsx           # Quick key/model/character toolbar & tabs
│   │   ├── ApiKeyModal.tsx      # Unlimited API keys manager & quota tracker
│   │   ├── PersonaModal.tsx     # Custom AI character & voice builder
│   │   ├── StudioTab.tsx        # Voiceover production studio & chunker
│   │   ├── AudioToSrtTab.tsx    # Dual-engine subtitle generator
│   │   ├── AudioCleanerTab.tsx  # FFmpeg audio enhancer
│   │   ├── AudioMergerTab.tsx   # Track combiner
│   │   └── SrtCleanerTab.tsx    # Shorts/Reels subtitle re-chunker
│   └── lib/
│       ├── personas.ts          # Persona registry & JSON import/export
│       ├── tts-projects.ts      # Multi-key pool & quota management
│       ├── tts-splitter.ts      # Strict 2–3 min script chunker
│       ├── srt-chunker.ts       # 5–8 words/cue subtitle processor
│       └── tts-audio-store.ts   # IndexedDB audio & draft storage
├── public/
├── start.sh                     # Linux/Mac launcher script
└── package.json
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to open an issue or pull request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
