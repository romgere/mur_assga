import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const RELEASE_NOTES_SOURCE = new URL('./src/data/release-notes.json', import.meta.url);

/**
 * Publie src/data/release-notes.json à la racine du site : une version déjà
 * installée y lit les nouveautés de la mise à jour qui l'attend (le fichier
 * n'est pas mis en cache par le service worker, voir globPatterns).
 */
function releaseNotes(): Plugin {
  return {
    name: 'release-notes',
    configureServer(server) {
      server.middlewares.use('/release-notes.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(readFileSync(RELEASE_NOTES_SOURCE));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'release-notes.json', source: readFileSync(RELEASE_NOTES_SOURCE) });
    },
  };
}

export default defineConfig({
  plugins: [
    releaseNotes(),
    // Application installable et utilisable hors ligne : tout le build (dont
    // les données du topo, intégrées au JS) est mis en cache par le service
    // worker. Une nouvelle version déployée est signalée par un bandeau
    // (voir src/main.ts et lardy-update-banner).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Topo Lardy – ASSGA Escalade',
        short_name: 'Topo Lardy',
        description: "Topo interactif du mur d'escalade de Lardy : suivez les voies faites en tête et en moulinette.",
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f5f2',
        theme_color: '#005030',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // Image source des icônes, inutile à l'application.
        globIgnores: ['logo-assga.png'],
        cleanupOutdatedCaches: true,
        // Contrôle la page dès la première visite (hors ligne immédiatement) et
        // permet au bouton « Mettre à jour » de recharger sur la nouvelle version.
        clientsClaim: true,
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
    restoreMocks: true,
  },
});
