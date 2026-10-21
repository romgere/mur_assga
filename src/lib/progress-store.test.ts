import { describe, expect, it, vi } from 'vitest';
import { memoryStorage, testStore } from '../test/helpers';
import { PROGRESS_KEY, ProgressChangeEvent, isDone } from './progress-store';

describe('ProgressStore', () => {
  it('bascule tête et moulinette indépendamment', () => {
    const store = testStore();
    store.toggle('1-VERTE', 't');
    expect(store.get('1-VERTE')).toEqual({ t: true });
    store.toggle('1-VERTE', 'm');
    expect(store.get('1-VERTE')).toEqual({ t: true, m: true });
    store.toggle('1-VERTE', 't');
    expect(store.get('1-VERTE')).toEqual({ m: true });
  });

  it('persiste sous lardy2026.v1 et relit au démarrage', () => {
    const storage = memoryStorage();
    const a = testStore(storage);
    a.toggle('1-VERTE', 's');
    a.setNote('1-VERTE', '  ressentie 6a+  ');
    expect(JSON.parse(storage.get(PROGRESS_KEY)!)).toEqual({ '1-VERTE': { s: true, n: 'ressentie 6a+' } });
    const b = testStore(storage);
    expect(b.get('1-VERTE')).toEqual({ s: true, n: 'ressentie 6a+' });
  });

  it('supprime l’entrée quand elle devient vide', () => {
    const storage = memoryStorage();
    const store = testStore(storage);
    store.toggle('1-VERTE', 't');
    store.toggle('1-VERTE', 't');
    expect(JSON.parse(storage.get(PROGRESS_KEY)!)).toEqual({});
  });

  it('émet un événement avec l’id modifié', () => {
    const store = testStore();
    const spy = vi.fn();
    store.addEventListener(ProgressChangeEvent.type, (e) => spy((e as ProgressChangeEvent).id));
    store.toggle('2-ROUGE', 'm');
    store.clear();
    expect(spy.mock.calls).toEqual([['2-ROUGE'], [undefined]]);
  });

  it('compte tête, moulinette et voies faites', () => {
    const store = testStore();
    store.toggle('1-VERTE', 't');
    store.toggle('1-VERTE', 'm');
    store.toggle('1-JAUNE', 'm');
    store.toggle('2-ROUGE', 's');
    expect(store.counts()).toEqual({ total: 5, lead: 1, toprope: 2, done: 2 });
    expect(isDone(store.get('2-ROUGE'))).toBe(false);
  });

  it('exporte puis réimporte une sauvegarde', () => {
    const a = testStore();
    a.toggle('1-VERTE', 't');
    a.setNote('2-BEIGE', 'facile');
    const text = a.exportText();
    const b = testStore();
    const result = b.importText(text);
    expect(result.ok).toBe(true);
    expect(result.imported).toBe(2);
    expect(b.get('2-BEIGE')).toEqual({ n: 'facile' });
  });

  it('accepte une table brute et ignore les voies inconnues', () => {
    const store = testStore();
    const result = store.importText(JSON.stringify({ '1-VERTE': { t: true }, '99-ROSE': { m: true } }));
    expect(result).toMatchObject({ ok: true, imported: 1, ignored: 1 });
  });

  it.each([
    ['pas du json', /JSON valide/],
    ['[1,2]', /objet JSON/],
    ['{"1-VERTE": {"t": "oui"}}', /« t » invalide/],
    ['{"1-VERTE": {"n": 3}}', /Note invalide/],
    ['{"1-VERTE": true}', /Entrée invalide/],
    ['{"app": "autre", "progress": {}}', /ne provient pas/],
    ['{"app": "lardy2026", "version": 9, "progress": {}}', /plus récente/],
  ])('rejette %s sans rien modifier', (text, message) => {
    const store = testStore();
    store.toggle('1-VERTE', 'm');
    const result = store.importText(text);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(message);
    expect(store.get('1-VERTE')).toEqual({ m: true });
  });

  it('ignore une sauvegarde locale corrompue', () => {
    const storage = memoryStorage();
    storage.set(PROGRESS_KEY, '{"1-VERTE": {"t": 42}}');
    expect(testStore(storage).get('1-VERTE')).toEqual({});
  });
});
