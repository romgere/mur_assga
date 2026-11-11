import { describe, expect, it } from 'vitest';
import { topo } from './topo';
import { GRADE_SCALE, countedVote, gradeRank, isGrade, summarizeVotes, voteChoices } from './grades';

describe('cotations ressenties', () => {
  it('l’échelle contient toutes les cotations du topo', () => {
    for (const grade of topo.grades) expect(isGrade(grade)).toBe(true);
    // Rangées dans le même ordre que le topo.
    const ranks = topo.grades.map(gradeRank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('propose la cotation officielle à ±3 crans, bornée à l’échelle', () => {
    expect(voteChoices('6a')).toEqual(['5b+', '5c', '5c+', '6a', '6a+', '6b', '6b+']);
    expect(voteChoices('3')).toEqual(['3', '3+', '4', '4+']);
    expect(voteChoices(GRADE_SCALE[GRADE_SCALE.length - 1])).toHaveLength(4);
    expect(voteChoices(undefined)).toEqual([]);
  });

  it('ne compte que les votes des voies terminées', () => {
    expect(countedVote({ t: true, g: '6a' })).toBe('6a');
    expect(countedVote({ m: true, mx: ['chute'], g: '6a' })).toBe('6a');
    expect(countedVote({ t: true, tx: ['partiel'], m: true, g: '6a' })).toBe('6a');
    expect(countedVote({ t: true, tx: ['partiel'], g: '6a' })).toBeNull();
    expect(countedVote({ s: true, g: '6a' })).toBeNull();
    expect(countedVote({ t: true, g: '9z' })).toBeNull();
    expect(countedVote({ t: true })).toBeNull();
    expect(countedVote(null)).toBeNull();
  });

  it('compare la médiane à la cotation officielle, à partir de 3 avis', () => {
    expect(summarizeVotes({ '6b': 2 }, '6a')).toEqual({ total: 2, trend: null });
    expect(summarizeVotes({ '6a+': 3 }, '6a')).toEqual({ total: 3, trend: 'harder' });
    expect(summarizeVotes({ '5c+': 2, '6a': 1 }, '6a')).toEqual({ total: 3, trend: 'easier' });
    expect(summarizeVotes({ '6a': 2, '6b': 1 }, '6a')).toEqual({ total: 3, trend: 'same' });
    // Un avis farfelu ne fait pas basculer la médiane.
    expect(summarizeVotes({ '6a': 3, '8b': 1 }, '6a').trend).toBe('same');
    // Deux médianes : leur moyenne, un demi-cran reste « juste ».
    expect(summarizeVotes({ '6a': 2, '6a+': 2 }, '6a').trend).toBe('same');
    expect(summarizeVotes({ '6a+': 5 }, undefined).trend).toBeNull();
  });
});
