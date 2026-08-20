// dom-utils.js — promise-based DOM helpers used by adapters and UI.
// No site-specific selectors live here — only generic mechanics.

/**
 * Resolve when selectorFn() returns a truthy element, polling via MutationObserver.
 * Resolves null on timeout (never rejects) so callers use a simple falsy check.
 *
 * @template T
 * @param {() => T|null|undefined} selectorFn  called immediately and on each mutation
 * @param {number} [timeoutMs=3000]
 * @param {ParentNode} [root=document]
 * @returns {Promise<T|null>}
 */
export function waitForElement(selectorFn, timeoutMs = 3000, root = document) {
  return new Promise((resolve) => {
    let done = false;
    // Declare observer/timer BEFORE finish so the immediate-check path (which
    // calls finish before they're assigned) doesn't hit a temporal-dead-zone
    // error — that error was being swallowed and leaving the promise unresolved.
    let observer = null;
    let timer = null;
    const finish = (val) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (observer) observer.disconnect();
      resolve(val);
    };

    // Immediate check first — often already present.
    try {
      const now = selectorFn();
      if (now) return finish(now);
    } catch (_) {
      /* selectorFn must be forgiving; ignore and let the observer retry */
    }

    observer = new MutationObserver(() => {
      try {
        const el = selectorFn();
        if (el) finish(el);
      } catch (_) {
        /* ignore transient selector errors during DOM churn */
      }
    });
    observer.observe(root === document ? document.documentElement : root, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    timer = setTimeout(() => finish(null), timeoutMs);
  });
}

/**
 * Wait until predicate() is true, polling on a short interval (for state that
 * isn't a DOM insertion, e.g. a label's text changing). Resolves boolean.
 *
 * @param {() => boolean} predicate
 * @param {number} [timeoutMs=2000]
 * @param {number} [intervalMs=80]
 * @returns {Promise<boolean>}
 */
export function waitForCondition(predicate, timeoutMs = 2000, intervalMs = 80) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      let ok = false;
      try {
        ok = !!predicate();
      } catch (_) {
        ok = false;
      }
      if (ok) return resolve(true);
      if (Date.now() - start >= timeoutMs) return resolve(false);
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

/**
 * Dispatch a realistic click on React/Radix-style menu items. A plain .click()
 * frequently fails on these components because they listen on pointer/mouse
 * events, so we fire the full sequence.
 *
 * @param {HTMLElement} el
 */
export function simulateClick(el) {
  if (!el) return;
  const opts = { bubbles: true, cancelable: true, view: window };
  const pointerOpts = { ...opts, pointerId: 1, isPrimary: true };
  try {
    el.dispatchEvent(new PointerEvent('pointerover', pointerOpts));
    el.dispatchEvent(new PointerEvent('pointerenter', pointerOpts));
    el.dispatchEvent(new PointerEvent('pointerdown', pointerOpts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', pointerOpts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  } catch (_) {
    // Fallback to the native path if constructing synthetic events fails.
    try {
      el.click();
    } catch (_) {
      /* give up silently — caller verifies outcome */
    }
  }
}

/**
 * Set the value of a React-controlled input/textarea and fire an input event
 * the framework will notice. Uses the native value setter so React's internal
 * value tracker sees the change. For contenteditable composers, sets textContent
 * and dispatches a matching input event.
 *
 * @param {HTMLElement} el
 * @param {string} value
 */
export function dispatchReactInput(el, value) {
  if (!el) return;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // contenteditable
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
  }
}

/**
 * Dispatch an Enter keydown (used by some adapters as the send mechanism).
 * @param {HTMLElement} el
 * @param {object} [opts]  e.g. { shiftKey: false }
 */
export function pressEnter(el, opts = {}) {
  if (!el) return;
  const init = {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    ...opts,
  };
  el.dispatchEvent(new KeyboardEvent('keydown', init));
  el.dispatchEvent(new KeyboardEvent('keyup', init));
}

/** Trimmed, collapsed text content of an element (safe on null). */
export function textOf(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

/** True if a string is empty or only whitespace/newlines. */
export function isBlank(str) {
  return !str || !str.replace(/[\s ]+/g, '').length;
}
