import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../test/helpers';
import { THEME_KEY, applyTheme, loadTheme, saveTheme } from './theme';

describe('thème', () => {
  it('vaut « auto » par défaut ou si la valeur est inconnue', () => {
    const storage = memoryStorage();
    expect(loadTheme(storage)).toBe('auto');
    storage.set(THEME_KEY, 'rose');
    expect(loadTheme(storage)).toBe('auto');
  });

  it('sauvegarde sous lardy2026.theme', () => {
    const storage = memoryStorage();
    saveTheme('dark', storage);
    expect(storage.get('lardy2026.theme')).toBe('dark');
    expect(loadTheme(storage)).toBe('dark');
  });

  it('pose data-theme, sauf en mode auto', () => {
    const root = document.createElement('html');
    applyTheme('light', root);
    expect(root.getAttribute('data-theme')).toBe('light');
    applyTheme('auto', root);
    expect(root.hasAttribute('data-theme')).toBe(false);
  });
});
