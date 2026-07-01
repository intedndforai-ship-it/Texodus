/**
 * Auto-save composable with debounce + flush.
 *
 * When autoSave is enabled in settings, editor content changes are debounced
 * (1.5s) and then written to disk silently — no toast, no title flash.
 *
 * `flushPendingSave()` can be called before destructive actions (tab switch,
 * close, open) to immediately persist any pending changes.
 *
 * Write suppression is handled by the separate `writeSuppression` module so
 * that both auto-save and manual saves share the same suppression registry
 * without coupling the file watcher to this composable.
 */

import { watch, onUnmounted, type WatchStopHandle } from 'vue';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useEditorStore } from '../stores/editor';
import { useSettingsStore } from '../stores/settings';
import { showToast } from '../utils/toast';
import { markFileWritten } from '../utils/writeSuppression';

type EditorStore = ReturnType<typeof useEditorStore>;

const AUTOSAVE_DEBOUNCE_MS = 1500;

// ── Module-level state (singleton) ─────────────────────────────────────────────

interface PendingSave {
  content: string;
  timer: ReturnType<typeof setTimeout>;
}

// One pending debounced save per file path. Keyed by path (not a single global
// slot) so a scheduled save for tab A is never clobbered when the user switches
// to and edits tab B before A's debounce fires.
const pending = new Map<string, PendingSave>();
let isFlushing = false;

/** True when at least one file has a pending debounced auto-save. */
export function hasPendingSave(): boolean {
  return pending.size > 0;
}

/**
 * Immediately save every pending debounced file. Returns true if at least one
 * save was performed.
 */
export async function flushPendingSave(): Promise<boolean> {
  if (isFlushing) return false;
  if (pending.size === 0) return false;

  isFlushing = true;
  try {
    const entries = [...pending.entries()];
    pending.clear();
    for (const [, p] of entries) clearTimeout(p.timer);

    let saved = false;
    for (const [path, p] of entries) {
      if (await doSave(path, p.content)) saved = true;
    }
    return saved;
  } finally {
    isFlushing = false;
  }
}

async function doSave(path: string, content: string): Promise<boolean> {
  try {
    await writeTextFile(path, content);
    const store = useEditorStore();
    const tab = store.tabs.find((t) => t.filePath === path);
    if (tab) store.setTabDirty(tab.id, false);
    markFileWritten(path, content);
    return true;
  } catch (e) {
    console.warn('Auto-save failed:', path, e);
    showToast('Auto-save failed');
    return false;
  }
}

function scheduleSave(path: string, content: string): void {
  const existing = pending.get(path);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    pending.delete(path);
    void doSave(path, content);
  }, AUTOSAVE_DEBOUNCE_MS);
  pending.set(path, { content, timer });
}

/**
 * Installs auto-save behaviour. Call once in App.vue setup.
 *
 * Watches:
 * - Content changes → schedules a debounced save (if autoSave enabled + file has path)
 * - AutoSave setting toggle → flushes pending on disable
 */
export function useAutoSave(store: EditorStore): void {
  let stopContentWatch: WatchStopHandle | null = null;

  function startContentWatcher() {
    if (stopContentWatch) return;
    stopContentWatch = watch(
      () => store.content,
      (newContent) => {
        const settings = useSettingsStore();
        if (!settings.autoSave) return;
        const tab = store.activeTab;
        if (!tab.filePath) return; // Untitled — can't auto-save without a path.
        // Only a real edit dirties the tab. A bare tab switch also changes
        // `store.content` (the getter follows the active tab) but leaves the
        // newly-active tab clean — don't rewrite an unmodified file to disk.
        if (!tab.isDirty) return;
        scheduleSave(tab.filePath, newContent);
      },
    );
  }

  function stopContentWatcher() {
    if (stopContentWatch) {
      stopContentWatch();
      stopContentWatch = null;
    }
  }

  // React to autoSave being toggled on/off.
  watch(
    () => useSettingsStore().autoSave,
    (enabled) => {
      if (enabled) {
        startContentWatcher();
      } else {
        // Flushing pending before stopping so no content is lost.
        void flushPendingSave().finally(() => stopContentWatcher());
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    void flushPendingSave();
    stopContentWatcher();
    // Defensive: drop any timers flush didn't consume (e.g. if a flush was
    // already in progress and bailed early).
    for (const [, p] of pending) clearTimeout(p.timer);
    pending.clear();
  });
}