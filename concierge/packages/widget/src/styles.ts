// Inline CSS injected into the Shadow root — no global leakage either direction. Theming via
// CSS custom properties read from the host page; sites without an override get these defaults.
export const styles = `
:host { all: initial; }
* { box-sizing: border-box; }
.launcher {
  position: fixed; right: 20px; bottom: 20px; z-index: 999999;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 18px; border-radius: 999px; border: none; cursor: pointer;
  background: var(--concierge-accent, #b4623f); color: #fffdf8;
  font: 600 14px/1 var(--concierge-font, "DM Sans", system-ui, sans-serif);
  box-shadow: 0 6px 20px rgba(0,0,0,.18);
  transition: transform 160ms cubic-bezier(.2,.8,.2,1), box-shadow 160ms;
}
.launcher:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(0,0,0,.22); }
.launcher:active { transform: scale(.97); }
.launcher[hidden] { display: none; }
.launcher svg { width: 16px; height: 16px; }

.panel {
  position: fixed; right: 20px; bottom: 20px; z-index: 999999;
  width: 380px; max-width: calc(100vw - 24px);
  height: min(640px, 90vh);
  display: flex; flex-direction: column;
  background: var(--concierge-bg, #fffdf8); color: var(--concierge-ink, #19372f);
  border-radius: 16px; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,.28);
  font-family: var(--concierge-font, "DM Sans", system-ui, sans-serif);
}
.panel[hidden] { display: none; }
@media (max-width: 480px) {
  .panel { right: 0; bottom: 0; width: 100vw; height: 100vh; max-width: 100vw; border-radius: 0; }
}

.head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid rgba(0,0,0,.08);
  font: 600 15px/1.2 var(--concierge-display-font, "Playfair Display", Georgia, serif);
}
.head button {
  border: none; background: transparent; cursor: pointer; padding: 4px; color: inherit; opacity: .6;
}
.head button:hover { opacity: 1; }

.messages { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.msg { max-width: 85%; padding: 9px 12px; border-radius: 12px; font-size: 13.5px; line-height: 1.45; }
.msg.bot { align-self: flex-start; background: rgba(0,0,0,.05); border-bottom-left-radius: 4px; }
.msg.user { align-self: flex-end; background: var(--concierge-accent, #b4623f); color: #fffdf8; border-bottom-right-radius: 4px; }

.chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px; }
.chip {
  border: 1px solid rgba(0,0,0,.15); background: transparent; color: inherit;
  border-radius: 999px; padding: 7px 12px; font-size: 12.5px; cursor: pointer;
  transition: background 120ms, border-color 120ms;
}
.chip:hover { background: rgba(0,0,0,.05); border-color: rgba(0,0,0,.3); }
.chip:focus-visible, .chip:focus { outline: 2px solid var(--concierge-accent, #b4623f); outline-offset: 1px; }

.cards { display: flex; flex-direction: column; gap: 10px; padding: 0 16px 10px; }
.card { border: 1px solid rgba(0,0,0,.1); border-radius: 12px; overflow: hidden; display: flex; gap: 10px; padding: 10px; }
.card img { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; background: rgba(0,0,0,.06); flex-shrink: 0; }
.card .body { flex: 1; min-width: 0; }
.card h4 { margin: 0 0 2px; font-size: 13.5px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.card .tag { font-size: 9.5px; letter-spacing: .06em; text-transform: uppercase; background: var(--concierge-accent, #b4623f); color: #fffdf8; padding: 1px 6px; border-radius: 4px; }
.card p { margin: 0 0 4px; font-size: 12px; color: rgba(0,0,0,.6); }
.card .reasons { font-size: 11px; color: rgba(0,0,0,.55); margin: 0 0 6px; }
.card .cta { display: flex; gap: 6px; }
.card .cta a, .card .cta button {
  font-size: 11.5px; font-weight: 600; text-decoration: none; padding: 5px 10px; border-radius: 999px; cursor: pointer;
  border: 1px solid rgba(0,0,0,.15); color: inherit; background: transparent;
}
.card .cta a.primary { background: var(--concierge-accent, #b4623f); color: #fffdf8; border-color: transparent; }

.input-row { display: flex; gap: 8px; padding: 10px 16px 14px; border-top: 1px solid rgba(0,0,0,.08); }
.input-row input {
  flex: 1; border: 1px solid rgba(0,0,0,.15); border-radius: 999px; padding: 9px 14px; font-size: 13px;
  background: transparent; color: inherit; font-family: inherit;
}
.input-row input:focus { outline: 2px solid var(--concierge-accent, #b4623f); outline-offset: 1px; }
.input-row button { border: none; background: var(--concierge-accent, #b4623f); color: #fffdf8; border-radius: 999px; padding: 0 14px; cursor: pointer; font-weight: 600; }

@media (prefers-reduced-motion: reduce) { .launcher, .launcher:hover { transition: none; } }
`;
