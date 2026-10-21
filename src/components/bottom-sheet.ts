import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { sharedStyles } from './shared-styles';

/**
 * Feuille modale générique qui monte du bas de l'écran. Se ferme par la
 * croix, un appui sur le fond ou Échap, et rend le focus à l'élément
 * qui l'a ouverte. Émet « close ».
 */
@customElement('lardy-sheet')
export class BottomSheet extends LitElement {
  static styles = [
    sharedStyles,
    css`
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 10;
        background: var(--overlay);
        animation: fade 0.15s ease-out;
      }

      .panel {
        position: fixed;
        z-index: 11;
        left: 0;
        right: 0;
        bottom: 0;
        margin: 0 auto;
        max-width: 640px;
        max-height: 88dvh;
        display: flex;
        flex-direction: column;
        background: var(--surface);
        color: var(--text);
        border-radius: 18px 18px 0 0;
        box-shadow: var(--shadow);
        animation: rise 0.2s ease-out;
      }

      .panel:focus {
        outline: none;
      }

      header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px var(--gutter-right) 4px var(--gutter-left);
      }

      h2 {
        flex: 1;
        margin: 0;
        font-size: 18px;
      }

      .close {
        width: 40px;
        height: 40px;
        border-radius: 20px;
        font-size: 24px;
        line-height: 1;
        color: var(--text-muted);
      }

      .body {
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 4px var(--gutter-right) max(16px, env(safe-area-inset-bottom)) var(--gutter-left);
      }

      @keyframes rise {
        from {
          transform: translateY(30px);
          opacity: 0;
        }
      }

      @keyframes fade {
        from {
          opacity: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .overlay,
        .panel {
          animation: none;
        }
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;
  @property() heading = '';

  @query('.panel') private panel?: HTMLElement;

  private returnFocus: Element | null = null;

  private onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) {
      e.preventDefault();
      this.close();
    }
  };

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('close'));
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) this.returnFocus = deepActiveElement();
  }

  protected updated(changed: Map<string, unknown>): void {
    if (!changed.has('open')) return;
    if (this.open) {
      document.addEventListener('keydown', this.onKeydown);
      if (!this.contains(deepActiveElement())) this.panel?.focus();
    } else if (changed.get('open') === true) {
      document.removeEventListener('keydown', this.onKeydown);
      (this.returnFocus as HTMLElement | null)?.focus?.();
      this.returnFocus = null;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.onKeydown);
  }

  render() {
    if (!this.open) return nothing;
    return html`<div class="overlay" @click=${this.close}></div>
      <div class="panel" role="dialog" aria-modal="true" aria-labelledby="title" tabindex="-1">
        <header>
          <h2 id="title">${this.heading}</h2>
          <button class="close" aria-label="Fermer" @click=${this.close}>×</button>
        </header>
        <div class="body"><slot></slot></div>
      </div>`;
  }
}

/** Élément focalisé, en traversant les shadow roots. */
function deepActiveElement(): Element | null {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-sheet': BottomSheet;
  }
}
