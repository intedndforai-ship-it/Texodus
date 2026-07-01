import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  useSettingsStore,
  SETTINGS_STORAGE_KEY,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
} from './settings';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('settings store', () => {
  it('clamps and rounds the font size', () => {
    const store = useSettingsStore();
    store.setFontSize(100);
    expect(store.fontSize).toBe(FONT_SIZE_MAX);
    store.setFontSize(1);
    expect(store.fontSize).toBe(FONT_SIZE_MIN);
    store.setFontSize(14.6);
    expect(store.fontSize).toBe(15);
  });

  it('clamps and rounds the line height to two decimals', () => {
    const store = useSettingsStore();
    store.setLineHeight(9);
    expect(store.lineHeight).toBe(2.4);
    store.setLineHeight(0.1);
    expect(store.lineHeight).toBe(1.2);
    store.setLineHeight(1.7000000000000002);
    expect(store.lineHeight).toBe(1.7);
  });

  it('accepts search highlight colors with or without a leading #, normalised', () => {
    const store = useSettingsStore();
    // `<input type="color">` emits `#rrggbb` — must be accepted.
    store.setSearchHighlightColor('#1A2B3C');
    expect(store.searchHighlightColor).toBe('#1a2b3c');
    // Bare hex is also accepted, and normalised to `#rrggbb`.
    store.setSearchHighlightColor('ABCDEF');
    expect(store.searchHighlightColor).toBe('#abcdef');
    // Invalid input is rejected, leaving the previous value untouched.
    store.setSearchHighlightColor('nope');
    expect(store.searchHighlightColor).toBe('#abcdef');
  });

  it('keeps recent files deduplicated, newest first, capped at 10', () => {
    const store = useSettingsStore();
    for (let i = 0; i < 12; i++) store.addRecentFile(`/f/${i}.md`);
    store.addRecentFile('/f/5.md');

    expect(store.recentFiles).toHaveLength(10);
    expect(store.recentFiles[0]).toBe('/f/5.md');
    expect(store.recentFiles.filter((p) => p === '/f/5.md')).toHaveLength(1);
  });

  it('cycleTheme walks system -> light -> dark -> system', () => {
    const store = useSettingsStore();
    expect(store.themeMode).toBe('system');
    store.cycleTheme();
    expect(store.themeMode).toBe('light');
    store.cycleTheme();
    expect(store.themeMode).toBe('dark');
    store.cycleTheme();
    expect(store.themeMode).toBe('system');
  });

  it('persist writes only persisted fields to localStorage', () => {
    const store = useSettingsStore();
    store.setDocumentMode('tabs');
    store.setSettingsVisible(true);
    store.setLayoutMode('focus');
    store.persist();

    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!);
    expect(saved.documentMode).toBe('tabs');
    expect(saved).not.toHaveProperty('settingsVisible');
    expect(saved).not.toHaveProperty('systemFonts');
    // layoutMode is per-window and must NOT be in the shared settings payload.
    expect(saved).not.toHaveProperty('layoutMode');
  });

  it('reloadFromStorage picks up changes another window persisted', () => {
    const store = useSettingsStore();
    store.setLayoutMode('focus');
    store.persist();

    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!);
    saved.documentMode = 'tabs';
    saved.fontSize = 18;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(saved));

    store.setSettingsVisible(true);
    store.reloadFromStorage();
    expect(store.documentMode).toBe('tabs');
    expect(store.fontSize).toBe(18);
    // Transient UI state must survive the reload.
    expect(store.settingsVisible).toBe(true);
    // layoutMode is per-window — must NOT be overwritten by reloadFromStorage.
    expect(store.layoutMode).toBe('focus');
  });

  it('reloadFromStorage does not re-persist/echo the data it just received', () => {
    const store = useSettingsStore();
    // Another window wrote a change to shared storage; seed it directly.
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ fontSize: 19 }));

    store.reloadFromStorage();
    expect(store.fontSize).toBe(19);

    // The `$patch` inside reloadFromStorage fires persist() via `$subscribe`
    // in the real app. That persist() must be a no-op here — re-writing and
    // re-broadcasting data we only *received* would bounce it back out and
    // fan out into O(N) redundant writes across open windows.
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    store.persist();
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('falls back to defaults on corrupt stored JSON', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json');
    localStorage.setItem('texodus.layoutMode.v1', '{not json');
    const store = useSettingsStore();
    expect(store.documentMode).toBe('windows');
    expect(store.layoutMode).toBe('split');
  });
});
