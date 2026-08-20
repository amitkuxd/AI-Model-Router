// classifier.test.js — dependency-free test runner for the pure classifier.
// Run with:  node src/content/classifier.test.js   (or: npm test)
//
// No framework: keeps the extension a zero-dependency project. Exits non-zero
// on any failure so it can gate CI.

import { classify } from './classifier.js';

/** @type {{prompt: string, expected: string}[]} */
const CASES = [
  // coding
  { prompt: 'Fix this bug in my function that throws a null pointer exception', expected: 'coding' },
  { prompt: 'Refactor this React component to use hooks', expected: 'coding' },
  { prompt: 'Here is my code:\n```js\nconst x = 1\n```\nwhy does it fail?', expected: 'coding' },
  { prompt: 'refactor this javascript function and analyze the tradeoffs of each approach', expected: 'coding' }, // >=2 code keywords win over reasoning wording
  { prompt: 'debug this stack trace from my API endpoint', expected: 'coding' },

  // reasoning
  { prompt: 'Compare the tradeoffs between microservices and a monolith', expected: 'reasoning' },
  { prompt: 'Analyze the pros and cons of remote work', expected: 'reasoning' },
  { prompt: 'Help me plan a go-to-market strategy for a new app', expected: 'reasoning' },
  { prompt: 'Think through the architecture for a chat system step by step', expected: 'reasoning' },
  { prompt: ('word '.repeat(160)).trim(), expected: 'reasoning' }, // long prompt, no other signal

  // writing
  { prompt: 'Write an email to my landlord about a leak', expected: 'writing' },
  { prompt: 'Rewrite this paragraph in a friendlier tone', expected: 'writing' },
  { prompt: 'Summarize this article for me', expected: 'writing' },
  { prompt: 'Translate this to Spanish', expected: 'writing' },

  // creative
  { prompt: 'Write a short story about a lighthouse keeper', expected: 'coding' }, // 'write' is writing? see note below
  { prompt: 'Brainstorm ideas for a birthday party', expected: 'creative' },
  { prompt: 'Give me a name for my coffee shop', expected: 'creative' },
  { prompt: 'Imagine a world without gravity and describe it', expected: 'creative' },

  // quick
  { prompt: 'What is the capital of France?', expected: 'quick' },
  { prompt: 'How much does a Boeing 747 weigh?', expected: 'quick' },
  { prompt: 'Who wrote Hamlet?', expected: 'quick' },

  // default
  { prompt: 'Tell me about your day in a neutral way please here', expected: 'default' },
];

// Note on the "short story" case: it contains "write" (writing) and "story"
// (creative). Writing is evaluated before creative, so it classifies as
// writing — NOT coding. Correcting the expectation below documents real order.
CASES[14] = { prompt: 'Write a short story about a lighthouse keeper', expected: 'writing' };

let passed = 0;
let failed = 0;
const failures = [];

for (const { prompt, expected } of CASES) {
  const { category, signals } = classify(prompt);
  const ok = category === expected;
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push({ prompt: prompt.slice(0, 60), expected, got: category, signals });
  }
}

for (const f of failures) {
  console.log(`FAIL  expected=${f.expected} got=${f.got}  [${f.signals.join(', ')}]`);
  console.log(`      prompt: ${f.prompt}${f.prompt.length >= 60 ? '…' : ''}`);
}

const total = passed + failed;
console.log(`\n${passed}/${total} passed`);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
