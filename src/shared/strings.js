// strings.js — every user-facing string in one place for later copy polish.
// No logic here. Functions are formatters only.

export const STRINGS = {
  button: {
    tooltip: 'Smart Send — picks the right model',
    ariaLabel: 'Smart Send',
  },
  toast: {
    // switchedTo('Haiku', 'quick question') => "Switched to Haiku · quick question"
    switchedTo: (modelLabel, reason) =>
      `Switched to ${modelLabel}${reason ? ` · ${reason}` : ''}`,
    // Already on the target model, so no switch happened.
    alreadyOn: (modelLabel, reason) =>
      `Kept ${modelLabel}${reason ? ` · ${reason}` : ''}`,
    // Picker not found / target unavailable — we sent anyway.
    switchFailed: "Couldn't switch models — sent with current model",
    switchFailedNamed: (modelLabel) =>
      `${modelLabel} isn't available here — sent with current model`,
    undo: (prevLabel) => `Switch back to ${prevLabel}`,
    undoDone: (prevLabel) => `Model set back to ${prevLabel} for your next message`,
    emptyPrompt: 'Type a prompt first',
  },
  reasons: {
    coding: 'code detected',
    reasoning: 'deep analysis',
    writing: 'writing task',
    creative: 'creative task',
    quick: 'quick question',
    default: 'general prompt',
  },
  options: {
    title: 'AI Model Router — Settings',
    autoModeLabel: 'Auto mode',
    autoModeHelp:
      'When on, the extension also routes when you press the native Send button or Enter — not just the Smart Send button. Off by default.',
    resetButton: 'Reset to defaults',
    perSiteHeading: 'Sites',
    mappingHeading: 'Category → tier',
    tierModelHeading: 'Tier → model (per site)',
  },
};

/** Plain-language reason string for a classifier category. */
export function reasonForCategory(category) {
  return STRINGS.reasons[category] || STRINGS.reasons.default;
}
