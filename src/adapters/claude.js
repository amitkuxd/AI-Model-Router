// claude.js — SiteAdapter for claude.ai
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ SELECTORS: fill these from live DevTools inspection of claude.ai.         │
// │ Each value below is a PLACEHOLDER — a valid CSS selector that matches      │
// │ nothing, so the extension degrades gracefully (buttons don't inject,      │
// │ switches report failure) until you paste real selectors in.               │
// │                                                                            │
// │ Rules when filling:                                                        │
// │  • Prefer aria-label, data-testid, role, stable text. NEVER hashed classes.│
// │  • This SELECTORS block is the ONLY thing you edit after a site redesign.  │
// │  • Leave the logic below untouched.                                        │
// └─────────────────────────────────────────────────────────────────────────┘

import {
  waitForElement, waitForCondition, simulateClick, textOf,
} from '../content/dom-utils.js';

const SELECTORS = {
  // The prompt composer — a contenteditable tiptap/ProseMirror div.
  // Verified on claude.ai: role="textbox", contenteditable, stable data-testid.
  inputEl: '[data-testid="chat-input"]',

  // Native send button. Verified: aria-label="Send message".
  sendButton: 'button[data-testid="chat-input-send"]',

  // Model picker trigger (shows current model, e.g. "Fable 5 High").
  // Verified: aria-haspopup="menu", stable data-testid.
  modelPickerButton: 'button[data-testid="model-selector-dropdown"]',

  // The opened menu container (aria-haspopup="menu" → role="menu").
  menu: '[role="menu"], [role="listbox"]',

  // Individual selectable model rows inside the menu. Claude uses menuitemradio
  // for model rows and menuitem for submenu triggers ("More models", "Effort").
  menuItem: '[role="menuitem"], [role="menuitemradio"], [role="option"]',

  // Fallback mount if the send button's parent can't be resolved (see
  // getButtonMountPoint, which prefers placing Smart Send next to Send).
  buttonMount: '',
};

/** Scoped query helpers. */
const q = (sel, root = document) => (sel ? root.querySelector(sel) : null);
const qa = (sel, root = document) => (sel ? Array.from(root.querySelectorAll(sel)) : []);

/** Dispatch a keydown/keyup pair (Radix submenus open via keyboard). */
function dispatchKey(el, key) {
  if (!el) return;
  const init = { bubbles: true, cancelable: true, key, code: key };
  el.dispatchEvent(new KeyboardEvent('keydown', init));
  el.dispatchEvent(new KeyboardEvent('keyup', init));
}

/** Close any open picker/submenu without changing the model. */
function closeMenu(picker) {
  dispatchKey(document.activeElement || document.body, 'Escape');
  // A second Escape closes a still-open parent menu; harmless if already closed.
  dispatchKey(document.body, 'Escape');
}

/**
 * Open the "More models" submenu (a Radix SubTrigger with aria-haspopup="menu")
 * and return the first item matching `findTarget`, or null. Tries the reliable
 * techniques in order: keyboard (ArrowRight/Enter), click, then hover.
 * @param {() => HTMLElement|undefined} findTarget
 */
async function openMoreModelsAndFind(findTarget) {
  // Prefer the explicit "More models" trigger; fall back to any submenu trigger
  // that isn't the Effort one (opening Effort would not reveal models).
  const triggers = qa('[role="menuitem"], [role="menuitemradio"]');
  const ordered = [
    ...triggers.filter((el) => /more models/i.test(textOf(el))),
    ...triggers.filter((el) =>
      el.getAttribute('aria-haspopup') === 'menu' &&
      !/more models|effort/i.test(textOf(el))),
  ];

  for (const trig of ordered) {
    const opened = () => trig.getAttribute('aria-expanded') === 'true' || !!findTarget();

    trig.focus?.();
    dispatchKey(trig, 'ArrowRight');
    if (await waitForCondition(opened, 700)) { if (findTarget()) return findTarget(); }

    dispatchKey(trig, 'Enter');
    if (await waitForCondition(() => !!findTarget(), 600)) return findTarget();

    simulateClick(trig);
    if (await waitForCondition(() => !!findTarget(), 700)) return findTarget();

    // Hover as a last resort (some builds open on pointer intent).
    for (const t of ['pointerover', 'pointerenter', 'pointermove']) {
      trig.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true }));
    }
    if (await waitForCondition(() => !!findTarget(), 700)) return findTarget();
  }
  return null;
}

/** @type {import('./adapter.types.js').SiteAdapter} */
export const claudeAdapter = {
  id: 'claude',
  urlPattern: /^https:\/\/claude\.ai\//,

  models: {
    haiku: { label: 'Haiku', matchers: [/haiku/i], tier: 'fast' },
    sonnet: { label: 'Sonnet', matchers: [/sonnet/i], tier: 'balanced' },
    opus: { label: 'Opus', matchers: [/opus/i], tier: 'max' },
  },
  defaultTierModel: { fast: 'haiku', balanced: 'sonnet', max: 'opus' },

  getInputEl() {
    return q(SELECTORS.inputEl);
  },

  getPromptText() {
    const el = this.getInputEl();
    if (!el) return '';
    // contenteditable → innerText preserves line breaks; textarea → value.
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return el.value || '';
    }
    return el.innerText || '';
  },

  getSendButton() {
    return q(SELECTORS.sendButton);
  },

  getModelPickerButton() {
    return q(SELECTORS.modelPickerButton);
  },

  async getCurrentModel() {
    const btn = this.getModelPickerButton();
    return btn ? textOf(btn) : null;
  },

  async selectModel(modelKey) {
    const def = this.models[modelKey];
    if (!def) return false;

    const picker = this.getModelPickerButton();
    if (!picker) return false;

    const before = textOf(picker);

    // Open the picker menu.
    console.log('[AI Model Router] selectModel: opening picker for', modelKey);
    simulateClick(picker);
    const menu = await waitForElement(() => q(SELECTORS.menu), 3000);
    if (!menu) { console.warn('[AI Model Router] selectModel: menu never opened'); return false; }

    // A matcher can accidentally hit a submenu trigger ("More models"), so only
    // treat a real, selectable model row as the target.
    const isModelRow = (it) => {
      const t = textOf(it);
      if (/more models/i.test(t) || it.getAttribute('aria-haspopup') === 'menu') return false;
      return def.matchers.some((re) => re.test(t));
    };
    const findTarget = () => qa(SELECTORS.menuItem).find(isModelRow);

    // Only Fable is shown at the top level on this account; Haiku/Sonnet/Opus
    // live behind the "More models" submenu. Open it if the target isn't visible.
    let target = findTarget();
    console.log('[AI Model Router] selectModel: target at top level?', !!target);
    if (!target) {
      target = await openMoreModelsAndFind(findTarget);
      console.log('[AI Model Router] selectModel: target after "More models"?', !!target);
    }

    if (!target) {
      console.warn('[AI Model Router] selectModel: model row not found —', modelKey,
        '| visible rows:', qa(SELECTORS.menuItem).map((el) => textOf(el).slice(0, 30)));
      closeMenu(picker);
      return false;
    }

    console.log('[AI Model Router] selectModel: clicking', textOf(target).slice(0, 40));
    simulateClick(target);

    // Verify the picker label changed to reflect the new model.
    const changed = await waitForCondition(() => {
      const now = textOf(this.getModelPickerButton());
      return now && now !== before && def.matchers.some((re) => re.test(now));
    }, 2500);

    console.log('[AI Model Router] selectModel: switched?', changed,
      '| picker now:', textOf(this.getModelPickerButton()).slice(0, 40));
    if (!changed) closeMenu(picker);
    return changed;
  },

  async send() {
    const btn = this.getSendButton();
    if (!btn) return false;
    if (btn.disabled) return false;
    simulateClick(btn);
    return true;
  },

  getButtonMountPoint() {
    // Anchor to an ALWAYS-present control. Claude hides the send button until
    // the user types, so the model picker (always visible) is a safer anchor;
    // fall back to the send button, then the input's container.
    const picker = this.getModelPickerButton();
    if (picker?.parentElement) return picker.parentElement;
    const send = this.getSendButton();
    if (send?.parentElement) return send.parentElement;
    const input = this.getInputEl();
    if (input?.parentElement) return input.parentElement;
    return q(SELECTORS.buttonMount);
  },
};

export default claudeAdapter;
