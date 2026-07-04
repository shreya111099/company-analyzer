import { useState } from 'react';
import AccordionSection from './components/AccordionSection.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import { SECTIONS, formatAsInterviewNotes } from './utils/schema.js';

export default function App() {
  const [companyName, setCompanyName] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analyzedCompany, setAnalyzedCompany] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!companyName.trim()) return;

    setLoading(true);
    setError('');
    setAnalysis(null);
    setAnalyzedCompany('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`);
      }

      setAnalysis(data.analysis);
      setAnalyzedCompany(companyName.trim());
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!analysis) return;
    const text = formatAsInterviewNotes(analyzedCompany, analysis);
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <h1 className="logo">Company Analyzer</h1>
          <p className="tagline">MBA Case-Interview Framework · Tech + Business Value Chain</p>
        </div>
      </header>

      <main className="main">
        <form className="search-form" onSubmit={handleAnalyze}>
          <div className="input-row">
            <input
              className="company-input"
              type="text"
              placeholder="Enter a company name (e.g. Apple, Stripe, TSMC…)"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <button
              className="analyze-btn"
              type="submit"
              disabled={loading || !companyName.trim()}
            >
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
          {loading && (
            <p className="loading-hint">
              Generating full analysis (may take 15–30 seconds)…
            </p>
          )}
        </form>

        {loading && <LoadingSpinner />}

        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {analysis && (
          <div className="results">
            <div className="results-header">
              <h2 className="results-title">{analyzedCompany}</h2>
              <button
                className={`copy-btn ${copySuccess ? 'copy-btn--success' : ''}`}
                onClick={handleCopy}
              >
                {copySuccess ? 'Copied!' : 'Copy as interview notes'}
              </button>
            </div>

            {SECTIONS.map((section, idx) => (
              <AccordionSection
                key={section.key}
                title={section.label}
                data={analysis[section.key]}
                fields={section.fields}
                defaultOpen={idx === 0}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Powered by Gemini 2.5 Flash · For interview prep use only</p>
      </footer>
    </div>
  );
}
