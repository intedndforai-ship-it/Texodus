import { describe, it, expect, vi } from 'vitest';
import { cleanupTauriEventListener, cleanupTauriEventListeners } from './tauriEventCleanup';

describe('cleanupTauriEventListener', () => {
  it('calls a synchronous unlisten function', () => {
    const fn = vi.fn();
    cleanupTauriEventListener(fn);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not throw when unlisten is null', () => {
    expect(() => cleanupTauriEventListener(null)).not.toThrow();
  });

  it('does not throw when unlisten is undefined', () => {
    expect(() => cleanupTauriEventListener(undefined)).not.toThrow();
  });

  it('swallows errors from a throwing unlisten', () => {
    const fn = vi.fn(() => { throw new Error('boom'); });
    expect(() => cleanupTauriEventListener(fn)).not.toThrow();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('swallows rejections from an async unlisten', async () => {
    const fn = vi.fn(() => Promise.reject(new Error('async boom')));
    expect(() => cleanupTauriEventListener(fn)).not.toThrow();
    // Flush microtasks so the rejection is handled.
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce());
  });

  it('handles a promise-returning unlisten that resolves', async () => {
    const fn = vi.fn(() => Promise.resolve());
    cleanupTauriEventListener(fn);
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce());
  });
});

describe('cleanupTauriEventListeners', () => {
  it('calls all non-null unlisten functions', () => {
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    cleanupTauriEventListeners([a, null, b, undefined, c]);
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    expect(c).toHaveBeenCalledOnce();
  });

  it('continues after a throwing unlisten', () => {
    const throwing = vi.fn(() => { throw new Error('oops'); });
    const after = vi.fn();
    cleanupTauriEventListeners([throwing, after]);
    expect(throwing).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
  });

  it('handles an empty array', () => {
    expect(() => cleanupTauriEventListeners([])).not.toThrow();
  });

  it('handles an array of all nulls', () => {
    expect(() => cleanupTauriEventListeners([null, null, null])).not.toThrow();
  });

  it('handles a Map values iterator', () => {
    const map = new Map<string, () => void>();
    const fn = vi.fn();
    map.set('a', fn);
    map.set('b', vi.fn());
    cleanupTauriEventListeners(map.values());
    expect(fn).toHaveBeenCalledOnce();
  });
});