import { describe, expect, it, vi } from 'vitest';
import pkg from '../../package.json';
import { memoryStorage } from '../test/helpers';
import { THEME_KEY } from './theme';
import { UI_KEY } from './ui-state';
import {
  APP_VERSION,
  RELEASE_NOTES,
  RELEASE_NOTES_URL,
  SEEN_VERSION_KEY,
  compareVersions,
  fetchUpdateNotes,
  lineText,
  lineTutorial,
  notesAfter,
  takeUnseenNotes,
  type ReleaseNote,
} from './release-notes';

const NOTES: ReleaseNote[] = [
  { version: '1.2.0', date: '2026-11-02', notes: ['Trois'] },
  { version: '1.1.0', date: '2026-10-23', notes: ['Deux'] },
  { version: '1.0.0', date: '2026-10-21', notes: ['Un'] },
];

function respond(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) } as Response);
}

describe('notes de version embarquées', () => {
  it('sont valides, triées de la plus récente à la plus ancienne', () => {
    for (const n of RELEASE_NOTES) {
      expect(n.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.notes.length).toBeGreaterThan(0);
    }
    for (let i = 1; i < RELEASE_NOTES.length; i++) {
      expect(compareVersions(RELEASE_NOTES[i - 1].version, RELEASE_NOTES[i].version)).toBeGreaterThan(0);
    }
  });

  it('suivent la version de package.json', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
});

describe('compareVersions', () => {
  it('compare numériquement chaque partie', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
  });

  it('notesAfter garde les versions plus récentes', () => {
    expect(notesAfter(NOTES, '1.0.0').map((n) => n.version)).toEqual(['1.2.0', '1.1.0']);
  });
});

describe('fetchUpdateNotes', () => {
  it('lit le fichier déployé sans cache et garde les versions plus récentes', async () => {
    const fetchFn = respond(NOTES);
    expect((await fetchUpdateNotes('1.1.0', fetchFn)).map((n) => n.version)).toEqual(['1.2.0']);
    expect(fetchFn).toHaveBeenCalledWith(RELEASE_NOTES_URL, { cache: 'no-store' });
  });

  it('ignore les entrées mal formées', async () => {
    const notes = await fetchUpdateNotes('1.0.0', respond([{ version: '2.0.0' }, NOTES[0]]));
    expect(notes).toEqual([NOTES[0]]);
  });

  it('accepte les nouveautés qui renvoient vers le tutoriel', async () => {
    const withTutorial = { version: '2.0.0', date: '2026-12-01', notes: ['Texte', { text: 'Tags', tutorial: ['tags'] }] };
    const broken = { version: '2.1.0', date: '2026-12-02', notes: [{ text: 'Oups', tutorial: 'tags' }] };
    expect(await fetchUpdateNotes('1.0.0', respond([broken, withTutorial]))).toEqual([withTutorial]);
  });

  it('renvoie une liste vide hors ligne ou en erreur', async () => {
    expect(await fetchUpdateNotes('1.0.0', vi.fn().mockRejectedValue(new TypeError('offline')))).toEqual([]);
    expect(await fetchUpdateNotes('1.0.0', respond(NOTES, false))).toEqual([]);
    expect(await fetchUpdateNotes('1.0.0', respond({ oups: true }))).toEqual([]);
  });
});

describe('lineText / lineTutorial', () => {
  it('lisent une nouveauté texte ou objet', () => {
    expect(lineText('Texte')).toBe('Texte');
    expect(lineTutorial('Texte')).toEqual([]);
    expect(lineText({ text: 'Tags', tutorial: ['tags'] })).toBe('Tags');
    expect(lineTutorial({ text: 'Tags', tutorial: ['tags'] })).toEqual(['tags']);
    expect(lineTutorial({ text: 'Tags' })).toEqual([]);
  });
});

describe('takeUnseenNotes', () => {
  it('ne montre rien à la première visite, mais retient la version', () => {
    const store = memoryStorage();
    expect(takeUnseenNotes(store, NOTES)).toEqual([]);
    expect(store.get(SEEN_VERSION_KEY)).toBe('1.2.0');
  });

  it('montre les versions manquées une seule fois', () => {
    const store = memoryStorage();
    store.set(SEEN_VERSION_KEY, '1.0.0');
    expect(takeUnseenNotes(store, NOTES).map((n) => n.version)).toEqual(['1.2.0', '1.1.0']);
    expect(takeUnseenNotes(store, NOTES)).toEqual([]);
  });

  it('montre la version actuelle à un utilisateur d’avant les notes de version', () => {
    for (const key of [UI_KEY, THEME_KEY]) {
      const store = memoryStorage();
      store.set(key, 'x');
      expect(takeUnseenNotes(store, NOTES)).toEqual([NOTES[0]]);
    }
  });
});
