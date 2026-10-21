import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import {
  DETAILS,
  MAX_NOTE_LENGTH,
  detailsKey,
  normalizeDetails,
  progressStore,
  type ClimbMode,
  type Detail,
  type ProgressStore,
  type RouteProgress,
} from '../lib/progress-store';
import type { Route } from '../lib/topo';
import { sharedStyles } from './shared-styles';
import './bottom-sheet';

const MODES: { mode: ClimbMode; label: string }[] = [
  { mode: 't', label: 'En tête' },
  { mode: 'm', label: 'En moulinette' },
];

/**
 * Feuille de détails d'une voie : comment elle a été grimpée (chute, repos,
 * partiel) en tête et en moulinette, et sa note (cotation ressentie, méthode…).
 */
@customElement('lardy-note-sheet')
export class NoteSheet extends LitElement {
  static styles = [
    sharedStyles,
    css`
      p {
        margin: 0 0 8px;
        font-size: 14px;
        color: var(--text-muted);
      }

      fieldset {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 12px;
        margin: 0 0 10px;
        padding: 0;
        border: 0;
      }

      fieldset label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
      }

      fieldset label.mode {
        min-width: 120px;
        font-weight: 700;
      }

      textarea {
        min-height: 120px;
        font-size: 16px;
        background: var(--bg);
      }

      .actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .actions .primary {
        margin-left: auto;
      }
    `,
  ];

  @property({ attribute: false }) route: Route | null = null;
  @property({ attribute: false }) store: ProgressStore = progressStore;

  @state() private draft = '';
  /** Tête, moulinette et leurs détails, enregistrés avec la note. */
  @state() private ascents: RouteProgress = {};
  @query('textarea') private textarea?: HTMLTextAreaElement;
  @query('lardy-sheet') private sheet?: HTMLElement & { updateComplete: Promise<boolean> };

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('route') && this.route) {
      const { t, m, tx, mx, n } = this.store.get(this.route.id);
      this.draft = n ?? '';
      this.ascents = { t, m, tx, mx };
    }
  }

  protected updated(changed: Map<string, unknown>): void {
    // La feuille doit d'abord s'afficher (et noter qui avait le focus).
    if (changed.has('route') && this.route) this.sheet?.updateComplete.then(() => this.textarea?.focus());
  }

  private close() {
    this.route = null;
    this.dispatchEvent(new CustomEvent('close'));
  }

  private setMode(mode: ClimbMode, on: boolean) {
    this.ascents = { ...this.ascents, [mode]: on, ...(on ? {} : { [detailsKey(mode)]: '' }) };
  }

  /** Cocher un détail coche aussi la façon de grimper. */
  private setDetail(mode: ClimbMode, detail: Detail, on: boolean) {
    const key = detailsKey(mode);
    const current = this.ascents[key] ?? '';
    const details = normalizeDetails(on ? current + detail : current.replace(detail, ''));
    this.ascents = { ...this.ascents, [key]: details, ...(on ? { [mode]: true } : {}) };
  }

  private save() {
    if (this.route) this.store.edit(this.route.id, { ...this.ascents, n: this.draft });
    this.close();
  }

  private deleteNote() {
    if (this.route) this.store.setNote(this.route.id, '');
    this.close();
  }

  render() {
    const r = this.route;
    const heading = r ? `Mur ${r.wall} · ${r.color.toLowerCase()} ${r.grade ?? 'traversée'}` : '';
    const hasNote = !!(r && this.store.get(r.id).n);
    const a = this.ascents;
    return html`<lardy-sheet .open=${!!r} heading=${heading} @close=${this.close}>
      ${MODES.map(
        ({ mode, label }) => html`<fieldset class=${mode === 't' ? 'lead' : 'toprope'}>
          <legend class="visually-hidden">${label}</legend>
          <label class="mode"
            ><input
              type="checkbox"
              class="mode"
              .checked=${!!a[mode]}
              @change=${(e: Event) => this.setMode(mode, (e.target as HTMLInputElement).checked)}
            />${label}</label
          >
          ${DETAILS.map(
            (d) => html`<label
              ><input
                type="checkbox"
                class="detail-${d.code}"
                .checked=${!!a[mode] && !!a[detailsKey(mode)]?.includes(d.code)}
                @change=${(e: Event) => this.setDetail(mode, d.code, (e.target as HTMLInputElement).checked)}
              />${d.label}</label
            >`,
          )}
        </fieldset>`,
      )}
      <p>Cotation ressentie, méthode, passage clé… Pensez aussi à l'indiquer sur le topo du club.</p>
      <label class="visually-hidden" for="note">Note</label>
      <textarea
        id="note"
        maxlength=${MAX_NOTE_LENGTH}
        placeholder="Ex. : ressentie 6a+, départ dur"
        .value=${this.draft}
        @input=${(e: Event) => (this.draft = (e.target as HTMLTextAreaElement).value)}
      ></textarea>
      <div class="actions">
        ${hasNote ? html`<button class="btn remove" @click=${this.deleteNote}>Supprimer la note</button>` : ''}
        <button class="btn primary save" @click=${this.save}>Enregistrer</button>
      </div>
    </lardy-sheet>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-note-sheet': NoteSheet;
  }
}
