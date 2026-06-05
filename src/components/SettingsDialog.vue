<template>
  <Transition name="fade">
    <div v-if="settingsStore.settingsVisible" class="settings-overlay" @click.self="close">
      <div class="settings-dialog glass">
        <button class="close-btn" @click="close" aria-label="Close">&times;</button>

        <div class="dialog-header">
          <h2>Settings</h2>
        </div>

        <div class="dialog-body">
          <div class="settings-row">
            <label for="editor-font">Editor font</label>
            <select
              id="editor-font"
              :value="settingsStore.editorFont"
              @change="settingsStore.setEditorFont(($event.target as HTMLSelectElement).value)"
            >
              <optgroup label="Bundled">
                <option v-for="f in EDITOR_FONTS" :key="`bundled-editor-${f.label}`" :value="f.value">{{ f.label }}</option>
              </optgroup>
              <optgroup v-if="editorSystemFontOptions.length" label="System fonts">
                <option v-for="f in editorSystemFontOptions" :key="`system-editor-${f.label}`" :value="f.value">{{ f.label }}</option>
              </optgroup>
            </select>
          </div>

          <div class="settings-row">
            <label for="preview-font">Preview font</label>
            <select
              id="preview-font"
              :value="settingsStore.previewFont"
              @change="settingsStore.setPreviewFont(($event.target as HTMLSelectElement).value)"
            >
              <optgroup label="Bundled">
                <option v-for="f in PREVIEW_FONTS" :key="`bundled-preview-${f.label}`" :value="f.value">{{ f.label }}</option>
              </optgroup>
              <optgroup v-if="previewSystemFontOptions.length" label="System fonts">
                <option v-for="f in previewSystemFontOptions" :key="`system-preview-${f.label}`" :value="f.value">{{ f.label }}</option>
              </optgroup>
            </select>
          </div>

          <div class="settings-hint" aria-live="polite">
            <span v-if="systemFontsLoading">Loading system fonts…</span>
            <span v-else-if="systemFontsError">System fonts unavailable</span>
            <span v-else-if="settingsStore.systemFontsLoaded">{{ settingsStore.systemFonts.length }} system fonts found</span>
          </div>

          <div class="settings-row">
            <label>Open documents in</label>
            <div class="segmented" role="radiogroup" aria-label="Document mode">
              <button
                type="button"
                role="radio"
                :aria-checked="settingsStore.documentMode === 'windows'"
                :class="{ active: settingsStore.documentMode === 'windows' }"
                @click="settingsStore.setDocumentMode('windows')"
              >Windows</button>
              <button
                type="button"
                role="radio"
                :aria-checked="settingsStore.documentMode === 'tabs'"
                :class="{ active: settingsStore.documentMode === 'tabs' }"
                @click="settingsStore.setDocumentMode('tabs')"
              >Tabs</button>
            </div>
          </div>

          <div class="settings-row">
            <label for="font-size">Font size</label>
            <div class="stepper">
              <button
                class="stepper-btn"
                :disabled="settingsStore.fontSize <= FONT_SIZE_MIN"
                aria-label="Decrease font size"
                @click="settingsStore.setFontSize(settingsStore.fontSize - 1)"
              >−</button>
              <select
                id="font-size"
                class="stepper-value"
                :value="settingsStore.fontSize"
                @change="settingsStore.setFontSize(Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="s in FONT_SIZES" :key="s" :value="s">{{ s }} pt</option>
              </select>
              <button
                class="stepper-btn"
                :disabled="settingsStore.fontSize >= FONT_SIZE_MAX"
                aria-label="Increase font size"
                @click="settingsStore.setFontSize(settingsStore.fontSize + 1)"
              >+</button>
            </div>
          </div>

          <div class="settings-row">
            <label for="line-height">Line height</label>
            <div class="stepper">
              <button
                class="stepper-btn"
                :disabled="settingsStore.lineHeight <= LINE_HEIGHT_MIN"
                aria-label="Decrease line height"
                @click="settingsStore.setLineHeight(settingsStore.lineHeight - 0.05)"
              >−</button>
              <select
                id="line-height"
                class="stepper-value"
                :value="settingsStore.lineHeight"
                @change="settingsStore.setLineHeight(Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="h in LINE_HEIGHTS" :key="h" :value="h">{{ h.toFixed(2) }}</option>
              </select>
              <button
                class="stepper-btn"
                :disabled="settingsStore.lineHeight >= LINE_HEIGHT_MAX"
                aria-label="Increase line height"
                @click="settingsStore.setLineHeight(settingsStore.lineHeight + 0.05)"
              >+</button>
            </div>
          </div>

          <div class="settings-preview">
            <span class="section-label">Fonts preview</span>
            <div class="fonts-preview">
              <div class="sample" :style="{ fontFamily: settingsStore.editorFont, fontSize: settingsStore.fontSize + 'pt', lineHeight: String(settingsStore.lineHeight) }">
                <strong>Editor:</strong> const greet = () =&gt; "Hello, world";
              </div>
              <div class="sample" :style="{ fontFamily: settingsStore.previewFont, fontSize: settingsStore.fontSize + 'pt', lineHeight: String(settingsStore.lineHeight) }">
                <strong>Preview:</strong> The quick brown fox jumps over the lazy dog.
              </div>
            </div>
          </div>

          <div class="settings-section">
            <span class="section-label">Color scheme</span>
            <div class="scheme-grid">
              <button
                v-for="scheme in COLOR_SCHEMES"
                :key="scheme.id"
                class="scheme-swatch"
                :class="{ selected: settingsStore.colorScheme === scheme.id }"
                :title="scheme.label"
                :style="{
                  '--sl': scheme.light.bgColor,
                  '--sd': scheme.dark.bgColor,
                  '--sa': scheme.light.accentColor,
                }"
                @click="settingsStore.setColorScheme(scheme.id)"
              >
                <div class="swatch-halves">
                  <div class="swatch-h light-h"></div>
                  <div class="swatch-h dark-h"></div>
                </div>
                <div class="swatch-accent"></div>
                <span class="swatch-name">{{ scheme.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  useSettingsStore,
  EDITOR_FONTS,
  PREVIEW_FONTS,
  FONT_SIZES,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  LINE_HEIGHTS,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
} from '../stores/settings';
import { COLOR_SCHEMES } from '../themes';
import { invoke } from '@tauri-apps/api/core';

const settingsStore = useSettingsStore();
const systemFontsLoading = ref(false);
const systemFontsError = ref(false);

const quoteFontFamily = (name: string) => `'${name.replace(/'/g, "\\'")}'`;
const systemFontOptions = computed(() => {
  const bundledLabels = new Set([...EDITOR_FONTS, ...PREVIEW_FONTS].map(f => f.label));
  return settingsStore.systemFonts
    .filter(name => !bundledLabels.has(name))
    .map(name => ({ label: name, value: quoteFontFamily(name) }));
});
const editorSystemFontOptions = computed(() =>
  systemFontOptions.value.map(f => ({ ...f, value: `${f.value}, monospace` })),
);
const previewSystemFontOptions = computed(() =>
  systemFontOptions.value.map(f => ({ ...f, value: `${f.value}, system-ui, sans-serif` })),
);

async function loadSystemFonts() {
  if (settingsStore.systemFontsLoaded || systemFontsLoading.value) return;
  systemFontsLoading.value = true;
  systemFontsError.value = false;
  try {
    settingsStore.setSystemFonts(await invoke<string[]>('list_system_fonts'));
  } catch (e) {
    console.warn('Failed to list system fonts:', e);
    systemFontsError.value = true;
  } finally {
    systemFontsLoading.value = false;
  }
}

const close = () => { settingsStore.setSettingsVisible(false); };

const onKey = (e: KeyboardEvent) => {
  if (settingsStore.settingsVisible && e.key === 'Escape') {
    e.preventDefault();
    close();
  }
};

watch(
  () => settingsStore.settingsVisible,
  (visible) => {
    if (visible) void loadSystemFonts();
  },
);

onMounted(() => {
  window.addEventListener('keydown', onKey);
  if (settingsStore.settingsVisible) void loadSystemFonts();
});
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.settings-dialog {
  width: 360px;
  max-width: 90vw;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.glass {
  background: rgba(var(--bg-color-rgb, 255, 255, 255), 0.85);
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
  z-index: 10;
}

.close-btn:hover {
  background: var(--btn-hover);
  color: var(--text-color);
}

.dialog-header {
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.dialog-body {
  padding: 1rem 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.settings-row label {
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-weight: 500;
  white-space: nowrap;
}

.settings-row select {
  flex: 1;
  max-width: 58%;
  padding: 0.35rem 0.5rem;
  background: var(--bg-secondary);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.8125rem;
  cursor: pointer;
}

.settings-row select:focus {
  outline: 2px solid var(--accent-subtle);
  border-color: var(--accent-color);
}

.settings-hint {
  margin-top: -0.35rem;
  min-height: 1rem;
  font-size: 0.7rem;
  color: var(--text-muted);
  text-align: right;
}

.stepper {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-secondary);
  max-width: 58%;
  flex: 1;
}

.stepper-btn {
  width: 28px;
  background: transparent;
  border: none;
  color: var(--text-color);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.stepper-btn:hover:not(:disabled) {
  background: var(--btn-hover);
  color: var(--accent-color);
}

.stepper-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.stepper-value {
  flex: 1;
  background: transparent;
  border: none;
  border-left: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  padding: 0.35rem 0.4rem;
  color: var(--text-color);
  font-size: 0.8125rem;
  text-align: center;
  cursor: pointer;
}

.stepper-value:focus { outline: none; background: var(--btn-hover); }

.segmented {
  display: inline-flex;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  max-width: 58%;
  flex: 1;
}

.segmented button {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  padding: 0.35rem 0.6rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.segmented button + button {
  border-left: 1px solid var(--border-color);
}

.segmented button:hover:not(.active) {
  background: var(--btn-hover);
  color: var(--text-color);
}

.segmented button.active {
  background: var(--accent-subtle);
  color: var(--accent-color);
  font-weight: 500;
}

.settings-preview {
  margin-top: 0.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fonts-preview {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 0.85rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-top: 0.25rem;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.03);
}

.fonts-preview .sample {
  color: var(--text-color);
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.fonts-preview .sample strong {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.6875rem !important;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent-color);
  font-weight: 600;
  opacity: 0.9;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-weight: 500;
}

.scheme-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.scheme-swatch {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 7px;
  overflow: hidden;
  padding: 0;
  background: none;
  transition: border-color 0.15s, transform 0.1s;
}

.scheme-swatch:hover {
  transform: scale(1.04);
}

.scheme-swatch.selected {
  border-color: var(--accent-color);
}

.swatch-halves {
  display: flex;
  height: 32px;
}

.swatch-h.light-h {
  flex: 1;
  background: var(--sl);
}

.swatch-h.dark-h {
  flex: 1;
  background: var(--sd);
}

.swatch-accent {
  height: 3px;
  background: var(--sa);
}

.swatch-name {
  font-size: 0.5625rem;
  text-align: center;
  padding: 3px 2px;
  color: var(--text-color);
  background: var(--bg-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
