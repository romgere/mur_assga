import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { MAX_NOTE_LENGTH, progressStore, type ProgressStore } from '../lib/progress-store';
import type { Route } from '../lib/topo';
import { sharedStyles } from './shared-styles';
import './bottom-sheet';

/** Feuille d'édition de la note d'une voie (cotation ressentie, méthode…). */
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
  @query('textarea') private textarea?: HTMLTextAreaElement;
  @query('lardy-sheet') private sheet?: HTMLElement & { updateComplete: Promise<boolean> };

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('route') && this.route) this.draft = this.store.get(this.route.id).n ?? '';
  }

  protected updated(changed: Map<string, unknown>): void {
    // La feuille doit d'abord s'afficher (et noter qui avait le focus).
    if (changed.has('route') && this.route) this.sheet?.updateComplete.then(() => this.textarea?.focus());
  }

  private close() {
    this.route = null;
    this.dispatchEvent(new CustomEvent('close'));
  }

  private save() {
    if (this.route) this.store.setNote(this.route.id, this.draft);
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
    return html`<lardy-sheet .open=${!!r} heading=${heading} @close=${this.close}>
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
        ${hasNote ? html`<button class="btn remove" @click=${this.deleteNote}>Supprimer</button>` : ''}
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
