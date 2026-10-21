import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Événement Chrome/Edge/Samsung qui permet de déclencher l'installation. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Comment proposer l'installation :
 * - installed : l'application tourne déjà en mode installé ;
 * - prompt : le navigateur fournit une invite d'installation (Android, Chrome…) ;
 * - ios : Safari iOS, qui n'en fournit pas : il faut passer par « Partager » ;
 * - manual : autre navigateur, installation par son menu.
 */
export type InstallMode = 'installed' | 'prompt' | 'ios' | 'manual';

export function isStandalone(win: Window): boolean {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || !!win.matchMedia?.('(display-mode: standalone)').matches;
}

export function isIos(nav: Navigator): boolean {
  // Les iPad récents se présentent comme un Mac : on les reconnaît à l'écran tactile.
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}

/**
 * État PWA partagé par l'interface : invite d'installation disponible et
 * nouvelle version en attente. Émet « change » à chaque évolution.
 */
export class PwaState extends EventTarget {
  installed: boolean;
  /** Une nouvelle version est téléchargée et attend d'être activée. */
  needRefresh = false;

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private applyUpdate: (() => Promise<void>) | null = null;

  constructor(private readonly win: Window = window) {
    super();
    this.installed = isStandalone(win);
  }

  /** À appeler une fois au démarrage, avant que le navigateur n'émette ses événements. */
  listen(): void {
    this.win.addEventListener('beforeinstallprompt', (e) => {
      // Pas de bandeau du navigateur : l'installation se fait depuis les réglages.
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.changed();
    });
    this.win.addEventListener('appinstalled', () => {
      this.installed = true;
      this.deferredPrompt = null;
      this.changed();
    });
  }

  get installMode(): InstallMode {
    if (this.installed) return 'installed';
    if (this.deferredPrompt) return 'prompt';
    return isIos(this.win.navigator) ? 'ios' : 'manual';
  }

  /** Ouvre l'invite d'installation du navigateur ; true si acceptée. */
  async install(): Promise<boolean> {
    const prompt = this.deferredPrompt;
    if (!prompt) return false;
    // Une invite ne peut servir qu'une fois.
    this.deferredPrompt = null;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') this.installed = true;
    this.changed();
    return outcome === 'accepted';
  }

  /** Appelé par l'enregistrement du service worker quand une mise à jour attend. */
  setUpdateAvailable(apply: () => Promise<void>): void {
    this.applyUpdate = apply;
    this.needRefresh = true;
    this.changed();
  }

  /** Active la nouvelle version (la page se recharge). */
  async update(): Promise<void> {
    await this.applyUpdate?.();
  }

  /** « Plus tard » : la nouvelle version sera prise au prochain lancement. */
  dismissUpdate(): void {
    this.needRefresh = false;
    this.changed();
  }

  private changed(): void {
    this.dispatchEvent(new Event('change'));
  }
}

export const pwaState = new PwaState();

/** Repeint un composant à chaque changement de l'état PWA. */
export class PwaController implements ReactiveController {
  private subscribed?: PwaState;

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly getState: () => PwaState,
  ) {
    host.addController(this);
  }

  private onChange = () => this.host.requestUpdate();

  hostConnected(): void {
    this.subscribed = this.getState();
    this.subscribed.addEventListener('change', this.onChange);
  }

  hostDisconnected(): void {
    this.subscribed?.removeEventListener('change', this.onChange);
    this.subscribed = undefined;
  }
}
