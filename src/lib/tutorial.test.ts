import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../test/helpers';
import { TUTORIAL_KEY, markTutorialSeen, tutorialSeen } from './tutorial';

describe('tutorial', () => {
  it('n’est pas vu tant qu’il n’a pas été marqué', () => {
    const storage = memoryStorage();
    expect(tutorialSeen(storage)).toBe(false);
    markTutorialSeen(storage);
    expect(tutorialSeen(storage)).toBe(true);
    expect(storage.get(TUTORIAL_KEY)).toBe('1');
  });
});
