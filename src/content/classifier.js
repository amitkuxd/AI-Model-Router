// classifier.js — pure, DOM-free, network-free prompt classifier.
//
// classify(promptText) => { category, confidence, signals[] }
//
// Evaluation order is specific→generic: coding → reasoning → writing →
// creative → quick → default. The first category whose rule fires wins, EXCEPT
// that a code fence forces `coding` regardless of length (so a long code prompt
// never leaks into `reasoning`).
//
// v2 hook: `classifyWithAI(promptText)` can be dropped in behind this exact
// signature (return the same shape) to swap rule-based for model-based routing.

const CODE_FENCE = /```|~~~/;
const CODE_KEYWORDS = [
  /\bfunction\b/i, /\bdebug\b/i, /\berror\b/i, /\bbug\b/i, /\brefactor\b/i,
  /\bcomponent\b/i, /\bAPI\b/i, /\bregex\b/i, /\bcss\b/i, /\bjs\b/i,
  /\bjavascript\b/i, /\btypescript\b/i, /\bpython\b/i, /\bjava\b/i, /\bc\+\+\b/i,
  /\bstack ?trace\b/i, /\bcompile\b/i, /\bexception\b/i, /\bnull ?pointer\b/i,
  /\bsyntax\b/i, /\bendpoint\b/i, /\bquery\b/i, /\bSQL\b/i, /\bterminal\b/i,
  /\bnpm\b/i, /\bgit\b/i, /[{};]\s*$/m, /=>/, /\bconsole\.log\b/i,
];
const REASONING_KEYWORDS = [
  /\banalyze\b/i, /\banalysis\b/i, /\bcompare\b/i, /\bcomparison\b/i, /\bplan\b/i,
  /\bstrategy\b/i, /\barchitecture\b/i, /\btrade[- ]?offs?\b/i, /\bstep by step\b/i,
  /\bthink through\b/i, /\bpros and cons\b/i, /\breason\b/i, /\bevaluate\b/i,
  /\bdecide\b/i, /\bframework\b/i, /\bimplications?\b/i, /\bwhy\b.*\bbetter\b/i,
];
const WRITING_KEYWORDS = [
  /\bwrite\b/i, /\bdraft\b/i, /\brewrite\b/i, /\bemail\b/i, /\bblog\b/i,
  /\bcaption\b/i, /\bcopy\b/i, /\btone\b/i, /\bsummar(y|ize|ise)\b/i,
  /\btranslate\b/i, /\bproofread\b/i, /\bessay\b/i, /\bparagraph\b/i,
  /\bheadline\b/i, /\bnewsletter\b/i,
];
const CREATIVE_KEYWORDS = [
  /\bstory\b/i, /\bpoem\b/i, /\bbrainstorm\b/i, /\bideas?\b/i, /\bimagine\b/i,
  /\bname(s)? for\b/i, /\bslogan\b/i, /\blyrics?\b/i, /\bcharacter\b/i,
  /\bplot\b/i, /\bfiction\b/i,
];
const QUICK_STARTERS = /^(what|who|when|where|how much|how many|is|are|does|do|can|which)\b/i;

/** Count how many patterns in a list match the text. */
function countMatches(text, patterns) {
  let n = 0;
  const hits = [];
  for (const re of patterns) {
    if (re.test(text)) {
      n++;
      hits.push(re);
    }
  }
  return { n, hits };
}

/** Word count (whitespace-split, empties removed). */
function wordCount(text) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * @param {string} promptText
 * @returns {{category: string, confidence: number, signals: string[]}}
 */
export function classify(promptText) {
  const text = (promptText || '').trim();
  const signals = [];

  if (!text) {
    return { category: 'default', confidence: 0, signals: ['empty'] };
  }

  const words = wordCount(text);
  const hasCodeFence = CODE_FENCE.test(text);
  const coding = countMatches(text, CODE_KEYWORDS);

  // --- coding (fence forces it; else need >=2 keyword hits) ---
  if (hasCodeFence) {
    signals.push('code fence');
    return { category: 'coding', confidence: 0.95, signals };
  }
  if (coding.n >= 2) {
    signals.push(`code keywords (${coding.n})`);
    return { category: 'coding', confidence: 0.75, signals };
  }

  // --- reasoning (keyword match, or a long prompt) ---
  const reasoning = countMatches(text, REASONING_KEYWORDS);
  if (reasoning.n >= 1) {
    signals.push('analytical keywords');
    return { category: 'reasoning', confidence: 0.7, signals };
  }
  if (words > 150) {
    signals.push(`long prompt (${words} words)`);
    return { category: 'reasoning', confidence: 0.6, signals };
  }

  // --- writing ---
  const writing = countMatches(text, WRITING_KEYWORDS);
  if (writing.n >= 1) {
    signals.push('writing keywords');
    return { category: 'writing', confidence: 0.7, signals };
  }

  // --- creative ---
  const creative = countMatches(text, CREATIVE_KEYWORDS);
  if (creative.n >= 1) {
    signals.push('creative keywords');
    return { category: 'creative', confidence: 0.65, signals };
  }

  // --- quick (short + question-shaped, no code) ---
  const isShort = words < 15;
  const looksLikeQuestion = text.endsWith('?') || QUICK_STARTERS.test(text);
  if (isShort && looksLikeQuestion) {
    signals.push('short question');
    return { category: 'quick', confidence: 0.6, signals };
  }

  // --- default ---
  signals.push('no strong signal');
  return { category: 'default', confidence: 0.3, signals };
}

/**
 * v2 hook — not implemented in v1. Kept so a model-based classifier can be
 * swapped in behind the same signature without touching callers.
 * @param {string} promptText
 * @returns {Promise<{category: string, confidence: number, signals: string[]}>}
 */
export async function classifyWithAI(promptText) {
  // Future: call a small classifier model. For now, defer to rules.
  return classify(promptText);
}
