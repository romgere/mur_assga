/**
 * Cotations ressenties : échelle des votes, choix proposés pour une voie et
 * avis de la communauté (« + », « − », « = »).
 *
 * Module sans dépendance au navigateur : le Worker l'utilise aussi pour
 * valider et compter les votes.
 */

/**
 * Échelle complète des cotations proposées au vote. Plus fine que celle du
 * topo (src/data/topo.json), qui ne liste que les cotations des voies
 * ouvertes : on doit pouvoir dire « 6a+ » même si aucune voie n'est en 6a+.
 */
export const GRADE_SCALE = [
  '3',
  '3+',
  '4',
  '4+',
  '5a',
  '5a+',
  '5b',
  '5b+',
  '5c',
  '5c+',
  '6a',
  '6a+',
  '6b',
  '6b+',
  '6c',
  '6c+',
  '7a',
  '7a+',
  '7b',
  '7b+',
  '7c',
  '7c+',
  '8a',
  '8a+',
  '8b',
] as const;

/** Nombre de crans proposés de part et d'autre de la cotation officielle. */
export const VOTE_SPAN = 4;
/** En dessous, l'indicateur ne s'affiche pas : un ou deux avis ne disent rien. */
export const MIN_VOTES = 3;

/** Rang dans GRADE_SCALE, -1 si la cotation n'en fait pas partie. */
export function gradeRank(grade: string | undefined): number {
  return grade === undefined ? -1 : (GRADE_SCALE as readonly string[]).indexOf(grade);
}

export function isGrade(value: unknown): value is string {
  return typeof value === 'string' && gradeRank(value) >= 0;
}

/** Cotations qu'on peut voter pour une voie : la cotation officielle ± VOTE_SPAN crans. */
export function voteChoices(official: string | undefined): string[] {
  const rank = gradeRank(official);
  if (rank < 0) return [];
  return GRADE_SCALE.slice(Math.max(0, rank - VOTE_SPAN), rank + VOTE_SPAN + 1);
}

/**
 * Un vote compte-t-il ? Seulement si la voie est faite (tête ou moulinette,
 * pas partielle) : on ne cote pas une voie qu'on n'a pas terminée. Forme
 * brute d'une voie de la progression ({t, m, tx, mx, g…}).
 */
export function countedVote(entry: unknown): string | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const e = entry as Record<string, unknown>;
  if (!isGrade(e.g)) return null;
  const completed = (mode: 't' | 'm') =>
    e[mode] === true && !(Array.isArray(e[`${mode}x`]) && (e[`${mode}x`] as unknown[]).includes('partiel'));
  return completed('t') || completed('m') ? e.g : null;
}

/** Nombre de votes par cotation (« 6a+ » → 3). */
export type GradeCounts = Record<string, number>;

/** Tendance des avis : plus dure, plus facile ou juste. */
export type Trend = 'harder' | 'easier' | 'same';

export interface VoteSummary {
  total: number;
  /** null sous MIN_VOTES avis, ou pour une voie sans cotation officielle. */
  trend: Trend | null;
}

/**
 * Compare la médiane des votes à la cotation officielle. La médiane, pas la
 * moyenne : un avis farfelu ne fait pas basculer l'indicateur. Écart d'au
 * moins un cran pour « + » ou « − » (avec deux médianes, leur moyenne).
 */
export function summarizeVotes(counts: GradeCounts, official: string | undefined): VoteSummary {
  const ranks: number[] = [];
  for (const grade of GRADE_SCALE) {
    for (let i = 0; i < (counts[grade] ?? 0); i++) ranks.push(gradeRank(grade));
  }
  const total = ranks.length;
  const officialRank = gradeRank(official);
  if (total < MIN_VOTES || officialRank < 0) return { total, trend: null };
  const mid = total / 2;
  const median = total % 2 ? ranks[Math.floor(mid)] : (ranks[mid - 1] + ranks[mid]) / 2;
  const diff = median - officialRank;
  return { total, trend: diff >= 1 ? 'harder' : diff <= -1 ? 'easier' : 'same' };
}
