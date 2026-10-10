// ─────────────────────────────────────────────────────────────
// tts-projects.ts
// Multi-Project API Key Pool & Quota Manager for Google Gemini & Groq
// 100% Client-side LocalStorage — No Hardcoded Keys, Dynamic Projects
// ─────────────────────────────────────────────────────────────

export const TTS_MODELS = [
  {
    id: "gemini-2.5-flash-preview-tts",
    name: "Gemini 2.5 Flash TTS",
    badge: "Fast & Stable",
    dailyLimit: 10,
    speedNote: "~1-2s per min audio",
  },
  {
    id: "gemini-3.1-flash-tts-preview",
    name: "Gemini 3.1 Flash TTS",
    badge: "Expressive",
    dailyLimit: 10,
    speedNote: "Expressive audio cues & nuance",
  },
  {
    id: "gemini-3.8-flash-tts",
    name: "Gemini 3.8 Flash TTS",
    badge: "Latest Gen",
    dailyLimit: 10,
    speedNote: "High fidelity modern audio",
  },
  {
    id: "gemini-3.8-flash-lite-tts",
    name: "Gemini 3.8 Flash Lite TTS",
    badge: "Ultra-Light",
    dailyLimit: 10,
    speedNote: "Fast lightweight synthesis",
  },
] as const;

export type TTSModelId = (typeof TTS_MODELS)[number]["id"];

export interface ModelUsageStats {
  requestsCount: number;
  tokensUsed: number;
  audioSeconds: number;
}

export interface ProjectDailyUsage {
  cycleDate: string;
  models: Record<string, ModelUsageStats>;
}

export interface TTSProject {
  id: string;
  name: string;
  apiKey: string;
  dailyUsage: ProjectDailyUsage;
}

export interface TTSPoolState {
  activeProjectId: string;
  selectedModel: TTSModelId;
  projects: TTSProject[];
  groqApiKey: string;
}

const STORAGE_KEY = "audio_studio_tts_pool_v2";

/**
 * Google AI Studio daily quotas reset at Midnight Pacific Time (08:00 UTC / 1:30 PM IST).
 */
export function getCurrentQuotaCycleId(): string {
  const now = new Date();
  const resetAligned = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  return resetAligned.toISOString().slice(0, 10);
}

export function createInitialModelUsage(): Record<string, ModelUsageStats> {
  const usage: Record<string, ModelUsageStats> = {};
  TTS_MODELS.forEach((m) => {
    usage[m.id] = { requestsCount: 0, tokensUsed: 0, audioSeconds: 0 };
  });
  return usage;
}

export function createNewProject(name?: string): TTSProject {
  const currentCycle = getCurrentQuotaCycleId();
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: name || `Gemini Key ${id.slice(-4)}`,
    apiKey: "",
    dailyUsage: {
      cycleDate: currentCycle,
      models: createInitialModelUsage(),
    },
  };
}

export function getDefaultProjects(): TTSProject[] {
  const currentCycle = getCurrentQuotaCycleId();
  return [
    {
      id: "proj-1",
      name: "Google Cloud Project 1",
      apiKey: "",
      dailyUsage: {
        cycleDate: currentCycle,
        models: createInitialModelUsage(),
      },
    },
    {
      id: "proj-2",
      name: "Google Cloud Project 2",
      apiKey: "",
      dailyUsage: {
        cycleDate: currentCycle,
        models: createInitialModelUsage(),
      },
    },
  ];
}

export function loadTTSPoolState(): TTSPoolState {
  if (typeof window === "undefined") {
    return {
      activeProjectId: "proj-1",
      selectedModel: "gemini-2.5-flash-preview-tts",
      projects: getDefaultProjects(),
      groqApiKey: "",
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const currentCycle = getCurrentQuotaCycleId();

    if (!raw) {
      const defaultState: TTSPoolState = {
        activeProjectId: "proj-1",
        selectedModel: "gemini-2.5-flash-preview-tts",
        projects: getDefaultProjects(),
        groqApiKey: "",
      };
      saveTTSPoolState(defaultState);
      return defaultState;
    }

    const state = JSON.parse(raw) as TTSPoolState;
    let modified = false;

    if (!state.projects || state.projects.length === 0) {
      state.projects = getDefaultProjects();
      modified = true;
    }

    if (state.groqApiKey === undefined) {
      state.groqApiKey = "";
      modified = true;
    }

    state.projects.forEach((proj) => {
      if (!proj.dailyUsage || proj.dailyUsage.cycleDate !== currentCycle) {
        proj.dailyUsage = {
          cycleDate: currentCycle,
          models: createInitialModelUsage(),
        };
        modified = true;
      } else {
        TTS_MODELS.forEach((m) => {
          if (!proj.dailyUsage.models[m.id]) {
            proj.dailyUsage.models[m.id] = { requestsCount: 0, tokensUsed: 0, audioSeconds: 0 };
            modified = true;
          }
        });
      }
    });

    if (!state.activeProjectId || !state.projects.some((p) => p.id === state.activeProjectId)) {
      state.activeProjectId = state.projects[0].id;
      modified = true;
    }

    if (!state.selectedModel) {
      state.selectedModel = "gemini-2.5-flash-preview-tts";
      modified = true;
    }

    if (modified) {
      saveTTSPoolState(state);
    }

    return state;
  } catch (err) {
    console.error("Failed to parse TTS pool state:", err);
    return {
      activeProjectId: "proj-1",
      selectedModel: "gemini-2.5-flash-preview-tts",
      projects: getDefaultProjects(),
      groqApiKey: "",
    };
  }
}

export function saveTTSPoolState(state: TTSPoolState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save TTS pool state:", err);
  }
}

export function validateApiKeyUniqueness(
  targetProjectId: string,
  newKey: string,
  projects: TTSProject[]
): string | null {
  const trimmedKey = newKey.trim();
  if (!trimmedKey) return null;

  const duplicate = projects.find(
    (p) => p.id !== targetProjectId && p.apiKey.trim() === trimmedKey
  );

  if (duplicate) {
    return `Duplicate Key: This API key is already assigned to "${duplicate.name}". Each entry must have a unique Google Cloud Project key!`;
  }

  return null;
}

export function recordGenerationUsage(
  state: TTSPoolState,
  projectId: string,
  modelId: string,
  tokensUsed: number,
  audioSeconds: number
): TTSPoolState {
  const currentCycle = getCurrentQuotaCycleId();
  const nextProjects = state.projects.map((proj) => {
    if (proj.id !== projectId) return proj;

    let usage = proj.dailyUsage;
    if (!usage || usage.cycleDate !== currentCycle) {
      usage = {
        cycleDate: currentCycle,
        models: createInitialModelUsage(),
      };
    }

    const currentModelStats = usage.models[modelId] || {
      requestsCount: 0,
      tokensUsed: 0,
      audioSeconds: 0,
    };

    const nextModelStats: ModelUsageStats = {
      requestsCount: currentModelStats.requestsCount + 1,
      tokensUsed: currentModelStats.tokensUsed + tokensUsed,
      audioSeconds: currentModelStats.audioSeconds + audioSeconds,
    };

    return {
      ...proj,
      dailyUsage: {
        ...usage,
        models: {
          ...usage.models,
          [modelId]: nextModelStats,
        },
      },
    };
  });

  const nextState: TTSPoolState = {
    ...state,
    projects: nextProjects,
  };

  saveTTSPoolState(nextState);
  return nextState;
}

export function getRemainingRequests(
  project: TTSProject,
  modelId: string,
  dailyLimit: number = 10
): number {
  const currentCycle = getCurrentQuotaCycleId();
  if (!project.dailyUsage || project.dailyUsage.cycleDate !== currentCycle) {
    return dailyLimit;
  }
  const used = project.dailyUsage.models[modelId]?.requestsCount || 0;
  return Math.max(0, dailyLimit - used);
}
