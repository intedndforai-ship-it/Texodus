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
              <option v-for="f in EDITOR_FONTS" :key="f.label" :value="f.value">{{ f.label }}</option>
            </select>
          </div>

          <div class="settings-row">
            <label for="preview-font">Preview font</label>
            <select
              id="preview-font"
              :value="settingsStore.previewFont"
              @change="settingsStore.setPreviewFont(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="f in PREVIEW_FONTS" :key="f.label" :value="f.value">{{ f.label }}</option>
            </select>
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
                <option v-for="s in FONT_SIZES" :key="s" :value="s">{{ s }} px</option>
              </select>
              <button
                class="stepper-btn"
                :disabled="settingsStore.fontSize >= FONT_SIZE_MAX"
                aria-label="Increase font size"
                @click="settingsStore.setFontSize(settingsStore.fontSize + 1)"
              >+</button>
            </div>
          </div>

          <div class="settings-preview">
            <div class="sample" :style="{ fontFamily: settingsStore.editorFont, fontSize: settingsStore.fontSize + 'px' }">
              Editor: const greet = () =&gt; "Hello, world";
            </div>
            <div class="sample" :style="{ fontFamily: settingsStore.previewFont, fontSize: settingsStore.fontSize + 'px' }">
              Preview: The quick brown fox jumps over the lazy dog.
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import {
  useSettingsStore,
  EDITOR_FONTS,
  PREVIEW_FONTS,
  FONT_SIZES,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
} from '../stores/settings';

const settingsStore = useSettingsStore();

const close = () => { settingsStore.setSettingsVisible(false); };

const onKey = (e: KeyboardEvent) => {
  if (settingsStore.settingsVisible && e.key === 'Escape') {
    e.preventDefault();
    close();
  }
};

onMounted(() => window.addEventListener('keydown', onKey));
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

.settings-preview {
  margin-top: 0.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.sample {
  color: var(--text-color);
  line-height: 1.5;
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
