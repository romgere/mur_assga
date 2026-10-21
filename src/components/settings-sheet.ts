import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { copyText } from '../lib/clipboard';
import { progressStore, type ImportResult, type ProgressStore } from '../lib/progress-store';
import type { Theme } from '../lib/theme';
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

/** Délai pendant lequel le bouton « Tout effacer » attend la confirmation. */
export const CLEAR_CONFIRM_MS = 4000;

/**
 * Réglages : thème, sauvegarde (texte JSON à copier), restauration (texte
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

      .about {
        font-size: 13px;
      }
    `,
  ];

  @property({ type: Boolean }) open = false;
  @property() theme: Theme = 'auto';
  @property({ attribute: false }) store: ProgressStore = progressStore;

  @state() private exportText = '';
  @state() private copyFeedback = '';
  @state() private importDraft = '';
  @state() private importResult: ImportResult | null = null;
  @state() private confirmingClear = false;
  @state() private clearDone = false;

  @query('textarea.export') private exportField?: HTMLTextAreaElement;

  private clearTimer = 0;

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
        <p>
          ${this.store.topo.club} · ${this.store.topo.title} (topo du
          ${new Date(this.store.topo.updated).toLocaleDateString('fr-FR')}).
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
