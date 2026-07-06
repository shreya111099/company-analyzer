import { useState } from 'react';
import AccordionSection from './components/AccordionSection.jsx';
import ProgressTracker from './components/ProgressTracker.jsx';
import SynthesisCard from './components/SynthesisCard.jsx';
import ModeToggle from './components/ModeToggle.jsx';
import { SECTIONS, sectionLabel, formatAsInterviewNotes } from './utils/schema.js';

const PLACEHOLDER = {
  company: 'Enter a company (e.g. Apple, Stripe, TSMC…)',
  sector: 'Enter a sector (e.g. EV charging, cloud infra…)',
};

// Each mode keeps its own independent state, so switching tabs preserves results.
const emptyTab = () => ({
  query: '',
  analysis: null,
  synthesis: null,
  meta: {},
  steps: [],
  error: '',
  mismatch: null,
  resultQuery: '',
});

// Parse a Server-Sent Events stream from a fetch Response body, invoking
// onEvent(eventName, data) for each complete event block.
async function consumeSSE(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split('\n\n');
    buffer = blocks.pop(); // keep incomplete tail

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

export default function App() {
  const [mode, setMode] = useState('company');
  const [domainCount, setDomainCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [tabs, setTabs] = useState({ company: emptyTab(), sector: emptyTab() });

  const cur = tabs[mode];

  // Merge a patch into one mode's state.
  const patchTab = (m, patch) =>
    setTabs((prev) => ({ ...prev, [m]: { ...prev[m], ...patch } }));

  // Insert/update one progress row within a mode's step list.
  function updateStep(m, key, patch) {
    setTabs((prev) => {
      const t = prev[m];
      const i = t.steps.findIndex((s) => s.key === key);
      let steps;
      if (i === -1) steps = [...t.steps, { key, status: 'queued', ...patch }];
      else {
        steps = [...t.steps];
        steps[i] = { ...steps[i], ...patch };
      }
      return { ...prev, [m]: { ...t, steps } };
    });
  }

  // Switching mode preserves each tab's state — no clearing here.
  function handleModeChange(next) {
    if (next === mode) return;
    setMode(next);
  }

  async function handleAnalyze(e, override = {}) {
    if (e && e.preventDefault) e.preventDefault();
    const runMode = override.mode || mode;
    const q = (override.query ?? tabs[runMode].query).trim();
    if (!q) return;

    setLoading(true);
    // Reset only the target tab's results (a new Analyze clears that tab).
    patchTab(runMode, {
      query: q,
      analysis: null,
      synthesis: null,
      meta: {},
      steps: [],
      error: '',
      mismatch: null,
      resultQuery: q,
    });

    try {
      const res = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: runMode, query: q, domainCount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      await consumeSSE(res, (event, data) => {
        switch (event) {
          case 'mismatch':
            patchTab(runMode, { mismatch: { detected: data.detected, expected: data.expected } });
            break;
          case 'plan':
            patchTab(runMode, {
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
            updateStep(runMode, data.key, { status: 'queued', label: data.label, provider: data.provider });
            break;
          case 'agent:running':
            updateStep(runMode, data.key, { status: 'running', label: data.label });
            break;
          case 'agent:done':
            updateStep(runMode, data.key, { status: 'done', provider: data.provider });
            if (data.key === 'synthesis') {
              patchTab(runMode, { synthesis: data.data });
            } else if (data.key !== 'framing' && data.data) {
              setTabs((prev) => {
                const t = prev[runMode];
                return {
                  ...prev,
                  [runMode]: {
                    ...t,
                    analysis: { ...(t.analysis || {}), [data.key]: data.data },
                    meta: { ...t.meta, [data.key]: { provider: data.provider } },
                  },
                };
              });
            }
            break;
          case 'agent:error':
            updateStep(runMode, data.key, { status: 'error' });
            break;
          case 'error':
            patchTab(runMode, { error: data.error || 'Analysis failed.' });
            break;
          default:
            break;
        }
      });
    } catch (err) {
      patchTab(runMode, { error: err.message || 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!cur.analysis) return;
    const text = formatAsInterviewNotes(mode, cur.resultQuery, cur.analysis, cur.synthesis);
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

  const hasResults = cur.analysis || cur.synthesis;
  const failedKeys = new Set(cur.steps.filter((s) => s.status === 'error').map((s) => s.key));

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <h1 className="logo">Strategic Analyzer</h1>
          <p className="tagline">Multi-Agent · Sector &amp; Company Value-Chain Analysis</p>
        </div>
      </header>

      <main className="main">
        <form className="search-form" onSubmit={handleAnalyze}>
          <div className="controls-row">
            <ModeToggle mode={mode} onChange={handleModeChange} disabled={loading} />
            <label className="depth-select">
              <span className="depth-label">Domains</span>
              <select
                value={domainCount}
                onChange={(e) => setDomainCount(Number(e.target.value))}
                disabled={loading}
              >
                <option value={2}>2 · Quick</option>
                <option value={4}>4 · Standard</option>
                <option value={6}>6 · Deep</option>
                <option value={8}>8 · Extensive</option>
                <option value={12}>12 · Full</option>
              </select>
            </label>
          </div>
          <div className="input-row">
            <input
              className="company-input"
              type="text"
              placeholder={PLACEHOLDER[mode]}
              value={cur.query}
              onChange={(e) => patchTab(mode, { query: e.target.value })}
              disabled={loading}
              autoFocus
            />
            <button className="analyze-btn" type="submit" disabled={loading || !cur.query.trim()}>
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
          {loading && (
            <p className="loading-hint">
              {cur.steps.length > 0
                ? `Running ${cur.steps.length} agents across free-tier models…`
                : 'Checking your input…'}
            </p>
          )}
        </form>

        {loading && cur.steps.length > 0 && <ProgressTracker steps={cur.steps} />}

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
                patchTab(detected, { query: q });
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
              <div>
                <span className="results-mode-tag">{mode === 'sector' ? 'Sector' : 'Company'}</span>
                <h2 className="results-title">{cur.resultQuery}</h2>
              </div>
              {cur.analysis && (
                <button
                  className={`copy-btn ${copySuccess ? 'copy-btn--success' : ''}`}
                  onClick={handleCopy}
                >
                  {copySuccess ? 'Copied!' : 'Copy as interview notes'}
                </button>
              )}
            </div>

            <SynthesisCard synthesis={cur.synthesis} />

            {SECTIONS.map((section, idx) => (
              <AccordionSection
                key={section.key}
                title={sectionLabel(section, mode)}
                data={cur.analysis?.[section.key]}
                fields={section.fields}
                meta={cur.meta[section.key]}
                failed={!cur.analysis?.[section.key] && failedKeys.has(section.key)}
                defaultOpen={idx === 0}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Multi-model · Gemini + Groq + Hugging Face · For strategy &amp; interview prep</p>
      </footer>
    </div>
  );
}
