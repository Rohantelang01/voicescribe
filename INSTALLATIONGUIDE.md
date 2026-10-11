# VoiceScribe — Installation Guide

Is guide me VoiceScribe ko apne system par install aur run karne ke **poore steps** hain — Linux, macOS aur Windows teenon ke liye.

**Time needed:** ~10–15 minutes (internet speed par depend karta hai).

---

## 1. Aapko kya-kya chahiye (Prerequisites)

| Tool | Minimum version | Kyun chahiye |
|---|---|---|
| **Node.js** | **20.19+** (`node --version` se check karo) | App chalane ke liye (Next.js 16 ki requirement hai — Node 18 kaam **nahi** karega) |
| **pnpm** | 10+ (repo `pnpm@11.3.0` use karta hai) | Dependencies install karne ke liye (npm se bhi chalega) |
| **FFmpeg** | koi bhi recent version | Audio denoise / mastering / merging — ye **server-side** chalta hai, iske bina Cleaner, Merger aur Studio mastering kaam nahi karenge |
| **Git** | koi bhi recent version | Code download / update karne ke liye |
| **Browser** | Chrome / Edge / Firefox (latest) | App browser me chalti hai |

> **Note:** Transcription aur AI features ke liye **free API keys** bhi chahiye hongi (Groq + Gemini) — uska step [Section 5](#5-api-keys-lagao-groq--gemini) me hai. Pehle app install kar lete hain.

---

## 2. Node.js, pnpm, FFmpeg aur Git install karo

Apne OS ke hisaab se **sirf ek** section follow karo.

### 2A. Ubuntu / Debian / Linux Mint / Pop!_OS

```bash
# System update
sudo apt update && sudo apt upgrade -y

# Git + FFmpeg
sudo apt install -y git ffmpeg

# Node.js 20+ (NodeSource se — Ubuntu ka default repo purana Node de sakta hai)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm (Corepack ke through — Node ke saath aata hai)
sudo corepack enable
corepack prepare pnpm@11.3.0 --activate

# Verify — teenon me version dikhna chahiye
node --version   # v20.19+ ya v22+
pnpm --version   # 11.x
ffmpeg -version  # version line dikhe
```

`curl` na ho to pehle `sudo apt install -y curl` chala lo.

### 2B. Fedora / RHEL / CentOS

```bash
sudo dnf install -y git ffmpeg
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash -
sudo dnf install -y nodejs
sudo corepack enable
corepack prepare pnpm@11.3.0 --activate
node --version && pnpm --version && ffmpeg -version
```

### 2C. Arch / Manjaro

```bash
sudo pacman -Syu --noconfirm git ffmpeg nodejs npm
sudo corepack enable
corepack prepare pnpm@11.3.0 --activate
node --version && pnpm --version && ffmpeg -version
```

> Agar Arch repo wala Node 20.19+ hai to bas — alag se kuch nahi chahiye.

### 2D. macOS

```bash
# Homebrew (na ho to: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)")
brew install git node ffmpeg
corepack enable
corepack prepare pnpm@11.3.0 --activate

node --version && pnpm --version && ffmpeg -version
```

### 2E. Windows 10 / 11

**Option 1 — winget (recommended, sabse aasaan):**

```powershell
winget install OpenJS.NodeJS.LTS Git.Git Gyan.FFmpeg
# Terminal band karke dobara kholo, phir:
corepack enable
corepack prepare pnpm@11.3.0 --activate
node --version
pnpm --version
ffmpeg -version
```

**Option 2 — manual:** [nodejs.org](https://nodejs.org) se LTS installer, [git-scm.com](https://git-scm.com) se Git, aur [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) se FFmpeg (ffmpeg-release-essentials.zip) download karke `bin` folder ko PATH me add karo.

> Windows par aage ke saare commands **PowerShell ya Git Bash** me chalao. `start.sh` Linux/macOS ke liye hai — Windows par seedha `pnpm dev` use karo (Section 4 dekho).

---

## 3. Project download karo (Clone)

```bash
git clone https://github.com/<your-username>/voicescribe.git
cd voicescribe
```

> `<your-username>` ko apne GitHub username se replace karo.

---

## 4. Dependencies install karo aur app chalao

```bash
# Project folder ke andar
pnpm install
```

Ye `node_modules/` me saari dependencies download karega (pehli baar 2–5 min lag sakte hain).

### Development mode me chalao (normal use ke liye yahi)

```bash
pnpm dev
```

Phir browser me kholo: **[http://localhost:3000](http://localhost:3000)**

**Linux/macOS shortcut:** `./start.sh` — ye dev server start karke browser bhi khol deta hai:

```bash
chmod +x start.sh   # sirf pehli baar
./start.sh
```

### Production mode (thoda fast, deploy jaisa)

```bash
pnpm build
pnpm start
```

Phir wahi [http://localhost:3000](http://localhost:3000) kholo.

| Command | Kya karta hai |
|---|---|
| `pnpm dev` | Development server (code change par auto-reload) |
| `pnpm build` | Production build banata hai — error aaye to code me problem hai |
| `pnpm start` | Bane hue production build ko serve karta hai |
| `pnpm lint` | Code check (contribute karne se pehle chalao) |

---

## 5. API Keys lagao (Groq + Gemini)

Bina keys ke app khulegi, lekin **Transcribe / Transform / Studio** kaam nahi karenge. Dono keys **free** hain:

| Key | Kahan se milegi | Format | Kis kaam ki |
|---|---|---|---|
| **Groq** | [console.groq.com/keys](https://console.groq.com/keys) — free signup → *Create API Key* | `gsk_…` | Whisper transcription + text transforms |
| **Gemini** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — *Get API Key* | `AIza…` | Voiceover Studio (TTS), transcription backup, transforms |

**App me add karne ke steps:**

1. [http://localhost:3000](http://localhost:3000) kholo.
2. Upar header me **Keys** button dabao.
3. Groq key paste karo → Save. Gemini ke liye **Add Project** → key paste karo → Save.
4. **Tip:** Multiple Gemini projects add karne se daily free quota multiply ho jata hai (quota reset: midnight Pacific Time).

> **Privacy:** Keys sirf tumhare browser ke `localStorage` me rehti hain — kahin upload nahi hotin. Lekin dhyan rahe: jab Generate/Transcribe dabate ho, tab audio/text Groq/Google ke servers par jata hai (model wahin chalta hai). Vault aur session data browser se bahar nahi jata.

---

## 6. Pehli baar chal gaya? Quick check ✅

1. `http://localhost:3000` par 5 numbered tabs dikhen: **1. Voiceover Studio, 2. Audio Merger, 3. Audio Cleaner, 4. Audio to SRT, 5. SRT Cleaner**.
2. **4. Audio to SRT** me koi chhoti MP3/WAV upload karke engine `Groq Whisper Large v3 Turbo` se transcribe karo — SRT aana chahiye.
3. Left sidebar me **Vault** me file save dikhni chahiye (page reload karke bhi rehni chahiye).

Aage kya karna hai, ye [`docs/USAGE.md`](docs/USAGE.md) me step-by-step likha hai.

---

## 7. Common problems (Troubleshooting)

| Problem | Fix |
|---|---|
| `node: command not found` ya version purana (< 20.19) | Section 2 se Node 22 dobara install karo, terminal restart karo |
| `pnpm: command not found` | `corepack enable` + `corepack prepare pnpm@11.3.0 --activate` chalao |
| `ffmpeg: command not found` (Cleaner/Merger fail) | FFmpeg install karo (Section 2) aur terminal restart karo; verify: `ffmpeg -version` |
| Port 3000 already in use | `pnpm dev -p 3001` se doosre port par chalao → `http://localhost:3001` |
| `pnpm install` me network error | `pnpm store prune` karke retry karo; proxy/VPN ho to temporarily off karo |
| Transcribe par 429 / quota error | Gemini me `*-lite` model chuno, ya Groq `gpt-oss-20b`; detail: [`docs/MODELS.md`](docs/MODELS.md) |
| Windows par `./start.sh` nahi chalta | Normal hai — PowerShell me `pnpm dev` chalao aur browser manually kholo |
| macOS par `./start.sh` browser nahi kholta | Koi baat nahi — manually `http://localhost:3000` khol lo |
| Page reload par data gayab? | Normal use me session auto-restore hota hai; private/incognito window me storage persist nahi hota — normal window use karo |

---

## 8. App update karna (baad me)

```bash
cd voicescribe
git pull
pnpm install   # nayi dependencies ho to
pnpm dev
```

---

## Aur docs

- [`README.md`](README.md) — features overview
- [`docs/USAGE.md`](docs/USAGE.md) — har tab ka step-by-step workflow
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data flow, API routes, storage design
- [`docs/MODELS.md`](docs/MODELS.md) — AI models, quotas, fallback chains
