import 'dotenv/config'; // load env before any module reads process.env
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import {
  runAnalysis,
  runCanvas,
  runFramework,
  runFollowup,
  runFollowupStream,
  runFinancials,
  replayAnalysis,
} from './orchestrator.js';
import { availableProviders } from './providers.js';
import { COMPANIES, SECTORS, matchCurated } from './config/suggestions.js';
import { FRAMEWORKS } from './config/frameworks.js';
import { cacheGet, cacheSet, cacheKey } from './cache.js';

const app = express();

// Behind Render/Vercel proxies — trust the first proxy so rate-limit sees the
// real client IP (via X-Forwarded-For).
app.set('trust proxy', 1);

// CORS: open by default. Set CORS_ORIGIN (comma-separated) in production to lock
// it to your frontend origin(s), e.g. "https://your-app.vercel.app".
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((s) => s.trim()) } : {}));
app.use(express.json({ limit: '1mb' }));

// Per-IP rate limit on the expensive (model-calling) endpoints, so a public
// deploy can't drain your API keys.
const heavyLimiter = rateLimit({
  windowMs: (Number(process.env.RATE_LIMIT_WINDOW_MIN) || 15) * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit reached — please wait a few minutes before running more analyses.' },
});

function validateQuery(req, res) {
  const { query, companyName } = req.body || {};
  const raw = query ?? companyName; // accept legacy companyName field
  if (!raw || !raw.trim()) {
    res.status(400).json({ error: 'A company or sector name is required.' });
    return null;
  }
  const mode = req.body?.mode === 'sector' ? 'sector' : 'company';
  const domainCount = req.body?.domainCount; // back-compat
  const domainKeys = Array.isArray(req.body?.domainKeys)
    ? req.body.domainKeys.filter((k) => typeof k === 'string')
    : null;
  const country = typeof req.body?.country === 'string' ? req.body.country : 'Global';
  const refresh = req.body?.refresh === true; // bypass cache (Regenerate)
  return { mode, query: raw.trim(), domainCount, domainKeys, country, refresh };
}

// ── Streaming endpoint (Server-Sent Events) ────────────────────────────────
// Emits: plan / agent:queued / agent:running / agent:done / agent:error / complete
app.post('/api/analyze/stream', heavyLimiter, async (req, res) => {
  const parsed = validateQuery(req, res);
  if (!parsed) return;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();

  // Track real client disconnects via the RESPONSE stream. (req 'close' fires as
  // soon as the POST body is fully received, which is NOT a disconnect and would
  // wrongly suppress every subsequent SSE write.)
  let clientGone = false;
  res.on('close', () => { clientGone = true; });

  const emit = (event, data) => {
    if (clientGone || res.writableEnded) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const selection = parsed.domainKeys?.length ? [...parsed.domainKeys].sort() : parsed.domainCount ?? 4;
  const key = cacheKey(['analyze', parsed.mode, parsed.query, selection, parsed.country]);

  try {
    const cached = parsed.refresh ? null : cacheGet(key);
    if (cached) {
      emit('cached', { at: Date.now() });
      replayAnalysis({ ...cached, query: parsed.query }, emit);
    } else {
      const result = await runAnalysis(parsed.mode, parsed.query, emit, {
        domainCount: parsed.domainCount,
        domainKeys: parsed.domainKeys,
        country: parsed.country,
      });
      // Cache only successful runs that actually produced sections.
      if (result && !result.mismatch && Object.keys(result.analysis || {}).length > 0) {
        cacheSet(key, result);
      }
    }
  } catch (err) {
    console.error('Analysis error:', err);
    emit('error', { error: err.message || 'Analysis failed.' });
  } finally {
    if (!clientGone && !res.writableEnded) {
      emit('end', {});
      res.end();
    }
  }
});

// ── Non-streaming fallback (buffers events, returns final JSON) ─────────────
app.post('/api/analyze', heavyLimiter, async (req, res) => {
  const parsed = validateQuery(req, res);
  if (!parsed) return;

  try {
    const result = await runAnalysis(parsed.mode, parsed.query, () => {}, {
      domainCount: parsed.domainCount,
      domainKeys: parsed.domainKeys,
      country: parsed.country,
    });
    // Back-compat: expose the merged analysis at `.analysis`.
    res.json(result);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
});

// Strategy framework lens (SWOT / Five Forces / PESTEL / Canvas) — single call.
app.post('/api/framework', heavyLimiter, async (req, res) => {
  const q = String(req.body?.query || '').trim();
  const framework = String(req.body?.framework || '');
  const mode = req.body?.mode === 'sector' ? 'sector' : 'company';
  const country = typeof req.body?.country === 'string' ? req.body.country : 'Global';
  if (!q) return res.status(400).json({ error: 'A company or sector name is required.' });
  if (!FRAMEWORKS[framework]) return res.status(400).json({ error: 'Unknown framework.' });

  const key = cacheKey(['framework', framework, mode, q, country]);
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  try {
    const out = await runFramework(framework, mode, q, country);
    cacheSet(key, out);
    res.json(out);
  } catch (err) {
    console.error('Framework error:', err);
    res.status(500).json({ error: err.message || 'Framework generation failed.' });
  }
});

// Structured financial snapshot for a company (numeric, drives mini-charts).
app.post('/api/financials', heavyLimiter, async (req, res) => {
  const q = String(req.body?.query || '').trim();
  if (!q) return res.status(400).json({ error: 'A company name is required.' });

  const key = cacheKey(['financials', q]);
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  try {
    const data = await runFinancials(q);
    cacheSet(key, data);
    res.json(data);
  } catch (err) {
    console.error('Financials error:', err);
    res.status(500).json({ error: err.message || 'Financials generation failed.' });
  }
});

// Follow-up Q&A grounded in a completed analysis — streamed token-by-token (SSE).
app.post('/api/followup/stream', heavyLimiter, async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'A question is required.' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();

  let clientGone = false;
  res.on('close', () => { clientGone = true; });
  const emit = (event, data) => {
    if (clientGone || res.writableEnded) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await runFollowupStream(
      String(req.body?.query || ''),
      String(req.body?.context || ''),
      question,
      Array.isArray(req.body?.history) ? req.body.history : [],
      (token) => emit('token', { token })
    );
  } catch (err) {
    console.error('Follow-up stream error:', err);
    emit('error', { error: err.message || 'Follow-up failed.' });
  } finally {
    if (!clientGone && !res.writableEnded) {
      emit('done', {});
      res.end();
    }
  }
});

// Non-streaming follow-up (back-compat / fallback).
app.post('/api/followup', heavyLimiter, async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'A question is required.' });
  try {
    const { answer } = await runFollowup(
      String(req.body?.query || ''),
      String(req.body?.context || ''),
      question,
      Array.isArray(req.body?.history) ? req.body.history : []
    );
    res.json({ answer });
  } catch (err) {
    console.error('Follow-up error:', err);
    res.status(500).json({ error: err.message || 'Follow-up failed.' });
  }
});

// Back-compat: Business Model Canvas endpoint.
app.post('/api/canvas', heavyLimiter, async (req, res) => {
  const q = String(req.body?.query || '').trim();
  if (!q) return res.status(400).json({ error: 'A company name is required.' });
  try {
    const { canvas } = await runCanvas(q);
    res.json({ canvas });
  } catch (err) {
    console.error('Canvas error:', err);
    res.status(500).json({ error: err.message || 'Canvas generation failed.' });
  }
});

// Lets the frontend show which providers are active vs. falling back to Gemini.
app.get('/api/providers', (_req, res) => {
  res.json(availableProviders());
});

// Fetch live web suggestions from DuckDuckGo's keyless autocomplete (server-side
// to avoid CORS). Returns [] on any failure.
async function webSuggestions(q) {
  try {
    const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&kl=us-en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.map((d) => d.phrase).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// Autocomplete: curated on-topic matches first, then live web suggestions.
app.get('/api/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const mode = req.query.mode === 'sector' ? 'sector' : 'company';
  if (q.length < 2) return res.json({ suggestions: [] });

  const curatedList = mode === 'sector' ? SECTORS : COMPANIES;
  const curated = matchCurated(curatedList, q, 6);
  const web = await webSuggestions(q);

  // Merge, dedupe case-insensitively, cap at 8. Curated matches rank first.
  const seen = new Set();
  const out = [];
  for (const s of [...curated, ...web]) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= 8) break;
  }
  res.json({ suggestions: out });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  const p = availableProviders();
  console.log(
    `Providers — Gemini: ${p.gemini ? 'on' : 'off'}, Groq: ${p.groq ? 'on' : 'off'}, HuggingFace: ${p.huggingface ? 'on' : 'off'}`
  );
});
