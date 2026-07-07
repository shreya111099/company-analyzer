// Orchestrates a full multi-agent analysis:
//   1. framing agent   → shared context briefing
//   2. 12 domain agents → fanned out in parallel (concurrency-capped)
//   3. merge slices     → full analysis object
//   4. synthesis agent  → executive assessment
//
// Progress is reported through an `emit(event, data)` callback so the caller
// can stream it (SSE). One agent failing is non-fatal.

import pLimit from 'p-limit';
import { callModel, callModelStream } from './providers.js';
import { gatherSources } from './grounding.js';
import {
  DOMAIN_AGENTS,
  FRAMING_AGENT,
  SYNTHESIS_AGENT,
  CLASSIFIER_AGENT,
  candidatesPreferring,
} from './agents/registry.js';
import { FRAMEWORKS } from './config/frameworks.js';

// Kept modest so parallel calls stay under free-tier tokens-per-minute caps.
const CONCURRENCY = Number(process.env.AGENT_CONCURRENCY) || 3;

// Synthesis (executive summary card) is on by default — set ENABLE_SYNTHESIS=false
// to disable. Framing (a shared-context pre-step) stays opt-in via ENABLE_FRAMING=true
// since it adds an extra call before the fan-out.
const ENABLE_FRAMING = process.env.ENABLE_FRAMING === 'true';
const ENABLE_SYNTHESIS = process.env.ENABLE_SYNTHESIS !== 'false';

function stripMarkdownFences(text) {
  return String(text)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function parseJson(text) {
  const cleaned = stripMarkdownFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    // Salvage: grab the outermost {...} block if the model added stray prose.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Response was not valid JSON');
  }
}

// Models sometimes return executiveSummary as an array of sentences and the list
// fields as a single string. Coerce to the shapes the UI/PDF expect.
function normalizeSynthesis(s) {
  if (!s || typeof s !== 'object') return s;
  if (Array.isArray(s.executiveSummary)) s.executiveSummary = s.executiveSummary.join(' ');
  for (const k of ['keyStrengths', 'keyWeaknesses', 'strategicRecommendations', 'keyQuestionsForDiligence']) {
    if (typeof s[k] === 'string') s[k] = s[k] ? [s[k]] : [];
  }
  return s;
}

async function runAgent(agent, buildArgs) {
  const t0 = Date.now();
  console.error(`[agent] ${agent.key} → ${agent.candidates[0].provider} start`);
  try {
    const result = await callModel({
      candidates: agent.candidates,
      system: agent.system,
      prompt: agent.buildPrompt(...buildArgs),
      // Framing returns prose; every other agent must return strict JSON.
      jsonMode: agent.kind !== 'framing',
      timeoutMs: agent.kind === 'framing' ? 20000 : 30000,
    });
    console.error(`[agent] ${agent.key} done in ${Date.now() - t0}ms (${result.provider})`);
    return result; // { text, provider, model }
  } catch (err) {
    console.error(`[agent] ${agent.key} FAILED in ${Date.now() - t0}ms: ${err.message.slice(0, 120)}`);
    throw err;
  }
}

// Classify the query as company vs sector. Returns { type, confidence } or null
// if classification failed (in which case we fail open and proceed).
async function classifyQuery(query) {
  try {
    const r = await callModel({
      candidates: CLASSIFIER_AGENT.candidates,
      system: CLASSIFIER_AGENT.system,
      prompt: CLASSIFIER_AGENT.buildPrompt(query),
      jsonMode: true,
      timeoutMs: 12000,
      maxTokens: 128,
    });
    const parsed = parseJson(r.text);
    if (parsed?.type === 'company' || parsed?.type === 'sector') return parsed;
  } catch (err) {
    console.error(`[classifier] failed: ${err.message.slice(0, 100)}`);
  }
  return null;
}

export const MAX_DOMAINS = DOMAIN_AGENTS.length;

/**
 * @param {'sector'|'company'} mode
 * @param {string} query
 * @param {(event: string, data: object) => void} emit
 * @param {{domainCount?: number}} [options]
 * @returns {Promise<{analysis, synthesis, meta}>}
 */
export async function runAnalysis(mode, query, emit, options = {}) {
  const analysis = {};
  const meta = {}; // per-domain { provider, model, status }

  // Which domain agents to run. Prefer an explicit key list; fall back to a count
  // (priority-ordered) for back-compat.
  let agents;
  const keys = Array.isArray(options.domainKeys) ? options.domainKeys.filter(Boolean) : null;
  if (keys && keys.length) {
    const set = new Set(keys);
    agents = DOMAIN_AGENTS.filter((a) => set.has(a.key)); // keeps priority order
    if (agents.length === 0) agents = DOMAIN_AGENTS.slice(0, 4);
  } else {
    const requested = Number(options.domainCount);
    const domainCount = Number.isFinite(requested)
      ? Math.min(Math.max(1, Math.round(requested)), DOMAIN_AGENTS.length)
      : 4;
    agents = DOMAIN_AGENTS.slice(0, domainCount);
  }

  // Optional country scope (sector analysis only).
  const country = mode === 'sector' ? options.country || 'Global' : 'Global';

  // ── 0. Mode guard: block an obvious company/sector mix-up ──
  emit('classifying', { query });
  const cls = await classifyQuery(query);
  if (cls && cls.type !== mode && (cls.confidence ?? 1) >= 0.6) {
    emit('mismatch', {
      query,
      expected: mode,          // the mode the user selected
      detected: cls.type,      // what the query actually looks like
      reason: cls.reason || '',
    });
    return { analysis, synthesis: null, meta, mismatch: true };
  }

  // ── 0.5. Grounding: gather real web sources (Gemini Google Search) ──
  // The grounded brief becomes the shared context for every domain agent, and
  // the sources are shown to the user as citations. Fails soft.
  let framing = '';
  let sources = [];
  let sourcesVia = '';
  emit('grounding', { query });
  const grounded = await gatherSources(mode, query, country);
  if (grounded) {
    framing = grounded.brief || '';
    sources = grounded.sources || [];
    sourcesVia = grounded.via || '';
  }
  emit('sources', { sources, via: sourcesVia });

  // Announce the planned agent roster up front so the UI can render the list.
  emit('plan', {
    mode,
    query,
    agents: agents.map((a) => ({
      key: a.key,
      label: a.label,
      provider: a.provider,
      model: a.model,
    })),
  });

  // ── 1. Framing (opt-in) — only if grounding didn't already supply context ──
  if (ENABLE_FRAMING && !framing) {
    emit('agent:running', { key: 'framing', label: FRAMING_AGENT.label });
    try {
      const r = await runAgent(FRAMING_AGENT, [mode, query, country]);
      framing = r.text.trim();
      emit('agent:done', { key: 'framing', label: FRAMING_AGENT.label, text: framing });
    } catch (err) {
      emit('agent:error', { key: 'framing', label: FRAMING_AGENT.label, error: err.message });
    }
  }

  // ── 2. Domain fan-out ──
  const limit = pLimit(CONCURRENCY);
  agents.forEach((a) =>
    emit('agent:queued', { key: a.key, label: a.label, provider: a.provider, model: a.model })
  );

  await Promise.all(
    agents.map((agent) =>
      limit(async () => {
        emit('agent:running', { key: agent.key, label: agent.label });
        try {
          const r = await runAgent(agent, [mode, query, framing, country]);
          const slice = parseJson(r.text);
          analysis[agent.key] = slice;
          meta[agent.key] = { provider: r.provider, model: r.model, status: 'done' };
          emit('agent:done', {
            key: agent.key,
            label: agent.label,
            provider: r.provider,
            model: r.model,
            data: slice,
          });
        } catch (err) {
          meta[agent.key] = { provider: agent.provider, model: agent.model, status: 'error' };
          emit('agent:error', { key: agent.key, label: agent.label, error: err.message });
        }
      })
    )
  );

  // ── 3. Synthesis (skipped in scaled-down mode) ──
  let synthesis = null;
  if (ENABLE_SYNTHESIS && Object.keys(analysis).length > 0) {
    emit('agent:running', { key: 'synthesis', label: SYNTHESIS_AGENT.label });
    try {
      const r = await runAgent(SYNTHESIS_AGENT, [mode, query, JSON.stringify(analysis), country]);
      synthesis = normalizeSynthesis(parseJson(r.text));
      emit('agent:done', { key: 'synthesis', label: SYNTHESIS_AGENT.label, data: synthesis });
    } catch (err) {
      emit('agent:error', { key: 'synthesis', label: SYNTHESIS_AGENT.label, error: err.message });
    }
  }

  emit('complete', { analysis, synthesis, meta, sources, sourcesVia });
  return { analysis, synthesis, meta, sources, sourcesVia };
}

// Replay a cached analysis result as SSE events so the UI renders identically
// (instantly) without re-running the agents.
const DOMAIN_LABELS = Object.fromEntries(DOMAIN_AGENTS.map((a) => [a.key, a.label]));

export function replayAnalysis(result, emit) {
  emit('sources', { sources: result.sources || [], via: result.sourcesVia || '' });
  const keys = Object.keys(result.analysis || {});
  emit('plan', {
    query: result.query,
    agents: keys.map((k) => ({ key: k, label: DOMAIN_LABELS[k] || k, provider: result.meta?.[k]?.provider })),
  });
  for (const k of keys) {
    emit('agent:running', { key: k, label: DOMAIN_LABELS[k] || k });
    emit('agent:done', { key: k, label: DOMAIN_LABELS[k] || k, provider: result.meta?.[k]?.provider, data: result.analysis[k] });
  }
  if (result.synthesis) {
    emit('agent:running', { key: 'synthesis', label: 'Strategic Synthesis' });
    emit('agent:done', { key: 'synthesis', label: 'Strategic Synthesis', data: result.synthesis });
  }
  emit('complete', {
    analysis: result.analysis,
    synthesis: result.synthesis,
    meta: result.meta,
    sources: result.sources,
  });
}

// Run a single-call strategy framework (SWOT, Five Forces, PESTEL, Canvas…).
export async function runFramework(frameworkKey, mode, query, country = 'Global') {
  const fw = FRAMEWORKS[frameworkKey];
  if (!fw) throw new Error(`Unknown framework: ${frameworkKey}`);

  const r = await callModel({
    candidates: candidatesPreferring('groq'),
    system: fw.system,
    prompt: fw.buildPrompt(mode, query, country),
    jsonMode: true,
    timeoutMs: 30000,
    maxTokens: 1600,
  });

  const parsed = parseJson(r.text);
  // Ensure every block is an array of strings.
  const blocks = {};
  for (const b of fw.blocks) {
    const v = parsed?.[b.key];
    blocks[b.key] = Array.isArray(v) ? v.filter(Boolean) : v ? [String(v)] : [];
  }
  return { framework: frameworkKey, blocks, provider: r.provider };
}

// Back-compat: the Canvas endpoint is just the canvas framework.
export async function runCanvas(query) {
  const { blocks } = await runFramework('canvas', 'company', query);
  return { canvas: blocks };
}

// Structured financial snapshot for a company (numeric, for mini-charts).
export async function runFinancials(query) {
  const shape = {
    metrics: [{ label: '', value: 0, unit: '', note: '' }],
    revenueTrend: [{ period: '', value: 0 }],
    margins: [{ label: '', value: 0 }],
  };
  const r = await callModel({
    candidates: candidatesPreferring('groq'),
    system:
      'You are a financial analyst. Return ONLY a valid JSON object with numeric estimates for a company — no prose, no markdown fences. Numeric fields must be plain numbers (no currency symbols, no commas, no "%").',
    prompt: `Provide a financial snapshot for the company "${query}".
- metrics: 4-6 headline figures such as Revenue, Revenue Growth, Gross Margin, Net Margin, Market Cap / Valuation, Free Cash Flow. "value" is a plain number; "unit" is one of "$B", "$M", "%", "x"; "note" is "(estimated)" if uncertain else "".
- revenueTrend: the last 3-4 fiscal years, each { "period": e.g. "FY22", "value": revenue in $B as a number }.
- margins: Gross, Operating, Net as percentages (plain numbers).
Use your best knowledge; estimate where needed. Return ONLY this JSON:

${JSON.stringify(shape, null, 2)}`,
    jsonMode: true,
    timeoutMs: 30000,
    maxTokens: 900,
  });

  const parsed = parseJson(r.text);
  const num = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  return {
    metrics: (Array.isArray(parsed?.metrics) ? parsed.metrics : [])
      .map((m) => ({ label: String(m.label || ''), value: num(m.value), unit: String(m.unit || ''), note: String(m.note || '') }))
      .filter((m) => m.label && m.value !== null)
      .slice(0, 6),
    revenueTrend: (Array.isArray(parsed?.revenueTrend) ? parsed.revenueTrend : [])
      .map((d) => ({ period: String(d.period || ''), value: num(d.value) }))
      .filter((d) => d.period && d.value !== null)
      .slice(0, 5),
    margins: (Array.isArray(parsed?.margins) ? parsed.margins : [])
      .map((d) => ({ label: String(d.label || ''), value: num(d.value) }))
      .filter((d) => d.label && d.value !== null)
      .slice(0, 4),
  };
}

// Shared prompt builder for follow-up Q&A.
function buildFollowupPrompt(query, context, question, history = []) {
  const historyText = history
    .map((m) => `${m.role === 'user' ? 'Q' : 'A'}: ${m.text}`)
    .join('\n')
    .slice(-1800);

  const system =
    'You are a sharp strategy analyst answering a follow-up question. Use the provided analysis as your primary source. Be concise and specific (2-5 sentences), plain prose (no markdown headers). If the analysis does not cover it, say so briefly, then give your best-grounded view and label it "(beyond the analysis)".';

  const prompt = `Subject: ${query}

Analysis context:
${String(context).slice(0, 6000)}
${historyText ? `\nConversation so far:\n${historyText}\n` : ''}
Question: ${question}`;

  return { system, prompt };
}

// Answer a follow-up question grounded in a completed analysis (single call).
export async function runFollowup(query, context, question, history = []) {
  const { system, prompt } = buildFollowupPrompt(query, context, question, history);
  const r = await callModel({
    candidates: candidatesPreferring('groq'),
    system,
    prompt,
    jsonMode: false,
    timeoutMs: 30000,
    maxTokens: 500,
  });
  return { answer: (r.text || '').trim(), provider: r.provider };
}

// Streaming follow-up: calls onToken(text) for each chunk as it arrives.
export async function runFollowupStream(query, context, question, history, onToken) {
  const { system, prompt } = buildFollowupPrompt(query, context, question, history);
  return callModelStream(
    { candidates: candidatesPreferring('groq'), system, prompt, timeoutMs: 30000, maxTokens: 500 },
    onToken
  );
}
