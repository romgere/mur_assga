import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { copyText } from '../lib/clipboard';
import { progressSync, type ProgressSync } from '../lib/sync';
import { sharedStyles } from './shared-styles';

/** Délai pendant lequel « Effacer mes données en ligne » attend la confirmation. */
export const DELETE_CONFIRM_MS = 4000;

/**
 * Section « Synchronisation » des réglages : activation (nouveau code ou code
 * d'un autre appareil), affichage du code et de l'état, désactivation et
 * effacement des données en ligne.
 */
@customElement('lardy-sync-panel')
export class SyncPanel extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      p {
        margin: 0 0 8px;
        font-size: 14px;
        color: var(--text-muted);
      }

      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }

      .code {
        flex: 1;
        min-width: 0;
        padding: 8px 10px;
        border-radius: 10px;
        background: var(--surface-2);
        font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: 13px;
        font-weight: 600;
        overflow-wrap: anywhere;
        user-select: all;
      }

      input {
        flex: 1;
        min-width: 0;
        font-family: ui-monospace, Menlo, Consolas, monospace;
        text-transform: uppercase;
      }

      .link-intro {
        margin-top: 12px;
      }

      .status {
        margin-top: 8px;
        font-weight: 600;
        color: var(--text);
      }

      .status.error {
        color: var(--danger);
      }

      .feedback {
        font-size: 14px;
        font-weight: 600;
        color: var(--accent);
      }

      .feedback.error {
        color: var(--danger);
      }
    `,
  ];

  @property({ attribute: false }) sync: ProgressSync = progressSync;

  @state() private codeDraft = '';
  @state() private feedback = '';
  @state() private feedbackError = false;
  @state() private confirmingDelete = false;
  @state() private busy = false;

  private subscribed?: ProgressSync;
  private deleteTimer = 0;
  private onChange = () => this.requestUpdate();

  connectedCallback(): void {
    super.connectedCallback();
    this.subscribe();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscribed?.removeEventListener('change', this.onChange);
    this.subscribed = undefined;
    clearTimeout(this.deleteTimer);
  }

  protected willUpdate(): void {
    if (this.isConnected && this.subscribed !== this.sync) this.subscribe();
  }

  private subscribe() {
    this.subscribed?.removeEventListener('change', this.onChange);
    this.subscribed = this.sync;
    this.sync.addEventListener('change', this.onChange);
  }

  private say(message: string, error = false) {
    this.feedback = message;
    this.feedbackError = error;
  }

  private async run(action: () => Promise<unknown>) {
    this.busy = true;
    try {
      await action();
    } finally {
      this.busy = false;
    }
  }

  private enable() {
    this.say('');
    return this.run(() => this.sync.enable());
  }

  private link() {
    return this.run(async () => {
      if (await this.sync.link(this.codeDraft)) {
        this.codeDraft = '';
        this.say('');
      } else {
        this.say('Code invalide : 24 lettres et chiffres, tels qu’affichés sur l’autre appareil.', true);
      }
    });
  }

  private async copy() {
    const ok = await copyText(this.sync.displayCode ?? '');
    this.say(ok ? 'Code copié !' : 'Copie impossible : recopiez le code à la main.', !ok);
  }

  private disable() {
    this.resetDelete();
    this.sync.disable();
    this.say('Synchronisation désactivée sur cet appareil. Vos voies y restent enregistrées.');
  }

  /** Premier appui : demande de confirmation ; second appui : effacement. */
  private deleteRemote() {
    if (!this.confirmingDelete) {
      this.confirmingDelete = true;
      this.deleteTimer = window.setTimeout(() => (this.confirmingDelete = false), DELETE_CONFIRM_MS);
      return;
    }
    this.resetDelete();
    return this.run(async () => {
      if (await this.sync.deleteRemote()) this.say('Données en ligne effacées. Vos voies restent sur cet appareil.');
    });
  }

  private resetDelete() {
    clearTimeout(this.deleteTimer);
    this.confirmingDelete = false;
  }

  private statusText(): string {
    const sync = this.sync;
    switch (sync.status) {
      case 'pending':
        return 'Modifications en attente d’envoi…';
      case 'syncing':
        return 'Synchronisation…';
      case 'synced': {
        const at = sync.syncedAt;
        const time = at?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return time ? `À jour (dernière synchronisation à ${time}).` : 'À jour.';
      }
      case 'offline':
        return 'Hors ligne : vos modifications seront envoyées au retour du réseau.';
      case 'error':
        return `Échec de la synchronisation : ${sync.message}`;
      default:
        return '';
    }
  }

  private renderOff() {
    return html`<p>
        Retrouvez vos voies sur vos autres appareils. Pas de compte ni d’e-mail : un code aléatoire suffit.
      </p>
      <button class="btn primary enable" ?disabled=${this.busy} @click=${this.enable}>
        Activer la synchronisation
      </button>
      <p class="link-intro">Déjà activée sur un autre appareil ? Saisissez son code :</p>
      <div class="row">
        <label class="visually-hidden" for="sync-code">Code de synchronisation</label>
        <input
          id="sync-code"
          class="code-input"
          placeholder="ABCD-EFGH-…"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          .value=${this.codeDraft}
          @input=${(e: Event) => {
            this.codeDraft = (e.target as HTMLInputElement).value;
            this.say('');
          }}
        />
        <button class="btn link-code" ?disabled=${this.busy || !this.codeDraft.trim()} @click=${this.link}>
          Utiliser
        </button>
      </div>`;
  }

  private renderOn() {
    const error = this.sync.status === 'error' || this.sync.status === 'offline';
    return html`<p>
        Code de synchronisation, à saisir sur vos autres appareils. Gardez-le pour vous : il donne accès à vos voies.
      </p>
      <div class="row">
        <span class="code">${this.sync.displayCode}</span>
        <button class="btn copy-code" @click=${this.copy}>Copier</button>
      </div>
      <p class="status ${error ? 'error' : ''}" role="status">${this.statusText()}</p>
      <div class="row">
        <button class="btn sync-now" ?disabled=${this.busy} @click=${() => this.run(() => this.sync.sync())}>
          Synchroniser
        </button>
        <button class="btn disable" ?disabled=${this.busy} @click=${this.disable}>Désactiver ici</button>
      </div>
      <div class="row">
        <button class="btn danger delete-remote" ?disabled=${this.busy} @click=${this.deleteRemote}>
          ${this.confirmingDelete ? 'Confirmer l’effacement' : 'Effacer mes données en ligne'}
        </button>
      </div>`;
  }

  render() {
    const feedback = this.confirmingDelete ? 'Appuyez à nouveau pour confirmer.' : this.feedback;
    return html`${this.sync.enabled ? this.renderOn() : this.renderOff()}
      <p class="feedback ${this.feedbackError ? 'error' : ''}" role="status">${feedback}</p>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-sync-panel': SyncPanel;
  }
}
