import { css } from 'lit';

/** Styles communs aux composants : remise à zéro des boutons, focus, gouttières. */
export const sharedStyles = css`
  :host {
    --gutter-left: max(16px, env(safe-area-inset-left));
    --gutter-right: max(16px, env(safe-area-inset-right));
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  button,
  select,
  textarea,
  input {
    font: inherit;
    color: inherit;
  }

  button {
    cursor: pointer;
    border: 0;
    background: none;
    padding: 0;
    touch-action: manipulation;
  }

  :focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  /* Bouton (i) d'aide, voir help-sheet. */
  .help-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin: -6px 0;
    border-radius: 16px;
    color: var(--accent);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface);
    font-weight: 600;
  }

  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }

  .btn.danger {
    background: var(--danger);
    border-color: var(--danger);
    color: var(--danger-ink);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  select,
  textarea {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
  }

  select {
    min-height: 40px;
    padding: 0 8px;
  }

  textarea {
    width: 100%;
    padding: 10px;
    resize: vertical;
  }
`;
