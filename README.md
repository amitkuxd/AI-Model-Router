# AI Model Router

A Chrome extension that adds a **Smart Send** (✨) button inside **claude.ai**,
**chatgpt.com**, and **grok.com**. Click it and the extension:

1. reads your typed prompt,
2. classifies the task **locally** (rule-based, no network, no API keys),
3. switches the site's own model picker to the best model for that task, and
4. sends the prompt — all inside the site's native UI.

Every automatic switch shows a toast explaining **what** was picked and **why**,
with an **Undo**. If anything fails (site redesign, model unavailable), it falls
back to a normal send with the current model and tells you — it never blocks you
from sending and never erases your prompt.

> **Working name.** Rename before any Chrome Web Store listing — "AI Model
> Switcher" already exists.

---

## Status: selectors need filling

The full extension is built and runs end-to-end, **but each site's DOM selectors
are intentionally left as placeholders** (`__amr_todo_fill_me__`) — a valid CSS
selector that matches nothing. This is deliberate: selectors are the one part
that must come from live inspection of each site rather than guesswork, because
that's where extensions break.

Until you fill them, the extension loads cleanly and does nothing visible (no
broken button). Once you paste real selectors into the `SELECTORS` block of an
adapter, that site works.

### How to fill selectors (per site)

1. Open the site (e.g. `claude.ai`), open DevTools (F12) → **Elements**.
2. Inspect these four things and note a **stable** selector for each
   (prefer `aria-label`, `data-testid`, `role`, or stable text — **never**
   hashed classes like `.css-1a2b3c`):
   - the prompt composer (`inputEl`)
   - the native send button (`sendButton`)
   - the model-picker button that shows the current model (`modelPickerButton`)
   - the container the Smart Send button should sit in (`buttonMount`)
3. Open the matching file in `src/adapters/` (`claude.js`, `chatgpt.js`,
   `grok.js`) and replace the `PLACEHOLDER` values in the `SELECTORS` block at
   the top. The example in each comment shows the expected shape.
4. Check the `models` map's `matchers` regexes match the model names as they
   appear in that site's picker menu; adjust if needed.
5. Reload the extension (see below) and test.

**That `SELECTORS` block is the only thing you edit after a site redesign.** All
logic lives outside it.

---

## Load it in Chrome (development)

The extension is plain JS with no build step.

1. Get these files onto your computer (clone the repo, or download the ZIP from
   GitHub → **Code** → **Download ZIP** and unzip).
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select this folder (the one with `manifest.json`).
5. Open `claude.ai` / `chatgpt.com` / `grok.com`. Pin the extension via the 🧩
   icon to reach its **Options** page.

**After editing files:** return to `chrome://extensions` and click the **↻
reload** icon on the extension card, then refresh the site tab.

**Debugging:** on the extension card, "Inspect views: service worker" opens the
background console; right-click the injected button → Inspect for content-script
logs.

---

## Settings (Options page)

- **Auto mode** (off by default): also route when you press the native Send
  button or Enter, not just the Smart Send button.
- **Sites**: enable/disable per site.
- **Category → tier**: map each task category to a tier (`fast` / `balanced` /
  `max`).
- **Tier → model (per site)**: pick which concrete model each tier means on each
  site.
- **Reset to defaults**.

Settings persist to `chrome.storage.sync` and follow your signed-in Chrome
profile across devices.

---

## How routing works

The classifier outputs a **category**; settings map category → **tier**; each
adapter maps tier → a concrete **model** that exists on that site. This
indirection means model renames never require code changes — just remap in
Options.

| Category | Fires on | Default tier |
|---|---|---|
| `coding` | code fences, or ≥2 code keywords | balanced |
| `reasoning` | analyze/compare/plan/tradeoffs…, or prompts > 150 words | max |
| `writing` | write/draft/email/summarize/translate… | balanced |
| `creative` | story/poem/brainstorm/name for… | balanced |
| `quick` | short (<15 words) question-shaped prompts | fast |
| `default` | none of the above | balanced |

Evaluation is specific→generic; a code fence forces `coding` regardless of length.

---

## Project layout

```
manifest.json          MV3 manifest — permissions: storage only
src/
  bootstrap.js         classic content script → dynamic-imports main.js as a module
  background.js        service worker: seeds default settings
  content/
    main.js            entry: detect site, inject button, SPA re-inject, auto mode
    classifier.js      pure (promptText) => { category, confidence, signals }
    classifier.test.js dependency-free test runner (npm test)
    router.js          classify → switch → send → toast orchestration
    ui.js              Smart Send button, toast, override menu (all shadow DOM)
    dom-utils.js       waitForElement, simulateClick, dispatchReactInput, …
  adapters/
    adapter.types.js   the SiteAdapter contract + tier/model resolvers
    claude.js          ← fill SELECTORS
    chatgpt.js         ← fill SELECTORS
    grok.js            ← fill SELECTORS
  options/             settings page (options.html + options.js)
  shared/
    config.js          categories, tiers, defaults
    storage.js         chrome.storage.sync wrapper
    strings.js         all user-facing copy
icons/                 generated ✨ icons
```

## Privacy

- **Permissions:** `storage` only. No `tabs`, no host permissions beyond the
  three site matches, no network permissions.
- **Zero network requests.** All classification is local. Verify in DevTools →
  Network.

## Tests

```
npm test        # runs the classifier test suite (node, no dependencies)
```

## Not in v1 (future hooks noted in code)

AI-based classification (`classifyWithAI` stub exists), cross-site routing,
analytics/telemetry (none — by design), Firefox/Safari ports.

## License

MIT
