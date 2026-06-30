/**
 * Safe cleanup for Tauri event listeners.
 *
 * Tauri's `listen()`, `onCloseRequested()`, `onFocusChanged()`,
 * `onDragDropEvent()`, and `watchFs()` all return `UnlistenFn` / `UnwatchFn`
 * values that may be `() => void` or `() => Promise<void>`. Calling them
 * directly in a sequential chain means a throw or rejection in one prevents
 * the rest from running. These utilities isolate each call.
 */

export type TauriUnlisten = () => void | Promise<void>;

/** Safely calls a single unlisten/unwatch function, swallowing errors. */
export function cleanupTauriEventListener(unlisten: TauriUnlisten | null | undefined): void {
  if (!unlisten) return;
  try {
    const result = unlisten();
    if (result instanceof Promise) {
      void result.catch(() => {});
    }
  } catch {
    // Swallow synchronous errors so remaining listeners are still cleaned up.
  }
}

/** Safely calls multiple unlisten/unwatch functions, each independently. */
export function cleanupTauriEventListeners(
  unlisteners: Iterable<TauriUnlisten | null | undefined>,
): void {
  for (const unlisten of unlisteners) {
    cleanupTauriEventListener(unlisten);
  }
}