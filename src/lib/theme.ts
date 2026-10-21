import { storage as defaultStorage, type KeyValueStorage } from './storage';

export const THEME_KEY = 'lardy2026.theme';
export type Theme = 'auto' | 'light' | 'dark';
export const THEMES: Theme[] = ['auto', 'light', 'dark'];

export function loadTheme(store: KeyValueStorage = defaultStorage): Theme {
  const value = store.get(THEME_KEY);
  return THEMES.includes(value as Theme) ? (value as Theme) : 'auto';
}

/** « auto » retire l'attribut : c'est alors prefers-color-scheme qui décide. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function saveTheme(theme: Theme, store: KeyValueStorage = defaultStorage): void {
  store.set(THEME_KEY, theme);
}
