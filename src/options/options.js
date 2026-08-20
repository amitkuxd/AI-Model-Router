// options.js — settings UI. Reads/writes chrome.storage.sync via the shared
// storage module and renders controls from config + the live adapter model lists.

import { getSettings, setSettings } from '../shared/storage.js';
import { defaultSettings, CATEGORIES, SITES, TIERS } from '../shared/config.js';
import { STRINGS } from '../shared/strings.js';
import { modelsByTier } from '../adapters/adapter.types.js';

import claudeAdapter from '../adapters/claude.js';
import chatgptAdapter from '../adapters/chatgpt.js';
import grokAdapter from '../adapters/grok.js';

const ADAPTERS = { claude: claudeAdapter, chatgpt: chatgptAdapter, grok: grokAdapter };

let settings = defaultSettings();

const $ = (id) => document.getElementById(id);

/* --------------------------------------------------------------- rendering */

function renderStatic() {
  $('autoModeLabel').textContent = STRINGS.options.autoModeLabel;
  $('autoModeHelp').textContent = STRINGS.options.autoModeHelp;
}

function renderAutoMode() {
  $('autoMode').checked = !!settings.autoMode;
}

function renderSites() {
  const root = $('sites');
  root.innerHTML = '';
  for (const [id, meta] of Object.entries(SITES)) {
    const row = document.createElement('div');
    row.className = 'row';
    const left = document.createElement('div');
    left.innerHTML = `<div class="label">${meta.label}</div>`;
    const label = document.createElement('label');
    label.className = 'switch';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = settings.siteEnabled[id] !== false;
    cb.addEventListener('change', () => {
      settings.siteEnabled[id] = cb.checked;
      save();
    });
    const slider = document.createElement('span');
    slider.className = 'slider';
    label.append(cb, slider);
    row.append(left, label);
    root.appendChild(row);
  }
}

function renderMapping() {
  const root = $('mapping');
  root.innerHTML = '';
  const cats = Object.entries(CATEGORIES).sort((a, b) => a[1].order - b[1].order);
  for (const [cat, meta] of cats) {
    const row = document.createElement('div');
    row.className = 'row';
    const left = document.createElement('div');
    left.innerHTML = `<div class="label">${meta.label}</div>`;
    const sel = document.createElement('select');
    for (const tier of TIERS) {
      const opt = document.createElement('option');
      opt.value = tier;
      opt.textContent = tier;
      if (settings.categoryTier[cat] === tier) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      settings.categoryTier[cat] = sel.value;
      save();
    });
    row.append(left, sel);
    root.appendChild(row);
  }
}

function renderTierModel() {
  const root = $('tierModel');
  root.innerHTML = '';
  for (const [siteId, adapter] of Object.entries(ADAPTERS)) {
    const block = document.createElement('div');
    block.className = 'site-block';
    const h = document.createElement('h3');
    h.textContent = SITES[siteId]?.label || siteId;
    block.appendChild(h);

    const byTier = modelsByTier(adapter);
    for (const tier of TIERS) {
      const row = document.createElement('div');
      row.className = 'row';
      const left = document.createElement('div');
      left.innerHTML = `<div class="label">${tier}</div>`;
      const sel = document.createElement('select');
      const options = byTier[tier] && byTier[tier].length
        ? byTier[tier]
        : Object.entries(adapter.models).map(([key, def]) => ({ key, label: def.label }));
      for (const { key, label } of options) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = label;
        const current = settings.tierModel?.[siteId]?.[tier] || adapter.defaultTierModel[tier];
        if (current === key) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => {
        settings.tierModel[siteId] = settings.tierModel[siteId] || {};
        settings.tierModel[siteId][tier] = sel.value;
        save();
      });
      row.append(left, sel);
      block.appendChild(row);
    }
    root.appendChild(block);
  }
}

function renderAll() {
  renderStatic();
  renderAutoMode();
  renderSites();
  renderMapping();
  renderTierModel();
}

/* ------------------------------------------------------------------ save */

let savedTimer = null;
async function save() {
  await setSettings(settings);
  const el = $('saved');
  el.classList.add('show');
  if (savedTimer) clearTimeout(savedTimer);
  savedTimer = setTimeout(() => el.classList.remove('show'), 1200);
}

/* ------------------------------------------------------------------ init */

$('autoMode').addEventListener('change', (e) => {
  settings.autoMode = e.target.checked;
  save();
});

$('reset').addEventListener('click', async () => {
  settings = defaultSettings();
  await save();
  renderAll();
});

(async () => {
  settings = await getSettings();
  renderAll();
})();
