// Grounds an analysis in real, current web sources using Gemini's built-in
// Google Search tool. Runs once per analysis and returns:
//   { brief, sources: [{ title, url }] }
// The brief is fed to every domain agent (so their content is grounded), and the
// sources are shown to the user as citations. Fails soft — returns null if
// grounding is unavailable, and the analysis proceeds ungrounded.

import { GoogleGenAI } from '@google/genai';

const ENABLED = process.env.ENABLE_GROUNDING !== 'false';

let _ai = null;
function gemini() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('grounding timed out')), ms)),
  ]);
}

// Dedupe sources by URL, cap the count, drop Google redirect noise where possible.
function normalizeSources(chunks) {
  const seen = new Set();
  const out = [];
  for (const c of chunks || []) {
    const url = c?.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: c.web.title || url, url });
    if (out.length >= 8) break;
  }
  return out;
}

export async function gatherSources(mode, query) {
  if (!ENABLED) return null;
  const ai = gemini();
  if (!ai) return null;

  const subject =
    mode === 'sector'
      ? `the "${query}" sector/industry`
      : `the company "${query}"`;

  const prompt = `Research ${subject} using up-to-date web sources and write a concise factual briefing (under 250 words). Cover: what it is; scale (revenue, market size, users, or valuation); key players/competitors; and the most notable recent developments (prefer 2024-2025). State figures with their approximate date. Plain prose, no headings.`;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Retry transient overload/rate errors a couple of times before giving up.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] },
        }),
        25000
      );

      const brief = (res.text || '').trim();
      const meta = res.candidates?.[0]?.groundingMetadata;
      const sources = normalizeSources(meta?.groundingChunks);

      if (!brief && sources.length === 0) return null;
      return { brief, sources };
    } catch (err) {
      const msg = String(err.message || '');
      const transient = /\b(503|429|500)\b|high demand|overloaded|UNAVAILABLE|timed out/i.test(msg);
      if (!transient || attempt === 2) {
        console.error(`[grounding] failed: ${msg.slice(0, 120)}`);
        return null;
      }
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}
