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
    domain: "History, Architecture, UI/UX, Culture & Deep Insights",
    gender: "Female",
    perceivedAge: "24",
    avatarUrl: "/professors/profile-pictures/arya-profile.png",
    avatarEmoji: "🏛️",
    baseVoice: "Kore",
    pacingNote:
      "Confident, engaging documentary narrator (~145–155 WPM) using Kore. Warm, alive, medium-high energy with natural emphasis on names, dates and key words.",
    directorPrompt: `Speaker: Prof. Arya, female Indian history educator.

Style: Confident, engaging documentary narrator speaking natural Hinglish. Clear and informative, like a passionate teacher explaining history to students who are listening closely. Warm and alive, with genuine interest in the story.

Voice: Warm, mature female voice with a lower-medium pitch and fuller chest resonance. Smooth, rounded tone with body and presence.

Pacing: Steady, flowing pace of around 145-155 WPM. Brief natural pauses at commas and full stops. Keep the rhythm moving forward.

Energy: Medium-high, bright and attentive throughout. Add natural emphasis on key names, dates and important words. Slight rise in tone for questions and important points, like a teacher keeping students interested.

Consistency: Keep the same voice, pitch and energy from the first line to the last. Finish every sentence with the same energy it started with, no fading at the end.`,
    templates: [
      {
        id: "arya-historical-sources",
        title: "📜 Historical Sources: How Historians Reconstruct the Past",
        topic: "Indian History",
        text: `Sochiye.

Do hazaar saal pehle ki duniya ko dekhne ke liye na koi camera tha, na koi digital hard drive, aur na hi aaj ki tarah roz chhapne wala newspaper.

Toh phir hum itne yakeen ke saath kaise keh sakte hain ki Chandragupta Maurya ne kaisa shasan kiya? Jinhe hue lagbhag do se dhai hazaar saal ho chuke hain. Ya yeh ki us zamaane ke log kaise bartan istemal karte the?

Kya yeh sirf purani kahaniyan hain, jo dadi-nani se sunte-sunte hum tak pahunchi hain? Ya iske peeche koi thos, scientific logic kaam karta hai?

Namaste dosto! Main hoon aapki Professor Arya, aur aaj ke session mein hum explore karenge Historical Sources ko. Yaani woh saare suraag, jinki madad se ek historian beete hue kal ki tasveer banata hai.`,
      },
      {
        id: "arya-kailash-temple",
        title: "🏛️ Kailash Temple, Ellora: The Engineering Marvel (5-Part Deep Dive)",
        topic: "Ancient Engineering & Architecture",
        text: `Chapter 1: The Top-Down Carving Paradox

Namaste dosto! Main hoon aapki Professor Arya. Aaj hum explore karenge Bharat ke ek aise ajoobe ko, jise dekh kar modern civil engineers aur architects ke hosh udd jaate hain. Hum baat kar rahe hain Maharashtra ke Aurangabad mein sthit Ellora ki Cave Number 16 — yaani vishal Kailash Mandir ki.

Duniya ki har ek imarat neeche zameen se upar ki taraf banti hai — pehle neev khodi jaati hai, fir deewarein banti hain, aur aakhir mein chhat daali jaati hai. Taj Mahal se lekar Burj Khalifa tak sab aise hi bane hain. Lekin Kailash Mandir duniya ka akela aisa ajooba hai, jo upar se shuru hokar neeche ki taraf taraasha gaya! Ji haan, top-down rock-cut monolith architecture.

Puraane shilpkaaron ne ek poore volcanic pahaad ko upar se kaatna shuru kiya aur neeche aate-aate do sau hazaar ton pathar nikaal kar ek jivant mandir khada kar diya. Na koi cement, na koi jod, aur na hi koi alag se joda gaya pathar. Lagbhag barah sau saal pehle, bina kisi laser tools ya modern machines ke, unhone yeh precision kaise haasil kiya? Chaliye shuru karte hain.


Chapter 2: The Mystery of 200,000 Tonnes of Missing Basalt Rock

Aate hain is investigation ke sabse bade scientific rahasya par — The Missing Basalt Rock. Geologists ke anusaar, is poore mandir ko taraashne ke liye kam se kam do laakh se chaar laakh ton volcanic basalt rock pahaad se kaat kar bahar nikala gaya tha. Basalt pathar lohe jaisa sakht aur kathor maana jaata hai.

Hairani ki baat yeh hai ki Ellora ke pachaas kilometer ke daayre mein, is do laakh ton malbe ka ek chhota sa tukda bhi nahi milta! Aakhir itna vishal pathar gaya kahan? Kya use kisi nadi mein baha diya gaya? Ya us daur mein use kisi alag hi project ke liye transport kiya gaya tha? Itihaskaar aaj tak is sawal ka koi thos jawab nahi de paaye hain.

Aur agar traditional hathoda aur chheni ki baat karein, toh Rashtrakuta raja Krishna Pratham ke samay mein yeh mandir sirf atharah saal mein ban kar taiyar ho gaya tha. Modern calculation ke hisaab se, har ghante pandrah se bees ton pathar kaat kar bahar nikalna padta. Chaubis ghante nonstop kaam karne ke baad bhi, bina advanced cutting technology ke yeh mathematically namumkin lagta hai!


Chapter 3: Zero Margin of Error & Ancient 3D Blueprints

Ab zara iske three-dimensional precision aur mathematical planning par gaur kijiye. Jab aap upar se kisi pahaad ko kaatna shuru karte hain, toh aapke paas galti ki koi gunjaish nahi hoti. Zero room for error. Agar ek chheni ka waar bhi galat lag gaya, ya ek p pillar thoda sa patla ho gaya, toh aap use dobara cement se jod nahi sakte! Ek chhoti si bhool poore mandir ki symmetry ko barbaad kar deti.

Iska seedha matlab yeh hai ki shilpkaaron ke paas shuruat se pehle hi poora three-dimensional architectural model dimaag mein ya bhojpatra par bilkul taiyar tha. Upar se shikhara banaya gaya, fir mandapa, fir vishal praveshdwar, aur aakhir mein zameen par khade jeevant haathi aur dhoop-chhaon se bache hue deepak-stambh. Har ek khamba, har ek moorti, aur har ek galiyara ek hi vishal chattaan ka hissa hai.


Chapter 4: The Flawless Monolithic Rainwater Drainage System

Aur sirf shilpkala hi nahi, is mandir ka drainage engineering dekhiye. Ellora mein har saal bhaari monsoon barish hoti hai. Pahaad se behne wala laakhon litre paani mandir ke aangan mein jama na ho, iske liye pahaad ke upar gupt naale aur underground drainage channels kaate gaye the.

Yeh naale paani ke tez bahaav ko mandir ke chaaron taraf ghuma kar seedhe bahar valley mein bhej dete hain. Barah sau saal beet jaane ke baad bhi, aur bina kisi modern maintenance ke, aaj tak Kailash mandir ke garbhagriha ya aangan mein ek boond paani ka thehrav nahi hota! Yeh engineering proof hai ki hamare purvaj hydraulic engineering ke kitne bade maahir the.


Chapter 5: Aurangzeb's 3-Year Failed Siege & The Final Verdict

Itihas mein is mandir ki taakat ka sabse bada saboot milta hai Mughal shashak Aurangzeb ke daur mein. San 1682 mein, Aurangzeb ne is mandir ko poori tarah zameendoz karne ka shahi farman diya tha. Ek hazaar mazdooron ko hathode, lohe ki rod aur aag ke saath is mandir ko todne par lagaya gaya.

Unhone poore teen saal tak lagatar mandir ko todne ki koshish ki. Lekin teen saal baad kya hua? Mandir ka baal bhi baanka nahi hua! Mazdoor sirf kuch baahri moortiyon ko thoda kharab kar paaye, lekin mandir ka mukhya dhyan aur shikhara chattano ki tarah waise ka waisa hi khada raha. Aakhirkaar thak-haar kar Aurangzeb ko yeh mission hamesha ke liye band karna pada.

Jo imarat ek hazaar log teen saal mein hathodon se tod nahi sake, sochiye use banaya kitne divya gyan ke saath gaya hoga. Toh dosto, yeh tha Ellora ke Kailash Mandir ka adbhut rahasya. Agle chapter mein hum explore karenge iske gupt underground chambers ko. Tab tak ke liye, main hoon Prof. Arya, namaste!`,
      },
    ],
    isBuiltIn: true,
  },
  kabir: {
    id: "kabir",
    name: "Kabir Storyteller",
    title: "Cinematic Narrator & Dark Mystery Storyteller",
    domain: "Horror, Mystery, Thriller & Folklore",
    gender: "Male",
    perceivedAge: "35",
    avatarEmoji: "🎙️",
    baseVoice: "Charon",
    pacingNote:
      "Deep, slow, suspenseful cadence (~120–135 WPM). Builds tension with dramatic pauses before crucial revelations.",
    directorPrompt: `Speaker: Kabir, deep atmospheric Indian storyteller.

Style: Suspenseful, immersive Hindi/Hinglish storyteller. Speaks with intense gravity and intimate conviction, drawing the listener into the mystery.

Voice: Deep baritone, resonant, slightly raspy lower frequencies. Powerful chest resonance.

Pacing: Deliberate, suspenseful (~125 WPM) with elongated dramatic pauses at ellipsis and sentence endings.`,
    templates: [
      {
        id: "kabir-mystery-forest",
        title: "🌲 The Unsolved Mystery of Shaitan Khad",
        topic: "Supernatural Thriller",
        text: `Raat ke theek teen baje the.

Hawa bilkul shaant thi... par jungle mein ek aisi aahat thi, jo seene mein thandak bhar de.

Har saal barish ke dino mein, Shimla ke us ghumavdar mod par gaadiyan rukti hain... par log kabhi aage nahi badhte. Kyun? Kyunki wahan par ek purana dak bangla khada hai... jiska darwaza hamesha andar se band rehta hai.`,
      },
    ],
    isBuiltIn: true,
  },
  rahul: {
    id: "rahul",
    name: "Tech Reviewer Rahul",
    title: "Gadget Guru & AI Explainer",
    domain: "Smartphones, Software, Gadgets & Coding",
    gender: "Male",
    perceivedAge: "26",
    avatarEmoji: "⚡",
    baseVoice: "Puck",
    pacingNote:
      "Fast, high-energy YouTube Shorts style (~160–170 WPM). Sharp punches on tech specs and features.",
    directorPrompt: `Speaker: Rahul, enthusiastic Indian tech creator.

Style: Upbeat, fast-paced, modern Hinglish tech enthusiast. Energetic and punchy like a top YouTube smartphone reviewer.

Voice: Clean, crisp, youthful male voice with high clarity.

Pacing: Fast (~165 WPM), snappy and punchy with no hesitation.`,
    templates: [
      {
        id: "rahul-ai-chip",
        title: "⚡ Apple M4 vs Snapdragon X Elite: Real World Truth",
        topic: "Hardware & Tech",
        text: `Dosto, agar aap bhi naya laptop lene ka soch rahe ho, toh ruko!

Market me chal raha hai sabse bada chip war! Ek taraf hai Apple ka M4 silicon, aur doosri taraf Qualcomm ka Snapdragon X Elite. Aaj bina kisi sponsored bakwaas ke dekhenge actual benchmarks aur battery backup!`,
      },
    ],
    isBuiltIn: true,
  },
};

export const DEFAULT_PERSONA_ID = "arya";
const PERSONAS_STORAGE_KEY = "audio_studio_personas_v2";

export function loadPersonas(): Record<string, PersonaConfig> {
  if (typeof window === "undefined") {
    return DEFAULT_PERSONAS;
  }

  try {
    const raw = localStorage.getItem(PERSONAS_STORAGE_KEY);
    if (!raw) {
      savePersonas(DEFAULT_PERSONAS);
      return DEFAULT_PERSONAS;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Object.keys(parsed).length === 0) {
      savePersonas(DEFAULT_PERSONAS);
      return DEFAULT_PERSONAS;
    }

    // Merge default personas so built-ins are always available
    const merged = { ...DEFAULT_PERSONAS, ...parsed };
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
  const all = loadPersonas();
  delete all[personaId];
  // Ensure default arya is never deleted
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
