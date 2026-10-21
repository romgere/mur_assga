import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { progressStore, type ProgressStore } from '../lib/progress-store';
import type { Page } from '../lib/views';
import { sharedStyles } from './shared-styles';
import './progress-counters';
import './route-list';

export interface PageChangeDetail {
  index: number;
}

/**
 * Pager horizontal en scroll-snap (une page par mur ou par cotation).
 * Le défilement natif fait le swipe ; le composant n'émet que « page-change ».
 * La page initiale est lue une seule fois : ensuite c'est le scroll qui fait
 * foi, et la navigation externe passe par goTo().
 */
@customElement('lardy-route-pager')
export class RoutePager extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        min-height: 0;
      }

      .track {
        display: flex;
        height: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x mandatory;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
      }

      .track::-webkit-scrollbar {
        display: none;
      }

      .page {
        flex: 0 0 100%;
        width: 100%;
        height: 100%;
        overflow-y: auto;
        overscroll-behavior-y: contain;
        scroll-snap-align: start;
        scroll-snap-stop: always;
        padding: 4px var(--gutter-right) 16px var(--gutter-left);
      }

      header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin: 4px 0 8px;
      }

      h2 {
        margin: 0;
        font-size: 20px;
      }
    `,
  ];

  @property({ attribute: false }) pages: Page[] = [];
  /** Page affichée au premier rendu. */
  @property({ type: Number, attribute: 'initial-index' }) initialIndex = 0;
  @property({ attribute: false }) store: ProgressStore = progressStore;

  @query('.track') private track!: HTMLElement;

  private current = 0;
  private frame = 0;
  private resizeObserver?: ResizeObserver;

  get index(): number {
    return this.current;
  }

  /** Va à la page demandée (clic sur une pastille). */
  goTo(index: number, smooth = true): void {
    const target = this.clamp(index);
    const width = this.track?.clientWidth ?? 0;
    if (this.track) {
      if (typeof this.track.scrollTo === 'function') {
        this.track.scrollTo({ left: target * width, behavior: smooth ? 'smooth' : 'auto' });
      } else {
        this.track.scrollLeft = target * width;
      }
    }
    this.setCurrent(target);
  }

  private clamp(index: number): number {
    return Math.max(0, Math.min(this.pages.length - 1, Math.round(index) || 0));
  }

  private setCurrent(index: number): void {
    if (index === this.current) return;
    this.current = index;
    this.dispatchEvent(new CustomEvent<PageChangeDetail>('page-change', { detail: { index } }));
  }

  private onScroll = () => {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const width = this.track.clientWidth;
      if (width > 0) this.setCurrent(this.clamp(this.track.scrollLeft / width));
    });
  };

  protected firstUpdated(): void {
    this.current = this.clamp(this.initialIndex);
    this.track.scrollLeft = this.current * this.track.clientWidth;
    // Rotation de l'écran : on recolle sur la page courante.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.track.scrollLeft = this.current * this.track.clientWidth;
      });
      this.resizeObserver.observe(this.track);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  render() {
    return html`<div class="track" @scroll=${this.onScroll}>
      ${repeat(
        this.pages,
        (p) => p.key,
        (p) => html`<section class="page" aria-label=${p.title}>
          <header>
            <h2>${p.title}</h2>
            <lardy-progress-counters compact .routes=${p.routes} .store=${this.store}></lardy-progress-counters>
          </header>
          <lardy-route-list .routes=${p.routes} .store=${this.store} ?show-wall=${p.showWall}></lardy-route-list>
        </section>`,
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-route-pager': RoutePager;
  }
}
