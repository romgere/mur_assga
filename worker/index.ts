import { handleApi } from './api';

/**
 * Point d'entrée du Worker : sert les fichiers statiques (build Vite) et, sous
 * /api/, la synchronisation de la progression (voir api.ts). Un point d'entrée
 * ne peut exporter que des gestionnaires : tout le reste vit dans api.ts.
 */

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env.DB);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
