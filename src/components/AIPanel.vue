<template>
  <div class="ai-panel">
    <div class="ai-panel-header">
      <h3>AI Assistant</h3>
      <div class="ai-tabs">
        <button :class="{ active: activeTab === 'generate' }" @click="activeTab = 'generate'">Generate</button>
        <button :class="{ active: activeTab === 'templates' }" @click="activeTab = 'templates'">Templates</button>
        <button :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">History</button>
      </div>
    </div>

    <div class="ai-panel-body">
      <!-- TAB: GENERATE -->
      <div v-if="activeTab === 'generate'" class="ai-tab-content ai-generate-tab">
        
        <div class="ai-form-group">
          <label>Provider</label>
          <select :value="ai.activeProvider.value" @change="handleProviderChange">
            <option value="mistral">Mistral Large 3</option>
            <option value="nemotron">Nemotron Ultra</option>
            <option value="glm">GLM 5.2</option>
          </select>
        </div>
        
        <div class="ai-form-group">
          <label>System Prompt</label>
          <textarea v-model="systemPrompt" rows="3" placeholder="Context or instructions for the AI..."></textarea>
        </div>

        <div class="ai-form-group">
          <label>User Prompt</label>
          <textarea v-model="userPrompt" rows="4" placeholder="What do you want to generate or modify?"></textarea>
        </div>

        <!-- Quick actions -->
        <div class="ai-quick-actions">
          <button class="ai-action-btn" @click="applyAction('Summarize the selection')">Summarize</button>
          <button class="ai-action-btn" @click="applyAction('Improve grammar and clarity')">Improve</button>
          <button class="ai-action-btn" @click="applyAction('Explain this text/code')">Explain</button>
          <button class="ai-action-btn" @click="applyAction('Expand and add detail')">Expand</button>
        </div>

        <div class="ai-controls">
          <button 
            v-if="!ai.isGenerating.value" 
            class="ai-btn ai-btn--primary" 
            @click="handleGenerate"
            :disabled="!userPrompt.trim()"
          >
            &#10024; Generate
          </button>
          
          <button 
            v-else 
            class="ai-btn ai-btn--stop" 
            @click="ai.stop()"
          >
            &#9209; Stop
          </button>
          
          <button class="ai-btn ai-btn--ghost" @click="ai.clearAll()" title="Clear output">
            &#128465;
          </button>
        </div>

        <!-- Error -->
        <div v-if="ai.error.value" class="ai-error">
          <div class="ai-error__msg">{{ ai.error.value }}</div>
        </div>

        <!-- Output -->
        <div v-if="ai.outputText.value || ai.isGenerating.value" class="ai-output-wrap">
          <div class="ai-output-header">
            <span class="ai-label">Output</span>
            <div class="ai-output-meta">
              <span v-if="ai.isGenerating.value" class="ai-badge ai-badge--live">
                <span class="ai-dot"></span> Generating...
              </span>
              <span v-else-if="ai.generationDuration.value" class="ai-badge">
                {{ ai.generationDuration.value }}s
              </span>
            </div>
          </div>

          <div class="ai-output">
            <pre class="ai-output__pre">{{ ai.outputText.value }}</pre>
          </div>
          
          <div class="ai-output-stats">{{ ai.outputWordCount.value }} words</div>

          <div v-if="ai.outputText.value && !ai.isGenerating.value" class="ai-insert-row">
            <button class="ai-insert-btn" @click="$emit('insert', ai.outputText.value)" title="Insert at cursor">&#8601; Insert</button>
            <button class="ai-insert-btn" @click="$emit('replace', ai.outputText.value)" title="Replace selected text">&#8644; Replace</button>
            <button class="ai-insert-btn" @click="$emit('append', ai.outputText.value)" title="Append to document">&#8595; Append</button>
            <button class="ai-insert-btn" @click="copyOutput" title="Copy to clipboard">&#9112; Copy</button>
          </div>
        </div>

      </div>

      <!-- TAB: TEMPLATES -->
      <div v-if="activeTab === 'templates'" class="ai-tab-content">
        <div class="ai-templates-list">
          <div 
            v-for="tpl in pTemplates.templates.value" 
            :key="tpl.id" 
            class="ai-template-item"
            @click="loadTemplate(tpl)"
          >
            <div class="ai-template-name">{{ tpl.name }}</div>
            <div class="ai-template-preview">{{ tpl.system.substring(0, 50) }}...</div>
          </div>
        </div>
      </div>

      <!-- TAB: HISTORY -->
      <div v-if="activeTab === 'history'" class="ai-tab-content">
        <div v-if="history.length === 0" class="ai-empty-state">
          No generation history yet.
        </div>
        <div class="ai-history-list">
          <div v-for="(item, i) in history" :key="i" class="ai-history-item" @click="loadHistoryItem(item)">
            <div class="ai-history-prompt">{{ item.userPrompt }}</div>
            <div class="ai-history-time">{{ new Date(item.timestamp).toLocaleTimeString() }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAI } from '../composables/useAI';
import { usePromptTemplates, PromptTemplate } from '../composables/usePromptTemplates';

const emit = defineEmits<{
  (e: 'insert', text: string): void;
  (e: 'replace', text: string): void;
  (e: 'append', text: string): void;
}>();

const props = defineProps<{
  selectedText?: string;
}>();

const activeTab = ref('generate');
const systemPrompt = ref('You are a helpful assistant.');
const userPrompt = ref('');

const ai = useAI();
const pTemplates = usePromptTemplates();

// Basic session history
const history = ref<{ systemPrompt: string, userPrompt: string, timestamp: number }[]>([]);

onMounted(() => {
  ai.loadKeys();
  pTemplates.loadTemplates();
});

watch(() => props.selectedText, (newText) => {
  if (newText) {
    userPrompt.value = userPrompt.value.replace('{text}', newText);
  }
});

const handleProviderChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value;
  ai.setActiveProvider(val as any);
};

const handleGenerate = async () => {
  if (!userPrompt.value.trim()) return;
  
  // Replace {text} with selected text if it exists
  const finalUser = props.selectedText 
    ? userPrompt.value.replace('{text}', props.selectedText)
    : userPrompt.value;

  history.value.unshift({
    systemPrompt: systemPrompt.value,
    userPrompt: finalUser,
    timestamp: Date.now()
  });

  await ai.generate(systemPrompt.value, finalUser);
};

const applyAction = (actionText: string) => {
  userPrompt.value = actionText + ':\n\n{text}';
};

const loadTemplate = (tpl: PromptTemplate) => {
  systemPrompt.value = tpl.system;
  userPrompt.value = tpl.user;
  activeTab.value = 'generate';
};

const loadHistoryItem = (item: { systemPrompt: string, userPrompt: string }) => {
  systemPrompt.value = item.systemPrompt;
  userPrompt.value = item.userPrompt;
  activeTab.value = 'generate';
};

const copyOutput = () => {
  navigator.clipboard.writeText(ai.outputText.value);
};
</script>

<style scoped>
.ai-panel {
  display: flex;
  flex-direction: column;
  width: 320px;
  height: 100%;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  color: var(--text-color);
  font-size: 0.875rem;
}

.ai-panel-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.ai-panel-header h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--heading-color);
}

.ai-tabs {
  display: flex;
  gap: 0.5rem;
}

.ai-tabs button {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.2s;
}

.ai-tabs button.active {
  background: var(--accent-subtle);
  color: var(--accent-color);
  font-weight: 500;
}

.ai-tabs button:hover:not(.active) {
  background: var(--btn-hover);
  color: var(--text-color);
}

.ai-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.ai-tab-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ai-form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ai-form-group label {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
}

.ai-form-group select,
.ai-form-group textarea {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  border-radius: 6px;
  padding: 0.5rem;
  font-family: inherit;
  resize: vertical;
}

.ai-form-group select:focus,
.ai-form-group textarea:focus {
  outline: none;
  border-color: var(--accent-color);
}

.ai-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ai-action-btn {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  border-radius: 12px;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.ai-action-btn:hover {
  background: var(--btn-hover);
  color: var(--text-color);
  border-color: var(--text-muted);
}

.ai-controls {
  display: flex;
  gap: 0.5rem;
}

.ai-btn {
  flex: 1;
  padding: 0.5rem;
  border-radius: 6px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.ai-btn--primary {
  background: var(--accent-color);
  color: #fff;
}

.ai-btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-btn--stop {
  background: var(--danger-color);
  color: #fff;
}

.ai-btn--ghost {
  flex: 0 0 auto;
  background: transparent;
  color: var(--text-muted);
  padding: 0.5rem;
}

.ai-btn--ghost:hover {
  color: var(--danger-color);
}

.ai-error {
  padding: 0.5rem;
  border-radius: 6px;
  background: rgba(220, 38, 38, 0.1);
  color: var(--danger-color);
  font-size: 0.8125rem;
}

.ai-output-wrap {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ai-output-header {
  background: var(--bg-color);
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ai-label {
  font-weight: 600;
  font-size: 0.75rem;
}

.ai-badge {
  font-size: 0.6875rem;
  padding: 0.1rem 0.4rem;
  border-radius: 12px;
  background: var(--bg-secondary);
  color: var(--text-muted);
}

.ai-badge--live {
  background: var(--accent-subtle);
  color: var(--accent-color);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.ai-dot {
  width: 6px;
  height: 6px;
  background: var(--accent-color);
  border-radius: 50%;
  animation: pulse 1s infinite alternate;
}

@keyframes pulse {
  from { opacity: 0.4; }
  to { opacity: 1; }
}

.ai-output {
  padding: 0.5rem;
  background: var(--code-bg);
  color: var(--code-text);
  max-height: 300px;
  overflow-y: auto;
}

.ai-output__pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: var(--preview-font, inherit);
}

.ai-output-stats {
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-align: right;
  background: var(--bg-color);
  border-top: 1px solid var(--border-color);
}

.ai-insert-row {
  display: flex;
  border-top: 1px solid var(--border-color);
  background: var(--bg-color);
}

.ai-insert-btn {
  flex: 1;
  background: transparent;
  border: none;
  border-right: 1px solid var(--border-color);
  color: var(--accent-color);
  padding: 0.4rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
}

.ai-insert-btn:last-child {
  border-right: none;
}

.ai-insert-btn:hover {
  background: var(--accent-subtle);
}

.ai-template-item, .ai-history-item {
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 0.5rem;
  background: var(--bg-color);
  cursor: pointer;
}

.ai-template-item:hover, .ai-history-item:hover {
  border-color: var(--accent-color);
}

.ai-template-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.ai-template-preview, .ai-history-prompt {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.ai-history-time {
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-align: right;
  margin-top: 0.25rem;
}
</style>
