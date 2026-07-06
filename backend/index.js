import 'dotenv/config'; // load env before any module reads process.env
import express from 'express';
import cors from 'cors';
import { runAnalysis } from './orchestrator.js';
import { availableProviders } from './providers.js';
import { COMPANIES, SECTORS, matchCurated } from './config/suggestions.js';

const app = express();
app.use(cors());
app.use(express.json());

function validateQuery(req, res) {
  const { query, companyName } = req.body || {};
  const raw = query ?? companyName; // accept legacy companyName field
  if (!raw || !raw.trim()) {
    res.status(400).json({ error: 'A company or sector name is required.' });
    return null;
  }
  const mode = req.body?.mode === 'sector' ? 'sector' : 'company';
  const domainCount = req.body?.domainCount; // validated/clamped in runAnalysis
  return { mode, query: raw.trim(), domainCount };
}

// ── Streaming endpoint (Server-Sent Events) ────────────────────────────────
// Emits: plan / agent:queued / agent:running / agent:done / agent:error / complete
app.post('/api/analyze/stream', async (req, res) => {
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

  try {
    await runAnalysis(parsed.mode, parsed.query, emit, { domainCount: parsed.domainCount });
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
app.post('/api/analyze', async (req, res) => {
  const parsed = validateQuery(req, res);
  if (!parsed) return;

  try {
    const result = await runAnalysis(parsed.mode, parsed.query, () => {}, {
      domainCount: parsed.domainCount,
    });
    // Back-compat: expose the merged analysis at `.analysis`.
    res.json(result);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed.' });
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
