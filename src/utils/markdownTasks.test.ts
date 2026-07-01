import { describe, expect, it } from 'vitest';
import { collectMarkdownTaskCheckboxes } from './markdownTasks';

describe('collectMarkdownTaskCheckboxes', () => {
  it('finds task checkboxes and checked state', () => {
    const out = collectMarkdownTaskCheckboxes('- [ ] one\n1. [x] two\n> - [X] three');
    expect(out.map((c) => c.checked)).toEqual([false, true, true]);
  });

  it('ignores checkbox-looking text inside backtick and tilde fences', () => {
    const markdown = [
      '- [ ] real',
      '```',
      '- [ ] ignored',
      '```',
      '~~~',
      '- [x] ignored too',
      '~~~',
      '- [x] real too',
    ].join('\n');

    const out = collectMarkdownTaskCheckboxes(markdown);
    expect(out.map((c) => c.checked)).toEqual([false, true]);
  });

  it('returns source offsets for the checkbox marker', () => {
    const markdown = 'intro\n> - [ ] quoted';
    const [checkbox] = collectMarkdownTaskCheckboxes(markdown);
    expect(markdown.slice(checkbox.markerStart, checkbox.markerStart + 3)).toBe('[ ]');
  });

  it('ignores a marker with no space after `]` (Marked renders it as plain text)', () => {
    // `- [ ]nospace` is NOT a task in GFM/Marked — only the second item is a
    // real checkbox, so it must be the only one collected (otherwise DOM and
    // source indices drift and clicks toggle the wrong line).
    const out = collectMarkdownTaskCheckboxes('- [ ]nospace\n- [x] ok');
    expect(out.map((c) => c.checked)).toEqual([true]);
  });

  it('points the offset at the right marker when an earlier line is not a task', () => {
    const markdown = '- [ ]nospace\n- [x] ok';
    const [checkbox] = collectMarkdownTaskCheckboxes(markdown);
    expect(markdown.slice(checkbox.markerStart, checkbox.markerStart + 3)).toBe('[x]');
  });

  it('counts an empty task only when a space follows the bracket', () => {
    expect(collectMarkdownTaskCheckboxes('- [ ]')).toHaveLength(0);
    expect(collectMarkdownTaskCheckboxes('- [ ] ')).toHaveLength(1);
  });
});
