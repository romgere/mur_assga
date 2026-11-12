import { storage as defaultStorage, type KeyValueStorage } from './storage';

export const FONT_SIZE_KEY = 'lardy2026.fontSize';
export type FontSize = 'small' | 'medium' | 'large';
export const FONT_SIZES: FontSize[] = ['small', 'medium', 'large'];

export function loadFontSize(store: KeyValueStorage = defaultStorage): FontSize {
  const value = store.get(FONT_SIZE_KEY);
  return FONT_SIZES.includes(value as FontSize) ? (value as FontSize) : 'medium';
}

/**
 * Pose data-font-size, lu par tokens.css pour régler --font-scale. « medium »
 * (la taille d'origine) retire l'attribut.
 */
export function applyFontSize(size: FontSize, root: HTMLElement = document.documentElement): void {
  if (size === 'medium') root.removeAttribute('data-font-size');
  else root.setAttribute('data-font-size', size);
}

export function saveFontSize(size: FontSize, store: KeyValueStorage = defaultStorage): void {
  store.set(FONT_SIZE_KEY, size);
}
