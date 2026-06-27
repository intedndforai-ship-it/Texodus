<template>
  <div class="export-menu" ref="menuContainer">
    <button class="trigger icon-only" @click="toggleMenu" title="Export Document" :disabled="isExporting">
      <span v-if="isExporting" class="trigger-spinner"></span>
      <span v-else class="trigger-icon" :style="{ '--icon': `url(${iconExport})` }"></span>
    </button>

    <div v-if="isOpen" class="dropdown-menu">
      <div class="menu-header">Export Options</div>

      <div class="menu-item" @click="triggerExport('pdf')">
        <span class="icon">📄</span>
        <span class="label">Export as PDF…</span>
        <span class="shortcut">{{ pdfShortcut }}</span>
      </div>

      <div class="menu-item" @click="triggerExport('html')">
        <span class="icon">🌐</span>
        <span class="label">Export as HTML…</span>
        <span class="shortcut">{{ htmlShortcut }}</span>
      </div>

      <div class="menu-item" @click="triggerExport('txt')">
        <span class="icon">📝</span>
        <span class="label">Export as TXT…</span>
        <span class="shortcut">{{ txtShortcut }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useEditorStore } from '../stores/editor';
import { exportPdf, exportHtml, exportTxt } from '../services/exportService';
import iconExport from '../assets/icons/icons8-export-100.png';
import { isMac } from '../utils/platform';

const isOpen = ref(false);
const isExporting = ref(false);
const menuContainer = ref<HTMLElement | null>(null);
const editorStore = useEditorStore();

const pdfShortcut = computed(() => isMac ? '⌘⇧P' : 'Ctrl+Shift+P');
const htmlShortcut = computed(() => isMac ? '⌘⇧H' : 'Ctrl+Shift+H');
const txtShortcut = computed(() => isMac ? '⌘⇧X' : 'Ctrl+Shift+X');

const toggleMenu = () => {
  isOpen.value = !isOpen.value;
};

const closeMenu = (e: MouseEvent) => {
  if (menuContainer.value && !menuContainer.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
};

const triggerExport = async (format: 'pdf' | 'html' | 'txt') => {
  isOpen.value = false;
  isExporting.value = true;
  try {
    if (format === 'pdf') {
      await exportPdf(editorStore.content, editorStore.filePath);
    } else if (format === 'html') {
      await exportHtml(editorStore.content, editorStore.filePath);
    } else if (format === 'txt') {
      await exportTxt(editorStore.content, editorStore.filePath);
    }
  } finally {
    isExporting.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', closeMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenu);
});
</script>

<style scoped>
.export-menu {
  position: relative;
  display: inline-block;
}

.trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-color);
  font-size: 0.8125rem;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
  height: 24px;
}

.trigger:hover {
  background: var(--btn-hover);
  color: var(--accent-color);
}

.trigger.icon-only {
  padding: 0.25rem 0.35rem;
}

.trigger-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  background-color: currentColor;
  -webkit-mask: var(--icon) center / contain no-repeat;
  mask: var(--icon) center / contain no-repeat;
  transition: transform 0.15s;
}

.trigger:hover .trigger-icon {
  transform: scale(1.1);
}

.trigger:active {
  transform: scale(0.94);
}

.trigger:disabled {
  opacity: 0.6;
  cursor: progress;
}

.trigger-spinner {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border: 2px solid var(--text-muted);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: export-spin 0.7s linear infinite;
}

@keyframes export-spin {
  to { transform: rotate(360deg); }
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  width: 240px;
  background: var(--bg-color, #ffffff);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: 6px 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.menu-header {
  padding: 6px 16px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.1s, color 0.1s;
  color: var(--text-color);
  font-size: 0.85rem;
}

.menu-item:hover {
  background: var(--btn-hover);
  color: var(--accent-color);
}

.icon {
  width: 20px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  margin-right: 8px;
  font-size: 1rem;
}

.label {
  flex: 1;
  text-align: left;
}

.shortcut {
  font-size: 0.75rem;
  opacity: 0.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  margin-left: 12px;
}
</style>
