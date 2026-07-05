import { ref } from 'vue';
import { load } from '@tauri-apps/plugin-store';

export interface PromptTemplate {
  id: string;
  name: string;
  system: string;
  user: string;
}

const defaultTemplates: PromptTemplate[] = [
  {
    id: 'default-1',
    name: 'Summarize',
    system: 'You are an expert summarizer. Provide a concise, bulleted summary of the provided text. Focus on key takeaways.',
    user: 'Summarize the following text:\n\n{text}'
  },
  {
    id: 'default-2',
    name: 'Improve Writing',
    system: 'You are an expert editor. Rewrite the text to be more professional, clear, and concise. Fix any grammar and spelling mistakes.',
    user: '{text}'
  },
  {
    id: 'default-3',
    name: 'Expand',
    system: 'You are a creative writer. Expand on the provided text, adding more detail, context, and examples.',
    user: 'Expand this text:\n\n{text}'
  },
  {
    id: 'default-4',
    name: 'Explain Code',
    system: 'You are a senior developer. Explain the provided code step by step. Identify the language if not specified.',
    user: 'Explain this code:\n\n{text}'
  },
  {
    id: 'default-5',
    name: 'Format as Table',
    system: 'Format the provided data into a Markdown table. Do not add any text before or after the table.',
    user: '{text}'
  },
  {
    id: 'default-6',
    name: 'Brainstorm',
    system: 'You are an ideation assistant. Provide 5-10 creative ideas related to the prompt.',
    user: 'Brainstorm ideas for:\n\n{text}'
  }
];

const getStore = async () => await load('ai-settings.json', { autoSave: 100 } as any);

// Shared state for templates
const templates = ref<PromptTemplate[]>([]);

export function usePromptTemplates() {
  const loadTemplates = async () => {
    try {
      const store = await getStore();
      const saved = await store.get<PromptTemplate[]>('prompt-templates');
      if (saved && saved.length > 0) {
        templates.value = saved;
      } else {
        templates.value = [...defaultTemplates];
      }
    } catch (err) {
      console.warn("Failed to load templates:", err);
      templates.value = [...defaultTemplates];
    }
  };

  const saveTemplates = async () => {
    try {
      const store = await getStore();
      await store.set('prompt-templates', templates.value);
      await store.save();
    } catch (e) {
      console.error(e);
    }
  };

  const addTemplate = (template: Omit<PromptTemplate, 'id'>) => {
    const id = 'custom-' + Date.now().toString();
    templates.value.push({ ...template, id });
    void saveTemplates();
  };

  const updateTemplate = (id: string, updated: Omit<PromptTemplate, 'id'>) => {
    const index = templates.value.findIndex(t => t.id === id);
    if (index !== -1) {
      templates.value[index] = { ...updated, id };
      void saveTemplates();
    }
  };

  const deleteTemplate = (id: string) => {
    const index = templates.value.findIndex(t => t.id === id);
    if (index !== -1) {
      templates.value.splice(index, 1);
      void saveTemplates();
    }
  };

  const resetToDefaults = () => {
    templates.value = [...defaultTemplates];
    void saveTemplates();
  };

  return {
    templates,
    loadTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    resetToDefaults
  };
}
