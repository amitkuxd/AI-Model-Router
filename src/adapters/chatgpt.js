// chatgpt.js — SiteAdapter for chatgpt.com (and legacy chat.openai.com)
//
// See claude.js header for the SELECTORS filling rules. Every value below is a
// PLACEHOLDER that matches nothing until replaced from live DevTools inspection.

import {
  waitForElement, waitForCondition, simulateClick, textOf,
} from '../content/dom-utils.js';

const PLACEHOLDER = '__amr_todo_fill_me__';

const SELECTORS = {
  // ChatGPT composer: historically a textarea, more recently a contenteditable
  // ProseMirror div with id="prompt-textarea".
  // TODO('inspect'): confirm current markup.
  inputEl: PLACEHOLDER, // e.g. '#prompt-textarea'

  // Send button. TODO('inspect'): data-testid="send-button" has been stable-ish.
  sendButton: PLACEHOLDER, // e.g. 'button[data-testid="send-button"]'

  // Model picker trigger in the top bar. TODO('inspect'):
  //   button[aria-label*="Model"] or data-testid="model-switcher-dropdown-button".
  modelPickerButton: PLACEHOLDER, // e.g. 'button[data-testid^="model-switcher"]'

  menu: '[role="menu"], [role="listbox"]',
  menuItem: '[role="menuitem"], [role="option"]',

  // Mount point — the composer's trailing actions container.
  buttonMount: PLACEHOLDER, // e.g. 'div[data-testid="composer-trailing-actions"]'
};

const q = (sel, root = document) => (sel ? root.querySelector(sel) : null);
const qa = (sel, root = document) => (sel ? Array.from(root.querySelectorAll(sel)) : []);

/** @type {import('./adapter.types.js').SiteAdapter} */
export const chatgptAdapter = {
  id: 'chatgpt',
  urlPattern: /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//,

  models: {
    // Model names change often; matchers are permissive and user-remappable.
    mini: { label: 'GPT mini', matchers: [/mini/i, /\bfast\b/i], tier: 'fast' },
    standard: { label: 'GPT', matchers: [/^gpt(?!.*(mini|pro)).*/i, /\bauto\b/i], tier: 'balanced' },
    pro: { label: 'GPT Pro / Thinking', matchers: [/pro\b/i, /thinking/i, /reason/i], tier: 'max' },
  },
  defaultTierModel: { fast: 'mini', balanced: 'standard', max: 'pro' },

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

export default chatgptAdapter;
