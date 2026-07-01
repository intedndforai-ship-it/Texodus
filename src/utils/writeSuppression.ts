/**
 * Write suppression for the file watcher.
 *
 * When the app writes a file (auto-save or manual save), the OS file-watcher
 * fires a change event for that same path. Without suppression, the watcher
 * would reload the file from disk — and if the in-memory buffer has since moved
 * ahead of what we wrote, it would even show a spurious "changed on disk"
 * prompt.
 *
 * Suppression is **content-aware**: `markFileWritten(path, content)` records
 * what we wrote, and `wasWrittenWithContent(path, diskContent)` only suppresses
 * when the on-disk content matches it. A genuine external edit that lands inside
 * the time window has *different* content, so it is NOT suppressed and still
 * gets picked up — a purely time-based window would have swallowed it.
 */

const SUPPRESSION_MS = 4000;

interface WriteRecord {
  content: string;
  ts: number;
}

const recentWrites = new Map<string, WriteRecord>();

/** Record the exact content the app just wrote to `path`. */
export function markFileWritten(path: string, content: string): void {
  recentWrites.set(path, { content, ts: Date.now() });
}

/**
 * True when `path` was written by the app within the suppression window AND the
 * given on-disk content matches what we wrote — i.e. this watcher event is our
 * own save echoing back rather than a genuine external change.
 */
export function wasWrittenWithContent(path: string, diskContent: string): boolean {
  const rec = recentWrites.get(path);
  if (!rec) return false;
  if (Date.now() - rec.ts > SUPPRESSION_MS) {
    recentWrites.delete(path);
    return false;
  }
  return rec.content === diskContent;
}

/** Clear all suppression entries. Useful for testing. */
export function clearWriteSuppression(): void {
  recentWrites.clear();
}
