import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { isDone, progressStore, type ProgressFlag, type ProgressStore } from '../lib/progress-store';
import { StoreController } from '../lib/store-controller';
import { colorToken, gradeLevel, type Route } from '../lib/topo';
import { sharedStyles } from './shared-styles';

export interface OpenNoteDetail {
  route: Route;
}

const starIcon = (filled: boolean) => html`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
  <path
    d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"
    fill=${filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linejoin="round"
  />
</svg>`;

const noteIcon = html`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
  <path
    d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linejoin="round"
  />
</svg>`;

/**
 * Une voie : pastille de couleur, cotation, initiales/badges, et les
 * boutons Tête / Moulinette / favori / note. Seule cette ligne se repeint
 * quand sa voie change dans le store.
 */
@customElement('lardy-route-row')
export class RouteRow extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      .row {
        display: grid;
        grid-template-columns: 62px minmax(0, 1fr) auto;
        align-items: center;
        gap: 4px 10px;
        padding: 8px 10px;
        border-radius: 12px;
        background: var(--surface);
        border: 1px solid var(--border);
        transition: background-color 0.15s;
      }

      .row.done {
        background: var(--done-bg);
      }

      .color {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 2px;
      }

      .wall {
        font-size: 12px;
        font-weight: 700;
        text-align: center;
        color: var(--text-muted);
      }

      .swatch {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 32px;
        border-radius: 6px;
        background: var(--sw);
        color: var(--sw-ink);
        border: 1px solid var(--swatch-border);
        font-size: 10.5px;
        font-weight: 800;
        letter-spacing: 0.02em;
        overflow: hidden;
      }

      .info {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .grade {
        font-size: 20px;
        font-weight: 800;
        line-height: 1.1;
        white-space: nowrap;
        color: var(--text);
      }

      .wall-num small {
        font-size: 13px;
        font-weight: 700;
        color: var(--text-muted);
      }

      .grade.g4 {
        color: var(--g4);
      }
      .grade.g5 {
        color: var(--g5);
      }
      .grade.g6 {
        color: var(--g6);
      }
      .grade.g7 {
        color: var(--g7);
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
      }

      .badge {
        padding: 0 5px;
        border-radius: 4px;
        background: var(--surface-2);
        font-weight: 700;
      }

      .badge.comp {
        background: var(--accent-soft);
        color: var(--accent);
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .toggle {
        min-width: 46px;
        height: 40px;
        padding: 0 6px;
        border-radius: 10px;
        border: 1.5px solid var(--border);
        background: var(--surface);
        font-size: 13px;
        font-weight: 700;
        color: var(--text-muted);
      }

      .toggle.lead[aria-pressed='true'] {
        background: var(--lead);
        border-color: var(--lead);
        color: var(--lead-ink);
      }

      .toggle.toprope[aria-pressed='true'] {
        background: var(--toprope);
        border-color: var(--toprope);
        color: var(--toprope-ink);
      }

      .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 40px;
        border-radius: 10px;
        color: var(--text-muted);
      }

      .star[aria-pressed='true'] {
        color: var(--star);
      }

      .note-btn.has-note {
        color: var(--accent);
      }

      .note {
        grid-column: 2 / -1;
        margin: 0;
        font-size: 13px;
        font-style: italic;
        color: var(--text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ];

  @property({ attribute: false }) route!: Route;
  @property({ type: Boolean, attribute: 'show-wall' }) showWall = false;
  /** Mode « Par difficulté » : le mur en gros, sans la cotation (déjà donnée par la page). */
  @property({ type: Boolean, attribute: 'wall-first' }) wallFirst = false;
  @property({ attribute: false }) store: ProgressStore = progressStore;

  constructor() {
    super();
    new StoreController(
      this,
      () => this.store,
      (id) => id === undefined || id === this.route?.id,
    );
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'listitem');
  }

  private toggle(flag: ProgressFlag) {
    this.store.toggle(this.route.id, flag);
  }

  private openNote() {
    this.dispatchEvent(
      new CustomEvent<OpenNoteDetail>('open-note', {
        detail: { route: this.route },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** Description complète pour les lecteurs d'écran (« voie verte 6a, mur 1 »). */
  private get label(): string {
    const r = this.route;
    const parts = [`voie ${r.color.toLowerCase()}`];
    if (r.grade) parts.push(r.grade);
    if (r.traverse) parts.push('traversée');
    parts.push(`mur ${r.wall}`);
    return parts.join(' ');
  }

  render() {
    const r = this.route;
    if (!r) return nothing;
    const p = this.store.get(r.id);
    const token = colorToken(r.color);
    const swatch = { '--sw': `var(--c-${token}, #888)`, '--sw-ink': `var(--c-${token}-ink, #fff)` };
    const label = this.label;

    return html`<div class="row ${isDone(p) ? 'done' : ''}">
      <span class="color">
        <span class="swatch" style=${styleMap(swatch)}>${r.color}</span>
        ${this.showWall && !this.wallFirst ? html`<span class="wall">Mur ${r.wall}</span>` : nothing}
      </span>
      <div class="info">
        ${this.wallFirst
          ? html`<span class="grade wall-num"><small>Mur</small> ${r.wall}</span>`
          : html`<span class="grade g${gradeLevel(r.grade)}">${r.grade ?? '—'}</span>`}
        <span class="meta">
          ${r.competition ? html`<span class="badge comp">Compét.</span>` : nothing}
          ${r.traverse ? html`<span class="badge">Traversée</span>` : nothing}
          ${r.setter ? html`<span class="setter">${r.setter}</span>` : nothing}
        </span>
      </div>
      <div class="actions">
        <button
          class="toggle lead"
          aria-pressed=${p.t ? 'true' : 'false'}
          aria-label="Faite en tête, ${label}"
          @click=${() => this.toggle('t')}
        >
          Tête
        </button>
        <button
          class="toggle toprope"
          aria-pressed=${p.m ? 'true' : 'false'}
          aria-label="Faite en moulinette, ${label}"
          @click=${() => this.toggle('m')}
        >
          Moul.
        </button>
        <button
          class="icon star"
          aria-pressed=${p.s ? 'true' : 'false'}
          aria-label="Favori, ${label}"
          @click=${() => this.toggle('s')}
        >
          ${starIcon(!!p.s)}
        </button>
        <button
          class="icon note-btn ${p.n ? 'has-note' : ''}"
          aria-label="${p.n ? 'Modifier la note' : 'Ajouter une note'}, ${label}"
          @click=${this.openNote}
        >
          ${noteIcon}
        </button>
      </div>
      ${p.n ? html`<p class="note">${p.n}</p>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-route-row': RouteRow;
  }
}
