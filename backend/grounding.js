// Grounds an analysis in real, current web sources — so the output cites
// verifiable references instead of just model knowledge. Returns:
//   { brief, sources: [{ title, url }], via }
//
// Provider order (first that succeeds wins):
//   1. Tavily  — dedicated search API, real source URLs, generous free tier.
//                Reliable and independent of Gemini's quota. (TAVILY_API_KEY)
//   2. Gemini Google Search grounding — fallback (GEMINI_API_KEY).
// Fails soft: returns null if neither is available, and the analysis proceeds
// ungrounded (no Sources panel).

import { GoogleGenAI } from '@google/genai';

const ENABLED = process.env.ENABLE_GROUNDING !== 'false';

function withTimeout(promise, ms, label = 'request') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
}

function subjectText(mode, query, country) {
  const geo = mode === 'sector' && country && country !== 'Global' ? ` in ${country}` : '';
  return mode === 'sector' ? `the "${query}" sector/industry${geo}` : `the company "${query}"`;
}

function searchQuery(mode, query, country) {
  const geo = mode === 'sector' && country && country !== 'Global' ? ` ${country}` : '';
  return mode === 'sector'
    ? `${query} industry${geo} market size key players trends 2024 2025`
    : `${query} company overview revenue business model competitors recent news`;
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

// ── 1. Tavily ──────────────────────────────────────────────────────────────
async function tavilySearch(mode, query, country) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;

  const res = await withTimeout(
    fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: searchQuery(mode, query, country),
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
    brief = (data.results || [])
      .slice(0, 4)
      .map((r) => r.content)
      .filter(Boolean)
      .join(' ')
      .slice(0, 1000);
  }

  if (!brief && sources.length === 0) return null;
  return { brief, sources, via: 'Tavily' };
}

// ── 2. Gemini Google Search grounding ──────────────────────────────────────
let _ai = null;
function gemini() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}

function geminiSources(chunks) {
  return dedupeSources((chunks || []).map((c) => ({ title: c?.web?.title, url: c?.web?.uri })));
}

async function geminiGrounding(mode, query, country) {
  const ai = gemini();
  if (!ai) return null;

  const prompt = `Research ${subjectText(mode, query, country)} using up-to-date web sources and write a concise factual briefing (under 250 words). Cover: what it is; scale (revenue, market size, users, or valuation); key players/competitors; and the most notable recent developments (prefer 2024-2025). State figures with their approximate date. Plain prose, no headings.`;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] },
        }),
        25000,
        'Gemini grounding'
      );
      const brief = (res.text || '').trim();
      const sources = geminiSources(res.candidates?.[0]?.groundingMetadata?.groundingChunks);
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

// ── Orchestration: try Tavily, then Gemini ─────────────────────────────────
export async function gatherSources(mode, query, country) {
  if (!ENABLED) return null;

  try {
    const t = await tavilySearch(mode, query, country);
    if (t) return t;
  } catch (err) {
    console.error(`[grounding:tavily] failed: ${String(err.message).slice(0, 120)}`);
  }

  return geminiGrounding(mode, query, country);
}
