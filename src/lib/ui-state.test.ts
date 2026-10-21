import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../test/helpers';
import { UI_KEY, defaultFilters, loadUiState, saveUiState } from './ui-state';

describe('état d’interface', () => {
  it('donne des valeurs par défaut', () => {
    expect(loadUiState(16, memoryStorage())).toEqual({
      mode: 'wall',
      wallPage: 0,
      gradePage: 0,
      filters: defaultFilters(16),
    });
  });

  it('relit ce qui a été sauvegardé', () => {
    const storage = memoryStorage();
    const state = { mode: 'all' as const, wallPage: 3, gradePage: 5, filters: { ...defaultFilters(16), min: 4, favorites: true } };
    saveUiState(state, storage);
    expect(loadUiState(16, storage)).toEqual(state);
  });

  it('corrige les valeurs invalides', () => {
    const storage = memoryStorage();
    storage.set(UI_KEY, JSON.stringify({ mode: 'x', wallPage: -2, filters: { min: 10, max: 3, status: 'zz', sort: 1 } }));
    const ui = loadUiState(16, storage);
    expect(ui.mode).toBe('wall');
    expect(ui.wallPage).toBe(0);
    expect(ui.filters).toMatchObject({ min: 10, max: 15, status: 'any', sort: 'wall' });
  });
});
