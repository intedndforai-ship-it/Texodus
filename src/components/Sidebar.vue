<template>
  <aside class="sidebar" aria-label="Workspace files">
    <header class="sidebar__header">
      <div class="sidebar__title-row">
        <div class="sidebar__title">Workspace</div>
        <div class="sidebar__actions">
          <button
            class="sidebar__icon-button"
            type="button"
            title="Open Folder…"
            :disabled="workspaceStore.isLoading"
            @click="openFolder"
          >
            <span class="sidebar__button-icon" :style="{ '--icon': `url(${iconOpenFolder})` }"></span>
          </button>
          <button
            class="sidebar__icon-button"
            type="button"
            title="Refresh workspace"
            :disabled="!workspaceStore.rootPath || workspaceStore.isLoading"
            @click="refresh"
          >
            ↻
          </button>
        </div>
      </div>
      <div v-if="workspaceStore.rootPath" class="sidebar__root" :title="workspaceStore.rootPath">
        {{ rootName }}
      </div>
    </header>

    <div class="sidebar__body">
      <div v-if="workspaceStore.isLoading" class="sidebar__state">Loading files…</div>
      <div v-else-if="workspaceStore.error" class="sidebar__state sidebar__state--error">
        {{ workspaceStore.error }}
      </div>
      <div v-else-if="!workspaceStore.rootPath" class="sidebar__state">
        <p class="sidebar__state-text">Choose a folder to browse Markdown files.</p>
        <div v-if="settingsStore.lastWorkspacePath" class="sidebar__remembered">
          <div class="sidebar__remembered-label">Last workspace</div>
          <div class="sidebar__remembered-path" :title="settingsStore.lastWorkspacePath">
            {{ lastWorkspaceName }}
          </div>
          <button class="sidebar__remembered-button" type="button" @click="openLastFolder">
            Open Last Folder
          </button>
        </div>
      </div>
      <div v-else-if="workspaceStore.tree.length === 0" class="sidebar__state">
        No Markdown or text files found.
      </div>
      <ul v-else class="sidebar__tree">
        <SidebarNode
          v-for="node in workspaceStore.tree"
          :key="node.path"
          :node="node"
          :selected-path="workspaceStore.selectedPath"
          :expanded-paths="workspaceStore.expandedPaths"
          @open-file="openFile"
          @toggle-directory="toggleDirectory"
        />
      </ul>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import SidebarNode from './SidebarNode.vue';
import { useEditorStore } from '../stores/editor';
import { useSettingsStore } from '../stores/settings';
import { useWorkspaceStore } from '../stores/workspace';
import {
  loadWorkspaceDirectoryChildren,
  openRememberedWorkspaceFolder,
  openWorkspaceFolder,
  refreshWorkspaceTree,
} from '../services/workspaceService';
import { loadFileFromPath } from '../services/fileService';
import { basename } from '../utils/path';
import iconOpenFolder from '../assets/icons/icons8-open-file-100.png';

const editorStore = useEditorStore();
const settingsStore = useSettingsStore();
const workspaceStore = useWorkspaceStore();

const rootName = computed(() => workspaceStore.rootPath ? basename(workspaceStore.rootPath) : '');
const lastWorkspaceName = computed(() => settingsStore.lastWorkspacePath ? basename(settingsStore.lastWorkspacePath) : '');

watch(
  () => editorStore.filePath,
  (path) => workspaceStore.setSelectedPath(path),
  { immediate: true }
);

async function openFolder() {
  try {
    await openWorkspaceFolder();
  } catch (e) {
    workspaceStore.setError(e instanceof Error ? e.message : String(e));
  }
}

async function refresh() {
  await refreshWorkspaceTree();
}

async function openLastFolder() {
  await openRememberedWorkspaceFolder();
}

async function toggleDirectory(path: string) {
  if (!workspaceStore.isExpanded(path)) {
    await loadWorkspaceDirectoryChildren(path);
  }
  workspaceStore.toggleExpanded(path);
}

async function openFile(path: string) {
  await loadFileFromPath(editorStore, path);
  if (editorStore.filePath === path) workspaceStore.setSelectedPath(path);
}
</script>

<style scoped>
.sidebar {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-color);
  overflow: hidden;
}

.sidebar__header {
  flex: 0 0 auto;
  padding: 0.85rem 0.75rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.sidebar__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
}

.sidebar__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.sidebar__title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.sidebar__root {
  margin-bottom: 0.65rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 600;
}

.sidebar__icon-button {
  width: 1.8rem;
  height: 1.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-color);
  color: var(--text-color);
  font: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.sidebar__button-icon {
  width: 0.95rem;
  height: 0.95rem;
  background-color: currentColor;
  -webkit-mask: var(--icon) center / contain no-repeat;
  mask: var(--icon) center / contain no-repeat;
}

.sidebar__icon-button:hover:not(:disabled) {
  background: var(--btn-hover);
}

.sidebar__icon-button:disabled {
  cursor: default;
  opacity: 0.55;
}

.sidebar__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.55rem;
}

.sidebar__tree {
  margin: 0;
  padding: 0;
}

.sidebar__state {
  padding: 0.8rem 0.45rem;
  color: var(--text-muted);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.sidebar__state-text {
  margin: 0 0 0.8rem;
}

.sidebar__remembered {
  padding: 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-color);
}

.sidebar__remembered-label {
  margin-bottom: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sidebar__remembered-path {
  margin-bottom: 0.6rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-color);
  font-weight: 600;
}

.sidebar__remembered-button {
  width: 100%;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-secondary);
  color: var(--text-color);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.sidebar__remembered-button:hover {
  background: var(--btn-hover);
}

.sidebar__state--error {
  color: #d04b4b;
}
</style>
