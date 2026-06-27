import { describe, it, expect } from 'vitest';
import { findNode, type FileTreeNode } from './workspaceTree';

function makeTree(): FileTreeNode[] {
  return [
    { name: 'a.md', path: '/root/a.md', kind: 'file' },
    {
      name: 'docs',
      path: '/root/docs',
      kind: 'directory',
      children: [
        { name: 'b.md', path: '/root/docs/b.md', kind: 'file' },
        {
          name: 'sub',
          path: '/root/docs/sub',
          kind: 'directory',
          children: [
            { name: 'c.md', path: '/root/docs/sub/c.md', kind: 'file' },
          ],
        },
      ],
    },
    { name: 'empty', path: '/root/empty', kind: 'directory' },
  ];
}

describe('findNode', () => {
  it('finds a top-level file', () => {
    const node = findNode(makeTree(), '/root/a.md');
    expect(node).not.toBeNull();
    expect(node!.name).toBe('a.md');
    expect(node!.kind).toBe('file');
  });

  it('finds a nested file deep in the tree', () => {
    const node = findNode(makeTree(), '/root/docs/sub/c.md');
    expect(node).not.toBeNull();
    expect(node!.name).toBe('c.md');
  });

  it('finds a directory node', () => {
    const node = findNode(makeTree(), '/root/docs');
    expect(node).not.toBeNull();
    expect(node!.kind).toBe('directory');
  });

  it('returns null for a non-existent path', () => {
    expect(findNode(makeTree(), '/root/missing.md')).toBeNull();
  });

  it('returns null for an empty tree', () => {
    expect(findNode([], '/anything')).toBeNull();
  });

  it('does not descend into directories with undefined children', () => {
    // /root/empty has no children — findNode should not crash
    expect(findNode(makeTree(), '/root/empty/inside.md')).toBeNull();
  });

  it('returns null when the path is only a prefix of a node path', () => {
    expect(findNode(makeTree(), '/root/docs/sub')).not.toBeNull(); // exact match works
    expect(findNode(makeTree(), '/root/docs/su')).toBeNull();       // prefix is not a match
  });
});