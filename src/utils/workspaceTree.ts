/**
 * Shared utilities for the workspace file-tree.
 *
 * `FileTreeNode` and `findNode` live here so that both the Pinia store and
 * the workspace service can use them without duplicating logic.
 */

export interface FileTreeNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  /** Undefined means directory children are not loaded yet. */
  children?: FileTreeNode[];
}

/**
 * Recursively searches `nodes` for a node whose `path` matches.
 * Returns the first match or `null`.
 */
export function findNode(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.kind === 'directory' && node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}