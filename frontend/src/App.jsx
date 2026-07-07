import { useState, useEffect } from 'react';
import AccordionSection from './components/AccordionSection.jsx';
import PipelineStrip from './components/PipelineStrip.jsx';
import StatStrip from './components/StatStrip.jsx';
import SynthesisCard from './components/SynthesisCard.jsx';
import ModeToggle from './components/ModeToggle.jsx';
import SearchInput from './components/SearchInput.jsx';
import ComparisonView from './components/ComparisonView.jsx';
import FrameworkView from './components/FrameworkView.jsx';
import FollowUpChat from './components/FollowUpChat.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import DomainPicker, { CORE_4 } from './components/DomainPicker.jsx';
import { SECTIONS, sectionLabel, formatAsInterviewNotes } from './utils/schema.js';
import { FRAMEWORKS, frameworksForMode } from './utils/frameworks.js';
import { COUNTRIES } from './utils/countries.js';
import { api } from './utils/api.js';
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
  resultCountry: '',
  chat: [],
  sourcesVia: '',
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
      sink.patch({ sources: data.sources || [], sourcesVia: data.via || '' });
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

async function streamAnalysis(runMode, q, domainKeys, country, sink) {
  try {
    const res = await fetch(api('/api/analyze/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: runMode, query: q, domainKeys, country }),
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
  const [companySub, setCompanySub] = useState('single'); // 'single' | 'compare'
  const [framework, setFramework] = useState('valuechain');
  const [country, setCountry] = useState('Global');
  const [selectedDomains, setSelectedDomains] = useState(CORE_4);
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [tabs, setTabs] = useState({ company: emptyTab(), sector: emptyTab() });
  const [compare, setCompare] = useState({ a: emptyTab(), b: emptyTab() });
  const [fwResult, setFwResult] = useState({ framework: null, mode: null, data: null, error: '', resultQuery: '' });
  const [providers, setProviders] = useState(null);
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light'
  );

  useEffect(() => {
    fetch(api('/api/providers')).then((r) => r.json()).then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // If the selected framework doesn't apply to the new mode, fall back to value chain.
  useEffect(() => {
    if (!FRAMEWORKS[framework].modes.includes(mode)) setFramework('valuechain');
  }, [mode, framework]);

  const isCompare = mode === 'company' && companySub === 'compare';
  const isQuick = !isCompare && framework !== 'valuechain';
  const cur = tabs[mode];

  const makeTabSink = (m) => ({
    patch: (obj) => setTabs((p) => ({ ...p, [m]: { ...p[m], ...obj } })),
    step: (key, patch) => setTabs((p) => ({ ...p, [m]: { ...p[m], steps: upsertStep(p[m].steps, key, patch) } })),
    addDomain: (key, d, provider) =>
      setTabs((p) => ({
        ...p,
        [m]: { ...p[m], analysis: { ...(p[m].analysis || {}), [key]: d }, meta: { ...p[m].meta, [key]: { provider } } },
      })),
  });

  const makeCompareSink = (slot) => ({
    patch: (obj) => setCompare((p) => ({ ...p, [slot]: { ...p[slot], ...obj } })),
    step: (key, patch) => setCompare((p) => ({ ...p, [slot]: { ...p[slot], steps: upsertStep(p[slot].steps, key, patch) } })),
    addDomain: (key, d, provider) =>
      setCompare((p) => ({
        ...p,
        [slot]: { ...p[slot], analysis: { ...(p[slot].analysis || {}), [key]: d }, meta: { ...p[slot].meta, [key]: { provider } } },
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
    const runCountry = runMode === 'sector' ? country : 'Global';
    setLoading(true);
    const sink = makeTabSink(runMode);
    sink.patch({ ...resetSlot(q), resultCountry: runMode === 'sector' ? runCountry : '' });
    await streamAnalysis(runMode, q, selectedDomains, runCountry, sink);
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
      streamAnalysis('company', qa, selectedDomains, 'Global', sinkA),
      streamAnalysis('company', qb, selectedDomains, 'Global', sinkB),
    ]);
    setLoading(false);
  }

  async function handleFramework(e) {
    if (e && e.preventDefault) e.preventDefault();
    const q = cur.query.trim();
    if (!q) return;
    const runCountry = mode === 'sector' ? country : 'Global';
    setLoading(true);
    setFwResult({ framework, mode, data: null, error: '', resultQuery: q, country: runCountry });
    try {
      const spec = FRAMEWORKS[framework];
      const res = await fetch(api(spec.endpoint || '/api/framework'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ framework, mode, query: q, country: runCountry }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Server error ${res.status}`);
      // Standard frameworks return { blocks }; special ones return their own shape.
      const data = spec.endpoint ? d : d.blocks;
      setFwResult({ framework, mode, data, error: '', resultQuery: q, country: runCountry });
    } catch (err) {
      setFwResult({ framework, mode, data: null, error: err.message || 'Framework generation failed.', resultQuery: q, country: runCountry });
    } finally {
      setLoading(false);
    }
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

  const onSubmit = isCompare ? handleCompare : isQuick ? handleFramework : handleAnalyze;
  // Value-chain runs (single or compare) need at least one domain selected.
  const noDomains = !isQuick && selectedDomains.length === 0;
  const submitDisabled =
    loading ||
    noDomains ||
    (isCompare ? !compare.a.query.trim() || !compare.b.query.trim() : !cur.query.trim());

  const hasResults = cur.analysis || cur.synthesis;
  const failedKeys = new Set(cur.steps.filter((s) => s.status === 'error').map((s) => s.key));
  const compareHasData = compare.a.analysis || compare.b.analysis;
  const fwMatches = fwResult.framework === framework && fwResult.mode === mode;

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
          <div className="header-right">
            {activeProviders.length > 0 && (
              <div className="provider-meta" title="Models power the agent pipeline (with automatic failover)">
                <span className="provider-bolt" aria-hidden="true">⚡</span>
                <span>Multi-model · {activeProviders.join(' · ')}</span>
              </div>
            )}
            <button
              className="theme-toggle"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-label="Toggle dark mode"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {/* ── Command bar ── */}
        <form className="command-bar" onSubmit={onSubmit}>
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
            <button className="analyze-btn" type="submit" disabled={submitDisabled}>
              {loading ? (isCompare ? 'Comparing…' : 'Analyzing…') : isCompare ? 'Compare' : 'Analyze'}
            </button>
          </div>

          <div className="command-sub">
            {!isCompare && (
              <label className="depth-select">
                <span className="depth-label">Framework</span>
                <select value={framework} onChange={(e) => setFramework(e.target.value)} disabled={loading}>
                  {frameworksForMode(mode).map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </label>
            )}
            {mode === 'sector' && (
              <label className="depth-select">
                <span className="depth-label">Country</span>
                <select value={country} onChange={(e) => setCountry(e.target.value)} disabled={loading}>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
            {(isCompare || framework === 'valuechain') && (
              <DomainPicker selected={selectedDomains} onChange={setSelectedDomains} disabled={loading} />
            )}
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
                {isQuick
                  ? `Building ${FRAMEWORKS[framework].label}…`
                  : isCompare
                  ? 'Analyzing both companies…'
                  : cur.steps.length > 0
                  ? `${cur.steps.filter((s) => s.status === 'done').length}/${cur.steps.length} agents done`
                  : 'Researching sources…'}
              </span>
            )}
          </div>
        </form>

        {/* ── Framework lens view (SWOT / Five Forces / PESTEL / Canvas) ── */}
        {isQuick ? (
          <>
            {loading && !(fwMatches && fwResult.data) && (
              <div className="bmc-loading">Building {FRAMEWORKS[framework].label}…</div>
            )}
            {fwMatches && fwResult.error && (
              <div className="error-box">
                <strong>Error:</strong> {fwResult.error}
              </div>
            )}
            {fwMatches && fwResult.data && (
              <div className="results">
                <div className="results-header">
                  <div className="results-id">
                    <span className="results-mode-tag">{FRAMEWORKS[framework].label}</span>
                    {fwResult.country && fwResult.country !== 'Global' && (
                      <span className="geo-tag">📍 {fwResult.country}</span>
                    )}
                    <h2 className="results-title">{fwResult.resultQuery}</h2>
                  </div>
                </div>
                <FrameworkView framework={framework} data={fwResult.data} />
                <p className="bmc-note">{FRAMEWORKS[framework].note}</p>
                <Disclaimer />
              </div>
            )}
          </>
        ) : isCompare ? (
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
            {compareHasData && <Disclaimer />}
          </>
        ) : (
          <>
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
                    {cur.resultCountry && cur.resultCountry !== 'Global' && (
                      <span className="geo-tag">📍 {cur.resultCountry}</span>
                    )}
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
                {cur.analysis && <Disclaimer />}

                <SynthesisCard synthesis={cur.synthesis} />

                {cur.sources.length > 0 && (
                  <details className="sources" open>
                    <summary className="sources-summary">
                      Sources <span className="sources-count">{cur.sources.length}</span>
                    </summary>
                    <ol className="sources-list">
                      {cur.sources.map((s, i) => (
                        <li key={i}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                        </li>
                      ))}
                    </ol>
                    <p className="sources-note">
                      Grounded via {cur.sourcesVia || 'web search'} · links open the original source
                    </p>
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
                          <div className="skeleton-lines"><span /><span /><span /></div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}

                {cur.analysis && (
                  <FollowUpChat
                    query={cur.resultQuery}
                    buildContext={() =>
                      formatAsInterviewNotes(mode, cur.resultQuery, cur.analysis, cur.synthesis, cur.sources)
                    }
                    chat={cur.chat}
                    onChat={(next) => setTabs((p) => ({ ...p, [mode]: { ...p[mode], chat: next } }))}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p>Multi-model · Grounded via Google Search · For strategy &amp; interview prep</p>
        <p className="footer-credit">Developed by Shreyasi &amp; Rohit</p>
      </footer>
    </div>
  );
}
