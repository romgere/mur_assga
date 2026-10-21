import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../lib/storage';
import { UI_KEY } from '../lib/ui-state';
import { $, $$, memoryStorage, mount, settle, testStore } from '../test/helpers';
import type { AllRoutesView } from './all-routes-view';
import { LardyApp } from './lardy-app';
import type { ModeTabs } from './mode-tabs';
import type { NoteSheet } from './note-sheet';
import type { PagerDots } from './pager-dots';
import type { RoutePager } from './route-pager';
import type { RouteRow } from './route-row';
import type { SettingsSheet } from './settings-sheet';

async function app(storage: KeyValueStorage = memoryStorage()) {
  const el = new LardyApp();
  el.storage = storage;
  el.store = testStore(storage);
  await mount(el);
  await settle(el);
  return el;
}

function switchMode(el: LardyApp, index: number) {
  const tabs = $<ModeTabs>(el, 'lardy-mode-tabs');
  $$(tabs, '[role="tab"]')[index].click();
}

describe('lardy-app', () => {
  it('démarre en mode « Par mur » avec pager et pastilles', async () => {
    const el = await app();
    const pager = $<RoutePager>(el, 'lardy-route-pager');
    expect(pager.pages.map((p) => p.title)).toEqual(['Mur 1', 'Mur 2']);
    expect($<PagerDots>(el, 'lardy-pager-dots').label).toBe('Murs');
    expect($(el, 'h1').textContent).toContain('Lardy');
  });

  it('passe en mode « Par difficulté » puis « Toutes » et mémorise le mode', async () => {
    const storage = memoryStorage();
    const el = await app(storage);
    switchMode(el, 1);
    await settle(el);
    expect($<RoutePager>(el, 'lardy-route-pager').pages[0].title).toBe('Cotation 4+');
    switchMode(el, 2);
    await settle(el);
    expect(el.shadowRoot!.querySelector('lardy-route-pager')).toBeNull();
    expect(el.shadowRoot!.querySelector('lardy-pager-dots')).toBeNull();
    expect($<AllRoutesView>(el, 'lardy-all-routes-view').routes).toHaveLength(5);
    expect(JSON.parse(storage.get(UI_KEY)!).mode).toBe('all');
  });

  it('recrée un pager à chaque changement de mode', async () => {
    const el = await app();
    const first = $(el, 'lardy-route-pager');
    switchMode(el, 1);
    await settle(el);
    expect($(el, 'lardy-route-pager')).not.toBe(first);
  });

  it('suit la page du pager et la sauvegarde', async () => {
    const storage = memoryStorage();
    const el = await app(storage);
    $(el, 'lardy-route-pager').dispatchEvent(new CustomEvent('page-change', { detail: { index: 1 } }));
    await settle(el);
    expect($<PagerDots>(el, 'lardy-pager-dots').index).toBe(1);
    expect(JSON.parse(storage.get(UI_KEY)!).wallPage).toBe(1);
    const again = await app(storage);
    expect($<RoutePager>(again, 'lardy-route-pager').initialIndex).toBe(1);
  });

  it('met à jour les compteurs au clic sur une voie', async () => {
    const el = await app();
    const pager = $<RoutePager>(el, 'lardy-route-pager');
    const list = pager.shadowRoot!.querySelector('lardy-route-list')!;
    const row = list.shadowRoot!.querySelector<RouteRow>('lardy-route-row')!;
    $(row, 'button.lead').click();
    const counters = $(el, 'lardy-progress-counters');
    await settle(el, row);
    expect($(counters, '.value').textContent).toBe('1');
  });

  it('ouvre la note demandée par une ligne', async () => {
    const el = await app();
    const route = el.store.topo.routes[1];
    $(el, 'main').dispatchEvent(new CustomEvent('open-note', { detail: { route } }));
    await settle(el);
    expect($<NoteSheet>(el, 'lardy-note-sheet').route).toBe(route);
  });

  it('ouvre les réglages et applique le thème', async () => {
    const storage = memoryStorage();
    const el = await app(storage);
    $(el, 'button.settings').click();
    await settle(el);
    const settings = $<SettingsSheet>(el, 'lardy-settings-sheet');
    expect(settings.open).toBe(true);
    settings.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: 'dark' } }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(storage.get('lardy2026.theme')).toBe('dark');
    document.documentElement.removeAttribute('data-theme');
  });
});
