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
    tone: "Warm, lower-medium pitch, rich chest resonance",
    bestFor: "Documentary, Educational, History, Serious Explainer",
  },
  {
    id: "Aoede",
    name: "Aoede",
    gender: "Female",
    tone: "Breezy, natural conversational, upbeat & dynamic",
    bestFor: "Finance, Daily Vlogs, Tutorials, Corporate",
  },
  {
    id: "Zephyr",
    name: "Zephyr",
    gender: "Female",
    tone: "Soft, gentle, compassionate, steady pace",
    bestFor: "Meditation, Bedtime Stories, Calming Guides",
  },
  {
    id: "Puck",
    name: "Puck",
    gender: "Male",
    tone: "Energetic, youthful, casual, punchy",
    bestFor: "Tech Reviews, Gaming, YouTube Shorts, Reaction",
  },
  {
    id: "Charon",
    name: "Charon",
    gender: "Male",
    tone: "Deep, authoritative, grave, cinematic baritone",
    bestFor: "Horror Stories, Crime Thrillers, Mystery, Movie Trailer",
  },
  {
    id: "Fenrir",
    name: "Fenrir",
    gender: "Male",
    tone: "Warm resonant, articulate narrative presence",
    bestFor: "Audiobooks, Biography, Philosophy, Long-form essays",
  },
  {
    id: "Enceladus",
    name: "Enceladus",
    gender: "Male",
    tone: "Crisp, bold, executive presentation tone",
    bestFor: "News reporting, Business pitches, Product launches",
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
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === "object") {
      const merged = { ...loadPersonas(), ...parsed };
      savePersonas(merged);
      return merged;
    }
  } catch (err) {
    console.error("Invalid persona JSON import:", err);
  }
  return null;
}
