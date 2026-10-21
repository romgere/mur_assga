import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { ProgressChangeEvent, type ProgressStore } from './progress-store';

/**
 * Abonne un composant aux changements du store. Le filtre reçoit l'id de la
 * voie modifiée (undefined = changement global) et décide s'il faut repeindre :
 * une ligne ne se repeint que pour sa propre voie.
 */
export class StoreController implements ReactiveController {
  private subscribed?: ProgressStore;

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly getStore: () => ProgressStore,
    private readonly filter: (id: string | undefined) => boolean = () => true,
  ) {
    host.addController(this);
  }

  private onChange = (event: Event) => {
    if (this.filter((event as ProgressChangeEvent).id)) this.host.requestUpdate();
  };

  hostConnected(): void {
    this.subscribe();
  }

  /** Suit un éventuel remplacement du store après la connexion. */
  hostUpdate(): void {
    if (this.subscribed && this.subscribed !== this.getStore()) this.subscribe();
  }

  hostDisconnected(): void {
    this.subscribed?.removeEventListener(ProgressChangeEvent.type, this.onChange);
    this.subscribed = undefined;
  }

  private subscribe(): void {
    this.subscribed?.removeEventListener(ProgressChangeEvent.type, this.onChange);
    this.subscribed = this.getStore();
    this.subscribed.addEventListener(ProgressChangeEvent.type, this.onChange);
  }
}
