import { describe, expect, it } from 'vitest';
import { $, $$, miniTopo, mount, testStore } from '../test/helpers';
import { RouteList } from './route-list';
import type { RouteRow } from './route-row';

describe('lardy-route-list', () => {
  it('affiche une ligne par voie et transmet show-wall et le store', async () => {
    const el = new RouteList();
    const store = testStore();
    el.routes = miniTopo().routes;
    el.store = store;
    el.showWall = true;
    await mount(el);
    const rows = $$<RouteRow>(el, 'lardy-route-row');
    expect(rows).toHaveLength(5);
    expect(rows[0].showWall).toBe(true);
    expect(rows[0].store).toBe(store);
    expect(el.getAttribute('role')).toBe('list');
  });

  it('affiche un message quand la liste est vide', async () => {
    const el = new RouteList();
    el.empty = 'Rien ici';
    await mount(el);
    expect($(el, '.empty').textContent).toBe('Rien ici');
  });

  it('réutilise les lignes existantes quand la liste change', async () => {
    const el = new RouteList();
    const routes = miniTopo().routes;
    el.routes = routes;
    await mount(el);
    const first = $(el, 'lardy-route-row');
    el.routes = routes.slice(0, 2);
    await el.updateComplete;
    expect($(el, 'lardy-route-row')).toBe(first);
  });
});
