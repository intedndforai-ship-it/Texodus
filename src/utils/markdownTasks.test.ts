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
});
