# VoiceScribe — Usage Guide

The app is a 5-step pipeline. Each tab hands its output to the next via the **Send ➔** buttons, and the **Asset Vault** (left sidebar) keeps everything.

## The pipeline

```
1. Studio  →  2. Merger  →  3. Cleaner  →  4. Audio to SRT  →  5. SRT Cleaner
 (TTS)        (combine)      (denoise)      (transcribe)         (transform)
```

You can also enter at any step by uploading your own files.

## 1. Studio (voiceover)

1. Add API keys via **Keys** (Gemini key pool + Groq key).
2. Pick a voice persona, paste your script, generate parts.
3. Use **Send to Audio to SRT ➔** to forward audio (your exact script travels with it).

## 2. Audio to SRT (transcription)

1. Upload audio (or receive it from the pipeline).
2. Pick an engine (Groq Turbo is the fastest default).
3. **Language**: *Auto Detect* (recommended) or *Manual Select*.
4. For audio longer than ~2.5 minutes, **📦 chunked transcription** turns on automatically — it splits audio into 60-second silence-cut pieces so no middle section goes missing.
5. Generate, then verify sync in the **Live Sync Preview** (play the audio, watch cues highlight).
6. If timing drifts: open **🔧 Sync Fix** → *Proportional Re-time* (instant fix), or nudge with ±seconds / stretch.
7. **Send to 5. SRT Cleaner ➔** forwards the SRT *plus* its audio.

## 3. SRT Cleaner (transform)

1. SRT, audio and (if it came from Studio) your exact script arrive pre-filled. External audio? Paste your script manually.
2. Choose a task: **Hindi → Roman** (Devanagari to Roman Hinglish), **Roman → Hindi** (Roman to Devanagari), **Translate EN / HI**, **Clean + Fix** (uses your script as ground truth), **Viral Captions**, or **Custom** with your own instruction.
3. Pick provider (Groq / Gemini) and model, then **Transform SRT**.
4. Timestamps are locked — only text changes. Verify in the preview, then Copy/Download.

## Tips

- **Missing middle section in long audio?** Re-run with chunked mode on — each 60s slice is transcribed independently.
- **Urdu script in Hindi output?** Whisper's auto-detect sometimes guesses Urdu for the first window. An auto-fix converts those lines to Devanagari; otherwise use the one-click fix banner.
- **Quota errors (429)?** Switch to a *-lite* Gemini model or GPT-OSS-20B on Groq — both have generous free quotas.
- Everything auto-saves: reload the page and your pipeline is restored.
