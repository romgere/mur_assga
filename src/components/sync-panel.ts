import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { copyText } from '../lib/clipboard';
import { progressSync, type LinkResult, type ProgressSync } from '../lib/sync';
import { sharedStyles } from './shared-styles';

/** Délai pendant lequel « Effacer ma sauvegarde en ligne » attend la confirmation. */
export const DELETE_CONFIRM_MS = 4000;

const LINK_ERRORS: Record<Exclude<LinkResult, 'ok'>, string> = {
  invalid: 'Code invalide : 24 lettres et chiffres, tels que notés à l’activation.',
  unknown: 'Aucune sauvegarde trouvée pour ce code : vérifiez-le caractère par caractère.',
  offline: 'Hors ligne : connectez-vous pour récupérer vos voies.',
  error: 'Vérification du code impossible pour le moment, réessayez plus tard.',
};

/**
 * Section « Sauvegarde en ligne » des réglages : activation (nouveau code ou
 * récupération avec un code existant), affichage du code et de l'état,
 * désactivation et effacement de la sauvegarde en ligne.
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

      .row.actions {
        justify-content: center;
      }

      .status,
      .feedback {
        text-align: center;
      }

      .keep {
        margin-top: 8px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--accent);
        color: var(--text);
        font-weight: 600;
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
      const result = await this.sync.link(this.codeDraft);
      if (result === 'ok') {
        this.codeDraft = '';
        this.say('');
      } else {
        this.say(LINK_ERRORS[result], true);
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
    this.say('Sauvegarde en ligne désactivée sur cet appareil. Vos voies y restent enregistrées.');
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
      if (await this.sync.deleteRemote()) this.say('Sauvegarde en ligne effacée. Vos voies restent sur cet appareil.');
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
        return 'Modifications en attente de sauvegarde…';
      case 'syncing':
        return 'Sauvegarde…';
      case 'synced': {
        const at = sync.syncedAt;
        const time = at?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return time ? `Sauvegardé (dernière sauvegarde à ${time}).` : 'Sauvegardé.';
      }
      case 'offline':
        return 'Hors ligne : vos modifications seront sauvegardées au retour du réseau.';
      case 'error':
        return `Échec de la sauvegarde : ${sync.message}`;
      default:
        return '';
    }
  }

  private renderOff() {
    // Désactivée sans action ici (sauvegarde effacée depuis un autre appareil).
    const notice = this.sync.message;
    return html`${notice ? html`<p class="status error" role="status">${notice}</p>` : ''}
      <p>
        Sauvegardez vos voies en ligne pour les retrouver en cas de perte, de casse ou de changement de téléphone.
        Pas de compte ni d’e-mail : un code de sauvegarde suffit.
      </p>
      <div class="row actions">
        <button class="btn primary enable" ?disabled=${this.busy} @click=${this.enable}>
          Activer la sauvegarde en ligne
        </button>
      </div>
      <p class="link-intro">Nouveau téléphone ? Saisissez votre code de sauvegarde pour récupérer vos voies :</p>
      <div class="row">
        <label class="visually-hidden" for="sync-code">Code de sauvegarde</label>
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
          Récupérer
        </button>
      </div>`;
  }

  private renderOn() {
    const error = this.sync.status === 'error' || this.sync.status === 'offline';
    return html`<p>Votre code de sauvegarde :</p>
      <div class="row">
        <span class="code">${this.sync.displayCode}</span>
        <button class="btn copy-code" @click=${this.copy}>Copier</button>
      </div>
      <p class="keep">
        Gardez ce code en lieu sûr (note, e-mail, papier) : sans lui, impossible de récupérer vos voies si vous
        perdez ou cassez votre téléphone. Ne le partagez pas, il donne accès à vos voies.
      </p>
      <p class="status ${error ? 'error' : ''}" role="status">${this.statusText()}</p>
      <div class="row actions">
        <button class="btn sync-now" ?disabled=${this.busy} @click=${() => this.run(() => this.sync.sync())}>
          Sauvegarder maintenant
        </button>
        <button class="btn disable" ?disabled=${this.busy} @click=${this.disable}>Désactiver ici</button>
      </div>
      <div class="row actions">
        <button class="btn danger delete-remote" ?disabled=${this.busy} @click=${this.deleteRemote}>
          ${this.confirmingDelete ? 'Confirmer l’effacement' : 'Effacer ma sauvegarde en ligne'}
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
