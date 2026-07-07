// Unified model-call layer across three free-tier providers.
//
//   callModel({ provider, model, system, prompt }) -> { text, provider, model }
//
// - gemini      : @google/genai (already a dependency)
// - groq        : OpenAI-compatible /chat/completions
// - huggingface : OpenAI-compatible router.huggingface.co/v1
//
// Missing keys fall back to Gemini so the app still runs with just GEMINI_API_KEY.
// HTTP 429 (and transient 5xx) are retried with exponential backoff.

import { GoogleGenAI } from '@google/genai';

// Env is read lazily (not at import time) because dotenv.config() may run after
// this module is imported. Capturing keys at import time would read them as empty.
const keyFor = {
  gemini: () => process.env.GEMINI_API_KEY,
  groq: () => process.env.GROQ_API_KEY,
  huggingface: () => process.env.HF_TOKEN,
};

let _ai = null;
function gemini() {
  if (!_ai) {
    const key = keyFor.gemini();
    if (!key) throw new Error('GEMINI_API_KEY is not set');
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}

const OPENAI_COMPATIBLE = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    label: 'Groq',
  },
  huggingface: {
    url: 'https://router.huggingface.co/v1/chat/completions',
    label: 'Hugging Face',
  },
};

// Which providers are actually usable given the keys present.
export function availableProviders() {
  return {
    gemini: Boolean(keyFor.gemini()),
    groq: Boolean(keyFor.groq()),
    huggingface: Boolean(keyFor.huggingface()),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A "limit" error means this model is out of budget (rate/quota/too-large) — no
// point retrying it; fail over to the next model immediately.
function isLimitError(err) {
  const status = err?.status;
  if (status === 429 || status === 413) return true;
  return /\b(429|413)\b|RESOURCE_EXHAUSTED|rate.?limit|quota|tokens per|TPD|TPM|RPD|too large/i.test(
    err?.message || ''
  );
}

// A "transient" error (timeout, 5xx, network blip) is worth a quick retry on the
// SAME model before moving on.
function isTransient(err) {
  const status = err?.status;
  if (status === 408 || (status >= 500 && status <= 599)) return true;
  return /timeout|ECONN|fetch failed|network|overloaded|unavailable/i.test(err?.message || '');
}

// Reject if a promise doesn't settle within ms — guards against a provider
// holding a connection open without responding (which would stall the pipeline).
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        const err = new Error(`${label} timed out after ${ms}ms`);
        err.status = 408;
        reject(err);
      }, ms)
    ),
  ]);
}

async function callGemini({ model, system, prompt, timeoutMs, maxTokens }) {
  const response = await withTimeout(
    gemini().models.generateContent({
      model,
      config: { systemInstruction: system, maxOutputTokens: maxTokens },
      contents: prompt,
    }),
    timeoutMs,
    'Gemini'
  );
  return response.text;
}

async function callOpenAICompatible(providerKey, { model, system, prompt, timeoutMs, jsonMode, maxTokens }) {
  const cfg = OPENAI_COMPATIBLE[providerKey];
  const key = keyFor[providerKey]();
  if (!key) throw new Error(`${providerKey} key is not set`);

  const payload = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    // Kept modest: a domain slice needs only a few hundred output tokens, and
    // free-tier tokens-per-minute caps count max_tokens toward a single request
    // (an 8k value trips Groq's 413 "request too large").
    max_tokens: maxTokens,
    temperature: 0.4,
  };
  // Force strict JSON when the caller expects it (Groq supports OpenAI json mode).
  if (jsonMode) payload.response_format = { type: 'json_object' };

  let res;
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    // AbortError (timeout) or network failure — mark retryable.
    const err = new Error(`${cfg.label} request failed: ${e.name === 'TimeoutError' ? 'timeout' : e.message}`);
    err.status = 408;
    throw err;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`${cfg.label} HTTP ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${cfg.label} returned an empty completion`);
  return text;
}

// Call one specific { provider, model } candidate.
async function callOne({ provider, model }, { system, prompt, timeoutMs, jsonMode, maxTokens }) {
  if (provider === 'gemini') {
    return callGemini({ model, system, prompt, timeoutMs, maxTokens });
  }
  return callOpenAICompatible(provider, { model, system, prompt, timeoutMs, jsonMode, maxTokens });
}

/**
 * Call a model with automatic failover across a candidate list. Each candidate
 * gets a short retry on transient errors; a limit/quota error fails over to the
 * next candidate immediately. Returns { text, provider, model } of whichever
 * candidate succeeded.
 *
 * @param {object} opts
 * @param {{provider,model}[]} [opts.candidates]  ordered model pool (preferred)
 * @param {string} [opts.provider] / [opts.model] single-model shorthand
 * @param {string} opts.system
 * @param {string} opts.prompt
 * @param {boolean} [opts.jsonMode=false]
 * @param {number} [opts.timeoutMs=30000]
 * @param {number} [opts.maxTokens=2048]
 * @param {number} [opts.retries=1]  transient retries per candidate
 */
export async function callModel(opts) {
  const {
    candidates,
    provider,
    model,
    system,
    prompt,
    jsonMode = false,
    timeoutMs = 30000,
    maxTokens = 2048,
    retries = 1,
  } = opts;

  const keys = availableProviders();
  const list = (candidates && candidates.length ? candidates : [{ provider, model }])
    .filter((c) => c && c.provider && c.model && keys[c.provider]);

  if (list.length === 0) throw new Error('No usable provider keys configured for the requested models');

  const params = { system, prompt, jsonMode, timeoutMs, maxTokens };
  let lastErr;

  for (let ci = 0; ci < list.length; ci++) {
    const cand = list[ci];
    let attempt = 0;
    while (attempt <= retries) {
      try {
        const text = await callOne(cand, params);
        return { text, provider: cand.provider, model: cand.model };
      } catch (err) {
        lastErr = err;
        if (isTransient(err) && attempt < retries) {
          await sleep(500 * 2 ** attempt + Math.random() * 200);
          attempt += 1;
          continue;
        }
        // Limit or fatal error on this candidate → fail over to the next model.
        if (ci < list.length - 1) {
          console.error(
            `[failover] ${cand.provider}/${cand.model} → ${list[ci + 1].provider}/${list[ci + 1].model} (${String(err.message).slice(0, 60)})`
          );
        }
        break;
      }
    }
  }
  throw lastErr;
}

// ── Streaming variants ─────────────────────────────────────────────────────

async function callGeminiStream({ model, system, prompt, maxTokens }, onToken) {
  const stream = await gemini().models.generateContentStream({
    model,
    config: { systemInstruction: system, maxOutputTokens: maxTokens },
    contents: prompt,
  });
  let text = '';
  for await (const chunk of stream) {
    const t = chunk.text || '';
    if (t) {
      text += t;
      onToken(t);
    }
  }
  return text;
}

async function callOpenAICompatibleStream(providerKey, { model, system, prompt, maxTokens, timeoutMs }, onToken) {
  const cfg = OPENAI_COMPATIBLE[providerKey];
  const key = keyFor[providerKey]();
  if (!key) throw new Error(`${providerKey} key is not set`);

  let res;
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.4,
        stream: true,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const err = new Error(`${cfg.label} request failed: ${e.name === 'TimeoutError' ? 'timeout' : e.message}`);
    err.status = 408;
    throw err;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`${cfg.label} HTTP ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return text;
      try {
        const t = JSON.parse(payload)?.choices?.[0]?.delta?.content || '';
        if (t) {
          text += t;
          onToken(t);
        }
      } catch {
        /* ignore keep-alive / partial lines */
      }
    }
  }
  return text;
}

/**
 * Streaming version of callModel with failover. Calls onToken(text) for each
 * chunk. If a candidate errors before emitting any token, fails over to the next;
 * if it errors mid-stream, it throws (the client already has partial text).
 */
export async function callModelStream(opts, onToken) {
  const { candidates, provider, model, system, prompt, timeoutMs = 30000, maxTokens = 500 } = opts;
  const keys = availableProviders();
  const list = (candidates && candidates.length ? candidates : [{ provider, model }])
    .filter((c) => c && c.provider && c.model && keys[c.provider]);
  if (list.length === 0) throw new Error('No usable provider keys configured for the requested models');

  let lastErr;
  for (const cand of list) {
    let emitted = false;
    const wrap = (t) => {
      emitted = true;
      onToken(t);
    };
    try {
      const params = { model: cand.model, system, prompt, maxTokens, timeoutMs };
      const text =
        cand.provider === 'gemini'
          ? await callGeminiStream(params, wrap)
          : await callOpenAICompatibleStream(cand.provider, params, wrap);
      return { text, provider: cand.provider, model: cand.model };
    } catch (err) {
      lastErr = err;
      if (emitted) throw err; // already streamed partial output — don't restart
      // else fail over to the next candidate
    }
  }
  throw lastErr;
}
