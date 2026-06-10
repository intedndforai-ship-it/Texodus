import { describe, expect, it } from 'vitest';
import { getExportTitle, renderExportHtml } from './exportService';

describe('getExportTitle', () => {
  it('falls back to Untitled without a path', () => {
    expect(getExportTitle(null)).toBe('Untitled');
  });

  it('uses the file name without its extension', () => {
    expect(getExportTitle('/a/b/report.md')).toBe('report');
    expect(getExportTitle('C:\\docs\\notes.markdown')).toBe('notes');
  });

  it('keeps dotfiles whole instead of producing an empty title', () => {
    expect(getExportTitle('/a/.env')).toBe('.env');
  });
});

describe('renderExportHtml', () => {
  it('produces a self-contained document with the rendered markdown', async () => {
    const html = await renderExportHtml('# Hello\n\nSome *text*.', 'My Doc');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<title>My Doc</title>');
    expect(html).toContain('<style>');
    expect(html).toContain('Hello');
    expect(html).toContain('<em>text</em>');
  });

  it('escapes the title', async () => {
    const html = await renderExportHtml('x', '<b>"T" & Co</b>');
    expect(html).toContain('<title>&lt;b&gt;&quot;T&quot; &amp; Co&lt;/b&gt;</title>');
  });

  it('sanitizes scripts out of the exported body', async () => {
    const html = await renderExportHtml('safe\n\n<script>alert(1)</script>', 'T');
    expect(html).not.toContain('<script>alert(1)');
  });
});
