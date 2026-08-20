// main.js — content-script entry (loaded as an ES module by bootstrap.js).
//
// Flow: detect site → load its adapter → if enabled, wait for the mount point
// (SPAs render late) → inject Smart Send → wire the router. Re-inject across
// SPA route changes. Optionally (auto mode) intercept native send / Enter.

import { waitForElement } from './dom-utils.js';
import { injectSmartSendButton } from './ui.js';
import { createRouter } from './router.js';
import { getSettings, onSettingsChanged } from '../shared/storage.js';

import claudeAdapter from '../adapters/claude.js';
import chatgptAdapter from '../adapters/chatgpt.js';
import grokAdapter from '../adapters/grok.js';

const ADAPTERS = [claudeAdapter, chatgptAdapter, grokAdapter];

/** Live settings cache, kept fresh via storage change events. */
let settings = null;

/** The current injection controller (button + wiring), or null. */
let mounted = null;

/** Guards against overlapping inject attempts. */
let injecting = false;

function pickAdapter() {
  const href = location.href;
  return ADAPTERS.find((a) => a.urlPattern.test(href)) || null;
}

/** Is the Smart Send button still present in the live DOM? */
function isButtonPresent() {
  return !!(mounted && mounted.controller?.el?.isConnected);
}

async function tryInject(adapter) {
  if (injecting || isButtonPresent()) return;
  if (!settings?.siteEnabled?.[adapter.id]) return;
  injecting = true;
  try {
    const mount = await waitForElement(() => adapter.getButtonMountPoint(), 8000);
    if (!mount) {
      console.warn('[AI Model Router] mount point not found for', adapter.id,
        '— input:', !!adapter.getInputEl(),
        'picker:', !!adapter.getModelPickerButton(),
        'send:', !!adapter.getSendButton());
      return; // no broken button
    }
    if (isButtonPresent()) return;
    console.log('[AI Model Router] injecting Smart Send for', adapter.id, 'into', mount);

    // Build the button first with placeholder handlers, then wire the router
    // (router needs the button controller for state/shake).
    const controller = injectSmartSendButton(mount, {
      onSmartSend: () => router?.routeAndSend(),
      getModels: () =>
        Object.entries(adapter.models).map(([key, def]) => ({ key, label: def.label })),
      onManualSelect: (modelKey) => router?.routeAndSend({ forceModelKey: modelKey }),
    });

    const router = createRouter({
      adapter,
      getSettings: () => settings,
      button: controller,
    });

    mounted = { adapter, controller, router, autoCleanup: null };

    // Wire auto mode if enabled.
    applyAutoMode(adapter);
  } finally {
    injecting = false;
  }
}

function teardown() {
  if (!mounted) return;
  try { mounted.autoCleanup?.(); } catch (_) {}
  try { mounted.controller?.remove(); } catch (_) {}
  mounted = null;
}

/* ----------------------------------------------------- auto mode (Phase 6) */

/**
 * When auto mode is on, route on the NATIVE send button and on Enter, not just
 * on the Smart Send button. This is the fiddliest path; it's off by default.
 *
 * Approach: capture-phase listeners that, on a genuine send gesture, swallow the
 * native event, run the route+send cycle (which itself calls adapter.send), and
 * stop. IME composition is guarded so we never fire mid-composition (CJK/Indic).
 */
function applyAutoMode(adapter) {
  // Clear any previous auto wiring first.
  if (mounted?.autoCleanup) { mounted.autoCleanup(); mounted.autoCleanup = null; }
  if (!settings?.autoMode) return;

  let composing = false;
  const input = adapter.getInputEl();
  const sendBtn = adapter.getSendButton();

  const onCompStart = () => { composing = true; };
  const onCompEnd = () => { composing = false; };

  const onKeydown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;      // Shift+Enter = newline
    if (composing || e.isComposing) return;           // IME guard
    if (mounted?.router?.isBusy()) return;
    // Swallow the native submit and route instead.
    e.preventDefault();
    e.stopPropagation();
    mounted?.router?.routeAndSend();
  };

  const onSendClick = (e) => {
    // Ignore synthetic clicks we generate ourselves (adapter.send()).
    if (!e.isTrusted) return;
    if (mounted?.router?.isBusy()) return;
    e.preventDefault();
    e.stopPropagation();
    mounted?.router?.routeAndSend();
  };

  input?.addEventListener('compositionstart', onCompStart, true);
  input?.addEventListener('compositionend', onCompEnd, true);
  input?.addEventListener('keydown', onKeydown, true);
  sendBtn?.addEventListener('click', onSendClick, true);

  if (mounted) {
    mounted.autoCleanup = () => {
      input?.removeEventListener('compositionstart', onCompStart, true);
      input?.removeEventListener('compositionend', onCompEnd, true);
      input?.removeEventListener('keydown', onKeydown, true);
      sendBtn?.removeEventListener('click', onSendClick, true);
    };
  }
}

/* ------------------------------------------------------- SPA route watching */

function watchNavigation(onChange) {
  let lastUrl = location.href;
  const check = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onChange();
    }
  };
  // Patch history methods (SPAs use pushState/replaceState).
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function (...args) {
      const r = orig.apply(this, args);
      queueMicrotask(check);
      return r;
    };
  }
  window.addEventListener('popstate', check);
  window.addEventListener('hashchange', check);
  // Belt-and-suspenders: some SPAs swap DOM without a URL change; a light
  // observer re-checks button presence so it self-heals if removed.
  const obs = new MutationObserver(() => {
    if (currentAdapter && !isButtonPresent()) tryInject(currentAdapter);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

/* ------------------------------------------------------------------- boot */

let currentAdapter = null;

async function boot() {
  currentAdapter = pickAdapter();
  console.log('[AI Model Router] boot; site adapter =', currentAdapter?.id || 'none', 'url =', location.href);
  if (!currentAdapter) return; // not one of our sites

  settings = await getSettings();

  // React to settings changes live (per-site toggle, auto mode, mappings).
  onSettingsChanged((next) => {
    settings = next;
    if (!currentAdapter) return;
    if (!settings.siteEnabled?.[currentAdapter.id]) {
      teardown();
    } else if (!isButtonPresent()) {
      tryInject(currentAdapter);
    } else {
      applyAutoMode(currentAdapter); // toggle auto wiring on the fly
    }
  });

  watchNavigation(() => {
    // Route changed — the old composer may be gone. Tear down and re-inject.
    teardown();
    tryInject(currentAdapter);
  });

  tryInject(currentAdapter);
}

boot().catch((err) => console.error('[AI Model Router] boot failed:', err));
