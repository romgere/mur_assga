import {
  hasDetail,
  hasFlaw,
  isClean,
  isCompleted,
  isDone,
  type ClimbMode,
  type ProgressStore,
  type RouteProgress,
} from './progress-store';
import type { Route, Topo } from './topo';
import type { Filters, StatusFilter } from './ui-state';

/** Une page du pager : un mur ou une cotation. */
export interface Page {
  key: string;
  /** Libellé court de la pastille (« 3 », « 6a+ »). */
  label: string;
  /** Titre affiché en tête de page (« Mur 3 », « Cotation 6a+ »). */
  title: string;
  routes: Route[];
  /** Afficher le numéro de mur dans chaque ligne. */
  showWall: boolean;
  /** Mur en gros et cotation en petit (la cotation est celle de la page). */
  wallFirst: boolean;
}

export function wallPages(topo: Topo): Page[] {
  return topo.walls.map((w) => ({
    key: `wall-${w.id}`,
    label: String(w.id),
    title: `Mur ${w.id}`,
    routes: topo.routes.filter((r) => r.wall === w.id),
    showWall: false,
    wallFirst: false,
  }));
}

export function gradePages(topo: Topo): Page[] {
  const pages: Page[] = topo.grades
    .map((g, i) => ({
      key: `grade-${g}`,
      label: g,
      title: `Cotation ${g}`,
      routes: topo.routes.filter((r) => r.gradeIndex === i),
      showWall: true,
      wallFirst: true,
    }))
    .filter((p) => p.routes.length > 0);
  const ungraded = topo.routes.filter((r) => r.gradeIndex < 0);
  if (ungraded.length) {
    pages.push({ key: 'grade-none', label: 'T', title: 'Traversée', routes: ungraded, showWall: true, wallFirst: true });
  }
  return pages;
}

export type PageStatus = 'none' | 'partial' | 'complete';

export function pageStatus(routes: Route[], store: ProgressStore): PageStatus {
  const done = routes.filter((r) => isDone(store.get(r.id))).length;
  if (done === 0) return 'none';
  return done === routes.length ? 'complete' : 'partial';
}

/** La voie correspond-elle au filtre de statut (mode « Toutes », raccourcis des stats) ? */
export function matchesStatus(p: RouteProgress, status: StatusFilter): boolean {
  switch (status) {
    case 'done':
      return isDone(p);
    case 'todo':
      return !isDone(p);
    case 'lead':
      return isCompleted(p, 't');
    case 'toprope':
      return isCompleted(p, 'm');
    case 'notlead':
      return !isCompleted(p, 't');
    case 'notcleanlead':
      return !isClean(p, 't');
    case 'partial':
      return hasDetail(p, 't', 'partiel') || hasDetail(p, 'm', 'partiel');
    case 'avue':
      return hasDetail(p, 't', 'avue') || hasDetail(p, 'm', 'avue');
    case 'flash':
      return hasDetail(p, 't', 'flash') || hasDetail(p, 'm', 'flash');
    case 'cleanlead':
      return isClean(p, 't');
    case 'cleantoprope':
      return isClean(p, 'm');
    case 'leadflaw':
      return isCompleted(p, 't') && hasFlaw(p, 't');
    case 'topropenotlead':
      return isCompleted(p, 'm') && !isCompleted(p, 't');
    default:
      return true;
  }
}

export interface MaxGrade {
  grade: string;
  /** Nombre de voies à cette cotation. */
  count: number;
}

/** Cotation la plus dure parmi les voies qui correspondent au statut (traversées exclues). */
export function maxGrade(routes: Route[], store: ProgressStore, status: StatusFilter): MaxGrade | null {
  let best: Route[] = [];
  for (const r of routes) {
    if (r.gradeIndex < 0 || !r.grade || !matchesStatus(store.get(r.id), status)) continue;
    if (!best.length || r.gradeIndex > best[0].gradeIndex) best = [r];
    else if (r.gradeIndex === best[0].gradeIndex) best.push(r);
  }
  return best.length ? { grade: best[0].grade!, count: best.length } : null;
}

/** Style d'une ascension, du meilleur au moins bon ; null si la façon de grimper n'est pas cochée. */
export type AscentStyle = 'avue' | 'flash' | 'clean' | 'flaw' | 'partial';
export const ASCENT_STYLES: AscentStyle[] = ['avue', 'flash', 'clean', 'flaw', 'partial'];

export function ascentStyle(p: RouteProgress, mode: ClimbMode): AscentStyle | null {
  if (!p[mode]) return null;
  if (hasDetail(p, mode, 'partiel')) return 'partial';
  if (hasFlaw(p, mode)) return 'flaw';
  if (hasDetail(p, mode, 'avue')) return 'avue';
  if (hasDetail(p, mode, 'flash')) return 'flash';
  return 'clean';
}

export type Breakdown = Record<AscentStyle | 'none', number>;

/** Répartition des voies par style d'ascension, pour une façon de grimper. */
export function ascentBreakdown(routes: Route[], store: ProgressStore, mode: ClimbMode): Breakdown {
  const counts: Breakdown = { avue: 0, flash: 0, clean: 0, flaw: 0, partial: 0, none: 0 };
  for (const r of routes) counts[ascentStyle(store.get(r.id), mode) ?? 'none']++;
  return counts;
}

/**
 * Filtre et tri du mode « Toutes ». Les traversées (sans cotation) ne sont
 * exclues que si les bornes de niveau ont été resserrées.
 */
export function filterRoutes(routes: Route[], filters: Filters, store: ProgressStore, gradeCount: number): Route[] {
  const fullRange = filters.min === 0 && filters.max === gradeCount - 1;
  const result = routes.filter((r) => {
    if (r.gradeIndex < 0) {
      if (!fullRange) return false;
    } else if (r.gradeIndex < filters.min || r.gradeIndex > filters.max) {
      return false;
    }
    const p = store.get(r.id);
    if (filters.favorites && !p.s) return false;
    if (filters.competition && !r.competition) return false;
    return matchesStatus(p, filters.status);
  });
  if (filters.sort === 'wall') return result;
  const dir = filters.sort === 'asc' ? 1 : -1;
  // Tri stable : à cotation égale, l'ordre des murs est conservé ; sans cotation en fin.
  return [...result].sort((a, b) => {
    if (a.gradeIndex < 0 || b.gradeIndex < 0) return (a.gradeIndex < 0 ? 1 : 0) - (b.gradeIndex < 0 ? 1 : 0);
    return dir * (a.gradeIndex - b.gradeIndex);
  });
}
