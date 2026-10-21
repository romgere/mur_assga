import { describe, expect, it, vi } from 'vitest';
import { wallPages, gradePages } from '../lib/views';
import { $, $$, miniTopo, mount, testStore } from '../test/helpers';
import type { RouteList } from './route-list';
import { RoutePager } from './route-pager';

const WIDTH = 300;

async function pager(initialIndex = 0) {
  const el = new RoutePager();
  el.pages = gradePages(miniTopo());
  el.store = testStore();
  el.initialIndex = initialIndex;
  // happy-dom ne calcule pas la mise en page : on fixe la largeur de la piste.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(WIDTH);
  return mount(el);
}

describe('lardy-route-pager', () => {
  it('rend une section par page avec titre et liste', async () => {
    const el = await pager();
    const pages = $$(el, 'section.page');
    expect(pages).toHaveLength(5);
    expect(pages[0].getAttribute('aria-label')).toBe('Cotation 4+');
    const list = pages[0].querySelector<RouteList>('lardy-route-list')!;
    expect(list.routes.map((r) => r.id)).toEqual(['1-JAUNE']);
    expect(list.showWall).toBe(true);
  });

  it('se positionne sur la page initiale', async () => {
    const el = await pager(3);
    expect(el.index).toBe(3);
    expect($(el, '.track').scrollLeft).toBe(3 * WIDTH);
  });

  it('émet page-change quand on fait défiler', async () => {
    const el = await pager();
    const spy = vi.fn();
    el.addEventListener('page-change', (e) => spy((e as CustomEvent).detail.index));
    const track = $(el, '.track');
    track.scrollLeft = 2 * WIDTH + 40;
    track.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 20));
    expect(spy).toHaveBeenCalledWith(2);
    expect(el.index).toBe(2);
  });

  it('goTo fait défiler et borne l’index', async () => {
    const el = await pager();
    const spy = vi.fn();
    el.addEventListener('page-change', (e) => spy((e as CustomEvent).detail.index));
    el.goTo(99, false);
    expect(el.index).toBe(4);
    expect(spy).toHaveBeenCalledWith(4);
  });

  it('ne reconstruit pas les pages quand une voie change', async () => {
    const el = new RoutePager();
    el.pages = wallPages(miniTopo());
    el.store = testStore();
    await mount(el);
    const spy = vi.spyOn(el, 'requestUpdate');
    el.store.toggle('1-VERTE', 't');
    expect(spy).not.toHaveBeenCalled();
  });
});
