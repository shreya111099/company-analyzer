// Grounds analysis in real, current web sources — so output cites verifiable
// references instead of just model knowledge. Returns { brief, sources, via }.
//
// Provider order (first that succeeds wins):
//   1. Tavily  — dedicated search API, real source URLs, generous free tier.
//   2. Gemini Google Search grounding — fallback.
// Fails soft: returns null if neither is available.

import { GoogleGenAI } from '@google/genai';

const ENABLED = process.env.ENABLE_GROUNDING !== 'false';

function withTimeout(promise, ms, label = 'request') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
}

function dedupeSources(list) {
  const seen = new Set();
  const out = [];
  for (const s of list) {
    if (!s?.url || seen.has(s.url)) continue;
    seen.add(s.url);
    out.push({ title: s.title || s.url, url: s.url });
    if (out.length >= 8) break;
  }
  return out;
}

// ── Tavily (search string in, {brief, sources} out) ────────────────────────
async function tavilyRaw(searchStr) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;

  const res = await withTimeout(
    fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: searchStr,
        search_depth: 'basic',
        include_answer: true,
        max_results: 6,
      }),
    }),
    15000,
    'Tavily'
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Tavily HTTP ${res.status}: ${body.slice(0, 120)}`);
  }

  const data = await res.json();
  const sources = dedupeSources((data.results || []).map((r) => ({ title: r.title, url: r.url })));
  let brief = String(data.answer || '').trim();
  if (!brief) {
    brief = (data.results || []).slice(0, 4).map((r) => r.content).filter(Boolean).join(' ').slice(0, 1000);
  }
  if (!brief && sources.length === 0) return null;
  return { brief, sources, via: 'Tavily' };
}

// ── Gemini Google Search grounding (prompt in, {brief, sources} out) ────────
let _ai = null;
function gemini() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}

async function geminiRaw(promptStr) {
  const ai = gemini();
  if (!ai) return null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: promptStr,
          config: { tools: [{ googleSearch: {} }] },
        }),
        25000,
        'Gemini grounding'
      );
      const brief = (res.text || '').trim();
      const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = dedupeSources((chunks || []).map((c) => ({ title: c?.web?.title, url: c?.web?.uri })));
      if (!brief && sources.length === 0) return null;
      return { brief, sources, via: 'Google Search' };
    } catch (err) {
      const msg = String(err.message || '');
      const transient = /\b(503|429|500)\b|high demand|overloaded|UNAVAILABLE|timed out/i.test(msg);
      if (!transient || attempt === 2) {
        console.error(`[grounding:gemini] failed: ${msg.slice(0, 120)}`);
        return null;
      }
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

// ── Queries / prompts ──────────────────────────────────────────────────────
function overviewQuery(mode, query, country) {
  const geo = mode === 'sector' && country && country !== 'Global' ? ` ${country}` : '';
  return mode === 'sector'
    ? `${query} industry${geo} market size key players latest trends 2025 2026`
    : `${query} company latest revenue 2025 business model competitors recent news 2025 2026`;
}

function overviewPrompt(mode, query, country) {
  const geo = mode === 'sector' && country && country !== 'Global' ? ` in ${country}` : '';
  const subject = mode === 'sector' ? `the "${query}" sector/industry${geo}` : `the company "${query}"`;
  return `Research ${subject} using up-to-date web sources and write a concise factual briefing (under 250 words). Prioritise the most recent information — the last ~2 years (2024-2026). Cover: what it is; latest scale (revenue, market size, users, or valuation); key players/competitors; and the most notable recent developments. State figures with their year. Plain prose, no headings.`;
}

function financialQuery(query) {
  return `${query} annual report 10-K revenue net income gross margin operating margin fiscal year 2024 2025 investor relations financial results`;
}

function financialPrompt(query) {
  return `Research the company "${query}" using its OFFICIAL financial disclosures only — most recent annual report / 10-K / 10-Q / audited statements / investor-relations releases. Summarise the latest reported figures: revenue, revenue growth, gross margin, operating margin, net margin, and market cap — each with its fiscal year (e.g. FY2024). Under 200 words, plain prose. Report only figures from official filings; if a figure is not disclosed, say so rather than guessing.`;
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function gatherSources(mode, query, country) {
  if (!ENABLED) return null;
  try {
    const t = await tavilyRaw(overviewQuery(mode, query, country));
    if (t) return t;
  } catch (err) {
    console.error(`[grounding:tavily] failed: ${String(err.message).slice(0, 120)}`);
  }
  return geminiRaw(overviewPrompt(mode, query, country));
}

// Financials grounded specifically in official/verified reports.
export async function gatherFinancialSources(query) {
  if (!ENABLED) return null;
  try {
    const t = await tavilyRaw(financialQuery(query));
    if (t) return t;
  } catch (err) {
    console.error(`[grounding:fin:tavily] failed: ${String(err.message).slice(0, 120)}`);
  }
  return geminiRaw(financialPrompt(query));
}
