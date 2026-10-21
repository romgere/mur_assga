import { describe, expect, it } from 'vitest';
import { miniTopo, testStore } from '../test/helpers';
import { defaultFilters } from './ui-state';
import { filterRoutes, gradePages, pageStatus, wallPages } from './views';

const topo = miniTopo();
const ids = (routes: { id: string }[]) => routes.map((r) => r.id);

describe('pages', () => {
  it('une page par mur', () => {
    const pages = wallPages(topo);
    expect(pages.map((p) => p.title)).toEqual(['Mur 1', 'Mur 2']);
    expect(pages[1].routes).toHaveLength(2);
    expect(pages[0].showWall).toBe(false);
  });

  it('une page par cotation présente, plus la traversée', () => {
    const pages = gradePages(topo);
    expect(pages.map((p) => p.label)).toEqual(['4+', '5a', '6a', '7a', 'T']);
    expect(pages.every((p) => p.showWall && p.wallFirst)).toBe(true);
  });

  it('statut de page : aucune, en partie, toutes', () => {
    const store = testStore();
    const page = wallPages(topo)[1];
    expect(pageStatus(page.routes, store)).toBe('none');
    store.toggle('2-ROUGE', 'm');
    expect(pageStatus(page.routes, store)).toBe('partial');
    store.toggle('2-BEIGE', 't');
    expect(pageStatus(page.routes, store)).toBe('complete');
  });
});

describe('filterRoutes', () => {
  const all = defaultFilters(topo.grades.length);

  it('sans filtre, garde tout dans l’ordre des murs', () => {
    expect(ids(filterRoutes(topo.routes, all, testStore(), 4))).toEqual(ids(topo.routes));
  });

  it('filtre par niveau et exclut alors la traversée', () => {
    const r = filterRoutes(topo.routes, { ...all, min: 1, max: 2 }, testStore(), 4);
    expect(ids(r)).toEqual(['1-VERTE', '1-VIOLETTE']);
  });

  it('filtre par statut', () => {
    const store = testStore();
    store.toggle('1-VERTE', 't');
    store.toggle('1-JAUNE', 'm');
    const run = (status: typeof all.status) => ids(filterRoutes(topo.routes, { ...all, status }, store, 4));
    expect(run('done')).toEqual(['1-VERTE', '1-JAUNE']);
    expect(run('todo')).toEqual(['1-VIOLETTE', '2-ROUGE', '2-BEIGE']);
    expect(run('lead')).toEqual(['1-VERTE']);
    expect(run('toprope')).toEqual(['1-JAUNE']);
    expect(run('notlead')).toHaveLength(4);
  });

  it('filtre selon les détails d’ascension', () => {
    const store = testStore();
    store.toggle('1-VERTE', 't');
    store.edit('1-JAUNE', { t: true, tx: 'c' });
    store.edit('2-ROUGE', { t: true, tx: 'cp' });
    store.edit('1-VIOLETTE', { m: true, mx: 'p' });
    const run = (status: typeof all.status) => ids(filterRoutes(topo.routes, { ...all, status }, store, 4));
    expect(run('done')).toEqual(['1-VERTE', '1-JAUNE']);
    expect(run('lead')).toEqual(['1-VERTE', '1-JAUNE']);
    expect(run('notlead')).toEqual(['1-VIOLETTE', '2-ROUGE', '2-BEIGE']);
    expect(run('notcleanlead')).toEqual(['1-JAUNE', '1-VIOLETTE', '2-ROUGE', '2-BEIGE']);
    expect(run('partial')).toEqual(['1-VIOLETTE', '2-ROUGE']);
  });

  it('filtre favoris et compétition', () => {
    const store = testStore();
    store.toggle('2-ROUGE', 's');
    expect(ids(filterRoutes(topo.routes, { ...all, favorites: true }, store, 4))).toEqual(['2-ROUGE']);
    expect(ids(filterRoutes(topo.routes, { ...all, competition: true }, store, 4))).toEqual(['1-VIOLETTE']);
  });

  it('trie facile → dur et dur → facile, traversée en dernier', () => {
    const store = testStore();
    expect(ids(filterRoutes(topo.routes, { ...all, sort: 'asc' }, store, 4))).toEqual([
      '1-JAUNE',
      '1-VIOLETTE',
      '1-VERTE',
      '2-ROUGE',
      '2-BEIGE',
    ]);
    expect(ids(filterRoutes(topo.routes, { ...all, sort: 'desc' }, store, 4))).toEqual([
      '2-ROUGE',
      '1-VERTE',
      '1-VIOLETTE',
      '1-JAUNE',
      '2-BEIGE',
    ]);
  });
});
