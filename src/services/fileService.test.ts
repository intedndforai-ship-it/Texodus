import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
  message: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setTitle: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock workspaceService to avoid Tauri calls
vi.mock('./workspaceService', () => ({
  refreshWorkspaceTreeIfPathInside: vi.fn().mockResolvedValue(undefined),
}));

// Mock assetScopeService
vi.mock('./assetScopeService', () => ({
  allowAssetDirectoryForFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock useUnsavedPrompt
vi.mock('../composables/useUnsavedPrompt', () => ({
  promptUnsavedChanges: vi.fn().mockResolvedValue('discard'),
}));

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { open, save, message } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import {
  saveFile,
  saveFileAs,
  newFile,
  closeFile,
  requestNewDocument,
  requestOpenDocument,
} from './fileService';
import { useEditorStore } from '../stores/editor';
import { useSettingsStore } from '../stores/settings';

const mockedReadTextFile = vi.mocked(readTextFile);
const mockedWriteTextFile = vi.mocked(writeTextFile);
const mockedOpen = vi.mocked(open);
const mockedSave = vi.mocked(save);
const mockedInvoke = vi.mocked(invoke);

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('saveFile', () => {
  it('writes content to the existing file path and clears dirty', async () => {
    const store = useEditorStore();
    store.loadFile('content', '/tmp/note.md');
    store.updateContent('modified');

    const result = await saveFile(store);
    expect(result).toBe(true);
    expect(mockedWriteTextFile).toHaveBeenCalledWith('/tmp/note.md', 'modified');
    expect(store.isDirty).toBe(false);
  });

  it('falls back to saveFileAs when no file path is set', async () => {
    const store = useEditorStore();
    store.updateContent('new content');

    mockedSave.mockResolvedValue('/tmp/saved.md');
    const result = await saveFile(store);
    expect(result).toBe(true);
    expect(mockedSave).toHaveBeenCalled();
    expect(mockedWriteTextFile).toHaveBeenCalledWith('/tmp/saved.md', 'new content');
    expect(store.filePath).toBe('/tmp/saved.md');
  });

  it('returns false when saveAs dialog is cancelled', async () => {
    const store = useEditorStore();
    store.updateContent('content');

    mockedSave.mockResolvedValue(null);
    const result = await saveFile(store);
    expect(result).toBe(false);
    expect(mockedWriteTextFile).not.toHaveBeenCalled();
  });
});

describe('saveFileAs', () => {
  it('saves to the chosen path and updates store', async () => {
    const store = useEditorStore();
    store.updateContent('hello');

    mockedSave.mockResolvedValue('/tmp/new.md');
    const result = await saveFileAs(store);
    expect(result).toBe(true);
    expect(mockedWriteTextFile).toHaveBeenCalledWith('/tmp/new.md', 'hello');
    expect(store.filePath).toBe('/tmp/new.md');
    expect(store.isDirty).toBe(false);
  });

  it('returns false when user cancels', async () => {
    const store = useEditorStore();
    mockedSave.mockResolvedValue(null);
    const result = await saveFileAs(store);
    expect(result).toBe(false);
  });

  it('shows error dialog on write failure', async () => {
    const store = useEditorStore();
    store.updateContent('data');
    mockedSave.mockResolvedValue('/tmp/fail.md');
    mockedWriteTextFile.mockRejectedValue(new Error('Disk full'));
    const result = await saveFileAs(store);
    expect(result).toBe(false);
    expect(message).toHaveBeenCalled();
  });
});

describe('newFile', () => {
  it('resets the store after confirming', async () => {
    const store = useEditorStore();
    store.loadFile('content', '/tmp/a.md');
    await newFile(store);
    expect(store.content).toBe('');
    expect(store.filePath).toBeNull();
  });
});

describe('closeFile', () => {
  it('resets the store after confirming', async () => {
    const store = useEditorStore();
    store.loadFile('content', '/tmp/a.md');
    await closeFile(store);
    expect(store.content).toBe('');
    expect(store.filePath).toBeNull();
  });
});

describe('requestNewDocument (windows mode)', () => {
  it('invokes open_new_window in windows mode', async () => {
    const store = useEditorStore();
    // windows mode is the default
    await requestNewDocument(store);
    expect(mockedInvoke).toHaveBeenCalledWith('open_new_window');
  });

  it('shows error dialog when invoke fails', async () => {
    const store = useEditorStore();
    mockedInvoke.mockRejectedValueOnce(new Error('Window creation failed'));
    await requestNewDocument(store);
    expect(message).toHaveBeenCalled();
  });
});

describe('requestNewDocument (tabs mode)', () => {
  it('adds a tab in tabs mode', async () => {
    const store = useEditorStore();
    const settings = useSettingsStore();
    settings.setDocumentMode('tabs');
    const initialCount = store.tabCount;
    await requestNewDocument(store);
    expect(store.tabCount).toBe(initialCount + 1);
    expect(mockedInvoke).not.toHaveBeenCalled();
  });
});

describe('requestOpenDocument (windows mode)', () => {
  it('opens file directly when current document is empty', async () => {
    const store = useEditorStore();
    mockedOpen.mockResolvedValue('/tmp/open.md');
    mockedReadTextFile.mockResolvedValue('file content');
    await requestOpenDocument(store);
    expect(store.content).toBe('file content');
    expect(store.filePath).toBe('/tmp/open.md');
  });

  it('opens new window with path when current document is dirty', async () => {
    const store = useEditorStore();
    store.loadFile('existing', '/tmp/existing.md');
    store.updateContent('modified');
    mockedOpen.mockResolvedValue('/tmp/other.md');
    await requestOpenDocument(store);
    expect(mockedInvoke).toHaveBeenCalledWith('open_new_window', { path: '/tmp/other.md' });
  });

  it('shows error when open_new_window fails with a path', async () => {
    const store = useEditorStore();
    store.loadFile('existing', '/tmp/existing.md');
    store.updateContent('modified');
    mockedOpen.mockResolvedValue('/tmp/other.md');
    mockedInvoke.mockRejectedValueOnce(new Error('Failed'));
    await requestOpenDocument(store);
    expect(message).toHaveBeenCalled();
  });
});