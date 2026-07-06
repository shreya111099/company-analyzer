import { useState, useEffect } from 'react';
import AccordionSection from './components/AccordionSection.jsx';
import PipelineStrip from './components/PipelineStrip.jsx';
import StatStrip from './components/StatStrip.jsx';
import SynthesisCard from './components/SynthesisCard.jsx';
import ModeToggle from './components/ModeToggle.jsx';
import SearchInput from './components/SearchInput.jsx';
import ComparisonView from './components/ComparisonView.jsx';
import { SECTIONS, sectionLabel, formatAsInterviewNotes } from './utils/schema.js';
import { exportAnalysisPdf } from './utils/pdf.js';

const PLACEHOLDER = {
  company: 'Enter a company (e.g. Apple, Stripe, TSMC…)',
  sector: 'Enter a sector (e.g. EV charging, cloud infra…)',
};

const emptyTab = () => ({
  query: '',
  analysis: null,
  synthesis: null,
  sources: [],
  meta: {},
  steps: [],
  error: '',
  mismatch: null,
  resultQuery: '',
});

const resetSlot = (q) => ({ ...emptyTab(), query: q, resultQuery: q });

function upsertStep(steps, key, patch) {
  const i = steps.findIndex((s) => s.key === key);
  if (i === -1) return [...steps, { key, status: 'queued', ...patch }];
  const next = [...steps];
  next[i] = { ...next[i], ...patch };
  return next;
}

async function consumeSSE(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop();
    for (const block of blocks) {
      let event = 'message';
      const dataLines = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length) {
        try {
          onEvent(event, JSON.parse(dataLines.join('\n')));
        } catch {
          /* ignore malformed block */
        }
      }
    }
  }
}

function applyEvent(event, data, sink) {
  switch (event) {
    case 'sources':
      sink.patch({ sources: data.sources || [] });
      break;
    case 'mismatch':
      sink.patch({ mismatch: { detected: data.detected, expected: data.expected } });
      break;
    case 'plan':
      sink.patch({
        steps: data.agents.map((a) => ({
          key: a.key,
          label: a.label,
          provider: a.provider,
          model: a.model,
          status: 'queued',
        })),
      });
      break;
    case 'agent:queued':
      sink.step(data.key, { status: 'queued', label: data.label, provider: data.provider });
      break;
    case 'agent:running':
      sink.step(data.key, { status: 'running', label: data.label });
      break;
    case 'agent:done':
      sink.step(data.key, { status: 'done', provider: data.provider });
      if (data.key === 'synthesis') sink.patch({ synthesis: data.data });
      else if (data.key !== 'framing' && data.data) sink.addDomain(data.key, data.data, data.provider);
      break;
    case 'agent:error':
      sink.step(data.key, { status: 'error' });
      break;
    case 'error':
      sink.patch({ error: data.error || 'Analysis failed.' });
      break;
    default:
      break;
  }
}

async function streamAnalysis(runMode, q, domainCount, sink) {
  try {
    const res = await fetch('/api/analyze/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: runMode, query: q, domainCount }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      sink.patch({ error: d.error || `Server error ${res.status}` });
      return;
    }
    await consumeSSE(res, (event, data) => applyEvent(event, data, sink));
  } catch (err) {
    sink.patch({ error: err.message || 'Something went wrong. Please try again.' });
  }
}

const PROVIDER_NAME = { groq: 'Groq', huggingface: 'Hugging Face', gemini: 'Gemini' };

export default function App() {
  const [mode, setMode] = useState('company');
  const [companySub, setCompanySub] = useState('single');
  const [domainCount, setDomainCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [tabs, setTabs] = useState({ company: emptyTab(), sector: emptyTab() });
  const [compare, setCompare] = useState({ a: emptyTab(), b: emptyTab() });
  const [providers, setProviders] = useState(null);

  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => {});
  }, []);

  const isCompare = mode === 'company' && companySub === 'compare';
  const cur = tabs[mode];

  const makeTabSink = (m) => ({
    patch: (obj) => setTabs((p) => ({ ...p, [m]: { ...p[m], ...obj } })),
    step: (key, patch) => setTabs((p) => ({ ...p, [m]: { ...p[m], steps: upsertStep(p[m].steps, key, patch) } })),
    addDomain: (key, d, provider) =>
      setTabs((p) => ({
        ...p,
        [m]: {
          ...p[m],
          analysis: { ...(p[m].analysis || {}), [key]: d },
          meta: { ...p[m].meta, [key]: { provider } },
        },
      })),
  });

  const makeCompareSink = (slot) => ({
    patch: (obj) => setCompare((p) => ({ ...p, [slot]: { ...p[slot], ...obj } })),
    step: (key, patch) => setCompare((p) => ({ ...p, [slot]: { ...p[slot], steps: upsertStep(p[slot].steps, key, patch) } })),
    addDomain: (key, d, provider) =>
      setCompare((p) => ({
        ...p,
        [slot]: {
          ...p[slot],
          analysis: { ...(p[slot].analysis || {}), [key]: d },
          meta: { ...p[slot].meta, [key]: { provider } },
        },
      })),
  });

  function handleModeChange(next) {
    if (next !== mode) setMode(next);
  }

  async function handleAnalyze(e, override = {}) {
    if (e && e.preventDefault) e.preventDefault();
    const runMode = override.mode || mode;
    const q = (override.query ?? tabs[runMode].query).trim();
    if (!q) return;
    setLoading(true);
    const sink = makeTabSink(runMode);
    sink.patch(resetSlot(q));
    await streamAnalysis(runMode, q, domainCount, sink);
    setLoading(false);
  }

  async function handleCompare(e) {
    if (e && e.preventDefault) e.preventDefault();
    const qa = compare.a.query.trim();
    const qb = compare.b.query.trim();
    if (!qa || !qb) return;
    setLoading(true);
    const sinkA = makeCompareSink('a');
    const sinkB = makeCompareSink('b');
    sinkA.patch(resetSlot(qa));
    sinkB.patch(resetSlot(qb));
    await Promise.all([
      streamAnalysis('company', qa, domainCount, sinkA),
      streamAnalysis('company', qb, domainCount, sinkB),
    ]);
    setLoading(false);
  }

  function handleRegenerate() {
    if (cur.resultQuery) handleAnalyze(null, { query: cur.resultQuery });
  }

  async function handleCopy() {
    if (!cur.analysis) return;
    const text = formatAsInterviewNotes(mode, cur.resultQuery, cur.analysis, cur.synthesis, cur.sources);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  function handleExportPdf() {
    if (cur.analysis) exportAnalysisPdf(mode, cur.resultQuery, cur.analysis, cur.synthesis, cur.sources);
  }

  const hasResults = cur.analysis || cur.synthesis;
  const failedKeys = new Set(cur.steps.filter((s) => s.status === 'error').map((s) => s.key));
  const compareHasData = compare.a.analysis || compare.b.analysis;

  const activeProviders = providers
    ? Object.keys(providers).filter((k) => providers[k]).map((k) => PROVIDER_NAME[k] || k)
    : [];

  const stats = [
    { label: 'Stages', value: cur.analysis ? Object.keys(cur.analysis).length : 0 },
    { label: 'Sources', value: cur.sources.length },
    { label: 'Agents run', value: cur.steps.filter((s) => s.status === 'done').length },
    { label: 'Models', value: new Set(Object.values(cur.meta).map((m) => m?.provider).filter(Boolean)).size },
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <h1 className="logo">Strategic Analyzer</h1>
            <p className="tagline">Multi-Agent · Sector &amp; Company Value-Chain Analysis</p>
          </div>
          {activeProviders.length > 0 && (
            <div className="provider-meta" title="Models power the agent pipeline (with automatic failover)">
              <span className="provider-bolt" aria-hidden="true">⚡</span>
              <span>Multi-model · {activeProviders.join(' · ')}</span>
            </div>
          )}
        </div>
      </header>

      <main className="main">
        {/* ── Command bar ── */}
        <form className="command-bar" onSubmit={isCompare ? handleCompare : handleAnalyze}>
          <div className="command-main">
            <ModeToggle mode={mode} onChange={handleModeChange} disabled={loading} />
            {isCompare ? (
              <div className="compare-inputs">
                <SearchInput
                  value={compare.a.query}
                  onChange={(v) => setCompare((p) => ({ ...p, a: { ...p.a, query: v } }))}
                  mode="company"
                  placeholder="First company"
                  disabled={loading}
                />
                <span className="compare-vs">vs</span>
                <SearchInput
                  value={compare.b.query}
                  onChange={(v) => setCompare((p) => ({ ...p, b: { ...p.b, query: v } }))}
                  mode="company"
                  placeholder="Second company"
                  disabled={loading}
                  autoFocus={false}
                />
              </div>
            ) : (
              <SearchInput
                value={cur.query}
                onChange={(v) => setTabs((p) => ({ ...p, [mode]: { ...p[mode], query: v } }))}
                mode={mode}
                placeholder={PLACEHOLDER[mode]}
                disabled={loading}
              />
            )}
            <button
              className="analyze-btn"
              type="submit"
              disabled={
                loading ||
                (isCompare
                  ? !compare.a.query.trim() || !compare.b.query.trim()
                  : !cur.query.trim())
              }
            >
              {loading ? (isCompare ? 'Comparing…' : 'Analyzing…') : isCompare ? 'Compare' : 'Analyze'}
            </button>
          </div>

          <div className="command-sub">
            <label className="depth-select">
              <span className="depth-label">Depth</span>
              <select value={domainCount} onChange={(e) => setDomainCount(Number(e.target.value))} disabled={loading}>
                <option value={2}>2 · Quick</option>
                <option value={4}>4 · Standard</option>
                <option value={6}>6 · Deep</option>
                <option value={8}>8 · Extensive</option>
                <option value={12}>12 · Full</option>
              </select>
            </label>
            {mode === 'company' && (
              <div className="mode-toggle subtoggle" role="tablist" aria-label="Company view">
                <button
                  type="button"
                  className={`mode-option ${companySub === 'single' ? 'mode-option--active' : ''}`}
                  onClick={() => setCompanySub('single')}
                  disabled={loading}
                >
                  Single
                </button>
                <button
                  type="button"
                  className={`mode-option ${companySub === 'compare' ? 'mode-option--active' : ''}`}
                  onClick={() => setCompanySub('compare')}
                  disabled={loading}
                >
                  Compare
                </button>
              </div>
            )}
            {loading && (
              <span className="command-hint">
                {isCompare
                  ? 'Analyzing both companies…'
                  : cur.steps.length > 0
                  ? `${cur.steps.filter((s) => s.status === 'done').length}/${cur.steps.length} agents done`
                  : 'Researching sources…'}
              </span>
            )}
          </div>
        </form>

        {/* ── Comparison view ── */}
        {isCompare ? (
          <>
            {(compare.a.steps.length > 0 || compare.b.steps.length > 0) && (
              <div className="compare-progress">
                <PipelineStrip steps={compare.a.steps} title={compare.a.query || 'Company A'} compact />
                <PipelineStrip steps={compare.b.steps} title={compare.b.query || 'Company B'} compact />
              </div>
            )}
            {(compare.a.mismatch || compare.b.mismatch) && (
              <div className="error-box mismatch-box">
                <p>One of your inputs looks like a <strong>sector</strong>, not a company. Comparison works best with two companies.</p>
              </div>
            )}
            {compareHasData && <ComparisonView a={compare.a} b={compare.b} />}
          </>
        ) : (
          <>
            {/* Pipeline strip — the visible multi-agent centerpiece */}
            <PipelineStrip steps={cur.steps} />

            {cur.mismatch && (
              <div className="error-box mismatch-box">
                <p>
                  <strong>Looks like the wrong mode.</strong> “{cur.resultQuery}” looks like a{' '}
                  <strong>{cur.mismatch.detected}</strong>, but you ran a{' '}
                  <strong>{cur.mismatch.expected}</strong> analysis.
                </p>
                <button
                  className="switch-btn"
                  onClick={() => {
                    const detected = cur.mismatch.detected;
                    const q = cur.resultQuery;
                    setTabs((p) => ({ ...p, [detected]: { ...p[detected], query: q } }));
                    setMode(detected);
                    handleAnalyze(null, { mode: detected, query: q });
                  }}
                >
                  Switch to {cur.mismatch.detected} analysis →
                </button>
              </div>
            )}

            {cur.error && (
              <div className="error-box">
                <strong>Error:</strong> {cur.error}
              </div>
            )}

            {hasResults && (
              <div className="results">
                <div className="results-header">
                  <div className="results-id">
                    <span className="results-mode-tag">{mode === 'sector' ? 'Sector' : 'Company'}</span>
                    <h2 className="results-title">{cur.resultQuery}</h2>
                  </div>
                  {cur.analysis && (
                    <div className="results-actions">
                      <button className="action-btn" onClick={handleRegenerate} disabled={loading} title="Re-run the analysis">
                        <span aria-hidden="true">↻</span> Regenerate
                      </button>
                      <button className="action-btn" onClick={handleExportPdf} title="Download as PDF">
                        <span aria-hidden="true">⬇</span> Export PDF
                      </button>
                      <button
                        className={`action-btn ${copySuccess ? 'action-btn--success' : ''}`}
                        onClick={handleCopy}
                        title="Copy skimmable interview notes"
                      >
                        <span aria-hidden="true">{copySuccess ? '✓' : '📋'}</span>{' '}
                        {copySuccess ? 'Copied' : 'Interview notes'}
                      </button>
                    </div>
                  )}
                </div>

                {cur.analysis && <StatStrip stats={stats} />}

                <SynthesisCard synthesis={cur.synthesis} />

                {cur.sources.length > 0 && (
                  <details className="sources" open>
                    <summary className="sources-summary">
                      Sources <span className="sources-count">{cur.sources.length}</span>
                    </summary>
                    <ol className="sources-list">
                      {cur.sources.map((s, i) => (
                        <li key={i}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer">
                            {s.title}
                          </a>
                        </li>
                      ))}
                    </ol>
                    <p className="sources-note">Grounded via Google Search · links open the original source</p>
                  </details>
                )}

                {SECTIONS.map((section, idx) => {
                  const data = cur.analysis?.[section.key];
                  const step = cur.steps.find((s) => s.key === section.key);
                  if (data) {
                    return (
                      <AccordionSection
                        key={section.key}
                        title={sectionLabel(section, mode)}
                        data={data}
                        fields={section.fields}
                        meta={cur.meta[section.key]}
                        defaultOpen={idx === 0}
                      />
                    );
                  }
                  if (failedKeys.has(section.key)) {
                    return (
                      <AccordionSection
                        key={section.key}
                        title={sectionLabel(section, mode)}
                        data={null}
                        fields={section.fields}
                        failed
                        defaultOpen={false}
                      />
                    );
                  }
                  // Skeleton while this stage's agent is queued/running.
                  if (loading && step && (step.status === 'running' || step.status === 'queued')) {
                    return (
                      <div className="skeleton-card" key={section.key} aria-hidden="true">
                        <div className="skeleton-head">
                          <span className="skeleton-title">{sectionLabel(section, mode)}</span>
                          <span className={`skeleton-state ${step.status === 'running' ? 'is-running' : ''}`}>
                            {step.status === 'running' ? 'generating…' : 'queued'}
                          </span>
                        </div>
                        {step.status === 'running' && (
                          <div className="skeleton-lines">
                            <span /><span /><span />
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p>Multi-model · Grounded via Google Search · For strategy &amp; interview prep</p>
      </footer>
    </div>
  );
}
