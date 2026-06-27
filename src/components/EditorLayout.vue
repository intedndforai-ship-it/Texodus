<template>
  <div class="editor-container" :class="layoutMode" ref="containerRef">
    <Transition name="panel">
      <div v-if="layoutMode !== 'preview'" class="editor-pane" :style="paneStyle">
        <slot name="editor"></slot>
      </div>
    </Transition>
    <div
      v-if="layoutMode === 'split'"
      class="pane-divider"
      @mousedown="startDrag"
    ></div>
    <Transition name="panel">
      <div v-if="layoutMode !== 'focus'" class="preview-pane" :style="paneStyle">
        <slot name="preview"></slot>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { type LayoutMode } from '../stores/settings';

const props = defineProps<{
  layoutMode: LayoutMode;
}>();

const containerRef = ref<HTMLElement | null>(null);
const splitRatio = ref(0.5);

const paneStyle = computed(() => {
  if (props.layoutMode !== 'split') return {};
  return { flex: `0 0 ${splitRatio.value * 100}%` };
});

// ── Draggable divider ────────────────────────────────────────────────────

function startDrag(e: MouseEvent) {
  e.preventDefault();
  const container = containerRef.value;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const onMove = (ev: MouseEvent) => {
    const x = ev.clientX - rect.left;
    const ratio = Math.max(0.15, Math.min(0.85, x / rect.width));
    splitRatio.value = ratio;
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// Reset ratio when leaving split mode so it starts fresh next time.
watch(() => props.layoutMode, (mode) => {
  if (mode !== 'split') splitRatio.value = 0.5;
});
</script>

<style scoped>
.editor-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  width: 100%;
  background: var(--bg-color);
  transition: background 0.25s;
}

.editor-pane,
.preview-pane {
  flex: 1;
  height: 100%;
  overflow: hidden;
  min-width: 0;
}

/* Resize divider */
.pane-divider {
  width: 5px;
  background: var(--border-color);
  flex-shrink: 0;
  cursor: col-resize;
  transition: background 0.15s;
  position: relative;
  z-index: 1;
}

.pane-divider:hover,
.pane-divider:active {
  background: var(--accent-color);
}

/* Single-pane modes: pane spans the full window so the scroll container
   covers the entire surface (otherwise the side gutters swallow scroll
   events). Content is centered visually via dynamic horizontal padding on
   the inner scrollable element, not via constraining the outer pane. */
.editor-container.preview .preview-pane :deep(.preview-content),
.editor-container.focus .editor-pane :deep(.cm-scroller) {
  padding-left: max(2.5rem, calc((100% - 780px) / 2));
  padding-right: max(2.5rem, calc((100% - 780px) / 2));
}

/* ── Panel transition (§2.3) ── */
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.panel-enter-from {
  opacity: 0;
  transform: translateX(12px);
}

.panel-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>