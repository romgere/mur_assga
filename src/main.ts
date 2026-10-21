import { registerSW } from 'virtual:pwa-register';
import './styles/tokens.css';
import { pwaState } from './lib/pwa';
import { applyTheme, loadTheme } from './lib/theme';
import './components/lardy-app';

applyTheme(loadTheme());
pwaState.listen();

// Vérifie les mises à jour au retour sur l'application et toutes les heures :
// une application installée peut rester ouverte longtemps.
const UPDATE_CHECK_MS = 60 * 60 * 1000;

// Une nouvelle version trouvée juste après l'ouverture (ou le retour sur
// l'onglet) est appliquée tout de suite : l'utilisateur n'a encore rien fait
// et tout est déjà enregistré. Sans cela, un simple rafraîchissement ne
// suffit jamais (la version attend que tous les onglets soient fermés).
// Plus tard, en cours d'utilisation, on passe par le bandeau.
const AUTO_APPLY_MS = 15 * 1000;
let freshSince = performance.now();

async function applyUpdate() {
  // Une mise à jour trouvée par registration.update() est vue comme
  // « externe » par vite-plugin-pwa, qui ne recharge alors pas la page :
  // on recharge nous-mêmes dès que la nouvelle version prend la main.
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  await updateSW(true);
}

const updateSW = registerSW({
  // Enregistrement dès le démarrage, sans attendre la fin du chargement.
  immediate: true,
  onNeedRefresh() {
    if (performance.now() - freshSince < AUTO_APPLY_MS) void applyUpdate();
    else pwaState.setUpdateAvailable(applyUpdate);
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => registration.update().catch(() => {});
    setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      freshSince = performance.now();
      check();
    });
  },
});
