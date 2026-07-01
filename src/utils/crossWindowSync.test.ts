import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCrossWindowSync, broadcastChange } from './crossWindowSync';

// BroadcastChannel is not available in jsdom by default — polyfill it.
// Matches the spec rule we rely on: a message is delivered to every instance
// on the channel name EXCEPT the one that posted it.
class MockBroadcastChannel {
  name: string;
  listeners: Set<(e: { data: unknown }) => void> = new Set();
  static instances = new Map<string, MockBroadcastChannel[]>();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.instances.has(name)) {
      MockBroadcastChannel.instances.set(name, []);
    }
    MockBroadcastChannel.instances.get(name)!.push(this);
  }

  postMessage(data: unknown): void {
    const peers = MockBroadcastChannel.instances.get(this.name) ?? [];
    for (const peer of peers) {
      if (peer === this) continue;
      peer.listeners.forEach((fn) => fn({ data }));
    }
  }

  addEventListener(_type: string, listener: (e: { data: unknown }) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: (e: { data: unknown }) => void): void {
    this.listeners.delete(listener);
  }

  close(): void {
    const peers = MockBroadcastChannel.instances.get(this.name) ?? [];
    MockBroadcastChannel.instances.set(
      this.name,
      peers.filter((p) => p !== this),
    );
  }
}

// Simulate a *different* window posting on the channel: a fresh instance,
// distinct from the one `createCrossWindowSync` / `broadcastChange` use.
function postFromOtherWindow(name: string): void {
  const ch = new BroadcastChannel(name);
  ch.postMessage('sync');
  ch.close();
}

describe('crossWindowSync', () => {
  beforeEach(() => {
    MockBroadcastChannel.instances.clear();
    // @ts-expect-error: polyfill BroadcastChannel for jsdom
    globalThis.BroadcastChannel = MockBroadcastChannel;
  });

  afterEach(() => {
    // @ts-expect-error: clean up polyfill
    delete globalThis.BroadcastChannel;
  });

  it('a broadcast from another window triggers onSync', () => {
    let syncCount = 0;
    const cleanup = createCrossWindowSync({
      channelName: 'test-sync',
      storageKey: 'test-key',
      onSync: () => { syncCount++; },
    });

    postFromOtherWindow('test-sync');
    expect(syncCount).toBe(1);

    cleanup();
  });

  it('does NOT deliver a window its own broadcast (prevents the sync loop)', () => {
    let syncCount = 0;
    const cleanup = createCrossWindowSync({
      channelName: 'test-sync-self',
      storageKey: 'test-key-self',
      onSync: () => { syncCount++; },
    });

    // The same window that listens also broadcasts — it must not hear itself,
    // otherwise persist→broadcast→reload→persist loops forever.
    broadcastChange('test-sync-self');
    expect(syncCount).toBe(0);

    cleanup();
  });

  it('storage event triggers onSync', () => {
    let syncCount = 0;
    const cleanup = createCrossWindowSync({
      channelName: 'test-sync-2',
      storageKey: 'test-key-2',
      onSync: () => { syncCount++; },
    });

    // Simulate a storage event from another window.
    const event = new StorageEvent('storage', {
      key: 'test-key-2',
      newValue: '{}',
    });
    window.dispatchEvent(event);

    expect(syncCount).toBe(1);
    cleanup();
  });

  it('storage event for a different key does not trigger onSync', () => {
    let syncCount = 0;
    const cleanup = createCrossWindowSync({
      channelName: 'test-sync-3',
      storageKey: 'expected-key',
      onSync: () => { syncCount++; },
    });

    const event = new StorageEvent('storage', {
      key: 'wrong-key',
      newValue: '{}',
    });
    window.dispatchEvent(event);

    expect(syncCount).toBe(0);
    cleanup();
  });

  it('cleanup removes both listeners', () => {
    let syncCount = 0;
    const cleanup = createCrossWindowSync({
      channelName: 'test-sync-4',
      storageKey: 'test-key-4',
      onSync: () => { syncCount++; },
    });

    cleanup();

    postFromOtherWindow('test-sync-4');
    const event = new StorageEvent('storage', {
      key: 'test-key-4',
      newValue: '{}',
    });
    window.dispatchEvent(event);

    expect(syncCount).toBe(0);
  });

  it('reacting to a sync and re-broadcasting does not loop back to self', () => {
    let callCount = 0;
    const cleanup = createCrossWindowSync({
      channelName: 'test-sync-5',
      storageKey: 'test-key-5',
      onSync: () => {
        callCount++;
        // A reaction commonly re-persists, which re-broadcasts. That echo must
        // not come back to us (which would loop).
        broadcastChange('test-sync-5');
      },
    });

    postFromOtherWindow('test-sync-5');
    expect(callCount).toBe(1);

    cleanup();
  });

  it('multiple channels are independent', () => {
    let countA = 0;
    let countB = 0;
    const cleanupA = createCrossWindowSync({
      channelName: 'channel-a',
      storageKey: 'key-a',
      onSync: () => { countA++; },
    });
    const cleanupB = createCrossWindowSync({
      channelName: 'channel-b',
      storageKey: 'key-b',
      onSync: () => { countB++; },
    });

    postFromOtherWindow('channel-a');
    expect(countA).toBe(1);
    expect(countB).toBe(0);

    postFromOtherWindow('channel-b');
    expect(countA).toBe(1);
    expect(countB).toBe(1);

    cleanupA();
    cleanupB();
  });
});
