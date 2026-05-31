import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { type FileTreeNode, useWorkspaceStore } from '../stores/workspace';
import { resolveLocalPath } from '../utils/path';

const VISIBLE_FILE_EXTENSIONS = /\.(md|markdown|txt)$/i;
const IGNORED_DIRECTORIES = new Set(['.git', '.obsidian', 'node_modules', 'dist', 'target']);

export async function selectWorkspaceFolder(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: true,
  });

  return typeof selected === 'string' ? selected : null;
}

export async function loadWorkspaceTree(rootPath: string): Promise<FileTreeNode[]> {
  const entries = await readDirectoryNodes(rootPath);
  return sortTree(entries);
}

export async function openWorkspaceFolder(): Promise<void> {
  const selected = await selectWorkspaceFolder();
  if (!selected) return;

  await refreshWorkspaceTree(selected);
}

export async function refreshWorkspaceTree(rootPath?: string): Promise<void> {
  const workspaceStore = useWorkspaceStore();
  const path = rootPath ?? workspaceStore.rootPath;
  if (!path) return;

  workspaceStore.setLoading(true);
  workspaceStore.setError(null);
  try {
    const tree = await loadWorkspaceTree(path);
    workspaceStore.setWorkspace(path, tree);
  } catch (e) {
    workspaceStore.setError(e instanceof Error ? e.message : String(e));
  } finally {
    workspaceStore.setLoading(false);
  }
}

async function readDirectoryNodes(directoryPath: string): Promise<FileTreeNode[]> {
  const entries = await readDir(directoryPath);
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    const path = resolveLocalPath(directoryPath, entry.name);

    if (entry.isDirectory) {
      // Hidden/config/build folders can be huge or forbidden by Tauri scopes
      // (for example Obsidian's `.obsidian`). They are not useful for the
      // Markdown workspace tree, so skip them in the MVP.
      if (entry.name.startsWith('.') || IGNORED_DIRECTORIES.has(entry.name)) continue;

      try {
        const children = await readDirectoryNodes(path);
        nodes.push({ name: entry.name, path, kind: 'directory', children });
      } catch (e) {
        console.warn(`Skipping unreadable directory: ${path}`, e);
      }
      continue;
    }

    if (entry.isFile && VISIBLE_FILE_EXTENSIONS.test(entry.name)) {
      nodes.push({ name: entry.name, path, kind: 'file' });
    }
  }

  return sortTree(nodes);
}

function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}
