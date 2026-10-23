import { describe, expect, it, vi } from 'vitest';
import { $, $$, mount, settle } from '../test/helpers';
import type { BottomSheet } from './bottom-sheet';
import { ReleaseNotesSheet, formatDate } from './release-notes-sheet';

async function sheet() {
  const el = new ReleaseNotesSheet();
  el.heading = 'Nouveautés';
  el.notes = [
    { version: '1.1.0', date: '2026-10-23', notes: ['Deux', 'Deux bis'] },
    { version: '1.0.0', date: '2026-10-21', notes: ['Un', { text: 'Voies', tutorial: ['cocher', 'inconnue'] }, { text: 'Tags', tutorial: ['tags'] }] },
  ];
  el.open = true;
  await mount(el);
  await settle(el, $<BottomSheet>(el, 'lardy-sheet'));
  return el;
}

describe('lardy-release-notes-sheet', () => {
  it('liste les nouveautés de chaque version', async () => {
    const el = await sheet();
    const sections = $$(el, 'section.release');
    expect(sections.map((s) => s.querySelector('h3')!.textContent)).toEqual([
      'Version 1.1.023/10/2026',
      'Version 1.0.021/10/2026',
    ]);
    expect([...sections[0].querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Deux', 'Deux bis']);
    expect([...sections[1].querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Un', 'VoiesVoir comment ça marche', 'Tags']);
    expect($<BottomSheet>(el, 'lardy-sheet').heading).toBe('Nouveautés');
  });

  it('renvoie vers les étapes connues du tutoriel', async () => {
    const el = await sheet();
    const links = $$(el, 'button.tutorial');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('Voir comment ça marche');
    const open = vi.fn();
    document.addEventListener('open-tutorial', open);
    links[0].click();
    document.removeEventListener('open-tutorial', open);
    expect((open.mock.calls[0][0] as CustomEvent).detail).toEqual({ steps: ['cocher'] });
  });

  it('se ferme avec OK', async () => {
    const el = await sheet();
    const close = vi.fn();
    el.addEventListener('close', close);
    $(el, 'button.ok').click();
    expect(close).toHaveBeenCalledOnce();
    expect(el.open).toBe(false);
  });

  it('formate les dates à la française', () => {
    expect(formatDate('2026-10-23')).toBe('23/10/2026');
    expect(formatDate('bientôt')).toBe('bientôt');
  });
});
