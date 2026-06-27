import { describe, it, expect } from 'vitest';
import { isAllowedExternalHref } from './link';

describe('isAllowedExternalHref', () => {
  // ── Allowed schemes ──────────────────────────────────────────────

  it('allows http:// links', () => {
    expect(isAllowedExternalHref('http://example.com')).toBe(true);
  });

  it('allows https:// links', () => {
    expect(isAllowedExternalHref('https://example.com/path?q=1')).toBe(true);
  });

  it('allows mailto: links', () => {
    expect(isAllowedExternalHref('mailto:user@example.com')).toBe(true);
  });

  // ── Dangerous schemes ────────────────────────────────────────────

  it('rejects javascript: URIs', () => {
    expect(isAllowedExternalHref('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URIs', () => {
    expect(isAllowedExternalHref('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects vbscript: URIs', () => {
    expect(isAllowedExternalHref('vbscript:msgbox("xss")')).toBe(false);
  });

  it('rejects file: URIs', () => {
    expect(isAllowedExternalHref('file:///etc/passwd')).toBe(false);
  });

  // ── Non-scheme inputs ─────────────────────────────────────────────

  it('rejects relative paths (no scheme)', () => {
    expect(isAllowedExternalHref('images/foo.png')).toBe(false);
  });

  it('rejects absolute paths (no scheme)', () => {
    expect(isAllowedExternalHref('/etc/passwd')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isAllowedExternalHref('')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isAllowedExternalHref('http://[invalid')).toBe(false);
  });
});