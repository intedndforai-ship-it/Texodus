import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { load } from '@tauri-apps/plugin-store';

interface StreamPayload {
  provider: string;
  text: string;
  is_done: boolean;
}

export interface AIKeys {
  mistral: string;
  nemotron: string;
  glm: string;
}

// Global state so it persists across panel toggles
const isGenerating = ref(false);
const outputText = ref('');
const error = ref('');
const generationDuration = ref(0);
let timer: number | null = null;
let startTime = 0;
let stopRequested = false;

// We use a Lazy store promise so it can be loaded async
const getStore = async () => await load('ai-settings.json', { autoSave: 100 } as any);

export function useAI() {
  const activeProvider = ref<'mistral' | 'nemotron' | 'glm'>('mistral');
  const aiKeys = ref<AIKeys>({ mistral: '', nemotron: '', glm: '' });

  const loadKeys = async () => {
    try {
      const store = await getStore();
      const mistral = await store.get<string>('key-mistral') || '';
      const nemotron = await store.get<string>('key-nemotron') || '';
      const glm = await store.get<string>('key-glm') || '';
      const savedProvider = await store.get<'mistral'|'nemotron'|'glm'>('active-provider') || 'mistral';
      
      aiKeys.value = { mistral, nemotron, glm };
      activeProvider.value = savedProvider;
    } catch (err) {
      console.warn("Failed to load AI settings:", err);
    }
  };

  const saveKey = async (provider: keyof AIKeys, key: string) => {
    aiKeys.value[provider] = key;
    try {
      const store = await getStore();
      await store.set(`key-${provider}`, key);
      await store.save();
    } catch (e) {
      console.error(e);
    }
  };

  const setActiveProvider = async (provider: 'mistral' | 'nemotron' | 'glm') => {
    activeProvider.value = provider;
    try {
      const store = await getStore();
      await store.set('active-provider', provider);
      await store.save();
    } catch (e) {
      console.error(e);
    }
  };

  const testConnection = async (provider: keyof AIKeys, key: string): Promise<boolean> => {
    try {
      return await invoke<boolean>('ai_test_connection', { provider, apiKey: key });
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const generate = async (systemPrompt: string, userPrompt: string) => {
    if (isGenerating.value) return;
    const currentKey = aiKeys.value[activeProvider.value];
    if (!currentKey) {
      error.value = `API key for ${activeProvider.value} is missing. Please configure it in settings.`;
      return;
    }

    error.value = '';
    outputText.value = '';
    isGenerating.value = true;
    stopRequested = false;
    generationDuration.value = 0;
    startTime = Date.now();
    
    if (timer) clearInterval(timer);
    timer = window.setInterval(() => {
      generationDuration.value = Number(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    const command = `ai_generate_${activeProvider.value}`;
    
    // We set up the listener first
    const unlisten = await listen<StreamPayload>('ai-chunk', (event) => {
      if (stopRequested) return; // Ignore chunks if stopped
      if (event.payload.is_done) {
        finishGeneration();
      } else {
        outputText.value += event.payload.text;
      }
    });

    try {
      // Async invocation to backend which handles streaming via event emission
      await invoke(command, {
        apiKey: currentKey,
        systemPrompt,
        userPrompt
      });
    } catch (err: any) {
      error.value = String(err);
      finishGeneration();
    } finally {
      // Cleanup listener when done or errored
      unlisten();
    }
  };

  const finishGeneration = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    isGenerating.value = false;
  };

  const stop = () => {
    stopRequested = true;
    finishGeneration();
  };

  const clearAll = () => {
    outputText.value = '';
    error.value = '';
    generationDuration.value = 0;
  };

  const outputWordCount = computed(() => {
    if (!outputText.value) return 0;
    return outputText.value.trim().split(/\s+/).length;
  });

  return {
    isGenerating,
    outputText,
    error,
    generationDuration,
    outputWordCount,
    aiKeys,
    activeProvider,
    loadKeys,
    saveKey,
    setActiveProvider,
    testConnection,
    generate,
    stop,
    clearAll
  };
}
