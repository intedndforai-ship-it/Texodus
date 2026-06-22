import { computed, onMounted, onUnmounted, ref, type ComputedRef } from 'vue';
import { useSettingsStore } from '../stores/settings';

export type ResolvedTheme = 'light' | 'dark';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

/**
 * Resolves the user-selected theme mode (`light`/`dark`/`system`) to the
 * effective light/dark value and keeps it reactive to OS theme changes.
 */
export function useResolvedTheme(): {
  resolvedTheme: ComputedRef<ResolvedTheme>;
  isDarkTheme: ComputedRef<boolean>;
} {
  const settingsStore = useSettingsStore();
  const systemDark = ref(systemPrefersDark());
  let mediaQuery: MediaQueryList | null = null;

  const handleSystemThemeChange = (event: MediaQueryListEvent) => {
    systemDark.value = event.matches;
  };

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemDark.value = mediaQuery.matches;
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  });

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', handleSystemThemeChange);
  });

  const resolvedTheme = computed<ResolvedTheme>(() => {
    if (settingsStore.themeMode === 'system') {
      return systemDark.value ? 'dark' : 'light';
    }
    return settingsStore.themeMode;
  });

  const isDarkTheme = computed(() => resolvedTheme.value === 'dark');

  return { resolvedTheme, isDarkTheme };
}
