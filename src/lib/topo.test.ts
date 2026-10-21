import { describe, expect, it } from 'vitest';
import { miniTopoData } from '../test/helpers';
import { buildTopo, colorToken, gradeLevel, topo } from './topo';

describe('topo.json', () => {
  it('contient les 16 murs et 65 voies du topo 2026', () => {
    expect(topo.walls).toHaveLength(16);
    expect(topo.routes).toHaveLength(65);
  });

  it('indique la saison 2026-2027', () => {
    expect(topo.season).toBe('2026-2027');
  });

  it('a une échelle de cotations croissante de 4+ à 7c', () => {
    expect(topo.grades[0]).toBe('4+');
    expect(topo.grades.at(-1)).toBe('7c');
  });

  it('identifie les voies par « mur-COULEUR »', () => {
    const r = topo.routes.find((x) => x.id === '8-BLEUE')!;
    expect(r).toMatchObject({ wall: 8, grade: '7c', competition: true });
  });

  it('compte 16 voies compétition et une traversée', () => {
    expect(topo.routes.filter((r) => r.competition)).toHaveLength(16);
    const traverses = topo.routes.filter((r) => r.traverse);
    expect(traverses.map((r) => r.id)).toEqual(['16-BEIGE']);
    expect(traverses[0].gradeIndex).toBe(-1);
  });
});

describe('buildTopo', () => {
  it('rejette une cotation inconnue', () => {
    const bad = structuredClone(miniTopoData);
    bad.walls[0].routes[0].grade = '9z';
    expect(() => buildTopo(bad)).toThrow(/cotation inconnue/);
  });

  it('rejette une voie en double', () => {
    const bad = structuredClone(miniTopoData);
    bad.walls[0].routes.push({ color: 'VERTE', grade: '5a' });
    expect(() => buildTopo(bad)).toThrow(/double/);
  });

  it('exige une saison', () => {
    const bad = structuredClone(miniTopoData);
    bad.season = '';
    expect(() => buildTopo(bad)).toThrow(/season/);
  });

  it('ajoute la révision à l’identifiant, sauf pour la première', () => {
    const data = structuredClone(miniTopoData);
    data.walls[0].routes[0].rev = 2;
    data.walls[0].routes[1].rev = 1;
    const ids = buildTopo(data).routes.map((r) => r.id);
    expect(ids.slice(0, 2)).toEqual(['1-VERTE~2', '1-JAUNE']);
  });

  it('rejette une révision invalide', () => {
    const bad = structuredClone(miniTopoData);
    bad.walls[0].routes[0].rev = 1.5;
    expect(() => buildTopo(bad)).toThrow(/rev/);
  });

  it('rejette deux voies de même couleur sur un mur, même de révisions différentes', () => {
    const bad = structuredClone(miniTopoData);
    bad.walls[0].routes.push({ color: 'VERTE', grade: '5a', rev: 2 });
    expect(() => buildTopo(bad)).toThrow(/double 1-VERTE/);
  });

  it('rejette une voie sans cotation qui n’est pas une traversée', () => {
    const bad = structuredClone(miniTopoData);
    bad.walls[0].routes.push({ color: 'GRISE' });
    expect(() => buildTopo(bad)).toThrow(/sans cotation/);
  });
});

describe('utilitaires', () => {
  it('colorToken met en minuscules sans accents', () => {
    expect(colorToken('VIOLETTE')).toBe('violette');
    expect(colorToken('ÉCRUE')).toBe('ecrue');
  });

  it('gradeLevel renvoie le chiffre du niveau', () => {
    expect(gradeLevel('6b+')).toBe('6');
    expect(gradeLevel(undefined)).toBe('');
  });
});
