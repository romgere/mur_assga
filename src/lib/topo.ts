import rawTopo from '../data/topo.json';

/** Une voie telle que décrite dans src/data/topo.json. */
export interface RouteData {
  color: string;
  grade?: string;
  setter?: string;
  competition?: boolean;
  traverse?: boolean;
  /**
   * Révision de la voie : à incrémenter (2, 3…) quand une voie est rouverte
   * en cours de saison avec la même couleur sur le même mur, pour repartir
   * d'une progression vierge sur cette voie seulement.
   */
  rev?: number;
}

export interface WallData {
  id: number;
  routes: RouteData[];
}

export interface TopoData {
  /** Saison du topo (« 2026-2027 ») : chaque saison a sa propre progression. */
  season: string;
  title: string;
  club: string;
  updated: string;
  grades: string[];
  walls: WallData[];
}

/** Voie enrichie, prête pour l'affichage. */
export interface Route extends RouteData {
  /** Clé de stockage : « mur-COULEUR » (« 3-VERTE »), suivie de « ~rev » si rev > 1. */
  id: string;
  wall: number;
  /** Rang dans l'échelle des cotations, -1 si sans cotation (traversée). */
  gradeIndex: number;
}

export interface Topo extends TopoData {
  routes: Route[];
}

export function routeId(wall: number, color: string, rev = 1): string {
  return rev > 1 ? `${wall}-${color}~${rev}` : `${wall}-${color}`;
}

/**
 * Vérifie le fichier de données et calcule les champs dérivés.
 * Lève une erreur explicite si le JSON est mal formé, pour que toute
 * erreur de saisie lors d'une mise à jour du topo soit vue au build/test.
 */
export function buildTopo(data: TopoData): Topo {
  if (typeof data.season !== 'string' || !data.season.trim()) {
    throw new Error('topo.json : « season » doit indiquer la saison (ex. « 2026-2027 »)');
  }
  if (!Array.isArray(data.grades) || data.grades.length === 0) {
    throw new Error('topo.json : « grades » doit être une liste non vide');
  }
  if (!Array.isArray(data.walls)) {
    throw new Error('topo.json : « walls » doit être une liste');
  }
  const routes: Route[] = [];
  const seen = new Set<string>();
  for (const wall of data.walls) {
    if (!Number.isInteger(wall.id)) throw new Error(`topo.json : identifiant de mur invalide (${wall.id})`);
    for (const r of wall.routes) {
      if (!r.color) throw new Error(`topo.json : voie sans couleur sur le mur ${wall.id}`);
      if (r.rev !== undefined && (!Number.isInteger(r.rev) || r.rev < 1)) {
        throw new Error(`topo.json : « rev » doit être un entier ≥ 1 (${wall.id}-${r.color})`);
      }
      // Une seule voie par couleur et par mur, quelle que soit sa révision.
      const slot = routeId(wall.id, r.color);
      if (seen.has(slot)) throw new Error(`topo.json : voie en double ${slot}`);
      seen.add(slot);
      const id = routeId(wall.id, r.color, r.rev);
      let gradeIndex = -1;
      if (r.grade !== undefined) {
        gradeIndex = data.grades.indexOf(r.grade);
        if (gradeIndex < 0) throw new Error(`topo.json : cotation inconnue « ${r.grade} » (${id})`);
      } else if (!r.traverse) {
        throw new Error(`topo.json : voie sans cotation ${id}`);
      }
      routes.push({ ...r, id, wall: wall.id, gradeIndex });
    }
  }
  return { ...data, routes };
}

export const topo: Topo = buildTopo(rawTopo as TopoData);

/** Couleur d'affichage (« VIOLETTE » → « violette ») pour les tokens CSS. */
export function colorToken(color: string): string {
  return color
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Niveau principal (4, 5, 6, 7…) pour la couleur de la cotation. */
export function gradeLevel(grade: string | undefined): string {
  return grade ? grade.charAt(0) : '';
}
