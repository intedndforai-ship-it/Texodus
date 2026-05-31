import { onUnmounted, watch as vueWatch } from 'vue';
import { readTextFile, watch as watchFs, type UnwatchFn } from '@tauri-apps/plugin-fs';
import { useEditorStore, type Tab } from '../stores/editor';
import { basename, dirname } from '../utils/path';
import { promptUnsavedChanges } from './useUnsavedPrompt';
import { saveFile, showToast, updateWindowTitle } from '../services/fileService';

type EditorStore = ReturnType<typeof useEditorStore>;

function uniqueOpenPaths(tabs: Tab[]): string[] {
  return [...new Set(tabs.map((tab) => tab.filePath).filter((path): path is string => Boolean(path)))].sort();
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function useFileWatch(store: EditorStore): void {
  const unwatchByDir = new Map<string, UnwatchFn>();
  const handlingPaths = new Set<string>();

  function watchRootForPath(path: string): string {
    return dirname(path) || path;
  }

  function stopWatching(dir: string) {
    const unwatch = unwatchByDir.get(dir);
    if (!unwatch) return;
    unwatchByDir.delete(dir);
    unwatch();
  }

  async function reloadChangedPath(path: string) {
    if (handlingPaths.has(path)) return;
    handlingPaths.add(path);

    try {
      const diskContent = await readTextFile(path);
      const matchingIds = store.tabs
        .filter((tab) => tab.filePath === path)
        .map((tab) => tab.id);

      for (const id of matchingIds) {
        const tab = store.tabs.find((candidate) => candidate.id === id && candidate.filePath === path);
        if (!tab) continue;

        if (tab.content === diskContent) {
          if (tab.isDirty) store.setTabDirty(id, false);
          continue;
        }

        if (!tab.isDirty) {
          store.loadTabFile(id, diskContent, path);
          showToast(`${basename(path)} reloaded`);
          continue;
        }

        store.setActiveTab(id);
        const choice = await promptUnsavedChanges({
          title: 'File changed on disk',
          body: `${basename(path)} was changed outside Texodus, while you have unsaved local changes. What do you want to do?`,
          cancelLabel: 'Keep Local',
          discardLabel: 'Reload',
          saveLabel: 'Overwrite',
        });

        if (choice === 'discard') {
          store.loadFile(diskContent, path);
          showToast(`${basename(path)} reloaded`);
        } else if (choice === 'save') {
          await saveFile(store);
        } else {
          showToast('Kept local changes');
        }
      }

      await updateWindowTitle(store);
    } catch (e) {
      console.warn('Failed to reload changed file:', e);
      showToast(`Failed to reload ${basename(path)}`);
    } finally {
      handlingPaths.delete(path);
    }
  }

  const stopPathWatcher = vueWatch(
    () => uniqueOpenPaths(store.tabs),
    async (paths) => {
      const desiredDirs = new Set(paths.map(watchRootForPath));

      for (const dir of [...unwatchByDir.keys()]) {
        if (!desiredDirs.has(dir)) stopWatching(dir);
      }

      for (const dir of desiredDirs) {
        if (unwatchByDir.has(dir)) continue;
        try {
          const unwatch = await watchFs(dir, (event) => {
            const changedPaths = new Set(event.paths.map(normalizePath));
            if (changedPaths.size === 0) return;

            for (const path of uniqueOpenPaths(store.tabs)) {
              if (watchRootForPath(path) !== dir) continue;
              if (changedPaths.has(normalizePath(path))) void reloadChangedPath(path);
            }
          }, { delayMs: 300 });
          unwatchByDir.set(dir, unwatch);
        } catch (e) {
          console.warn('Failed to watch directory:', dir, e);
        }
      }
    },
    { immediate: true, deep: true }
  );

  onUnmounted(() => {
    stopPathWatcher();
    for (const unwatch of unwatchByDir.values()) unwatch();
    unwatchByDir.clear();
  });
}
