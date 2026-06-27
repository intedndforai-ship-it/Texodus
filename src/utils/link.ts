/**
 * Link validation utilities for the Markdown preview.
 */

import { hasUrlScheme } from './path';

/**
 * Returns true when `href` is a safe external link that the preview may open
 * via the OS — `http:`, `https:`, or `mailto:`. Unsafe schemes like `data:`,
 * `javascript:`, `vbscript:`, etc. are rejected. Relative paths (no scheme)
 * are also rejected — they're handled by `rewriteLocalImages`, not link clicks.
 */
export function isAllowedExternalHref(href: string): boolean {
  if (!hasUrlScheme(href)) return false;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}