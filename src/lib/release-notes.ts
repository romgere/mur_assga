import releaseNotesData from '../data/release-notes.json';
import { storage as defaultStorage, type KeyValueStorage } from './storage';
import { THEME_KEY } from './theme';
import { UI_KEY } from './ui-state';

/** Une version publiée et ses nouveautés (src/data/release-notes.json). */
export interface ReleaseNote {
  version: string;
  /** Date de publication, AAAA-MM-JJ. */
  date: string;
  notes: string[];
}

/** Notes de la version en cours d'exécution, de la plus récente à la plus ancienne. */
export const RELEASE_NOTES: ReleaseNote[] = releaseNotesData;

/** Version de l'application : la plus récente des notes embarquées. */
export const APP_VERSION = RELEASE_NOTES[0].version;

/** Dernière version dont l'utilisateur a vu les nouveautés. */
export const SEEN_VERSION_KEY = 'lardy2026.version';

/**
 * Publié tel quel à la racine du site (voir vite.config.ts) et exclu du cache
 * du service worker : c'est la version déployée, pas celle qui tourne.
 */
export const RELEASE_NOTES_URL = '/release-notes.json';

/** Compare deux versions « 1.2.3 » ; négatif si a < b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

/** Notes des versions strictement plus récentes que `version`. */
export function notesAfter(notes: ReleaseNote[], version: string): ReleaseNote[] {
  return notes.filter((n) => compareVersions(n.version, version) > 0);
}

function isReleaseNote(value: unknown): value is ReleaseNote {
  const n = value as ReleaseNote;
  return (
    typeof n?.version === 'string' &&
    typeof n.date === 'string' &&
    Array.isArray(n.notes) &&
    n.notes.every((line) => typeof line === 'string')
  );
}

/**
 * Notes de la version déployée plus récentes que celle qui tourne : ce
 * qu'apporte la mise à jour en attente. Liste vide si le réseau ou le
 * fichier fait défaut.
 */
export async function fetchUpdateNotes(
  current = APP_VERSION,
  fetchFn: typeof fetch = (...args) => fetch(...args),
): Promise<ReleaseNote[]> {
  try {
    const response = await fetchFn(RELEASE_NOTES_URL, { cache: 'no-store' });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return [];
    return notesAfter(data.filter(isReleaseNote), current);
  } catch {
    return [];
  }
}

/**
 * Nouveautés à montrer une seule fois au lancement qui suit une mise à jour,
 * puis mémorise la version vue. Rien à la toute première visite ; un
 * utilisateur d'avant les notes de version (réglages déjà enregistrés) voit
 * celles de la version actuelle.
 */
export function takeUnseenNotes(
  store: KeyValueStorage = defaultStorage,
  notes: ReleaseNote[] = RELEASE_NOTES,
): ReleaseNote[] {
  const current = notes[0].version;
  const seen = store.get(SEEN_VERSION_KEY);
  if (seen === current) return [];
  store.set(SEEN_VERSION_KEY, current);
  if (seen === null) {
    const returning = store.get(UI_KEY) !== null || store.get(THEME_KEY) !== null;
    return returning ? notes.slice(0, 1) : [];
  }
  return notesAfter(notes, seen);
}
