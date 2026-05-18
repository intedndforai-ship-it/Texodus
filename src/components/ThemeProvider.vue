<template>
  <div class="theme-root" :class="resolvedTheme" :style="themeStyle">
    <slot></slot>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { COLOR_SCHEMES } from '../themes';

const settingsStore = useSettingsStore();
const systemDark = ref(false);

let mq = null;
const updateSystemTheme = (e) => { systemDark.value = e.matches; };

onMounted(() => {
  mq = window.matchMedia('(prefers-color-scheme: dark)');
  systemDark.value = mq.matches;
  mq.addEventListener('change', updateSystemTheme);
});

onUnmounted(() => {
  mq?.removeEventListener('change', updateSystemTheme);
});

const resolvedTheme = computed(() => {
  if (settingsStore.themeMode === 'system') {
    return systemDark.value ? 'dark' : 'light';
  }
  return settingsStore.themeMode;
});

const themeStyle = computed(() => {
  const scheme = COLOR_SCHEMES.find(s => s.id === settingsStore.colorScheme) ?? COLOR_SCHEMES[0];
  const t = scheme[resolvedTheme.value];
  return {
    '--bg-color':               t.bgColor,
    '--bg-secondary':           t.bgSecondary,
    '--toolbar-bg':             t.toolbarBg,
    '--border-color':           t.borderColor,
    '--text-color':             t.textColor,
    '--text-muted':             t.textMuted,
    '--accent-color':           t.accentColor,
    '--accent-subtle':          t.accentSubtle,
    '--btn-hover':              t.btnHover,
    '--code-bg':                t.codeBg,
    '--code-text':              t.codeText,
    '--inline-code-bg':         t.inlineCodeBg,
    '--blockquote-bg':          t.blockquoteBg,
    '--scrollbar-thumb':        t.scrollbarThumb,
    '--scrollbar-thumb-hover':  t.scrollbarThumbHover,
    '--heading-color':          t.headingColor,
    '--syntax-text':            t.codeText,
    '--syntax-comment':         t.syntaxComment,
    '--syntax-keyword':         t.syntaxKeyword,
    '--syntax-string':          t.syntaxString,
    '--syntax-number':          t.syntaxNumber,
    '--syntax-function':        t.syntaxFunction,
    '--syntax-variable':        t.syntaxVariable,
    '--syntax-punctuation':     t.syntaxPunctuation,
    '--editor-font':            settingsStore.editorFont,
    '--preview-font':           settingsStore.previewFont,
  };
});
</script>

<style>
/* ── Design tokens ──────────────────────────────────────────── */
.theme-root {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  transition: background-color 0.25s, color 0.25s;
}

/* Global resets */
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  padding: 0;
  background: var(--bg-color);
  color: var(--text-color);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar — overlay style: hidden by default, briefly visible while
   scrolling. The `.is-scrolling` class is toggled by scroll handlers in
   TextEditor.vue and MarkdownPreview.vue. */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background-color: transparent;
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 5px;
  transition: background-color 0.4s ease;
}

.editor-textarea.is-scrolling::-webkit-scrollbar-thumb,
.preview-content.is-scrolling::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-thumb);
}

.editor-textarea.is-scrolling::-webkit-scrollbar-thumb:hover,
.preview-content.is-scrolling::-webkit-scrollbar-thumb:hover {
  background-color: var(--scrollbar-thumb-hover);
}

/* Firefox / Gecko (no-op in Tauri's WebKit/WebView2, but kept for parity). */
* { scrollbar-width: thin; scrollbar-color: transparent transparent; }
.editor-textarea.is-scrolling,
.preview-content.is-scrolling { scrollbar-color: var(--scrollbar-thumb) transparent; }
</style>
