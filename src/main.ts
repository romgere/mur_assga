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

const updateSW = registerSW({
  onNeedRefresh() {
    pwaState.setUpdateAvailable(async () => {
      // Une mise à jour trouvée par registration.update() est vue comme
      // « externe » par vite-plugin-pwa, qui ne recharge alors pas la page :
      // on recharge nous-mêmes dès que la nouvelle version prend la main.
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
      await updateSW(true);
    });
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => registration.update().catch(() => {});
    setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  },
});
