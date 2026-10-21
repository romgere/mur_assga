import { describe, expect, it } from 'vitest';
import { $, mount, settle, testStore } from '../test/helpers';
import { FavoritesView } from './favorites-view';
import type { RouteList } from './route-list';

async function view(...favorites: string[]) {
  const el = new FavoritesView();
  el.store = testStore();
  for (const id of favorites) el.store.toggle(id, 's');
  return mount(el);
}

const listed = (el: FavoritesView) => $<RouteList>(el, 'lardy-route-list').routes.map((r) => r.id);

describe('lardy-favorites-view', () => {
  it('liste les favoris dans l’ordre des murs, avec leur mur', async () => {
    const el = await view('2-ROUGE', '1-JAUNE');
    expect(listed(el)).toEqual(['1-JAUNE', '2-ROUGE']);
    expect($<RouteList>(el, 'lardy-route-list').showWall).toBe(true);
    expect($(el, '.count').textContent).toBe('2 voies');
  });

  it('affiche un message quand il n’y a aucun favori', async () => {
    const el = await view();
    expect($(el, '.count').textContent).toBe('0 voie');
    const list = $<RouteList>(el, 'lardy-route-list');
    await list.updateComplete;
    expect($(list, '.empty').textContent).toContain('Aucun favori');
  });

  it('garde une voie dont on retire l’étoile, jusqu’au prochain rendu complet', async () => {
    const el = await view('1-VERTE', '2-ROUGE');
    el.store.toggle('1-VERTE', 's');
    await settle(el);
    expect(listed(el)).toEqual(['1-VERTE', '2-ROUGE']);
    el.store.clear();
    await settle(el);
    expect(listed(el)).toEqual([]);
  });
});
