// Orchestrates a full multi-agent analysis:
//   1. framing agent   → shared context briefing
//   2. 12 domain agents → fanned out in parallel (concurrency-capped)
//   3. merge slices     → full analysis object
//   4. synthesis agent  → executive assessment
//
// Progress is reported through an `emit(event, data)` callback so the caller
// can stream it (SSE). One agent failing is non-fatal.

import pLimit from 'p-limit';
import { callModel } from './providers.js';
import {
  DOMAIN_AGENTS,
  FRAMING_AGENT,
  SYNTHESIS_AGENT,
  CLASSIFIER_AGENT,
} from './agents/registry.js';

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

  // How many (priority-ordered) domain agents to run — user-selectable.
  const requested = Number(options.domainCount);
  const domainCount = Number.isFinite(requested)
    ? Math.min(Math.max(1, Math.round(requested)), DOMAIN_AGENTS.length)
    : 4; // default
  const agents = DOMAIN_AGENTS.slice(0, domainCount);

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

  // ── 1. Framing (skipped in scaled-down mode) ──
  let framing = '';
  if (ENABLE_FRAMING) {
    emit('agent:running', { key: 'framing', label: FRAMING_AGENT.label });
    try {
      const r = await runAgent(FRAMING_AGENT, [mode, query]);
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
          const r = await runAgent(agent, [mode, query, framing]);
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
      const r = await runAgent(SYNTHESIS_AGENT, [mode, query, JSON.stringify(analysis)]);
      synthesis = normalizeSynthesis(parseJson(r.text));
      emit('agent:done', { key: 'synthesis', label: SYNTHESIS_AGENT.label, data: synthesis });
    } catch (err) {
      emit('agent:error', { key: 'synthesis', label: SYNTHESIS_AGENT.label, error: err.message });
    }
  }

  emit('complete', { analysis, synthesis, meta, framing });
  return { analysis, synthesis, meta, framing };
}
