import { describe, expect, it, vi } from 'vitest';
import { $, miniTopo, mount, settle, testStore } from '../test/helpers';
import type { BottomSheet } from './bottom-sheet';
import { NoteSheet } from './note-sheet';

const route = miniTopo().routes[0];

async function noteSheet(note?: string) {
  const el = new NoteSheet();
  el.store = testStore();
  if (note) el.store.setNote(route.id, note);
  await mount(el);
  el.route = route;
  await settle(el, $<BottomSheet>(el, 'lardy-sheet'));
  return el;
}

const textarea = (el: NoteSheet) => el.shadowRoot!.querySelector('textarea')!;

describe('lardy-note-sheet', () => {
  it('est fermée sans voie', async () => {
    const el = await mount(new NoteSheet());
    expect($<BottomSheet>(el, 'lardy-sheet').open).toBe(false);
  });

  it('s’ouvre sur la voie avec sa note existante', async () => {
    const el = await noteSheet('déjà là');
    const sheet = $<BottomSheet>(el, 'lardy-sheet');
    expect(sheet.open).toBe(true);
    expect(sheet.heading).toBe('Mur 1 · verte 6a');
    expect(textarea(el).value).toBe('déjà là');
  });

  it('enregistre la note et se ferme', async () => {
    const el = await noteSheet();
    const spy = vi.fn();
    el.addEventListener('close', spy);
    textarea(el).value = 'ressentie 6a+';
    textarea(el).dispatchEvent(new Event('input'));
    $(el, 'button.save').click();
    expect(el.store.get(route.id).n).toBe('ressentie 6a+');
    expect(el.route).toBeNull();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('supprime une note existante', async () => {
    const el = await noteSheet('à effacer');
    $(el, 'button.remove').click();
    expect(el.store.get(route.id)).toEqual({});
  });

  it('enregistre la façon de grimper et ses détails', async () => {
    const el = await noteSheet();
    const check = (selector: string) => {
      const input = $<HTMLInputElement>(el, selector);
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change'));
    };
    check('fieldset.lead .detail-c');
    check('fieldset.lead .detail-p');
    check('fieldset.toprope input.mode');
    await el.updateComplete;
    expect($<HTMLInputElement>(el, 'fieldset.lead input.mode').checked).toBe(true);
    $(el, 'button.save').click();
    expect(el.store.get(route.id)).toEqual({ t: true, tx: 'cp', m: true });
  });

  it('décocher la façon de grimper efface ses détails', async () => {
    const el = await noteSheet();
    el.store.edit(route.id, { t: true, tx: 'r' });
    el.route = null;
    await el.updateComplete;
    el.route = route;
    await el.updateComplete;
    expect($<HTMLInputElement>(el, 'fieldset.lead .detail-r').checked).toBe(true);
    const mode = $<HTMLInputElement>(el, 'fieldset.lead input.mode');
    mode.checked = false;
    mode.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect($<HTMLInputElement>(el, 'fieldset.lead .detail-r').checked).toBe(false);
    $(el, 'button.save').click();
    expect(el.store.get(route.id)).toEqual({});
  });

  it('n’enregistre rien si on ferme sans valider', async () => {
    const el = await noteSheet('initiale');
    textarea(el).value = 'modifiée';
    textarea(el).dispatchEvent(new Event('input'));
    $<BottomSheet>(el, 'lardy-sheet').close();
    expect(el.store.get(route.id).n).toBe('initiale');
    expect(el.route).toBeNull();
  });
});
