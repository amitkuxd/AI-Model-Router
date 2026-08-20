// bootstrap.js — classic content script whose only job is to load the ES-module
// entry point. MV3 content scripts run as classic scripts and cannot use static
// `import`, but a dynamic import() of an extension-URL module works and gives the
// rest of the codebase full ES-module semantics (import/export across files).
//
// Everything else in src/ is a real ES module. This is the one exception.
(async () => {
  try {
    const url = chrome.runtime.getURL('src/content/main.js');
    await import(url);
  } catch (err) {
    // Never throw into the page. A failed load must be silent to the user.
    console.error('[AI Model Router] failed to load main module:', err);
  }
})();
