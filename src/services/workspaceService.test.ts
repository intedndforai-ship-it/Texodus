import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { resetMockTauri } from '../mock-tauri';

// Mock assetScopeService (non-Tauri dep)
vi.mock('./assetScopeService', () => ({
  allowAssetDirectory: vi.fn().mockResolvedValue(undefined),
  allowAssetDirectoryForFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock settings store to avoid localStorage persistence
vi.mock('../stores/settings', () => ({
  useSettingsStore: () => ({
    lastWorkspacePath: null,
    setLastWorkspacePath: vi.fn(),
  }),
}));

import { readDir } from '@tauri-apps/plugin-fs';
import {
  loadWorkspaceTree,
  loadWorkspaceDirectoryChildren,
  refreshWorkspaceTree,
  refreshWorkspaceTreeIfPathInside,
  expandAndLoadParentDirectories,
} from './workspaceService';
import { useWorkspaceStore } from '../stores/workspace';

const mockedReadDir = vi.mocked(readDir);

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('loadWorkspaceTree', () => {
  it('builds a sorted tree with directories first', async () => {
    mockedReadDir.mockResolvedValue([
      { name: 'z.md', isDirectory: false, isFile: true } as any,
      { name: 'docs', isDirectory: true, isFile: false } as any,
      { name: 'a.md', isDirectory: false, isFile: true } as any,
    ]);
    const tree = await loadWorkspaceTree('/root');
    expect(tree).toHaveLength(3);
    // directories come first, then files alphabetically
    expect(tree[0].name).toBe('docs');
    expect(tree[0].kind).toBe('directory');
    expect(tree[1].name).toBe('a.md');
    expect(tree[2].name).toBe('z.md');
  });

  it('filters to md, markdown, txt extensions only', async () => {
    mockedReadDir.mockResolvedValue([
      { name: 'note.md', isDirectory: false, isFile: true } as any,
      { name: 'note.MARKDOWN', isDirectory: false, isFile: true } as any,
      { name: 'readme.txt', isDirectory: false, isFile: true } as any,
      { name: 'image.png', isDirectory: false, isFile: true } as any,
      { name: 'script.js', isDirectory: false, isFile: true } as any,
    ]);
    const tree = await loadWorkspaceTree('/root');
    expect(tree).toHaveLength(3);
    expect(tree.map((n) => n.name).sort()).toEqual(['note.MARKDOWN', 'note.md', 'readme.txt']);
  });

  it('skips hidden and ignored directories', async () => {
    mockedReadDir.mockResolvedValue([
      { name: '.hidden', isDirectory: true, isFile: false } as any,
      { name: '.git', isDirectory: true, isFile: false } as any,
      { name: 'node_modules', isDirectory: true, isFile: false } as any,
      { name: 'docs', isDirectory: true, isFile: false } as any,
    ]);
    const tree = await loadWorkspaceTree('/root');
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('docs');
  });

  it('creates directory nodes without children (lazy loading)', async () => {
    mockedReadDir.mockResolvedValue([
      { name: 'docs', isDirectory: true, isFile: false } as any,
    ]);
    const tree = await loadWorkspaceTree('/root');
    expect(tree[0].children).toBeUndefined();
  });

  it('uses forward-slash paths via resolveLocalPath', async () => {
    mockedReadDir.mockResolvedValue([
      { name: 'a.md', isDirectory: false, isFile: true } as any,
    ]);
    const tree = await loadWorkspaceTree('/root');
    expect(tree[0].path).toBe('/root/a.md');
  });
});

describe('loadWorkspaceDirectoryChildren', () => {
  it('sets children on the directory node in the store', async () => {
    const store = useWorkspaceStore();
    store.setWorkspace('/root', [
      { name: 'root', path: '/root', kind: 'directory', children: [
        { name: 'docs', path: '/root/docs', kind: 'directory' },
      ]},
    ]);
    mockedReadDir.mockResolvedValue([
      { name: 'b.md', isDirectory: false, isFile: true } as any,
    ]);
    await loadWorkspaceDirectoryChildren('/root/docs');
    const node = store.tree[0].children![0];
    expect(node.children).toHaveLength(1);
    expect(node.children![0].name).toBe('b.md');
  });

  it('does not reload if children are already loaded', async () => {
    const store = useWorkspaceStore();
    store.setWorkspace('/root', [
      { name: 'root', path: '/root', kind: 'directory', children: [
        { name: 'docs', path: '/root/docs', kind: 'directory', children: [
          { name: 'existing.md', path: '/root/docs/existing.md', kind: 'file' },
        ]},
      ]},
    ]);
    await loadWorkspaceDirectoryChildren('/root/docs');
    expect(mockedReadDir).not.toHaveBeenCalled();
  });

  it('sets error on store when readDir throws', async () => {
    const store = useWorkspaceStore();
    store.setWorkspace('/root', [
      { name: 'root', path: '/root', kind: 'directory', children: [
        { name: 'docs', path: '/root/docs', kind: 'directory' },
      ]},
    ]);
    mockedReadDir.mockRejectedValue(new Error('Permission denied'));
    await loadWorkspaceDirectoryChildren('/root/docs');
    expect(store.error).toBe('Permission denied');
  });
});

describe('refreshWorkspaceTree', () => {
  it('loads tree, sets workspace, and clears loading', async () => {
    mockedReadDir.mockResolvedValue([
      { name: 'a.md', isDirectory: false, isFile: true } as any,
    ]);
    await refreshWorkspaceTree('/root');
    const store = useWorkspaceStore();
    expect(store.rootPath).toBe('/root');
    expect(store.tree).toHaveLength(1);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('sets error and clears loading on failure', async () => {
    mockedReadDir.mockRejectedValue(new Error('Access denied'));
    await refreshWorkspaceTree('/root');
    const store = useWorkspaceStore();
    expect(store.error).toBe('Access denied');
    expect(store.isLoading).toBe(false);
  });

  it('does nothing without a rootPath argument or store rootPath', async () => {
    await refreshWorkspaceTree();
    expect(mockedReadDir).not.toHaveBeenCalled();
  });
});

describe('refreshWorkspaceTreeIfPathInside', () => {
  it('refreshes when path is inside the workspace root', async () => {
    const store = useWorkspaceStore();
    store.setWorkspace('/root', [
      { name: 'root', path: '/root', kind: 'directory', children: [
        { name: 'a.md', path: '/root/a.md', kind: 'file' },
      ]},
    ]);
    mockedReadDir.mockResolvedValue([]);
    await refreshWorkspaceTreeIfPathInside('/root/docs/new.md');
    expect(store.selectedPath).toBe('/root/docs/new.md');
  });

  it('does nothing when path is outside the workspace', async () => {
    const store = useWorkspaceStore();
    store.setWorkspace('/root', []);
    mockedReadDir.mockResolvedValue([]);
    await refreshWorkspaceTreeIfPathInside('/other/file.md');
    expect(mockedReadDir).not.toHaveBeenCalled();
  });

  it('does nothing when no workspace is open', async () => {
    await refreshWorkspaceTreeIfPathInside('/anywhere/file.md');
    expect(mockedReadDir).not.toHaveBeenCalled();
  });
});

describe('expandAndLoadParentDirectories', () => {
  it('expands all parent directories from root to the file parent', async () => {
    const store = useWorkspaceStore();
    store.setWorkspace('/root', [
      { name: 'root', path: '/root', kind: 'directory', children: [
        { name: 'docs', path: '/root/docs', kind: 'directory', children: [
          { name: 'sub', path: '/root/docs/sub', kind: 'directory' },
        ]},
      ]},
    ]);
    mockedReadDir.mockResolvedValue([]);
    await expandAndLoadParentDirectories('/root/docs/sub/file.md', '/root');
    expect(store.expandedPaths).toContain('/root');
    expect(store.expandedPaths).toContain('/root/docs');
    expect(store.expandedPaths).toContain('/root/docs/sub');
  });
});