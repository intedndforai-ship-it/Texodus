import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useEditorStore } from './editor';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('editor store', () => {
  it('starts with a single blank active tab', () => {
    const store = useEditorStore();
    expect(store.tabs).toHaveLength(1);
    expect(store.activeTabId).toBe(store.tabs[0].id);
    expect(store.content).toBe('');
    expect(store.filePath).toBeNull();
    expect(store.isDirty).toBe(false);
  });

  it('updateContent marks the active tab dirty', () => {
    const store = useEditorStore();
    store.updateContent('hello');
    expect(store.content).toBe('hello');
    expect(store.isDirty).toBe(true);
  });

  it('loadFile replaces content and clears the dirty flag', () => {
    const store = useEditorStore();
    store.updateContent('draft');
    store.loadFile('# saved', '/tmp/a.md');
    expect(store.content).toBe('# saved');
    expect(store.filePath).toBe('/tmp/a.md');
    expect(store.isDirty).toBe(false);
  });

  it('addTab inserts after the active tab and focuses it', () => {
    const store = useEditorStore();
    const first = store.activeTabId;
    const second = store.addTab({ content: 'b' });
    expect(store.activeTabId).toBe(second);

    // Insert a third while the *first* tab is active — it must land between.
    store.setActiveTab(first);
    const third = store.addTab({ content: 'c' });
    expect(store.tabs.map((t) => t.id)).toEqual([first, third, second]);
  });

  it('closing the only tab resets it in place instead of emptying the array', () => {
    const store = useEditorStore();
    const id = store.activeTabId;
    store.loadFile('content', '/tmp/a.md');
    store.closeTab(id);
    expect(store.tabs).toHaveLength(1);
    expect(store.tabs[0].id).toBe(id);
    expect(store.content).toBe('');
    expect(store.filePath).toBeNull();
  });

  it('closing the active tab focuses the right neighbour, then falls back left', () => {
    const store = useEditorStore();
    const a = store.activeTabId;
    const b = store.addTab();
    const c = store.addTab();
    // Order is [a, b, c] (each added right after the then-active tab).

    store.setActiveTab(b);
    store.closeTab(b);
    expect(store.activeTabId).toBe(c);

    store.closeTab(c);
    expect(store.activeTabId).toBe(a);
  });

  it('closing an inactive tab keeps the current focus', () => {
    const store = useEditorStore();
    const a = store.activeTabId;
    const b = store.addTab();
    store.closeTab(a);
    expect(store.activeTabId).toBe(b);
  });

  it('cycles through tabs in both directions', () => {
    const store = useEditorStore();
    const a = store.activeTabId;
    const b = store.addTab();
    store.activateNextTab();
    expect(store.activeTabId).toBe(a);
    store.activatePreviousTab();
    expect(store.activeTabId).toBe(b);
  });

  it('anyTabDirty reflects background tabs', () => {
    const store = useEditorStore();
    store.updateContent('x');
    store.addTab();
    expect(store.isDirty).toBe(false);
    expect(store.anyTabDirty).toBe(true);
  });

  describe('closeOtherTabs', () => {
    it('removes every tab except the given one', () => {
      const store = useEditorStore();
      const a = store.activeTabId;
      const b = store.addTab({ content: 'b' });
      const c = store.addTab({ content: 'c' });
      store.closeOtherTabs(b);
      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].id).toBe(b);
      expect(store.activeTabId).toBe(b);
    });
  });

  describe('closeTabsToTheRight', () => {
    it('removes tabs after the given one', () => {
      const store = useEditorStore();
      const a = store.activeTabId;
      const b = store.addTab();
      const c = store.addTab();
      const d = store.addTab();
      // Order: [a, b, c, d]
      store.closeTabsToTheRight(b);
      expect(store.tabs.map((t) => t.id)).toEqual([a, b]);
      expect(store.activeTabId).toBe(b);
    });

    it('does nothing when the tab is already last', () => {
      const store = useEditorStore();
      const a = store.activeTabId;
      const b = store.addTab();
      store.closeTabsToTheRight(b);
      expect(store.tabs.map((t) => t.id)).toEqual([a, b]);
    });
  });
});
