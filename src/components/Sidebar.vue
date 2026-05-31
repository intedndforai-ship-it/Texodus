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

    <div class="sidebar__body" @contextmenu.prevent="openRootContextMenu">
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
          @node-context-menu="openNodeContextMenu"
        />
      </ul>
    </div>

    <div
      v-if="contextMenu.visible && contextMenu.node"
      class="sidebar-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <button type="button" @click="runContextAction('new-file')">New File</button>
      <button type="button" @click="runContextAction('new-folder')">New Folder</button>
      <div v-if="!contextMenu.isRoot" class="sidebar-context-menu__separator"></div>
      <button v-if="!contextMenu.isRoot" type="button" @click="runContextAction('rename')">Rename</button>
      <button v-if="!contextMenu.isRoot" type="button" class="sidebar-context-menu__danger" @click="runContextAction('delete')">Delete</button>
      <div class="sidebar-context-menu__separator"></div>
      <button type="button" @click="runContextAction('reveal')">Reveal in Finder/Explorer</button>
      <button type="button" @click="runContextAction('copy-relative-path')">Copy Relative Path</button>
    </div>

    <div v-if="namePrompt.visible" class="sidebar-prompt-backdrop" @click.self="closeNamePrompt">
      <form class="sidebar-prompt" @submit.prevent="confirmNamePrompt">
        <label class="sidebar-prompt__label" for="sidebar-name-input">{{ namePrompt.title }}</label>
        <input
          id="sidebar-name-input"
          ref="nameInputRef"
          v-model="namePrompt.value"
          class="sidebar-prompt__input"
          type="text"
          autofocus
          @keydown.escape.prevent="closeNamePrompt"
        />
        <div class="sidebar-prompt__actions">
          <button type="button" @click="closeNamePrompt">Cancel</button>
          <button type="submit">OK</button>
        </div>
      </form>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
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
import {
  copyWorkspaceRelativePath,
  createWorkspaceFile,
  createWorkspaceFolder,
  deleteWorkspaceNode,
  renameWorkspaceNode,
  revealWorkspaceNode,
} from '../services/workspaceFileOperations';
import { type FileTreeNode } from '../stores/workspace';
import { basename } from '../utils/path';
import iconOpenFolder from '../assets/icons/icons8-open-file-100.png';

const editorStore = useEditorStore();
const settingsStore = useSettingsStore();
const workspaceStore = useWorkspaceStore();

const rootName = computed(() => workspaceStore.rootPath ? basename(workspaceStore.rootPath) : '');
const lastWorkspaceName = computed(() => settingsStore.lastWorkspacePath ? basename(settingsStore.lastWorkspacePath) : '');
const nameInputRef = ref<HTMLInputElement | null>(null);
const contextMenu = reactive<{
  visible: boolean;
  x: number;
  y: number;
  node: FileTreeNode | null;
  isRoot: boolean;
}>({ visible: false, x: 0, y: 0, node: null, isRoot: false });

const namePrompt = reactive<{
  visible: boolean;
  title: string;
  value: string;
  action: 'new-file' | 'new-folder' | 'rename' | null;
  node: FileTreeNode | null;
}>({ visible: false, title: '', value: '', action: null, node: null });

watch(
  () => editorStore.filePath,
  (path) => workspaceStore.setSelectedPath(path),
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('keydown', handleContextMenuKeydown);
});

onUnmounted(() => {
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('keydown', handleContextMenuKeydown);
});

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

function openNodeContextMenu(node: FileTreeNode, event: MouseEvent) {
  contextMenu.visible = true;
  contextMenu.node = node;
  contextMenu.isRoot = false;
  const position = getContextMenuPosition(event);
  contextMenu.x = position.x;
  contextMenu.y = position.y;
}

function openRootContextMenu(event: MouseEvent) {
  if (!workspaceStore.rootPath) return;
  contextMenu.visible = true;
  contextMenu.isRoot = true;
  contextMenu.node = {
    name: rootName.value || workspaceStore.rootPath,
    path: workspaceStore.rootPath,
    kind: 'directory',
    children: workspaceStore.tree,
  };
  const position = getContextMenuPosition(event);
  contextMenu.x = position.x;
  contextMenu.y = position.y;
}

function getContextMenuPosition(event: MouseEvent): { x: number; y: number } {
  const menuWidth = 210;
  const menuHeight = contextMenu.isRoot ? 150 : 250;
  const padding = 8;
  const x = Math.min(event.clientX, window.innerWidth - menuWidth - padding);
  const opensUpward = event.clientY + menuHeight + padding > window.innerHeight;
  const y = opensUpward
    ? Math.max(padding, event.clientY - menuHeight)
    : event.clientY;

  return { x, y };
}

function closeContextMenu() {
  contextMenu.visible = false;
}

function handleContextMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeContextMenu();
}

async function runContextAction(action: string) {
  const node = contextMenu.node;
  closeContextMenu();
  if (!node) return;

  if (action === 'new-file') openNamePrompt('new-file', node, 'New file name', 'untitled.md');
  else if (action === 'new-folder') openNamePrompt('new-folder', node, 'New folder name', 'New Folder');
  else if (action === 'rename') openNamePrompt('rename', node, 'Rename', node.name);
  else if (action === 'delete') await deleteWorkspaceNode(node);
  else if (action === 'reveal') await revealWorkspaceNode(node);
  else if (action === 'copy-relative-path') await copyWorkspaceRelativePath(node);
}

function openNamePrompt(
  action: 'new-file' | 'new-folder' | 'rename',
  node: FileTreeNode,
  title: string,
  value: string,
) {
  namePrompt.visible = true;
  namePrompt.title = title;
  namePrompt.value = value;
  namePrompt.action = action;
  namePrompt.node = node;

  void nextTick(() => {
    nameInputRef.value?.focus();
    nameInputRef.value?.select();
  });
}

function closeNamePrompt() {
  namePrompt.visible = false;
  namePrompt.action = null;
  namePrompt.node = null;
}

async function confirmNamePrompt() {
  const node = namePrompt.node;
  const action = namePrompt.action;
  const value = namePrompt.value.trim();
  closeNamePrompt();
  if (!node || !action || !value) return;

  if (action === 'new-file') await createWorkspaceFile(node, value);
  else if (action === 'new-folder') await createWorkspaceFolder(node, value);
  else if (action === 'rename') await renameWorkspaceNode(node, value);
}

async function openFile(path: string) {
  await loadFileFromPath(editorStore, path);
  if (editorStore.filePath === path) workspaceStore.setSelectedPath(path);
}
</script>

<style scoped>
.sidebar {
  position: relative;
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

.sidebar-context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 190px;
  padding: 0.3rem;
  border: 1px solid var(--border-color);
  border-radius: 9px;
  background: var(--bg-color);
  color: var(--text-color);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
}

.sidebar-context-menu button {
  width: 100%;
  display: block;
  padding: 0.45rem 0.55rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
}

.sidebar-context-menu button:hover {
  background: var(--btn-hover);
}

.sidebar-context-menu__danger {
  color: #d04b4b !important;
}

.sidebar-context-menu__separator {
  height: 1px;
  margin: 0.25rem 0.2rem;
  background: var(--border-color);
}

.sidebar-prompt-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
}

.sidebar-prompt {
  width: min(360px, calc(100vw - 2rem));
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-color);
  color: var(--text-color);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.28);
}

.sidebar-prompt__label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.sidebar-prompt__input {
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-color);
  font: inherit;
}

.sidebar-prompt__input:focus {
  outline: 2px solid var(--accent-subtle);
  border-color: var(--accent-color);
}

.sidebar-prompt__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.85rem;
}

.sidebar-prompt__actions button {
  padding: 0.42rem 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-secondary);
  color: var(--text-color);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.sidebar-prompt__actions button:hover {
  background: var(--btn-hover);
}
</style>
