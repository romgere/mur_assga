import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../lib/storage';
import { RELEASE_NOTES, SEEN_VERSION_KEY } from '../lib/release-notes';
import { UI_KEY } from '../lib/ui-state';
import { $, $$, memoryStorage, mount, settle, testStore } from '../test/helpers';
import type { AllRoutesView } from './all-routes-view';
import type { FavoritesView } from './favorites-view';
import type { HelpSheet } from './help-sheet';
import { LardyApp } from './lardy-app';
import type { ModeTabs } from './mode-tabs';
import type { NoteSheet } from './note-sheet';
import type { ReleaseNotesSheet } from './release-notes-sheet';
import type { PagerDots } from './pager-dots';
import type { ProgressCounters } from './progress-counters';
import type { RoutePager } from './route-pager';
import type { RouteList } from './route-list';
import type { RouteRow } from './route-row';
import type { SettingsSheet } from './settings-sheet';
import type { StatsView } from './stats-view';

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
  it('démarre en mode « Mur » avec pager et pastilles', async () => {
    const el = await app();
    const pager = $<RoutePager>(el, 'lardy-route-pager');
    expect(pager.pages.map((p) => p.title)).toEqual(['Mur 1', 'Mur 2']);
    expect($<PagerDots>(el, 'lardy-pager-dots').label).toBe('Murs');
    expect($(el, 'h1').textContent).toContain('Lardy');
    const logos = $$<HTMLImageElement>(el, 'img.logo');
    expect(logos.map((l) => l.getAttribute('src'))).toEqual(['/logo-header-light.png', '/logo-header-dark.png']);
    expect(logos.every((l) => l.alt === '')).toBe(true);
  });

  it('passe en mode « Difficulté » puis « Toutes » et mémorise le mode', async () => {
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
    await settle(el, row);
    expect(el.shadowRoot!.querySelector('lardy-progress-counters')).toBeNull();
    switchMode(el, 4);
    await settle(el);
    const stats = $<StatsView>(el, 'lardy-stats-view');
    const counters = $<ProgressCounters>(stats, 'lardy-progress-counters');
    await settle(el, stats, counters);
    expect($(counters, '.value').textContent).toBe('1');
    expect(el.shadowRoot!.querySelector('lardy-pager-dots')).toBeNull();
    stats.dispatchEvent(new CustomEvent('count-change', { detail: { count: 'lead' } }));
    await settle(el);
    expect(stats.count).toBe('lead');
  });

  it('affiche les favoris dans l’onglet dédié, sans pastilles', async () => {
    const el = await app();
    el.store.toggle('2-ROUGE', 's');
    switchMode(el, 3);
    await settle(el);
    const view = $<FavoritesView>(el, 'lardy-favorites-view');
    expect($<RouteList>(view, 'lardy-route-list').routes.map((r) => r.id)).toEqual(['2-ROUGE']);
    expect(el.shadowRoot!.querySelector('lardy-pager-dots')).toBeNull();
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

  it('n’affiche pas de nouveautés à la première visite', async () => {
    const el = await app();
    expect($<ReleaseNotesSheet>(el, 'lardy-release-notes-sheet').open).toBe(false);
  });

  it('affiche une fois les nouveautés après une mise à jour', async () => {
    const storage = memoryStorage();
    storage.set(SEEN_VERSION_KEY, '0.0.1');
    const el = await app(storage);
    const sheet = $<ReleaseNotesSheet>(el, 'lardy-release-notes-sheet');
    expect(sheet.open).toBe(true);
    expect(sheet.heading).toBe('Application mise à jour');
    expect(sheet.notes).toEqual(RELEASE_NOTES);
    sheet.dispatchEvent(new CustomEvent('close'));
    await el.updateComplete;
    expect(sheet.open).toBe(false);
    el.remove();
    const again = await app(storage);
    expect($<ReleaseNotesSheet>(again, 'lardy-release-notes-sheet').open).toBe(false);
  });

  it('ouvre les nouveautés demandées depuis les réglages ou le bandeau', async () => {
    const el = await app();
    $(el, 'button.settings').click();
    await settle(el);
    const notes = [RELEASE_NOTES[0]];
    const settings = $<SettingsSheet>(el, 'lardy-settings-sheet');
    settings.dispatchEvent(new CustomEvent('show-release-notes', { detail: { heading: 'Nouveautés', notes } }));
    await settle(el);
    expect(settings.open).toBe(false);
    const sheet = $<ReleaseNotesSheet>(el, 'lardy-release-notes-sheet');
    expect(sheet.open).toBe(true);
    expect(sheet.notes).toEqual(notes);
    sheet.dispatchEvent(new CustomEvent('close'));
    await settle(el);
    $(el, 'lardy-update-banner').dispatchEvent(new CustomEvent('show-release-notes', { detail: { heading: 'Maj', notes } }));
    await settle(el);
    expect(sheet.heading).toBe('Maj');
    expect(sheet.open).toBe(true);
  });

  it('ouvre l’aide demandée depuis une ligne ou les réglages', async () => {
    const el = await app();
    const help = () => $<HelpSheet>(el, 'lardy-help-sheet');
    expect(help().open).toBe(false);
    $(el, 'main').dispatchEvent(new Event('open-help', { bubbles: true, composed: true }));
    await settle(el);
    expect(help().open).toBe(true);
    help().dispatchEvent(new CustomEvent('close'));
    await settle(el);
    expect(help().open).toBe(false);
    $(el, 'button.settings').click();
    await settle(el);
    const settings = $<SettingsSheet>(el, 'lardy-settings-sheet');
    await settle(settings);
    $(settings, 'button.help').click();
    await settle(el);
    expect(help().open).toBe(true);
  });
});
