// Agent definitions: the 12 value-chain domain agents plus framing + synthesis.
// Domain agents are distributed round-robin across the three free providers so
// no single free tier absorbs all calls at once.

import { DOMAINS, emptySlice } from '../config/schema.js';

// Ordered pool of free-tier models. When a model hits a limit (429/413/quota),
// callModel automatically advances to the next entry — so one exhausted free tier
// never fails an agent as long as another has budget. Distributed across providers
// so per-provider per-minute caps don't all trip at once.
export const MODEL_POOL = [
  { provider: 'groq', model: 'llama-3.1-8b-instant' },
  { provider: 'huggingface', model: 'meta-llama/Llama-3.1-8B-Instruct' },
  { provider: 'huggingface', model: 'Qwen/Qwen2.5-7B-Instruct' },
  { provider: 'huggingface', model: 'mistralai/Mistral-7B-Instruct-v0.3' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'gemini', model: 'gemini-2.5-flash' },
];

// Candidate list starting at a given pool index, wrapping around — so different
// agents begin on different models (spreading load) but can fail over to any other.
export function candidatesFrom(startIndex) {
  const n = MODEL_POOL.length;
  return Array.from({ length: n }, (_, i) => MODEL_POOL[(startIndex + i) % n]);
}

// Convenience: candidates that prefer a specific provider first.
export function candidatesPreferring(provider) {
  const idx = Math.max(0, MODEL_POOL.findIndex((m) => m.provider === provider));
  return candidatesFrom(idx);
}

const DOMAIN_SYSTEM = `You are a top-tier strategy consultant and MBA case-interview coach with deep expertise in one specific area of the Tech + Business Value Chain. Rules:
1. Fill EVERY field with 1-3 sentences, specific and grounded in what is actually known — no generic boilerplate.
2. If a figure or fact is uncertain or estimated, add the label "(estimated)" rather than stating it as confirmed fact.
3. Respond with ONLY a valid JSON object matching the requested shape. No markdown fences, no preamble, no trailing commentary — just raw JSON.`;

// Optional country scope applies to sector analysis only.
function geoSuffix(mode, country) {
  return mode === 'sector' && country && country !== 'Global' ? ` in ${country}` : '';
}

function subjectClause(mode, query, country) {
  const geo = geoSuffix(mode, country);
  return mode === 'sector'
    ? `the "${query}" sector/industry${geo} (analyze the industry${geo ? ` as it operates${geo}` : ''}, its structure and representative players — not a single company)`
    : `the company "${query}"`;
}

// Build one domain agent from a DOMAINS entry. `startIndex` seeds which pool
// model it begins on; it can fail over to any other model in the pool.
function makeDomainAgent(domain, startIndex) {
  const candidates = candidatesFrom(startIndex);
  return {
    key: domain.key,
    label: domain.label,
    kind: 'domain',
    fields: domain.fields,
    candidates,
    provider: candidates[0].provider, // starting provider (for the UI plan/badge)
    model: candidates[0].model,
    system: DOMAIN_SYSTEM,
    buildPrompt(mode, query, framing, country) {
      const shape = JSON.stringify(emptySlice(domain), null, 2);
      return `Analyze ${subjectClause(mode, query, country)} for the "${domain.label}" dimension only.

Shared context established for this analysis:
${framing || '(none)'}

Fill in every field of this JSON object with 1-3 sentences specific to ${query}${geoSuffix(mode, country)}. Use "(estimated)" for any uncertain figures. Return ONLY the completed JSON object:

${shape}`;
    },
  };
}

// Priority order — when the user picks "N domains", we run the top N most
// decision-relevant dimensions first.
const DOMAIN_PRIORITY = [
  'strategyAndMarket',
  'competition',
  'businessModel',
  'financials',
  'techValueChain',
  'risksAndFuture',
  'aiInnovationAndAdoption',
  'customerAndService',
  'salesAndMarketing',
  'operations',
  'distribution',
  'supplyAndInput',
];

const orderedDomains = DOMAIN_PRIORITY.map((k) => DOMAINS.find((d) => d.key === k)).filter(Boolean);

// All 12 domain agents, priority-ordered. The orchestrator slices this to the
// user-requested count. Each starts on a different pool model to spread load.
export const DOMAIN_AGENTS = orderedDomains.map((d, i) =>
  makeDomainAgent(d, i % MODEL_POOL.length)
);

// ── Classifier agent (runs first) ──────────────────────────────────────────
// Decides whether the query is a specific company or a whole sector, so we can
// block a mode mismatch (e.g. "EV charging" entered in Company mode).
export const CLASSIFIER_AGENT = {
  key: 'classifier',
  candidates: candidatesPreferring('groq'),
  system:
    'You classify a search query. Respond with ONLY a valid JSON object — no prose, no markdown fences.',
  buildPrompt(query) {
    return `Classify the query below as either:
- "company": one specific, named business or organization (e.g. Apple, Stripe, TSMC, OpenAI, Figma).
- "sector": an industry, market, or category spanning many companies (e.g. EV charging, cloud infrastructure, fintech, semiconductors).

Query: "${query}"

Respond ONLY with this JSON: {"type":"company"|"sector","confidence":0.0-1.0,"reason":"<=8 words"}`;
  },
};

// ── Framing agent (runs first) ─────────────────────────────────────────────
// On Groq: Gemini's free tier (20/day) is too small to reliably carry the
// framing + synthesis calls. Falls back to Gemini if GROQ_API_KEY is absent.
export const FRAMING_AGENT = {
  key: 'framing',
  label: 'Framing',
  kind: 'framing',
  candidates: candidatesPreferring('groq'),
  system:
    'You are a strategy consultant setting up a structured analysis. Respond with a tight, factual briefing in plain prose (no JSON, no markdown headings). Keep it under 180 words.',
  buildPrompt(mode, query, country) {
    const geo = geoSuffix(mode, country);
    return mode === 'sector'
      ? `Establish shared context for a strategic analysis of the "${query}" sector${geo}. In under 180 words, state: (1) a one-line definition of the sector and its boundaries${geo ? ` ${geo}` : ''}, (2) its main sub-segments, (3) 4-6 representative players${geo ? ` active${geo}` : ''}, (4) rough market size and growth${geo ? ` ${geo}` : ''} (label estimates "(estimated)"). This briefing will be handed to specialist analysts.`
      : `Establish shared context for a strategic analysis of the company "${query}". In under 180 words, state: (1) a one-line description of what the company does, (2) the sector it competes in, (3) 4-6 primary competitors, (4) rough scale — revenue / users / valuation (label estimates "(estimated)"). This briefing will be handed to specialist analysts.`;
  },
};

// ── Synthesis agent (runs last) ────────────────────────────────────────────
export const SYNTHESIS_AGENT = {
  key: 'synthesis',
  label: 'Strategic Synthesis',
  kind: 'synthesis',
  candidates: candidatesPreferring('groq'),
  system:
    'You are a senior strategy partner delivering an executive synthesis. Respond with ONLY a valid JSON object in the exact shape requested — no markdown fences, no preamble.',
  buildPrompt(mode, query, mergedAnalysisJson, country) {
    const shape = JSON.stringify(
      {
        executiveSummary: '',
        keyStrengths: ['', '', ''],
        keyWeaknesses: ['', '', ''],
        strategicRecommendations: ['', '', ''],
        keyQuestionsForDiligence: ['', '', ''],
      },
      null,
      2
    );
    return `You have received specialist analyses of ${subjectClause(
      mode,
      query,
      country
    )} across the full value chain. Synthesize them into an executive strategic assessment.

Full analysis (JSON):
${mergedAnalysisJson}

Produce ONLY this JSON object, grounded in the analysis above (3-5 items per array; executiveSummary 3-5 sentences):

${shape}`;
  },
};

// ── Business Model Canvas agent ────────────────────────────────────────────
// Fills the nine Osterwalder building blocks for a company.
export const CANVAS_BLOCKS = [
  'keyPartners',
  'keyActivities',
  'keyResources',
  'valuePropositions',
  'customerRelationships',
  'channels',
  'customerSegments',
  'costStructure',
  'revenueStreams',
];

export const CANVAS_AGENT = {
  key: 'canvas',
  candidates: candidatesPreferring('groq'),
  system:
    'You are a business strategy expert building a Business Model Canvas (Osterwalder & Pigneur). Respond with ONLY a valid JSON object — no prose, no markdown fences.',
  buildPrompt(query) {
    const shape = JSON.stringify(Object.fromEntries(CANVAS_BLOCKS.map((k) => [k, []])), null, 2);
    return `Build a Business Model Canvas for the company "${query}". For EACH of the nine blocks, give 2-4 concise, specific bullet points (short phrases, not full sentences) grounded in what is actually known about ${query}. Label a point "(estimated)" only if uncertain. Return ONLY this JSON object (each value an array of strings):

${shape}`;
  },
};
