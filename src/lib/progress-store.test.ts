import { describe, expect, it, vi } from 'vitest';
import { buildTopo } from './topo';
import { memoryStorage, miniTopoData, testStore } from '../test/helpers';
import {
  LEGACY_PROGRESS_KEY,
  ProgressChangeEvent,
  ascentSummary,
  hasDetail,
  hasFlaw,
  isClean,
  isCompleted,
  isDone,
  normalizeDetails,
  progressKey,
  withDetail,
} from './progress-store';

const PROGRESS_KEY = progressKey('2026-2027');

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

  it('persiste sous la clé de la saison et relit au démarrage', () => {
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

  it('exporte la saison dans la sauvegarde', () => {
    const backup = JSON.parse(testStore().exportText());
    expect(backup).toMatchObject({ app: 'lardy2026', version: 3, season: '2026-2027' });
  });

  it('accepte une sauvegarde v1 (sans saison) pour la saison 2026-2027', () => {
    const store = testStore();
    const result = store.importText(JSON.stringify({ app: 'lardy2026', version: 1, progress: { '1-VERTE': { t: true } } }));
    expect(result.ok).toBe(true);
    expect(store.get('1-VERTE')).toEqual({ t: true });
  });
});

describe('ProgressStore : détails d’ascension', () => {
  it('relit les données existantes sans détails comme des ascensions propres', () => {
    const storage = memoryStorage();
    storage.set(PROGRESS_KEY, JSON.stringify({ '1-VERTE': { t: true, m: true, s: true, n: 'ok' } }));
    const store = testStore(storage);
    expect(store.get('1-VERTE')).toEqual({ t: true, m: true, s: true, n: 'ok' });
    expect(isClean(store.get('1-VERTE'), 't')).toBe(true);
    expect(ascentSummary(store.get('1-VERTE'), 't')).toBe('Enchaînée proprement');
    expect(store.counts()).toEqual({ total: 5, lead: 1, toprope: 1, done: 1 });
  });

  it('enregistre les détails normalisés et les persiste', () => {
    const storage = memoryStorage();
    testStore(storage).edit('1-VERTE', {
      t: true,
      tx: ['partiel', 'chute', 'chute'],
      m: true,
      mx: ['repos'],
    });
    const saved = { '1-VERTE': { t: true, tx: ['chute', 'partiel'], m: true, mx: ['repos'] } };
    expect(JSON.parse(storage.get(PROGRESS_KEY)!)).toEqual(saved);
    expect(testStore(storage).get('1-VERTE')).toEqual(saved['1-VERTE']);
  });

  it('efface les détails quand la façon de grimper est décochée', () => {
    const store = testStore();
    store.edit('1-VERTE', { t: true, tx: ['chute'] });
    store.toggle('1-VERTE', 't');
    expect(store.get('1-VERTE')).toEqual({});
    store.edit('1-VERTE', { tx: ['repos'] });
    expect(store.get('1-VERTE')).toEqual({});
  });

  it('ne compte pas une ascension partielle comme faite', () => {
    const store = testStore();
    store.edit('1-VERTE', { t: true, tx: ['chute', 'partiel'] });
    store.edit('1-JAUNE', { t: true, tx: ['chute', 'repos'], m: true, mx: ['partiel'] });
    expect(isDone(store.get('1-VERTE'))).toBe(false);
    expect(isCompleted(store.get('1-JAUNE'), 't')).toBe(true);
    expect(isCompleted(store.get('1-JAUNE'), 'm')).toBe(false);
    expect(hasDetail(store.get('1-VERTE'), 't', 'chute')).toBe(true);
    expect(ascentSummary(store.get('1-VERTE'), 't')).toBe('Avec chute · non terminée');
    expect(store.counts()).toEqual({ total: 5, lead: 1, toprope: 0, done: 1 });
  });

  it('à vue et flash comptent comme faites et propres', () => {
    const store = testStore();
    store.edit('1-VERTE', { t: true, tx: ['avue'] });
    store.edit('1-JAUNE', { m: true, mx: ['flash'] });
    expect(isClean(store.get('1-VERTE'), 't')).toBe(true);
    expect(hasFlaw(store.get('1-VERTE'), 't')).toBe(false);
    expect(ascentSummary(store.get('1-VERTE'), 't')).toBe('Enchaînée à vue');
    expect(ascentSummary(store.get('1-JAUNE'), 'm')).toBe('Enchaînée en flash');
    expect(store.counts()).toEqual({ total: 5, lead: 1, toprope: 1, done: 2 });
  });

  it('applique les exclusions entre détails', () => {
    // Un défaut l'emporte sur à vue / flash, à vue sur flash.
    expect(normalizeDetails(['avue', 'chute'])).toEqual(['chute']);
    expect(normalizeDetails(['flash', 'avue'])).toEqual(['avue']);
    expect(normalizeDetails(['repos', 'chute', 'zzz'])).toEqual(['chute', 'repos']);
    // Le détail ajouté retire ceux qu'il exclut.
    expect(withDetail(['chute', 'repos'], 'avue', true)).toEqual(['avue']);
    expect(withDetail(['avue'], 'flash', true)).toEqual(['flash']);
    expect(withDetail(['avue'], 'partiel', true)).toEqual(['partiel']);
    expect(withDetail(['chute'], 'repos', true)).toEqual(['chute', 'repos']);
    expect(withDetail(['chute', 'repos'], 'chute', false)).toEqual(['repos']);
    expect(withDetail(undefined, 'flash', true)).toEqual(['flash']);
  });

  it('exporte et réimporte les détails, ignore les codes inconnus', () => {
    const a = testStore();
    a.edit('1-VERTE', { t: true, tx: ['avue'], m: true, mx: ['partiel', 'repos'] });
    const b = testStore();
    expect(b.importText(a.exportText()).ok).toBe(true);
    expect(b.get('1-VERTE')).toEqual({ t: true, tx: ['avue'], m: true, mx: ['repos', 'partiel'] });
    expect(b.importText(JSON.stringify({ '1-VERTE': { t: true, tx: ['zzz', 'chute', 3] } })).ok).toBe(true);
    expect(b.get('1-VERTE')).toEqual({ t: true, tx: ['chute'] });
  });

  it('accepte une sauvegarde v2 (sans détails)', () => {
    const store = testStore();
    const v2 = { app: 'lardy2026', version: 2, season: '2026-2027', progress: { '1-VERTE': { t: true, m: true } } };
    expect(store.importText(JSON.stringify(v2)).ok).toBe(true);
    expect(store.get('1-VERTE')).toEqual({ t: true, m: true });
  });

  it('rejette des détails qui ne sont pas une liste', () => {
    const result = testStore().importText('{"1-VERTE": {"t": true, "tx": "chute"}}');
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/« tx » invalides/) });
  });
});

function seasonTopo(season: string) {
  return buildTopo({ ...structuredClone(miniTopoData), season });
}

describe('ProgressStore : saisons', () => {
  it('reprend la progression de la V1 sous la clé 2026-2027', () => {
    const storage = memoryStorage();
    storage.set(LEGACY_PROGRESS_KEY, JSON.stringify({ '1-VERTE': { t: true } }));
    const store = testStore(storage);
    expect(store.get('1-VERTE')).toEqual({ t: true });
    expect(storage.get(LEGACY_PROGRESS_KEY)).toBeNull();
    expect(JSON.parse(storage.get(PROGRESS_KEY)!)).toEqual({ '1-VERTE': { t: true } });
  });

  it('ne remplace pas une progression 2026-2027 déjà migrée', () => {
    const storage = memoryStorage();
    storage.set(PROGRESS_KEY, JSON.stringify({ '2-ROUGE': { m: true } }));
    storage.set(LEGACY_PROGRESS_KEY, JSON.stringify({ '1-VERTE': { t: true } }));
    expect(testStore(storage).get('2-ROUGE')).toEqual({ m: true });
  });

  it('démarre une nouvelle saison à zéro sans toucher à la précédente', () => {
    const storage = memoryStorage();
    testStore(storage).toggle('1-VERTE', 't');
    const next = testStore(storage, seasonTopo('2027-2028'));
    expect(next.get('1-VERTE')).toEqual({});
    next.toggle('2-ROUGE', 'm');
    expect(JSON.parse(storage.get(progressKey('2027-2028'))!)).toEqual({ '2-ROUGE': { m: true } });
    expect(JSON.parse(storage.get(PROGRESS_KEY)!)).toEqual({ '1-VERTE': { t: true } });
  });

  it('refuse une sauvegarde d’une autre saison', () => {
    const old = testStore().exportText();
    const next = testStore(memoryStorage(), seasonTopo('2027-2028'));
    const result = next.importText(old);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/saison 2026-2027.*saison 2027-2028/);
  });

  it('remet à zéro une seule voie quand sa révision change', () => {
    const storage = memoryStorage();
    const store = testStore(storage);
    store.toggle('1-VERTE', 't');
    store.toggle('2-ROUGE', 'm');
    const data = structuredClone(miniTopoData);
    data.walls[0].routes[0].rev = 2;
    const reopened = testStore(storage, buildTopo(data));
    expect(reopened.get('1-VERTE~2')).toEqual({});
    expect(reopened.get('2-ROUGE')).toEqual({ m: true });
  });
});
