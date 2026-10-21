import { describe, expect, it } from 'vitest';
import { FakeStorage } from '../test/helpers';
import { createStorage, readJson, writeJson } from './storage';

describe('createStorage', () => {
  it('lit et écrit dans le stockage du navigateur', () => {
    const backend = new FakeStorage();
    const s = createStorage(backend);
    s.set('a', '1');
    expect(backend.getItem('a')).toBe('1');
    expect(s.get('a')).toBe('1');
    s.remove('a');
    expect(s.get('a')).toBeNull();
    expect(s.persistent).toBe(true);
  });

  it('se replie en mémoire si le stockage lève une erreur', () => {
    const backend = new FakeStorage();
    backend.failing = true;
    const s = createStorage(backend);
    s.set('a', '1');
    expect(s.persistent).toBe(false);
    expect(s.get('a')).toBe('1');
  });

  it('fonctionne sans stockage du tout', () => {
    const s = createStorage(null);
    expect(s.persistent).toBe(false);
    s.set('k', 'v');
    expect(s.get('k')).toBe('v');
  });

  it('readJson ignore un JSON corrompu', () => {
    const s = createStorage(new FakeStorage());
    s.set('x', '{pas du json');
    expect(readJson(s, 'x')).toBeNull();
    writeJson(s, 'y', { a: 1 });
    expect(readJson(s, 'y')).toEqual({ a: 1 });
  });
});
