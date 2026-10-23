import { hasDetail, isClean, isCompleted, isDone, type ProgressStore } from './progress-store';
import type { Route, Topo } from './topo';
import type { Filters } from './ui-state';

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
    switch (filters.status) {
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
      default:
        return true;
    }
  });
  if (filters.sort === 'wall') return result;
  const dir = filters.sort === 'asc' ? 1 : -1;
  // Tri stable : à cotation égale, l'ordre des murs est conservé ; sans cotation en fin.
  return [...result].sort((a, b) => {
    if (a.gradeIndex < 0 || b.gradeIndex < 0) return (a.gradeIndex < 0 ? 1 : 0) - (b.gradeIndex < 0 ? 1 : 0);
    return dir * (a.gradeIndex - b.gradeIndex);
  });
}
