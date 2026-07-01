import { describe, it, expect, beforeEach, vi } from 'vitest';
import { markFileWritten, wasWrittenWithContent, clearWriteSuppression } from './writeSuppression';

describe('writeSuppression', () => {
  beforeEach(() => {
    clearWriteSuppression();
  });

  it('returns false for an unknown path', () => {
    expect(wasWrittenWithContent('/some/never-written.md', 'x')).toBe(false);
  });

  it('suppresses when on-disk content matches what we wrote', () => {
    const path = '/test/recent.md';
    markFileWritten(path, 'hello');
    expect(wasWrittenWithContent(path, 'hello')).toBe(true);
  });

  it('does NOT suppress when on-disk content differs (genuine external edit)', () => {
    const path = '/test/recent.md';
    markFileWritten(path, 'hello');
    // An external tool changed the file inside the window — different content.
    expect(wasWrittenWithContent(path, 'hello, world')).toBe(false);
  });

  it('returns false for a different path', () => {
    markFileWritten('/test/file-a.md', 'a');
    expect(wasWrittenWithContent('/test/file-b.md', 'a')).toBe(false);
  });

  it('returns false after the suppression window expires', () => {
    const path = '/test/expired.md';
    vi.useFakeTimers();
    markFileWritten(path, 'data');
    vi.advanceTimersByTime(4001);
    expect(wasWrittenWithContent(path, 'data')).toBe(false);
    vi.useRealTimers();
  });

  it('still suppresses just before the window expires', () => {
    const path = '/test/almost.md';
    vi.useFakeTimers();
    markFileWritten(path, 'data');
    vi.advanceTimersByTime(3999);
    expect(wasWrittenWithContent(path, 'data')).toBe(true);
    vi.useRealTimers();
  });

  it('clearWriteSuppression removes all entries', () => {
    markFileWritten('/test/a.md', 'a');
    markFileWritten('/test/b.md', 'b');
    clearWriteSuppression();
    expect(wasWrittenWithContent('/test/a.md', 'a')).toBe(false);
    expect(wasWrittenWithContent('/test/b.md', 'b')).toBe(false);
  });

  it('latest mark on the same path wins and resets the window', () => {
    const path = '/test/repeated.md';
    vi.useFakeTimers();
    markFileWritten(path, 'v1');
    vi.advanceTimersByTime(2000);
    markFileWritten(path, 'v2'); // Re-mark with new content resets the window.
    vi.advanceTimersByTime(2000);
    expect(wasWrittenWithContent(path, 'v2')).toBe(true);
    expect(wasWrittenWithContent(path, 'v1')).toBe(false);
    vi.useRealTimers();
  });
});
