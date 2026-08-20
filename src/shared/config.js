// config.js — default category definitions and the default category→tier mapping.
//
// Design note: the classifier outputs a CATEGORY. Settings map category → TIER
// (fast | balanced | max). Each adapter maps TIER → an actual model that exists
// on that site. This indirection means model renames never touch this file and
// users can remap in Options without a code change.

/** @typedef {'fast'|'balanced'|'max'} Tier */

/** The tiers, ordered weakest→strongest. Used to populate dropdowns. */
export const TIERS = /** @type {const} */ (['fast', 'balanced', 'max']);

/**
 * Category catalog. `order` drives evaluation precedence in the classifier
 * (lower = evaluated earlier; specific-before-generic).
 */
export const CATEGORIES = {
  coding: { order: 1, label: 'Coding' },
  reasoning: { order: 2, label: 'Reasoning / analysis' },
  writing: { order: 3, label: 'Writing' },
  creative: { order: 4, label: 'Creative' },
  quick: { order: 5, label: 'Quick question' },
  default: { order: 6, label: 'General' },
};

/** Default category → tier mapping. Overridable per-user in Options. */
export const DEFAULT_CATEGORY_TIER = {
  coding: 'balanced',
  reasoning: 'max',
  writing: 'balanced',
  creative: 'balanced',
  quick: 'fast',
  default: 'balanced',
};

/** Sites we support, and whether they're enabled by default. */
export const SITES = {
  claude: { label: 'claude.ai', enabledByDefault: true },
  chatgpt: { label: 'chatgpt.com', enabledByDefault: true },
  grok: { label: 'grok.com', enabledByDefault: true },
};

/**
 * The full default settings object persisted to chrome.storage.sync.
 * `tierModel` is filled lazily per-site the first time an adapter is seen,
 * defaulting to each adapter's own `defaultTierModel`.
 * @returns {StoredSettings}
 */
export function defaultSettings() {
  const siteEnabled = {};
  for (const [id, s] of Object.entries(SITES)) {
    siteEnabled[id] = s.enabledByDefault;
  }
  return {
    version: 1,
    autoMode: false,
    siteEnabled,
    categoryTier: { ...DEFAULT_CATEGORY_TIER },
    // tierModel[siteId][tier] = modelKey. Populated on demand from adapters.
    tierModel: {},
  };
}

/**
 * @typedef {Object} StoredSettings
 * @property {number} version
 * @property {boolean} autoMode
 * @property {Object.<string, boolean>} siteEnabled
 * @property {Object.<string, Tier>} categoryTier
 * @property {Object.<string, Object.<Tier, string>>} tierModel
 */
