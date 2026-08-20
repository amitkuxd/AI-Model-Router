// adapter.types.js — the contract every site adapter implements.
//
// RULE: all site-specific selectors and quirks live ONLY inside /adapters.
// Nothing outside this folder may contain a site-specific selector.
//
// Every get* returns null instead of throwing. Every async action resolves a
// boolean (or null) rather than rejecting. Callers rely on this to stay on the
// "never break the page" happy path.

/**
 * @typedef {'fast'|'balanced'|'max'} Tier
 */

/**
 * @typedef {Object} ModelDef
 * @property {string} label         Human label shown in menus/toasts, e.g. 'Haiku'.
 * @property {RegExp[]} matchers    Regexes; a menu item matches if ANY tests true.
 * @property {Tier} tier            Which tier this model represents on this site.
 */

/**
 * @typedef {Object} SiteAdapter
 * @property {string} id                                    'claude' | 'chatgpt' | 'grok'
 * @property {RegExp} urlPattern                            Matches location.href.
 * @property {() => HTMLElement|null} getInputEl            The prompt composer element.
 * @property {() => string} getPromptText                  Current prompt text ('' if none).
 * @property {() => HTMLElement|null} getSendButton
 * @property {() => HTMLElement|null} getModelPickerButton
 * @property {() => Promise<string|null>} getCurrentModel  Display name of active model.
 * @property {(modelKey: string) => Promise<boolean>} selectModel
 *           Open picker → find item matching models[modelKey].matchers → click →
 *           verify the picker label changed. Resolve false on ANY failure.
 * @property {() => Promise<boolean>} send                 Trigger native send.
 * @property {() => HTMLElement|null} getButtonMountPoint  Where Smart Send injects.
 * @property {Object.<string, ModelDef>} models            modelKey => ModelDef.
 * @property {Object.<Tier, string>} defaultTierModel      tier => default modelKey.
 */

/**
 * Resolve a tier to a concrete modelKey for an adapter, honoring user overrides.
 * @param {SiteAdapter} adapter
 * @param {Tier} tier
 * @param {Object.<Tier, string>} [override]  from settings.tierModel[siteId]
 * @returns {string|null} modelKey or null if the adapter has no model for the tier
 */
export function resolveTierModel(adapter, tier, override) {
  const key = override?.[tier] || adapter.defaultTierModel?.[tier];
  if (key && adapter.models[key]) return key;
  // Fallback: any model whose own tier matches.
  for (const [k, def] of Object.entries(adapter.models)) {
    if (def.tier === tier) return k;
  }
  return null;
}

/** All modelKeys for an adapter grouped by tier — used to populate Options. */
export function modelsByTier(adapter) {
  const out = { fast: [], balanced: [], max: [] };
  for (const [key, def] of Object.entries(adapter.models)) {
    (out[def.tier] || (out[def.tier] = [])).push({ key, label: def.label });
  }
  return out;
}
