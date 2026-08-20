// ui.js — all injected UI: the Smart Send button, the toast, and the manual
// override menu. Everything renders inside shadow DOM so site CSS can neither
// bleed in nor leak out. No site-specific selectors here.

import { STRINGS } from '../shared/strings.js';

const NS = 'ai-model-router';

/* ------------------------------------------------------------------ styles */

const BUTTON_CSS = `
  :host { all: initial; display: inline-flex; }
  .btn {
    box-sizing: border-box;
    width: 34px; height: 34px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 50%;
    cursor: pointer;
    border: 1.5px solid transparent;
    background:
      linear-gradient(var(--amr-bg, #1c1c1c), var(--amr-bg, #1c1c1c)) padding-box,
      linear-gradient(135deg, #a78bfa, #60a5fa) border-box;
    color: var(--amr-fg, #e5e5e5);
    font: 16px/1 system-ui, sans-serif;
    transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease;
    user-select: none;
    padding: 0;
  }
  .btn:hover { transform: translateY(-1px); box-shadow: 0 2px 10px rgba(96,165,250,.35); }
  .btn:active { transform: translateY(0); }
  .btn[data-state="switching"] { pointer-events: none; }
  .btn[data-state="switching"] .icon { animation: amr-spin .8s linear infinite; }
  .btn[data-state="classifying"] .icon { animation: amr-pulse .4s ease; }
  .btn[data-state="shake"] { animation: amr-shake .3s ease; }
  .icon { display: inline-block; }
  @keyframes amr-spin { to { transform: rotate(360deg); } }
  @keyframes amr-pulse { 0%,100% { transform: scale(1);} 50% { transform: scale(1.25);} }
  @keyframes amr-shake {
    0%,100% { transform: translateX(0); }
    25% { transform: translateX(-4px);} 75% { transform: translateX(4px); }
  }
  .menu {
    position: absolute; bottom: 42px; right: 0;
    min-width: 160px; padding: 4px;
    background: var(--amr-bg, #1c1c1c); color: var(--amr-fg, #e5e5e5);
    border: 1px solid rgba(150,150,150,.25); border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0,0,0,.35);
    font: 13px system-ui, sans-serif; z-index: 2147483647;
  }
  .menu[hidden] { display: none; }
  .menu-title { padding: 6px 8px; opacity: .6; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  .menu-item {
    padding: 7px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap;
  }
  .menu-item:hover { background: rgba(120,120,120,.18); }
  .wrap { position: relative; display: inline-flex; }
`;

const TOAST_CSS = `
  :host { all: initial; }
  .toast-root {
    position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
    display: flex; flex-direction: column; gap: 8px; align-items: center;
    z-index: 2147483647; pointer-events: none;
    font: 13px/1.4 system-ui, sans-serif;
  }
  .toast {
    pointer-events: auto;
    display: flex; align-items: center; gap: 12px;
    max-width: 90vw;
    padding: 10px 14px;
    background: #1c1c1cf2; color: #f2f2f2;
    border: 1px solid rgba(150,150,150,.22);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,.4);
    opacity: 0; transform: translateY(8px);
    transition: opacity .18s ease, transform .18s ease;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.warn { border-color: #f59e0b88; }
  .toast .msg { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .toast .dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto;
    background: linear-gradient(135deg,#a78bfa,#60a5fa); }
  .toast.warn .dot { background: #f59e0b; }
  .toast button {
    all: unset; cursor: pointer; color: #93c5fd; font-weight: 600;
    padding: 2px 6px; border-radius: 6px;
  }
  .toast button:hover { background: rgba(147,197,253,.15); }
`;

/* ------------------------------------------------------- theme detection */

/** Sniff a light/dark background from the page so injected UI blends in. */
function themeVars() {
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const isDark = isDarkColor(bodyBg) ||
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return isDark
    ? { '--amr-bg': '#1f1f22', '--amr-fg': '#ececec' }
    : { '--amr-bg': '#ffffff', '--amr-fg': '#1a1a1a' };
}

function isDarkColor(rgb) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
  if (!m) return false;
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  // relative luminance
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 128;
}

/* --------------------------------------------------------- Smart Send btn */

/**
 * Create the Smart Send button controller and mount it.
 * @param {HTMLElement} mountPoint
 * @param {{
 *   onSmartSend: () => void,
 *   getModels: () => {key:string,label:string}[],
 *   onManualSelect: (modelKey:string) => void
 * }} handlers
 * @returns {{ el: HTMLElement, setState: (s:string)=>void, shake: ()=>void, remove: ()=>void }}
 */
export function injectSmartSendButton(mountPoint, handlers) {
  const host = document.createElement('span');
  host.className = `${NS}-button-host`;
  host.setAttribute('data-amr', 'button');
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = BUTTON_CSS;

  const wrap = document.createElement('span');
  wrap.className = 'wrap';

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.type = 'button';
  btn.dataset.state = 'idle';
  btn.title = STRINGS.button.tooltip;
  btn.setAttribute('aria-label', STRINGS.button.ariaLabel);
  btn.innerHTML = `<span class="icon">✨</span>`;

  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.hidden = true;

  // Apply theme vars on the host.
  const vars = themeVars();
  for (const [k, v] of Object.entries(vars)) host.style.setProperty(k, v);

  // --- interactions ---
  let longPressTimer = null;

  const openMenu = () => {
    const models = handlers.getModels?.() || [];
    menu.innerHTML = `<div class="menu-title">Send with…</div>`;
    for (const m of models) {
      const item = document.createElement('div');
      item.className = 'menu-item';
      item.textContent = m.label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.hidden = true;
        handlers.onManualSelect?.(m.key);
      });
      menu.appendChild(item);
    }
    menu.hidden = false;
  };
  const closeMenu = () => { menu.hidden = true; };

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!menu.hidden) { closeMenu(); return; }
    if (btn.dataset.state !== 'idle') return; // debounce while busy
    handlers.onSmartSend?.();
  });

  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    menu.hidden ? openMenu() : closeMenu();
  });

  // long-press (touch / mouse hold) → manual menu
  const startPress = () => {
    longPressTimer = setTimeout(() => { openMenu(); }, 550);
  };
  const cancelPress = () => { if (longPressTimer) clearTimeout(longPressTimer); };
  btn.addEventListener('pointerdown', startPress);
  btn.addEventListener('pointerup', cancelPress);
  btn.addEventListener('pointerleave', cancelPress);

  // click-away closes the menu
  const onDocClick = (e) => {
    if (!host.contains(e.target)) closeMenu();
  };
  document.addEventListener('click', onDocClick, true);

  wrap.appendChild(btn);
  wrap.appendChild(menu);
  shadow.appendChild(style);
  shadow.appendChild(wrap);

  // Mount: append into the site's action row.
  mountPoint.appendChild(host);

  let shakeTimer = null;
  return {
    el: host,
    setState(s) {
      btn.dataset.state = s;
    },
    shake() {
      btn.dataset.state = 'shake';
      if (shakeTimer) clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => { btn.dataset.state = 'idle'; }, 320);
    },
    remove() {
      document.removeEventListener('click', onDocClick, true);
      host.remove();
    },
  };
}

/* ------------------------------------------------------------------ toast */

let toastHost = null;
let toastRoot = null;

function ensureToastRoot() {
  if (toastRoot && document.body.contains(toastHost)) return toastRoot;
  toastHost = document.createElement('div');
  toastHost.className = `${NS}-toast-host`;
  const shadow = toastHost.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = TOAST_CSS;
  toastRoot = document.createElement('div');
  toastRoot.className = 'toast-root';
  shadow.appendChild(style);
  shadow.appendChild(toastRoot);
  document.body.appendChild(toastHost);
  return toastRoot;
}

/**
 * Show a toast. Auto-dismisses after `duration` ms; pauses on hover.
 * @param {{
 *   message: string,
 *   variant?: 'info'|'warn',
 *   undoLabel?: string,
 *   onUndo?: () => void,
 *   duration?: number
 * }} opts
 * @returns {() => void} dismiss
 */
export function showToast(opts) {
  const { message, variant = 'info', undoLabel, onUndo, duration = 4000 } = opts;
  const root = ensureToastRoot();

  const toast = document.createElement('div');
  toast.className = `toast ${variant === 'warn' ? 'warn' : ''}`;

  const dot = document.createElement('span');
  dot.className = 'dot';
  const msg = document.createElement('span');
  msg.className = 'msg';
  msg.textContent = message;
  toast.appendChild(dot);
  toast.appendChild(msg);

  if (undoLabel && onUndo) {
    const undo = document.createElement('button');
    undo.textContent = undoLabel;
    undo.addEventListener('click', () => {
      try { onUndo(); } finally { dismiss(); }
    });
    toast.appendChild(undo);
  }

  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  let timer = null;
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    if (timer) clearTimeout(timer);
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  };
  const arm = () => { timer = setTimeout(dismiss, duration); };
  toast.addEventListener('mouseenter', () => { if (timer) clearTimeout(timer); });
  toast.addEventListener('mouseleave', arm);
  arm();

  return dismiss;
}

/** Remove all injected UI (used on teardown / SPA route change cleanup). */
export function clearToasts() {
  if (toastRoot) toastRoot.innerHTML = '';
}
