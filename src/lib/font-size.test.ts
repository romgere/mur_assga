import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../test/helpers';
import { FONT_SIZE_KEY, applyFontSize, loadFontSize, saveFontSize } from './font-size';

describe('taille du texte', () => {
  it('vaut « medium » par défaut ou si la valeur est inconnue', () => {
    const storage = memoryStorage();
    expect(loadFontSize(storage)).toBe('medium');
    storage.set(FONT_SIZE_KEY, 'énorme');
    expect(loadFontSize(storage)).toBe('medium');
  });

  it('sauvegarde sous lardy2026.fontSize', () => {
    const storage = memoryStorage();
    saveFontSize('large', storage);
    expect(storage.get('lardy2026.fontSize')).toBe('large');
    expect(loadFontSize(storage)).toBe('large');
  });

  it('pose data-font-size, sauf en taille moyenne', () => {
    const root = document.createElement('html');
    applyFontSize('small', root);
    expect(root.getAttribute('data-font-size')).toBe('small');
    applyFontSize('medium', root);
    expect(root.hasAttribute('data-font-size')).toBe(false);
  });
});
