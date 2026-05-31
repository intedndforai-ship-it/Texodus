import { defineStore } from 'pinia';

export interface FileTreeNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  /** Undefined means directory children are not loaded yet. */
  children?: FileTreeNode[];
}

interface WorkspaceState {
  rootPath: string | null;
  tree: FileTreeNode[];
  expandedPaths: string[];
  selectedPath: string | null;
  isLoading: boolean;
  error: string | null;
}

function findNode(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.kind === 'directory' && node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

export const useWorkspaceStore = defineStore('workspace', {
  state: (): WorkspaceState => ({
    rootPath: null,
    tree: [],
    expandedPaths: [],
    selectedPath: null,
    isLoading: false,
    error: null,
  }),
  getters: {
    isExpanded: (state) => (path: string) => state.expandedPaths.includes(path),
  },
  actions: {
    setWorkspace(rootPath: string, tree: FileTreeNode[]) {
      this.rootPath = rootPath;
      this.tree = tree;
      this.error = null;
      if (!this.expandedPaths.includes(rootPath)) this.expandedPaths.push(rootPath);
    },
    setTree(tree: FileTreeNode[]) {
      this.tree = tree;
    },
    setDirectoryChildren(path: string, children: FileTreeNode[]) {
      const node = findNode(this.tree, path);
      if (node && node.kind === 'directory') node.children = children;
    },
    setSelectedPath(path: string | null) {
      this.selectedPath = path;
    },
    setLoading(value: boolean) {
      this.isLoading = value;
    },
    setError(message: string | null) {
      this.error = message;
    },
    toggleExpanded(path: string) {
      if (this.expandedPaths.includes(path)) {
        this.expandedPaths = this.expandedPaths.filter((p) => p !== path);
      } else {
        this.expandedPaths.push(path);
      }
    },
    expandPath(path: string) {
      if (!this.expandedPaths.includes(path)) this.expandedPaths.push(path);
    },
    reset() {
      this.rootPath = null;
      this.tree = [];
      this.expandedPaths = [];
      this.selectedPath = null;
      this.isLoading = false;
      this.error = null;
    },
  },
});
