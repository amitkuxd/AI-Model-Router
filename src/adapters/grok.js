// grok.js — SiteAdapter for grok.com
//
// See claude.js header for the SELECTORS filling rules. Every value below is a
// PLACEHOLDER that matches nothing until replaced from live DevTools inspection.

import {
  waitForElement, waitForCondition, simulateClick, textOf,
} from '../content/dom-utils.js';

const PLACEHOLDER = '__amr_todo_fill_me__';

const SELECTORS = {
  // Grok composer. TODO('inspect'): textarea or contenteditable in the composer.
  inputEl: PLACEHOLDER, // e.g. 'textarea[aria-label="Ask Grok anything"]'

  // Send button. TODO('inspect'): aria-label="Submit" / type="submit".
  sendButton: PLACEHOLDER, // e.g. 'button[type="submit"][aria-label*="Submit"]'

  // Model picker. TODO('inspect'): grok exposes an Expert/Fast/model toggle.
  modelPickerButton: PLACEHOLDER, // e.g. 'button[aria-haspopup="menu"]'

  menu: '[role="menu"], [role="listbox"]',
  menuItem: '[role="menuitem"], [role="option"]',

  // Mount point next to send. TODO('inspect').
  buttonMount: PLACEHOLDER,
};

const q = (sel, root = document) => (sel ? root.querySelector(sel) : null);
const qa = (sel, root = document) => (sel ? Array.from(root.querySelectorAll(sel)) : []);

/** @type {import('./adapter.types.js').SiteAdapter} */
export const grokAdapter = {
  id: 'grok',
  urlPattern: /^https:\/\/grok\.com\//,

  models: {
    // Grok's tiers map loosely to a fast/standard/expert style split.
    fast: { label: 'Grok Fast', matchers: [/fast/i, /mini/i], tier: 'fast' },
    standard: { label: 'Grok', matchers: [/^grok(?!.*(fast|expert|heavy)).*/i, /auto/i], tier: 'balanced' },
    expert: { label: 'Grok Expert / Heavy', matchers: [/expert/i, /heavy/i, /think/i, /reason/i], tier: 'max' },
  },
  defaultTierModel: { fast: 'fast', balanced: 'standard', max: 'expert' },

  getInputEl() {
    return q(SELECTORS.inputEl);
  },

  getPromptText() {
    const el = this.getInputEl();
    if (!el) return '';
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

    simulateClick(picker);
    const menu = await waitForElement(() => q(SELECTORS.menu), 3000);
    if (!menu) return false;

    const items = qa(SELECTORS.menuItem, menu);
    const target = items.find((it) => {
      const t = textOf(it);
      return def.matchers.some((re) => re.test(t));
    });
    if (!target) {
      simulateClick(picker);
      return false;
    }

    simulateClick(target);

    const changed = await waitForCondition(() => {
      const now = textOf(this.getModelPickerButton());
      return now && now !== before && def.matchers.some((re) => re.test(now));
    }, 2000);

    return changed;
  },

  async send() {
    const btn = this.getSendButton();
    if (!btn) return false;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;
    simulateClick(btn);
    return true;
  },

  getButtonMountPoint() {
    return q(SELECTORS.buttonMount);
  },
};

export default grokAdapter;
