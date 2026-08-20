// router.js — orchestrates a single "route and send" cycle. Owns none of the
// DOM specifics (adapter) nor the settings I/O (storage); it wires them together
// and enforces the product principles:
//   1. Never lose the prompt (we never clear the input).
//   2. Never switch silently (always a toast).
//   3. Degrade gracefully (any failure still sends).

import { classify } from './classifier.js';
import { showToast } from './ui.js';
import { STRINGS, reasonForCategory } from '../shared/strings.js';
import { resolveTierModel } from '../adapters/adapter.types.js';
import { isBlank } from './dom-utils.js';

/**
 * @param {object} deps
 * @param {import('../adapters/adapter.types.js').SiteAdapter} deps.adapter
 * @param {() => import('../shared/config.js').StoredSettings} deps.getSettings
 * @param {{ setState:(s:string)=>void, shake:()=>void }} deps.button
 */
export function createRouter({ adapter, getSettings, button }) {
  let busy = false;

  /** Resolve which modelKey a given prompt should route to on this site. */
  function decide(promptText) {
    const settings = getSettings();
    const { category, signals } = classify(promptText);
    const tier = settings.categoryTier[category] || 'balanced';
    const override = settings.tierModel?.[adapter.id];
    const modelKey = resolveTierModel(adapter, tier, override);
    return { category, signals, tier, modelKey };
  }

  /**
   * Full Smart Send cycle. Never throws.
   * @param {{ forceModelKey?: string }} [opts]
   */
  async function routeAndSend(opts = {}) {
    if (busy) return;
    const promptText = adapter.getPromptText();

    if (isBlank(promptText)) {
      button.shake();
      showToast({ message: STRINGS.toast.emptyPrompt, variant: 'warn', duration: 2000 });
      return;
    }

    busy = true;
    try {
      button.setState('classifying');

      // Manual override path skips classification.
      let category = null;
      let signals = [];
      let targetKey = opts.forceModelKey || null;
      if (!targetKey) {
        const d = decide(promptText);
        category = d.category;
        signals = d.signals;
        targetKey = d.modelKey;
      }

      const targetDef = targetKey ? adapter.models[targetKey] : null;
      const reason = category ? reasonForCategory(category) : null;

      // No resolvable target (adapter has no model for the tier) → just send.
      if (!targetDef) {
        await adapter.send();
        showToast({
          message: STRINGS.toast.switchFailed,
          variant: 'warn',
        });
        return;
      }

      // Read current model; skip the switch if we're already there.
      const currentLabel = await adapter.getCurrentModel();
      const alreadyThere = currentLabel &&
        targetDef.matchers.some((re) => re.test(currentLabel));

      let switched = false;
      let previousLabel = currentLabel;

      if (!alreadyThere) {
        button.setState('switching');
        switched = await adapter.selectModel(targetKey);
        if (!switched) {
          // Failure path: send anyway with current model. Honest toast, no undo.
          button.setState('idle');
          await adapter.send();
          showToast({
            message: STRINGS.toast.switchFailedNamed(targetDef.label),
            variant: 'warn',
          });
          return;
        }
      }

      // Send.
      button.setState('idle');
      const sent = await adapter.send();
      if (!sent) {
        // Couldn't click send — leave prompt intact, tell the user.
        showToast({ message: STRINGS.toast.switchFailed, variant: 'warn' });
        return;
      }

      // Success toast.
      if (alreadyThere) {
        showToast({ message: STRINGS.toast.alreadyOn(targetDef.label, reason) });
      } else {
        // Offer undo → restore previous model for the NEXT message.
        const prevKey = findModelKeyByLabel(adapter, previousLabel);
        const undoLabel = prevKey
          ? STRINGS.toast.undo(adapter.models[prevKey].label)
          : null;
        showToast({
          message: STRINGS.toast.switchedTo(targetDef.label, reason),
          undoLabel,
          onUndo: prevKey
            ? async () => {
                const ok = await adapter.selectModel(prevKey);
                showToast({
                  message: ok
                    ? STRINGS.toast.undoDone(adapter.models[prevKey].label)
                    : STRINGS.toast.switchFailed,
                  variant: ok ? 'info' : 'warn',
                  duration: 2500,
                });
              }
            : null,
        });
      }
    } catch (err) {
      console.error('[AI Model Router] routeAndSend error:', err);
      // Last-ditch: try to send so the user isn't stuck. Prompt stays intact.
      try { await adapter.send(); } catch (_) { /* noop */ }
    } finally {
      button.setState('idle');
      busy = false;
    }
  }

  return { routeAndSend, decide, isBusy: () => busy };
}

/** Best-effort reverse lookup: a display label → our modelKey. */
function findModelKeyByLabel(adapter, label) {
  if (!label) return null;
  for (const [key, def] of Object.entries(adapter.models)) {
    if (def.matchers.some((re) => re.test(label))) return key;
  }
  return null;
}
