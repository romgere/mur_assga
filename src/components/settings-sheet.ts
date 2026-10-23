import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { copyText } from '../lib/clipboard';
import { progressStore, type ImportResult, type ProgressStore } from '../lib/progress-store';
import { PwaController, pwaState, type InstallMode, type PwaState } from '../lib/pwa';
import { APP_VERSION, RELEASE_NOTES } from '../lib/release-notes';
import type { Theme } from '../lib/theme';
import { infoIcon as helpIcon, requestHelp } from './help-sheet';
import { requestTutorial } from './tutorial-sheet';
import { infoIcon, showReleaseNotesEvent } from './release-notes-sheet';
import { sharedStyles } from './shared-styles';
import './bottom-sheet';

export interface ThemeChangeDetail {
  theme: Theme;
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

/** Dépôt du code source, pour le lien « Contribuer ». */
export const REPO_URL = 'https://github.com/romgere/mur_assga';
export const AUTHOR_URL = 'https://mestres.fr';

/** Délai pendant lequel le bouton « Tout effacer » attend la confirmation. */
export const CLEAR_CONFIRM_MS = 4000;

/**
 * Réglages : thème, installation de l'application, nouveautés de la version, sauvegarde (texte JSON à copier), restauration (texte
 * collé et validé) et effacement complet en deux temps.
 */
@customElement('lardy-settings-sheet')
export class SettingsSheet extends LitElement {
  static styles = [
    sharedStyles,
    css`
      section {
        padding: 12px 0;
        border-top: 1px solid var(--border);
      }

      section:first-of-type {
        border-top: 0;
      }

      h3 {
        margin: 0 0 6px;
        font-size: 15px;
      }

      p {
        margin: 0 0 8px;
        font-size: 14px;
        color: var(--text-muted);
      }

      .segmented {
        display: flex;
        padding: 3px;
        border-radius: 12px;
        background: var(--surface-2);
      }

      .segmented button {
        flex: 1;
        height: 36px;
        border-radius: 9px;
        font-weight: 600;
        color: var(--text-muted);
      }

      .segmented button[aria-checked='true'] {
        background: var(--surface);
        color: var(--text);
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
      }

      textarea {
        min-height: 90px;
        font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: 12px;
        background: var(--bg);
      }

      .row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }

      .feedback {
        font-size: 14px;
        font-weight: 600;
      }

      .feedback.ok {
        color: var(--accent);
      }

      .feedback.error {
        color: var(--danger);
      }

      .warning {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--danger);
        color: var(--danger);
      }

      .version {
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 0;
      }

      .info {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 18px;
        color: var(--accent);
      }

      ol {
        margin: 0;
        padding-left: 22px;
        font-size: 14px;
      }

      ol li + li {
        margin-top: 4px;
      }

      .about {
        font-size: 13px;
        text-align: center;
      }

      .about p {
        margin: 0 0 4px;
      }

      a,
      .link {
        color: var(--accent);
        font-weight: 600;
      }

      /* Ouvre une feuille : un bouton, mais présenté comme un lien. */
      .link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0;
        font-size: 14px;
        text-align: left;
      }

      .link span {
        text-decoration: underline;
      }

      .link svg {
        flex: none;
      }

      .link.tutorial {
        display: flex;
        margin-top: 10px;
      }
    `,
  ];

  @property({ type: Boolean }) open = false;
  @property() theme: Theme = 'auto';
  @property({ attribute: false }) store: ProgressStore = progressStore;
  @property({ attribute: false }) pwa: PwaState = pwaState;

  @state() private exportText = '';
  @state() private copyFeedback = '';
  @state() private importDraft = '';
  @state() private importResult: ImportResult | null = null;
  @state() private confirmingClear = false;
  @state() private clearDone = false;

  @query('textarea.export') private exportField?: HTMLTextAreaElement;

  private clearTimer = 0;

  constructor() {
    super();
    new PwaController(this, () => this.pwa);
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) {
      this.exportText = this.store.exportText();
      this.copyFeedback = '';
      this.importDraft = '';
      this.importResult = null;
      this.clearDone = false;
      this.resetClear();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.clearTimer);
  }

  private close() {
    this.open = false;
    this.resetClear();
    this.dispatchEvent(new CustomEvent('close'));
  }

  private setTheme(theme: Theme) {
    this.theme = theme;
    this.dispatchEvent(new CustomEvent<ThemeChangeDetail>('theme-change', { detail: { theme } }));
  }

  private async copy() {
    const ok = await copyText(this.exportText, this.exportField);
    this.copyFeedback = ok ? 'Copié !' : 'Copie impossible : sélectionnez le texte à la main.';
  }

  private restore() {
    this.importResult = this.store.importText(this.importDraft);
    if (this.importResult.ok) {
      this.importDraft = '';
      this.exportText = this.store.exportText();
    }
  }

  private renderInstall() {
    const mode = this.pwa.installMode;
    if (mode === 'installed') {
      return html`<p class="install-status">L’application est installée sur cet appareil.</p>`;
    }
    return html`<p class="install-intro">Installez l’application pour l’utiliser hors ligne (optionnel).</p>
      ${this.renderInstallSteps(mode)}`;
  }

  private renderInstallSteps(mode: InstallMode) {
    switch (mode) {
      case 'prompt':
        return html`<button class="btn primary install" @click=${() => this.pwa.install()}>
          Installer l’application
        </button>`;
      case 'ios':
        return html`<ol class="ios-steps">
          <li>Ouvrez cette page dans <strong>Safari</strong>.</li>
          <li>Touchez le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut).</li>
          <li>Choisissez <strong>« Sur l’écran d’accueil »</strong>, puis <strong>Ajouter</strong>.</li>
        </ol>`;
      default:
        return html`<p class="install-manual">
          Utilisez le menu de votre navigateur : <strong>« Installer l’application »</strong> ou
          <strong>« Ajouter à l’écran d’accueil »</strong>.
        </p>`;
    }
  }

  /** Premier appui : demande de confirmation ; second appui : effacement. */
  private clear() {
    if (!this.confirmingClear) {
      this.confirmingClear = true;
      this.clearDone = false;
      this.clearTimer = window.setTimeout(() => (this.confirmingClear = false), CLEAR_CONFIRM_MS);
      return;
    }
    this.resetClear();
    this.store.clear();
    this.exportText = this.store.exportText();
    this.clearDone = true;
  }

  private resetClear() {
    clearTimeout(this.clearTimer);
    this.confirmingClear = false;
  }

  render() {
    return html`<lardy-sheet .open=${this.open} heading="Réglages" @close=${this.close}>
      <section>
        <h3 id="theme-label">Thème</h3>
        <div class="segmented" role="radiogroup" aria-labelledby="theme-label">
          ${THEME_OPTIONS.map(
            (o) =>
              html`<button
                role="radio"
                data-theme=${o.value}
                aria-checked=${o.value === this.theme ? 'true' : 'false'}
                @click=${() => this.setTheme(o.value)}
              >
                ${o.label}
              </button>`,
          )}
        </div>
      </section>

      <section>
        <h3>Aide</h3>
        <button class="link help" @click=${() => requestHelp(this)}>
          ${helpIcon}<span>États d’une voie : tête, moulinette, à vue, chute…</span>
        </button>
        <button class="link tutorial" @click=${() => requestTutorial(this)}>
          ${helpIcon}<span>Revoir le tutoriel de prise en main</span>
        </button>
      </section>

      <section>
        <h3>Application</h3>
        ${this.renderInstall()}
      </section>

      <section>
        <p class="version">
          Version ${APP_VERSION} installée.
          <button
            class="info release-notes"
            aria-label="Voir les nouveautés"
            title="Voir les nouveautés"
            @click=${() => this.dispatchEvent(showReleaseNotesEvent({ heading: 'Nouveautés', notes: RELEASE_NOTES.slice(0, 1) }))}
          >
            ${infoIcon}
          </button>
        </p>
      </section>

      <section>
        <h3>Sauvegarde</h3>
        ${this.store.persistent
          ? html`<p>
              Vos voies sont enregistrées dans ce navigateur uniquement. Copiez ce texte et gardez-le (notes, mail…)
              pour le restaurer sur un autre appareil.
            </p>`
          : html`<p class="warning" role="alert">
              Le stockage du navigateur est indisponible (navigation privée ?) : vos voies seront perdues à la
              fermeture. Copiez la sauvegarde ci-dessous.
            </p>`}
        <label class="visually-hidden" for="export">Texte de sauvegarde</label>
        <textarea id="export" class="export" readonly .value=${this.exportText}></textarea>
        <div class="row">
          <button class="btn primary copy" @click=${this.copy}>Copier</button>
          <span class="feedback ok" role="status">${this.copyFeedback}</span>
        </div>
      </section>

      <section>
        <h3>Restauration</h3>
        <p>Collez une sauvegarde : elle remplace toutes les données actuelles.</p>
        <label class="visually-hidden" for="import">Sauvegarde à restaurer</label>
        <textarea
          id="import"
          class="import"
          placeholder='{"app":"lardy2026", …}'
          .value=${this.importDraft}
          @input=${(e: Event) => {
            this.importDraft = (e.target as HTMLTextAreaElement).value;
            this.importResult = null;
          }}
        ></textarea>
        <div class="row">
          <button class="btn restore" ?disabled=${!this.importDraft.trim()} @click=${this.restore}>Restaurer</button>
          <span class="feedback ${this.importResult?.ok ? 'ok' : 'error'}" role="status"
            >${this.importResult?.message ?? ''}</span
          >
        </div>
      </section>

      <section>
        <h3>Effacement</h3>
        <p>Supprime toutes les voies cochées, les favoris et les notes.</p>
        <div class="row">
          <button class="btn danger clear" @click=${this.clear}>
            ${this.confirmingClear ? 'Confirmer l’effacement' : 'Tout effacer'}
          </button>
          <span class="feedback ok" role="status"
            >${this.confirmingClear ? 'Appuyez à nouveau pour confirmer.' : this.clearDone ? 'Données effacées.' : ''}</span
          >
        </div>
      </section>

      <section class="about">
        <p>${this.store.topo.club} · ${this.store.topo.title}</p>
        <p class="credits">
          Vibe codé avec <span role="img" aria-label="amour">❤️</span> par
          <a href=${AUTHOR_URL} target="_blank" rel="noopener">Jérôme</a> -
          <a href=${REPO_URL} target="_blank" rel="noopener">Contribuer</a>
        </p>
      </section>
    </lardy-sheet>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-settings-sheet': SettingsSheet;
  }
}
