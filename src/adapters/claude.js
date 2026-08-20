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

const PLACEHOLDER = '__amr_todo_fill_me__'; // valid selector, matches nothing

const SELECTORS = {
  // The prompt composer. Claude uses a contenteditable ProseMirror div.
  // TODO('inspect'): likely 'div[contenteditable="true"]' inside the composer,
  //   or a container with aria-label like "Write your prompt to Claude".
  inputEl: PLACEHOLDER, // e.g. 'div.ProseMirror[contenteditable="true"]'

  // Native send button. TODO('inspect'): look for aria-label="Send message"
  //   or a data-testid on the send/submit button.
  sendButton: PLACEHOLDER, // e.g. 'button[aria-label="Send message"]'

  // The model picker trigger (shows current model name).
  // TODO('inspect'): a button in the composer toolbar showing "Sonnet"/"Opus".
  modelPickerButton: PLACEHOLDER, // e.g. 'button[data-testid="model-selector"]'

  // The opened menu container. TODO('inspect'): role="menu" or role="listbox".
  menu: '[role="menu"], [role="listbox"]',

  // Individual selectable model rows inside the menu.
  // TODO('inspect'): role="menuitem" / role="option".
  menuItem: '[role="menuitem"], [role="option"]',

  // Where Smart Send mounts — usually the send button's parent toolbar.
  // TODO('inspect'): the flex container that holds the send button.
  buttonMount: PLACEHOLDER, // e.g. 'div.composer-actions'
};

/** Scoped query helpers. */
const q = (sel, root = document) => (sel ? root.querySelector(sel) : null);
const qa = (sel, root = document) => (sel ? Array.from(root.querySelectorAll(sel)) : []);

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

    // Open the menu.
    simulateClick(picker);
    const menu = await waitForElement(() => q(SELECTORS.menu), 3000);
    if (!menu) return false;

    // Find the matching item.
    const items = qa(SELECTORS.menuItem, menu);
    const target = items.find((it) => {
      const t = textOf(it);
      return def.matchers.some((re) => re.test(t));
    });

    if (!target) {
      // Close the menu so we don't leave UI open, then report failure.
      simulateClick(picker);
      return false;
    }

    simulateClick(target);

    // Verify the picker label changed to reflect the new model.
    const changed = await waitForCondition(() => {
      const now = textOf(this.getModelPickerButton());
      return now && (now !== before) && def.matchers.some((re) => re.test(now));
    }, 2000);

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
    return q(SELECTORS.buttonMount);
  },
};

export default claudeAdapter;
