import { defineConfig } from 'vitest/config';

// jsdom (not happy-dom): the sanitizer tests feed hostile markup through
// DOMPurify, and happy-dom's HTML parser mishandles siblings that follow a
// <script> element — onerror attributes survived sanitization there. DOMPurify
// itself is tested against jsdom, so it is the accurate environment for
// security assertions. jsdom also never fetches external resources by default.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
