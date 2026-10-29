/**
 * API de synchronisation de la progression entre appareils (base D1).
 *
 * Pas de compte : chaque appareil synchronisé connaît un code aléatoire
 * (24 caractères base32, 120 bits), envoyé en `Authorization: Bearer <code>`.
 * La base ne garde que son empreinte SHA-256 : qui lit la base ne peut ni lire
 * ni modifier les données de quelqu'un.
 *
 *   GET    /api/progress/<saison>  → { rev, data, updatedAt } (404 : rien d'enregistré)
 *   PUT    /api/progress/<saison>  ← { rev, data } ; rev = révision sur laquelle
 *          l'appareil s'appuie (0 : aucune). 409 + version en ligne si elle a
 *          changé entre-temps : l'appareil fusionne puis renvoie.
 *   DELETE /api/progress           → efface toutes les saisons de ce code.
 */

/** Code de synchronisation normalisé : 24 caractères base32 (RFC 4648). */
export const CODE_PATTERN = /^[A-Z2-7]{24}$/;
const SEASON_PATTERN = /^\d{4}-\d{4}$/;
/** Une saison complète avec une note de 2000 caractères par voie tient largement. */
export const MAX_BODY_BYTES = 256 * 1024;
const MAX_ROUTES = 1000;
const MAX_ROUTE_ID_LENGTH = 64;
const MAX_NOTE_LENGTH = 2000;
const DETAILS = new Set(['avue', 'flash', 'chute', 'repos', 'partiel']);

interface ProgressRow {
  data: string;
  rev: number;
  updated_at: string;
}

export async function handleApi(request: Request, db: D1Database): Promise<Response> {
  const url = new URL(request.url);
  const code = readCode(request);
  if (!code) return error(401, 'Code de synchronisation absent ou invalide.');
  const user = await hashCode(code);

  if (url.pathname === '/api/progress') {
    if (request.method !== 'DELETE') return error(405, 'Méthode non autorisée.');
    await db.prepare('DELETE FROM progress WHERE user_hash = ?').bind(user).run();
    return json(200, { ok: true });
  }

  const match = /^\/api\/progress\/([^/]+)$/.exec(url.pathname);
  if (!match) return error(404, 'Adresse inconnue.');
  const season = decodeURIComponent(match[1]);
  if (!SEASON_PATTERN.test(season)) return error(400, 'Saison invalide.');

  switch (request.method) {
    case 'GET': {
      const row = await read(db, user, season);
      return row ? json(200, toBody(row)) : error(404, 'Aucune donnée enregistrée.');
    }
    case 'PUT':
      return write(request, db, user, season);
    default:
      return error(405, 'Méthode non autorisée.');
  }
}

async function write(request: Request, db: D1Database, user: string, season: string): Promise<Response> {
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_BODY_BYTES) return error(413, 'Données trop volumineuses.');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return error(413, 'Données trop volumineuses.');

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error(400, 'JSON invalide.');
  }
  if (!isObject(body) || !Number.isInteger(body.rev) || (body.rev as number) < 0) {
    return error(400, 'Révision invalide.');
  }
  if (!isProgressMap(body.data)) return error(400, 'Progression invalide.');

  const base = body.rev as number;
  const data = JSON.stringify(body.data);
  const now = new Date().toISOString();
  // Écriture conditionnelle : ne passe que si personne n'a écrit depuis `base`.
  const result =
    base === 0
      ? await db
          .prepare(
            'INSERT INTO progress (user_hash, season, data, rev, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT DO NOTHING',
          )
          .bind(user, season, data, now)
          .run()
      : await db
          .prepare(
            'UPDATE progress SET data = ?, rev = rev + 1, updated_at = ? WHERE user_hash = ? AND season = ? AND rev = ?',
          )
          .bind(data, now, user, season, base)
          .run();

  if (result.meta.changes === 0) {
    const current = await read(db, user, season);
    return json(409, current ? toBody(current) : { rev: 0, data: {}, updatedAt: null });
  }
  return json(200, { rev: base + 1, updatedAt: now });
}

function read(db: D1Database, user: string, season: string): Promise<ProgressRow | null> {
  return db
    .prepare('SELECT data, rev, updated_at FROM progress WHERE user_hash = ? AND season = ?')
    .bind(user, season)
    .first<ProgressRow>();
}

function toBody(row: ProgressRow) {
  return { rev: row.rev, data: JSON.parse(row.data) as unknown, updatedAt: row.updated_at };
}

function readCode(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/.exec(header);
  return match && CODE_PATTERN.test(match[1]) ? match[1] : null;
}

export async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Contrôle de forme seulement ({"mur-COULEUR": {t, m, tx, mx, s, n}}) : les
 * voies elles-mêmes sont vérifiées par l'application, qui connaît le topo.
 */
function isProgressMap(value: unknown): boolean {
  if (!isObject(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > MAX_ROUTES) return false;
  return entries.every(([id, entry]) => {
    if (id.length > MAX_ROUTE_ID_LENGTH || !isObject(entry)) return false;
    return Object.entries(entry).every(([key, v]) => {
      switch (key) {
        case 't':
        case 'm':
        case 's':
          return typeof v === 'boolean';
        case 'tx':
        case 'mx':
          return Array.isArray(v) && v.length <= DETAILS.size && v.every((d) => DETAILS.has(d as string));
        case 'n':
          return typeof v === 'string' && v.length <= MAX_NOTE_LENGTH;
        default:
          return false;
      }
    });
  });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function error(status: number, message: string): Response {
  return json(status, { error: message });
}
