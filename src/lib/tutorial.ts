import { storage as defaultStorage, type KeyValueStorage } from './storage';

/** Posée dès que le tutoriel a été passé ou terminé. */
export const TUTORIAL_KEY = 'lardy2026.tutorial';

/** Le tutoriel s'ouvre au lancement tant qu'il n'a pas été vu, nouvel utilisateur ou non. */
export function tutorialSeen(store: KeyValueStorage = defaultStorage): boolean {
  return store.get(TUTORIAL_KEY) !== null;
}

export function markTutorialSeen(store: KeyValueStorage = defaultStorage): void {
  store.set(TUTORIAL_KEY, '1');
}
