// background.js — MV3 service worker.
// Responsibilities: seed default settings on install. That's it for v1.
// No network, no tabs, no message routing needed — content scripts read/write
// chrome.storage.sync directly and observe changes there.

import { getSettings, setSettings } from './shared/storage.js';

chrome.runtime.onInstalled.addListener(async (details) => {
  // Seed defaults on first install without clobbering an existing config
  // (getSettings already merges over defaults, so writing it back is safe
  // and also upgrades older stored shapes to the current version).
  try {
    const settings = await getSettings();
    await setSettings(settings);
  } catch (err) {
    console.error('[AI Model Router] onInstalled seed failed:', err);
  }
  if (details.reason === 'install') {
    // Future hook: open a short onboarding / options page here.
  }
});
