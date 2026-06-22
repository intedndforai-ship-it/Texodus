export interface MarkdownTaskCheckbox {
  markerStart: number;
  checked: boolean;
}

const TASK_CHECKBOX_RE = /^[>\s]*([-*+]|\d+[.)])\s+(\[[ xX]\])/;
const FENCE_RE = /^[ \t]{0,3}(`{3,}|~{3,})/;

function isFenceClose(line: string, markerChar: '`' | '~', minLength: number): boolean {
  const re = markerChar === '`' ? /^[ \t]{0,3}(`{3,})/ : /^[ \t]{0,3}(~{3,})/;
  const match = re.exec(line);
  return match !== null && match[1].length >= minLength;
}

/**
 * Finds source locations of Markdown task-list checkboxes that Marked renders
 * as real checkbox inputs. Fenced code blocks (both ``` and ~~~) are skipped so
 * DOM checkbox indices line up with source positions.
 */
export function collectMarkdownTaskCheckboxes(markdown: string): MarkdownTaskCheckbox[] {
  const checkboxes: MarkdownTaskCheckbox[] = [];
  let offset = 0;
  let fence: { char: '`' | '~'; length: number } | null = null;

  for (const line of markdown.match(/.*(?:\n|$)/g) ?? []) {
    if (line === '') break;

    const fenceMatch = FENCE_RE.exec(line);
    if (fence) {
      if (isFenceClose(line, fence.char, fence.length)) fence = null;
      offset += line.length;
      continue;
    }

    if (fenceMatch) {
      fence = { char: fenceMatch[1][0] as '`' | '~', length: fenceMatch[1].length };
      offset += line.length;
      continue;
    }

    const taskMatch = TASK_CHECKBOX_RE.exec(line);
    if (taskMatch) {
      const marker = taskMatch[2];
      checkboxes.push({
        markerStart: offset + taskMatch[0].indexOf(marker),
        checked: marker !== '[ ]',
      });
    }

    offset += line.length;
  }

  return checkboxes;
}
