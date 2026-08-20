// storage.js — thin promise wrapper over chrome.storage.sync, plus settings
// merge/normalize helpers. The only module that touches chrome.storage directly.

import { defaultSettings } from './config.js';

const KEY = 'settings';

/**
 * Read settings, merging over defaults so new fields added in future versions
 * are always present. Never rejects — returns defaults on any error.
 * @returns {Promise<import('./config.js').StoredSettings>}
 */
export async function getSettings() {
  try {
    // Guard against a storage call that never settles (seen in some content-
    // script contexts): fall back to defaults after a short timeout so boot
    // can never stall waiting on it.
    const raw = await Promise.race([
      Promise.resolve(chrome.storage?.sync?.get(KEY)),
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), 1200)),
    ]);
    if (raw && raw.__timeout) {
      console.warn('[AI Model Router] storage.get timed out; using defaults');
      return defaultSettings();
    }
    return mergeSettings(raw?.[KEY]);
  } catch (err) {
    console.error('[AI Model Router] getSettings failed, using defaults:', err);
    return defaultSettings();
  }
}

/**
 * Persist a full settings object.
 * @param {import('./config.js').StoredSettings} settings
 */
export async function setSettings(settings) {
  await chrome.storage.sync.set({ [KEY]: settings });
}

/**
 * Shallow-ish merge of stored settings over defaults. Nested maps are merged
 * one level deep so a partial stored object never loses default keys.
 * @param {Partial<import('./config.js').StoredSettings>|undefined} stored
 */
export function mergeSettings(stored) {
  const base = defaultSettings();
  if (!stored || typeof stored !== 'object') return base;
  return {
    ...base,
    ...stored,
    siteEnabled: { ...base.siteEnabled, ...(stored.siteEnabled || {}) },
    categoryTier: { ...base.categoryTier, ...(stored.categoryTier || {}) },
    tierModel: mergeTierModel(base.tierModel, stored.tierModel),
  };
}

function mergeTierModel(base, stored) {
  const out = { ...base };
  if (stored && typeof stored === 'object') {
    for (const [site, tiers] of Object.entries(stored)) {
      out[site] = { ...(out[site] || {}), ...(tiers || {}) };
    }
  }
  return out;
}

/**
 * Subscribe to settings changes (fires when any device updates sync storage).
 * @param {(settings: import('./config.js').StoredSettings) => void} cb
 * @returns {() => void} unsubscribe
 */
export function onSettingsChanged(cb) {
  const handler = (changes, area) => {
    if (area === 'sync' && changes[KEY]) {
      cb(mergeSettings(changes[KEY].newValue));
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
