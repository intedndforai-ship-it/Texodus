import { ref, readonly } from 'vue';

export type UnsavedChoice = 'save' | 'discard' | 'cancel';

export interface UnsavedPromptOptions {
  title?: string;
  body?: string;
  saveLabel?: string;
  discardLabel?: string;
  cancelLabel?: string;
}

const DEFAULT_OPTIONS: Required<UnsavedPromptOptions> = {
  title: 'Unsaved changes',
  body: 'You have unsaved changes. Save them before continuing?',
  saveLabel: 'Save',
  discardLabel: "Don't Save",
  cancelLabel: 'Cancel',
};

const isOpen = ref(false);
const options = ref<Required<UnsavedPromptOptions>>({ ...DEFAULT_OPTIONS });
let resolver: ((choice: UnsavedChoice) => void) | null = null;

/**
 * Shows the unsaved-changes modal and resolves with the user's choice.
 * Implements the 3-button flow required by spec §4.4 (Save / Don't Save / Cancel),
 * which the binary native dialogs cannot express.
 */
export function promptUnsavedChanges(promptOptions: UnsavedPromptOptions = {}): Promise<UnsavedChoice> {
  if (resolver) {
    // Re-entrant call: cancel the previous prompt.
    resolver('cancel');
    resolver = null;
  }
  options.value = { ...DEFAULT_OPTIONS, ...promptOptions };
  isOpen.value = true;
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

export function resolveUnsavedPrompt(choice: UnsavedChoice): void {
  if (!resolver) return;
  isOpen.value = false;
  const r = resolver;
  resolver = null;
  r(choice);
}

export function useUnsavedPromptState() {
  return { isOpen: readonly(isOpen), options: readonly(options) };
}
