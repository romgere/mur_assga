import { describe, expect, it, vi } from 'vitest';
import { defaultFilters } from '../lib/ui-state';
import { $, $$, miniTopo, mount, settle, testStore } from '../test/helpers';
import { AllRoutesView } from './all-routes-view';
import type { RouteList } from './route-list';

async function view() {
  const topo = miniTopo();
  const el = new AllRoutesView();
  el.routes = topo.routes;
  el.grades = topo.grades;
  el.filters = defaultFilters(topo.grades.length);
  el.store = testStore();
  return mount(el);
}

const listed = (el: AllRoutesView) => $<RouteList>(el, 'lardy-route-list').routes.map((r) => r.id);

function choose(el: AllRoutesView, name: string, value: string) {
  const select = $<HTMLSelectElement>(el, `select[name="${name}"]`);
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

describe('lardy-all-routes-view', () => {
  it('liste toutes les voies avec leur mur', async () => {
    const el = await view();
    expect(listed(el)).toHaveLength(5);
    expect($(el, '.count').textContent).toBe('5 voies');
    expect($<RouteList>(el, 'lardy-route-list').showWall).toBe(true);
  });

  it('filtre par niveau et émet filters-change', async () => {
    const el = await view();
    const spy = vi.fn();
    el.addEventListener('filters-change', (e) => spy((e as CustomEvent).detail.filters));
    choose(el, 'min', '2');
    await el.updateComplete;
    expect(listed(el)).toEqual(['1-VERTE', '2-ROUGE']);
    expect(spy.mock.calls[0][0]).toMatchObject({ min: 2, max: 3 });
  });

  it('remonte le max si le min le dépasse', async () => {
    const el = await view();
    choose(el, 'max', '1');
    await el.updateComplete;
    choose(el, 'min', '3');
    await el.updateComplete;
    expect(el.filters).toMatchObject({ min: 3, max: 3 });
    expect($<HTMLSelectElement>(el, 'select[name="max"]').value).toBe('3');
  });

  it('filtre faites / non faites et favoris', async () => {
    const el = await view();
    el.store.toggle('1-VERTE', 'm');
    el.store.toggle('2-ROUGE', 's');
    choose(el, 'status', 'done');
    await el.updateComplete;
    expect(listed(el)).toEqual(['1-VERTE']);
    choose(el, 'status', 'any');
    $(el, 'button[name="favorites"]').click();
    await el.updateComplete;
    expect(listed(el)).toEqual(['2-ROUGE']);
  });

  it('filtre compétition et trie', async () => {
    const el = await view();
    $(el, 'button[name="competition"]').click();
    await el.updateComplete;
    expect(listed(el)).toEqual(['1-VIOLETTE']);
    $(el, 'button[name="competition"]').click();
    choose(el, 'sort', 'desc');
    await el.updateComplete;
    expect(listed(el)[0]).toBe('2-ROUGE');
  });

  it('ne retire pas une voie cochée tant que les filtres ne changent pas', async () => {
    const el = await view();
    choose(el, 'status', 'todo');
    await el.updateComplete;
    el.store.toggle('1-VERTE', 't');
    await settle(el);
    expect(listed(el)).toContain('1-VERTE');
    el.store.clear();
    await settle(el);
    expect(listed(el)).toHaveLength(5);
  });

  it('affiche le tri avec un libellé visible et une icône', async () => {
    const el = await view();
    const label = $(el, 'label.sort');
    expect(label.textContent).toContain('Tri');
    expect(label.querySelector('svg')).not.toBeNull();
    expect(label.querySelector('select[name="sort"]')).not.toBeNull();
  });

  it('propose de réinitialiser les filtres', async () => {
    const el = await view();
    expect(el.shadowRoot!.querySelector('.reset')).toBeNull();
    $(el, 'button[name="favorites"]').click();
    await el.updateComplete;
    $(el, '.reset').click();
    await el.updateComplete;
    expect(el.filters).toEqual(defaultFilters(4));
    expect($$(el, '.reset')).toHaveLength(0);
  });
});
