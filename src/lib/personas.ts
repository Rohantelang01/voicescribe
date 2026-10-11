// ─────────────────────────────────────────────────────────────
// personas.ts
// Dynamic AI Voice Persona Registry for Audio Studio
// Fully customizable, user-editable, stored in LocalStorage
// ─────────────────────────────────────────────────────────────

export interface GeminiVoiceInfo {
  id: string;
  name: string;
  gender: "Female" | "Male";
  tone: string;
  bestFor: string;
}

export const GEMINI_VOICES: GeminiVoiceInfo[] = [
  {
    id: "Kore",
    name: "Kore",
    gender: "Female",
    tone: "Firm — warm, lower-medium pitch, rich chest resonance",
    bestFor: "Documentary, Educational, History, Serious Explainer",
  },
  {
    id: "Aoede",
    name: "Aoede",
    gender: "Female",
    tone: "Breezy — natural conversational, upbeat & dynamic",
    bestFor: "Finance, Daily Vlogs, Tutorials, Corporate",
  },
  {
    id: "Zephyr",
    name: "Zephyr",
    gender: "Female",
    tone: "Bright — soft, gentle, compassionate, steady pace",
    bestFor: "Meditation, Bedtime Stories, Calming Guides",
  },
  {
    id: "Puck",
    name: "Puck",
    gender: "Male",
    tone: "Upbeat — energetic, youthful, casual, punchy",
    bestFor: "Tech Reviews, Gaming, YouTube Shorts, Reaction",
  },
  {
    id: "Charon",
    name: "Charon",
    gender: "Male",
    tone: "Informative — deep, authoritative, grave, cinematic baritone",
    bestFor: "Horror Stories, Crime Thrillers, Mystery, Movie Trailer",
  },
  {
    id: "Fenrir",
    name: "Fenrir",
    gender: "Male",
    tone: "Excitable — warm resonant, articulate narrative presence",
    bestFor: "Audiobooks, Biography, Philosophy, Long-form essays",
  },
  {
    id: "Enceladus",
    name: "Enceladus",
    gender: "Male",
    tone: "Breathy — crisp, bold, executive presentation tone",
    bestFor: "News reporting, Business pitches, Product launches",
  },
  {
    id: "Leda",
    name: "Leda",
    gender: "Female",
    tone: "Youthful — fresh, lively, friendly young voice",
    bestFor: "Kids Content, Lifestyle Vlogs, Fashion, Youth Shows",
  },
  {
    id: "Orus",
    name: "Orus",
    gender: "Male",
    tone: "Firm — steady, confident, grounded delivery",
    bestFor: "Documentary, Explainers, Corporate Narration",
  },
  {
    id: "Callirrhoe",
    name: "Callirrhoe",
    gender: "Female",
    tone: "Easy-going — relaxed, smooth, pleasant flow",
    bestFor: "Travel Vlogs, Lifestyle, Soft Explainers",
  },
  {
    id: "Autonoe",
    name: "Autonoe",
    gender: "Female",
    tone: "Bright — clear, cheerful, sparkling presence",
    bestFor: "Commercials, Kid Stories, Positive News",
  },
  {
    id: "Iapetus",
    name: "Iapetus",
    gender: "Male",
    tone: "Clear — precise, neutral, highly intelligible",
    bestFor: "E-learning, Tutorials, How-to Guides",
  },
  {
    id: "Umbriel",
    name: "Umbriel",
    gender: "Male",
    tone: "Easy-going — calm, laid-back, smooth talker",
    bestFor: "Podcasts, Chill Commentary, Interviews",
  },
  {
    id: "Algieba",
    name: "Algieba",
    gender: "Male",
    tone: "Smooth — polished, even, professional",
    bestFor: "Ads, Brand Films, Announcements",
  },
  {
    id: "Despina",
    name: "Despina",
    gender: "Female",
    tone: "Smooth — silky, even, graceful delivery",
    bestFor: "Luxury Brands, Beauty, Wellness",
  },
  {
    id: "Erinome",
    name: "Erinome",
    gender: "Female",
    tone: "Clear, gentle — soft-spoken and articulate",
    bestFor: "Audiobooks, Bedtime Stories, Guides",
  },
  {
    id: "Algenib",
    name: "Algenib",
    gender: "Male",
    tone: "Neutral-balanced — clean all-rounder voice",
    bestFor: "General Narration, Explainers, IVR",
  },
  {
    id: "Rasalgethi",
    name: "Rasalgethi",
    gender: "Male",
    tone: "Deep-textured — weighty, storyteller feel",
    bestFor: "Mythology, History, Epic Stories",
  },
  {
    id: "Laomedeia",
    name: "Laomedeia",
    gender: "Female",
    tone: "Melodic — lyrical, expressive flow",
    bestFor: "Poetry, Romantic Stories, Drama",
  },
  {
    id: "Achernar",
    name: "Achernar",
    gender: "Male",
    tone: "Bright-tenor — sharp, vivid, alert",
    bestFor: "Sports Commentary, Breaking News",
  },
  {
    id: "Alnilam",
    name: "Alnilam",
    gender: "Male",
    tone: "Centered — stable, trustworthy, even",
    bestFor: "Finance, News, Documentary",
  },
  {
    id: "Schedar",
    name: "Schedar",
    gender: "Male",
    tone: "Even — measured, composed, steady",
    bestFor: "Reports, Analysis, Podcasts",
  },
  {
    id: "Gacrux",
    name: "Gacrux",
    gender: "Male",
    tone: "Rich-low — dark, full-bodied resonance",
    bestFor: "Trailers, True Crime, Thrillers",
  },
  {
    id: "Pulcherrima",
    name: "Pulcherrima",
    gender: "Female",
    tone: "Radiant — luminous, uplifting, warm",
    bestFor: "Inspiration, Festive, Lifestyle",
  },
  {
    id: "Achird",
    name: "Achird",
    gender: "Male",
    tone: "Crisp — tight, punchy, modern edge",
    bestFor: "Tech, Startups, Youth Content",
  },
  {
    id: "Zubenelgenubi",
    name: "Zubenelgenubi",
    gender: "Male",
    tone: "Commanding — large, powerful presence",
    bestFor: "Cinematic Intros, Trailers, Events",
  },
  {
    id: "Vindemiatrix",
    name: "Vindemiatrix",
    gender: "Female",
    tone: "Classic — timeless, elegant narration",
    bestFor: "Literature, Culture, Heritage",
  },
  {
    id: "Sadachbia",
    name: "Sadachbia",
    gender: "Male",
    tone: "Grounded — earthy, sincere, honest",
    bestFor: "Rural Stories, Interviews, Docs",
  },
  {
    id: "Sadaltager",
    name: "Sadaltager",
    gender: "Male",
    tone: "Knowledgeable — wise, professor-like warmth",
    bestFor: "Education, Science, Explainers",
  },
  {
    id: "Sulafat",
    name: "Sulafat",
    gender: "Female",
    tone: "Sweet-voiced — tender, caring, gentle lift",
    bestFor: "Kids, Health, Family Content",
  },
];

export interface PersonaTemplate {
  id: string;
  title: string;
  topic: string;
  text: string;
}

export interface PersonaConfig {
  id: string;
  name: string;
  title: string;
  domain: string;
  gender: "Female" | "Male";
  perceivedAge: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  baseVoice: string;
  pacingNote: string;
  directorPrompt: string;
  templates: PersonaTemplate[];
  isBuiltIn?: boolean;
}

export const DEFAULT_PERSONAS: Record<string, PersonaConfig> = {
  arya: {
    id: "arya",
    name: "Prof. Arya",
    title: "Master of Design, Architecture & Cultural Heritage",
    domain: "History, Architecture, Culture & Documentary",
    gender: "Female",
    perceivedAge: "26",
    avatarUrl: "/professors/profile-pictures/arya-profile.png",
    avatarEmoji: "🏛️",
    baseVoice: "Kore",
    pacingNote:
      "Confident, engaging documentary narrator (~145–155 WPM). Warm, alive, with articulate emphasis on historical facts, dates, and architectural depth.",
    directorPrompt: `Speaker: Prof. Arya, articulate Indian educator & cultural documentary narrator.
Genre: Educational Documentary, Cultural Heritage & Architecture.

Vocal Tone & Timbre: Warm, mature female voice with lower-medium pitch, rich chest resonance, and clear academic authority. Smooth, rounded tone with dignified presence.

Pacing & Rhythm: Steady, flowing pace (~145-155 WPM). Purposeful natural pauses at commas and full stops to allow complex concepts to breathe.

Energy & Emotion: Medium-high, attentive and intellectually curious. Engaging like a passionate professor captivating a lecture hall.

Language & Multilingual Adaptation:
- UNIVERSAL MULTILINGUAL CAPABILITY: Naturally and dynamically adapts to the exact language and script of the provided transcript (whether English, Hindi, Hinglish, Marathi, Tamil, Bengali, Telugu, Gujarati, Spanish, French, etc.).
- Speaks with native fluency and natural pronunciation, without forcing any unnatural foreign accent.
- Maintains intellectual warmth and articulate clarity across all languages.

Consistency Lock: Preserve this exact vocal timbre, resonance, and energy from the opening phrase to the final sentence without drifting.`,
    templates: [
      {
        id: "arya-historical-sources",
        title: "📜 Historical Sources: Reconstructing the Past (Hinglish)",
        topic: "Indian History",
        text: `Sochiye. Do hazaar saal pehle ki duniya ko dekhne ke liye na koi camera tha, na koi digital hard drive, aur na hi aaj ki tarah roz chhapne wala newspaper.

Toh phir hum itne yakeen ke saath kaise keh sakte hain ki Chandragupta Maurya ne kaisa shasan kiya? Namaste dosto! Main hoon aapki Professor Arya, aur aaj ke session mein hum explore karenge Historical Sources ko.`,
      },
      {
        id: "arya-kailash-temple-en",
        title: "🏛️ Kailash Temple: The Monolithic Marvel (English)",
        topic: "Ancient Engineering",
        text: `Welcome to today's architectural investigation. Cave 16 of Ellora, the magnificent Kailash Temple, defies the fundamental rules of classical civil engineering. 

Unlike traditional monuments built from the ground up, this monolithic wonder was carved from the top down into a single volcanic basalt mountain. Over two hundred thousand tonnes of solid stone were chiseled away with unmatched mathematical precision over twelve centuries ago.`,
      },
    ],
    isBuiltIn: true,
  },
  kabir: {
    id: "kabir",
    name: "Kabir Storyteller",
    title: "Cinematic Narrator & Dark Suspense Storyteller",
    domain: "Horror, Mystery, Crime Thrillers & Folklore",
    gender: "Male",
    perceivedAge: "35",
    avatarEmoji: "🎙️",
    baseVoice: "Charon",
    pacingNote:
      "Deep, slow, suspenseful cadence (~120–135 WPM). Builds spine-chilling tension with dramatic pauses before crucial revelations.",
    directorPrompt: `Speaker: Kabir, atmospheric Indian cinematic narrator & dark suspense storyteller.
Genre: Horror, True Crime, Thriller & Supernatural Folklore.

Vocal Tone & Timbre: Deep, commanding baritone with heavy chest resonance, grave gravelly undertone, and cinematic weight.

Pacing & Rhythm: Deliberate, suspenseful (~125-135 WPM). Elongated dramatic pauses before critical plot twists and revelations. Whispered tension on climax moments.

Energy & Emotion: Brooding, intense, and deeply immersive. Speaks with intimate conviction that draws listeners straight into the darkness.

Language & Multilingual Adaptation:
- UNIVERSAL MULTILINGUAL CAPABILITY: Effortlessly adapts to the language and script of the transcript (Hindi, English, Hinglish, Bengali, Marathi, or any regional/international language).
- Pronounces words with native fluency and spine-chilling authenticity in every language.
- Never sounds artificially accented; adapts natively to the transcript's tongue while retaining his signature dark baritone.

Consistency Lock: Lock deep pitch register and brooding pace throughout the entire audio generation without pitch elevation.`,
    templates: [
      {
        id: "kabir-mystery-forest",
        title: "🌲 The Unsolved Mystery of Shaitan Khad (Hinglish)",
        topic: "Supernatural Thriller",
        text: `Raat ke theek teen baje the. Hawa bilkul shaant thi... par jungle mein ek aisi aahat thi, jo seene mein thandak bhar de.

Har saal barish ke dino mein, us ghumavdar pahadi mod par gaadiyan rukti hain... par log kabhi aage nahi badhte. Kyun? Kyunki wahan par ek purana dak bangla khada hai... jiska darwaza hamesha andar se band rehta hai.`,
      },
      {
        id: "kabir-abandoned-mansion-en",
        title: "🏚️ The Midnight Watcher of Blackwood Estate (English)",
        topic: "Psychological Horror",
        text: `It was exactly three minutes past midnight when the ticking stopped.

The silence that followed was not ordinary quiet—it was suffocating, deliberate, and watching. Footsteps echoed in the corridor above, slow and rhythmic, dragging across floorboards that had been untouched for over forty years.`,
      },
    ],
    isBuiltIn: true,
  },
  rahul: {
    id: "rahul",
    name: "Rahul Tech",
    title: "Gadget Guru & Modern Digital Explainer",
    domain: "Smartphones, AI, Software, Gaming & Tech News",
    gender: "Male",
    perceivedAge: "25",
    avatarEmoji: "⚡",
    baseVoice: "Puck",
    pacingNote:
      "Fast, high-energy YouTube Shorts & Reels cadence (~160–170 WPM). Sharp punches on tech specs, benchmarks, and hot takes.",
    directorPrompt: `Speaker: Rahul, dynamic Indian tech creator and modern product reviewer.
Genre: Tech Reviews, Software Guides, AI Tutorials & Viral Shorts.

Vocal Tone & Timbre: Upbeat, youthful, crisp male tenor with crystal-clear high-frequency clarity. Punchy and modern.

Pacing & Rhythm: Rapid, snappy (~160-170 WPM). Fast transitions with minimal dead air, keeping listeners hooked like a top YouTube creator.

Energy & Emotion: High-voltage, authentic enthusiasm. Energetic inflections on specs, performance numbers, and punchlines.

Language & Multilingual Adaptation:
- UNIVERSAL MULTILINGUAL CAPABILITY: Seamlessly adapts to whatever language or mix the user provides (Hinglish, fluent English, Hindi, or regional languages).
- Speaks naturally like a modern digital native with effortless flow and correct tech terminology pronunciation.

Consistency Lock: Maintain punchy high-energy pacing and clean articulation throughout every sentence.`,
    templates: [
      {
        id: "rahul-ai-chip",
        title: "⚡ Apple M4 vs Snapdragon X Elite (Hinglish)",
        topic: "Hardware & Tech",
        text: `Dosto, agar aap bhi naya laptop lene ka soch rahe ho, toh ruko! Market me chal raha hai sabse bada chip war! Ek taraf hai Apple ka M4 silicon, aur doosri taraf Qualcomm ka Snapdragon X Elite. Aaj bina kisi sponsored bakwaas ke dekhenge actual benchmarks aur battery backup!`,
      },
      {
        id: "rahul-ai-agents-en",
        title: "🤖 The Era of Autonomous AI Agents (English)",
        topic: "AI Innovation",
        text: `Stop scrolling if you write code for a living! The next generation of autonomous AI coding agents just dropped, and it's not just about autocompleting lines anymore. We are talking full repository refactoring, automated bug resolution, and zero-touch testing pipelines in seconds!`,
      },
    ],
    isBuiltIn: true,
  },
  ananya: {
    id: "ananya",
    name: "Ananya Commercial",
    title: "Premium Brand Voice & Commercial Specialist",
    domain: "Advertisements, Brand Promos, Product Launches & Luxury",
    gender: "Female",
    perceivedAge: "27",
    avatarEmoji: "✨",
    baseVoice: "Aoede",
    pacingNote:
      "Polished, breezy commercial flow (~145–155 WPM). Warm smile in the voice, persuasive inflections, and elegant rhythm.",
    directorPrompt: `Speaker: Ananya, premium Indian commercial voiceover artist and brand ambassador.
Genre: Commercials, Brand Films, Radio Spots, Product Launches & Luxury Ads.

Vocal Tone & Timbre: Breezy, sophisticated, luminous female voice with bright clarity and silky smoothness. Smiles through the audio.

Pacing & Rhythm: Rhythmic, persuasive, and flowing (~145-155 WPM). Subtle lifts on brand benefits and memorable cadence on slogans.

Energy & Emotion: Welcoming, confident, premium, and trustworthy. Creates an instant emotional connection with the listener.

Language & Multilingual Adaptation:
- UNIVERSAL MULTILINGUAL CAPABILITY: Flawlessly speaks in English, Hindi, Hinglish, or any regional/international language matching the input.
- Delivers polished, broadcast-grade native diction and emotional persuasion in whatever language is passed.

Consistency Lock: Keep premium commercial shine and confident warmth locked evenly from first hook to final call-to-action.`,
    templates: [
      {
        id: "ananya-luxury-brand",
        title: "✨ Elevate Your Daily Ritual (English)",
        topic: "Commercial Brand Spot",
        text: `True luxury isn't about being noticed. It's about being remembered. Crafted from timeless organic botanicals and backed by dermatological precision, discover skin care that honors your natural glow. Experience the difference today.`,
      },
      {
        id: "ananya-festive-offer",
        title: "🎉 Shandar Tyohar, Bemisaal Offers (Hinglish)",
        topic: "Festive Campaign",
        text: `Is tyohar ke mausam me, apne ghar ko dijiye ek naya aur khoobsurat roop! Payiye flat fifty percent discount latest home decor aur smart appliances par. Sirf is weekend, apne nazdeeki showroom par aaiye ya order kijiye online.`,
      },
    ],
    isBuiltIn: true,
  },
  meera: {
    id: "meera",
    name: "Meera Dhyan",
    title: "Mindfulness, Meditation & Inner Peace Guide",
    domain: "Meditation, Breathwork, Sleep Stories, Spiritual Healing & Yoga",
    gender: "Female",
    perceivedAge: "30",
    avatarEmoji: "🌸",
    baseVoice: "Zephyr",
    pacingNote:
      "Gentle, tranquil, unhurried cadence (~110–120 WPM). Soft breathing pauses that ground the listener into deep calm.",
    directorPrompt: `Speaker: Meera, compassionate Indian mindfulness guide and meditation narrator.
Genre: Guided Meditation, Spiritual Reflection, Sleep Stories & Stress Relief.

Vocal Tone & Timbre: Soft, velvety, tranquil female voice with warm airiness and maternal gentleness. Smooth like calm water.

Pacing & Rhythm: Very relaxed, spacious (~110-120 WPM). Generous pauses between thoughts, synchronized with calm breathing cycles.

Energy & Emotion: Serene, peaceful, grounding, and deeply empathetic. Calms the nervous system instantly.

Language & Multilingual Adaptation:
- UNIVERSAL MULTILINGUAL CAPABILITY: Adapts smoothly to the transcript language (Hindi, English, Sanskrit chants, Marathi, Tamil, etc.).
- Maintains ethereal peace and soothing native cadence regardless of the spoken tongue.

Consistency Lock: Do not accelerate pace or raise pitch. Maintain deep meditative serenity till the final breath.`,
    templates: [
      {
        id: "meera-stress-relief",
        title: "🌸 3-Minute Breath & Grounding (Hinglish / Hindi)",
        topic: "Guided Meditation",
        text: `Apni aankhon ko dheere se band kar lijiye... Ek gehri saans andar lijiye... aur aahista se bahar chhod dijiye.

Is pal me koi jaldbazi nahi hai... koi bojh nahi hai. Apne kandhon ko dheela chhodiye, aur mehsoos kijiye ki aap bilkul surakshit aur shant hain.`,
      },
      {
        id: "meera-sleep-journey-en",
        title: "🌙 Peaceful Sleep River Journey (English)",
        topic: "Sleep Relaxation",
        text: `Allow your thoughts to drift away like gentle autumn leaves floating down a quiet river under a starlit sky. With every slow breath out, release the tension of the day. You are safe. You are at peace. Rest deeply now.`,
      },
    ],
    isBuiltIn: true,
  },
  vikram: {
    id: "vikram",
    name: "Vikram Talks",
    title: "Podcast Host & Thoughtful Conversationalist",
    domain: "Podcasts, Deep Discussions, Life Philosophy & Interviews",
    gender: "Male",
    perceivedAge: "34",
    avatarEmoji: "☕",
    baseVoice: "Fenrir",
    pacingNote:
      "Thoughtful, resonant, conversational pace (~140–150 WPM). Natural conversational cadence like two friends sharing coffee.",
    directorPrompt: `Speaker: Vikram, warm and reflective Indian podcast host and conversational narrator.
Genre: Long-form Podcasts, Audio Essays, Thoughtful Interviews & Life Philosophy.

Vocal Tone & Timbre: Warm, rich resonant male voice with grounded chest presence and articulate, comfortable depth.

Pacing & Rhythm: Natural, conversational flow (~140-150 WPM). Realistic inflections, organic pauses, and thoughtful contemplation.

Energy & Emotion: Sincere, grounded, curious, and welcoming. Feels like an intimate conversation with a trusted friend.

Language & Multilingual Adaptation:
- UNIVERSAL MULTILINGUAL CAPABILITY: Effortlessly communicates in Hindi, English, Hinglish, or any regional tongue in the input text.
- Retains effortless conversational authenticity and native colloquial rhythm in any language.

Consistency Lock: Maintain relaxed, mature warmth without turning into a radio announcer.`,
    templates: [
      {
        id: "vikram-slow-living",
        title: "☕ Why Hustle Culture Fails (Hinglish)",
        topic: "Podcast Essay",
        text: `Aapne kabhi notice kiya hai ki hum sab kitni jaldi me hain? Subah uthte hi notification check karna, din bhar deadlines chase karna, aur raat ko thak kar so jana. Lekin sawaal yeh hai: kya hum sach me aage badh rahe hain, ya bas ek race me bhaag rahe hain? Aaj baat karenge the power of slow living par.`,
      },
      {
        id: "vikram-curiosity-en",
        title: "🎙️ The Quiet Power of Genuine Curiosity (English)",
        topic: "Thoughtful Dialogue",
        text: `Most people don't listen to understand—they listen to reply. But when you sit down across from someone with genuine, ego-free curiosity, the entire room transforms. That's where real wisdom begins, not in having all the answers, but in asking better questions.`,
      },
    ],
    isBuiltIn: true,
  },
  dev: {
    id: "dev",
    name: "Dev Motivation",
    title: "High-Energy Motivational Speaker & Power Coach",
    domain: "Motivation, Discipline, Fitness, Entrepreneurship & Keynotes",
    gender: "Male",
    perceivedAge: "28",
    avatarEmoji: "🔥",
    baseVoice: "Achernar",
    pacingNote:
      "High-impact, electric, driving rhythm (~155–165 WPM). Powerful vocal punches on motivational triggers and calls to action.",
    directorPrompt: `Speaker: Dev, dynamic Indian motivational powerhouse and mindset coach.
Genre: Motivational Speeches, Gym & Workout Hype, Startup Keynotes & Drive.

Vocal Tone & Timbre: Bold, sharp tenor with electric projection, firm vocal cord closure, and intense conviction.

Pacing & Rhythm: Driving, rhythmic, urgent (~155-165 WPM). Builds crescendo from quiet intensity to explosive motivation.

Energy & Emotion: 10/10 relentless passion, grit, and inspiring drive. Unapologetic hunger and fiery belief.

Language & Multilingual Adaptation:
- UNIVERSAL MULTILINGUAL CAPABILITY: Delivers thunderous motivation in English, Hindi, Hinglish, or any local dialect.
- Channels authentic native fire and emotional weight directly matching the transcript's language.

Consistency Lock: Never lose the driving forward momentum and razor-sharp conviction.`,
    templates: [
      {
        id: "dev-wake-up",
        title: "🔥 Apne Sapno Ke Liye Ladna Sikho (Hinglish)",
        topic: "High-Energy Drive",
        text: `Kab tak bahane banaoge? Kal karunga, agle hafte karunga, agle saal karunga... Yeh 'kal' kabhi nahi aata dost! Agar tumhare paas ek sapna hai, toh uski keemat chukane ke liye aaj hi khade ho jao. Mehnat ka koi shortcut nahi hota—utho aur chase karo!`,
      },
      {
        id: "dev-relentless-en",
        title: "⚡ The Relentless Standard (English)",
        topic: "Mindset & Execution",
        text: `Champions are not made in the lights; they are made in the dark hours when nobody is cheering. When fatigue whispers to quit, your discipline must speak louder. Wake up, lock in, and refuse to accept anything less than your absolute best!`,
      },
    ],
    isBuiltIn: true,
  },
  priya: {
    id: "priya",
    name: "Priya Kathakaar",
    title: "Audiobook Narrator & Expressive Storyteller",
    domain: "Audiobooks, Classic Novels, Emotional Drama & Family Stories",
    gender: "Female",
    perceivedAge: "29",
    avatarEmoji: "📖",
    baseVoice: "Laomedeia",
    pacingNote:
      "Melodic, expressive, theatrical narrative cadence (~135–145 WPM). Brings characters to life with rich emotional color.",
    directorPrompt: `Speaker: Priya, expressive Indian audiobook narrator and dramatic storyteller.
Genre: Literary Fiction, Emotional Biographies, Romantic Drama & Audiobooks.

Vocal Tone & Timbre: Lyrical, textured, expressive female voice with rich vocal color, subtle vibrato, and emotional versatility.

Pacing & Rhythm: Expressive and melodic (~135-145 WPM). Slows down for poignant sorrow, quickens for joyful wonder.

Energy & Emotion: Deeply empathetic, colorful, and engaging. Transports the listener into the hearts of the characters.

Language & Multilingual Adaptation:
- UNIVERSAL MULTILINGUAL CAPABILITY: Reads audiobooks and literature seamlessly in Hindi, English, Urdu, Bengali, Marathi, or any world language.
- Pronounces literary phrases with profound native grace and artistic depth.

Consistency Lock: Keep character voice distinction and poetic narrative beauty steady throughout chapters.`,
    templates: [
      {
        id: "priya-old-letter",
        title: "✉️ Purani Kitaab Aur Woh Aakhri Khat (Hinglish)",
        topic: "Emotional Narrative",
        text: `Barsat ki ek thandi dopahar ko, library ki purani almari se ek kitaab gir padi. Uske peele pad chuke panno ke darmiyan ek khat chhupa hua tha... ek aisi dastan, jise waqt ne bhula diya tha, lekin shabdon ne hamesha ke liye zinda rakha tha.`,
      },
      {
        id: "priya-forgotten-station-en",
        title: "🚂 The Midnight Train to Nowhere (English)",
        topic: "Literary Drama",
        text: `The mist hung heavy over the forgotten platform as the distant whistle pierced the damp night air. In her trembling hands, Maya held the brass key she had guarded for three decades—the only surviving key to her grandfather's lost clockwork workshop.`,
      },
    ],
    isBuiltIn: true,
  },
  aarav: {
    id: "aarav",
    name: "Aarav Broadcast",
    title: "News Anchor & Corporate Intelligence Voice",
    domain: "Daily News, Business Reports, Financial Analysis & Whitepapers",
    gender: "Male",
    perceivedAge: "32",
    avatarEmoji: "💼",
    baseVoice: "Enceladus",
    pacingNote:
      "Crisp, measured, authoritative broadcast pace (~150 WPM). Flawless neutral articulation with professional journalistic clarity.",
    directorPrompt: `Speaker: Aarav, authoritative Indian news anchor and corporate intelligence presenter.
Genre: Prime-time News, Financial Briefs, Annual Reports & Executive Presentations.

Vocal Tone & Timbre: Crisp, clean, bold executive baritone with flawless diction, neutral articulation, and sharp clarity.

Pacing & Rhythm: Measured, balanced, authoritative (~150 WPM). Steady cadences that deliver complex data clearly.

Energy & Emotion: Composed, objective, highly credible, and professional. Demands attention through composure.

Language & Multilingual Adaptation:
- UNIVERSAL MULTILINGUAL CAPABILITY: Broadcasts cleanly in English, Hindi, and multilingual corporate briefings.
- Speaks with pristine international/native journalistic neutrality without exaggerated inflections.

Consistency Lock: Maintain executive credibility and impeccable clarity from the headline to sign-off.`,
    templates: [
      {
        id: "aarav-market-update",
        title: "📈 Global Markets & Tech Sector Surge (English)",
        topic: "Business Brief",
        text: `Good morning. Asian markets opened higher this session as semiconductor stocks spearheaded an international rally following stronger-than-expected cloud earnings. Meanwhile, institutional investors are closely monitoring the central bank's upcoming interest rate guidance.`,
      },
      {
        id: "aarav-fintech-report",
        title: "💼 Digital Banking Ka Naya Daur (Hinglish)",
        topic: "Financial Analysis",
        text: `Namaskar. Desh ke digital payments ecosystem ne pichhle maah ek naya record qayam kiya hai. Tier-2 aur Tier-3 shahron me micro-transactions ki tezi se fintech startups ka valuation do guna ho gaya hai. Aaiye dekhte hain is growth ke mukhya factors.`,
      },
    ],
    isBuiltIn: true,
  },
};

export const DEFAULT_PERSONA_ID = "arya";
const PERSONAS_STORAGE_KEY = "audio_studio_personas_v3";

export function loadPersonas(): Record<string, PersonaConfig> {
  if (typeof window === "undefined") {
    return DEFAULT_PERSONAS;
  }

  try {
    let raw = localStorage.getItem(PERSONAS_STORAGE_KEY);
    // Backward compatibility: migrate existing v2 personas and merge with fresh v3 built-in presets
    if (!raw) {
      const v2Raw = localStorage.getItem("audio_studio_personas_v2");
      if (v2Raw) {
        try {
          const v2Parsed = JSON.parse(v2Raw);
          const migrated: Record<string, PersonaConfig> = { ...DEFAULT_PERSONAS };
          for (const [id, persona] of Object.entries(v2Parsed)) {
            // Keep user-created custom personas
            if (!DEFAULT_PERSONAS[id]) {
              migrated[id] = persona as PersonaConfig;
            }
          }
          savePersonas(migrated);
          return migrated;
        } catch {}
      }
      savePersonas(DEFAULT_PERSONAS);
      return DEFAULT_PERSONAS;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Object.keys(parsed).length === 0) {
      savePersonas(DEFAULT_PERSONAS);
      return DEFAULT_PERSONAS;
    }

    // Always ensure all latest built-in DEFAULT_PERSONAS are up-to-date while preserving user custom personas
    const merged: Record<string, PersonaConfig> = { ...DEFAULT_PERSONAS };
    for (const [id, persona] of Object.entries(parsed)) {
      if (!DEFAULT_PERSONAS[id]) {
        merged[id] = persona as PersonaConfig;
      }
    }
    return merged;
  } catch (err) {
    console.error("Failed to load personas:", err);
    return DEFAULT_PERSONAS;
  }
}

export function savePersonas(personas: Record<string, PersonaConfig>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PERSONAS_STORAGE_KEY, JSON.stringify(personas));
  } catch (err) {
    console.error("Failed to save personas:", err);
  }
}

export function saveSinglePersona(persona: PersonaConfig): Record<string, PersonaConfig> {
  const all = loadPersonas();
  all[persona.id] = persona;
  savePersonas(all);
  return all;
}

export function deletePersona(personaId: string): Record<string, PersonaConfig> {
  if (DEFAULT_PERSONAS[personaId]) {
    return loadPersonas();
  }
  const all = loadPersonas();
  delete all[personaId];
  if (Object.keys(all).length === 0) {
    all.arya = DEFAULT_PERSONAS.arya;
  }
  savePersonas(all);
  return all;
}

export function resetPersonasToDefaults(): Record<string, PersonaConfig> {
  savePersonas(DEFAULT_PERSONAS);
  return DEFAULT_PERSONAS;
}

export function exportPersonasToJson(): string {
  const all = loadPersonas();
  return JSON.stringify(all, null, 2);
}

export function importPersonasFromJson(jsonStr: string): Record<string, PersonaConfig> | null {
  const map = parsePersonaMap(jsonStr);
  if (!map) {
    console.error("Invalid persona JSON import.");
    return null;
  }
  const merged = { ...loadPersonas(), ...map };
  savePersonas(merged);
  return merged;
}

/**
 * Lenient JSON parser for LLM-generated persona files.
 * LLMs aksar curly/smart quotes (“ ” ‘ ’), markdown fences ya trailing
 * commas de dete hain — ye sab normalize karke parse karo.
 * Single persona object bhi accept hota hai (map me wrap ho jata hai).
 */
export function sanitizeJsonText(text: string): string {
  let t = (text || "").trim().replace(/^﻿/, "");
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s !== -1 && e > s) t = t.slice(s, e + 1);
  t = t.replace(/[“”„‟]/g, '"').replace(/[‘’‚]/g, "'");
  t = t.replace(/,\s*([}\]])/g, "$1");
  return t;
}

const VALID_VOICE_IDS = new Set(GEMINI_VOICES.map((v) => v.id));

function coercePersona(id: string, p: unknown): PersonaConfig | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || typeof o.baseVoice !== "string") {
    return null;
  }
  const voiceId = VALID_VOICE_IDS.has(o.baseVoice) ? o.baseVoice : "Kore";
  const voiceInfo = GEMINI_VOICES.find((v) => v.id === voiceId);
  const gender = o.gender === "Male" || o.gender === "Female" ? o.gender : voiceInfo?.gender || "Female";
  const templates = Array.isArray(o.templates)
    ? o.templates
        .filter(
          (t): t is Record<string, unknown> =>
            !!t && typeof t === "object" && typeof (t as Record<string, unknown>).text === "string"
        )
        .map((t, i) => ({
          id: typeof t.id === "string" ? t.id : `template_${Date.now()}_${i}`,
          title: typeof t.title === "string" ? t.title : `Sample ${i + 1}`,
          topic: typeof t.topic === "string" ? t.topic : "General",
          text: t.text as string,
        }))
    : [];
  return {
    id: o.id,
    name: o.name,
    title: typeof o.title === "string" ? o.title : "Custom Voice Narrator",
    domain: typeof o.domain === "string" ? o.domain : "General",
    gender,
    perceivedAge: typeof o.perceivedAge === "string" ? o.perceivedAge : "25",
    avatarEmoji: typeof o.avatarEmoji === "string" ? o.avatarEmoji : "🎙️",
    baseVoice: voiceId,
    pacingNote:
      typeof o.pacingNote === "string" ? o.pacingNote : "Natural conversational pace (~145 WPM).",
    directorPrompt: typeof o.directorPrompt === "string" ? o.directorPrompt : "",
    templates:
      templates.length > 0
        ? templates
        : [
            {
              id: `template_${Date.now()}`,
              title: "Sample Script",
              topic: "General",
              text: "Namaste doston! Ye mera pehla sample script hai.",
            },
          ],
    isBuiltIn: false,
  };
}

export function parsePersonaMap(jsonStr: string): Record<string, PersonaConfig> | null {
  try {
    const parsed: unknown = JSON.parse(sanitizeJsonText(jsonStr));
    if (!parsed || typeof parsed !== "object") return null;
    const map: Record<string, PersonaConfig> = {};
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.baseVoice === "string" && typeof rec.id === "string") {
      // Single persona object (map me wrap nahi hai)
      const c = coercePersona(rec.id, rec);
      if (c) map[c.id] = c;
    } else {
      for (const [k, v] of Object.entries(rec)) {
        const c = coercePersona(k, v);
        if (c) map[c.id] = c;
      }
    }
    return Object.keys(map).length > 0 ? map : null;
  } catch (err) {
    console.error("Invalid persona JSON import:", err);
    return null;
  }
}
