import { useState } from 'react';
import { SECTIONS } from '../utils/schema.js';
import Est from './Est.jsx';

function ComparisonSection({ section, a, b, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const da = a.analysis?.[section.key];
  const db = b.analysis?.[section.key];
  if (!da && !db) return null;

  // Only show fields where at least one side has a value.
  const rows = section.fields.filter((f) => da?.[f.key] || db?.[f.key]);
  if (rows.length === 0) return null;

  return (
    <div className={`accordion ${open ? 'accordion--open' : ''}`}>
      <button className="accordion-header" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="accordion-title">{section.label}</span>
        <span className="accordion-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="accordion-body">
          <div className="cmp-grid">
            {rows.map((f) => (
              <div className="cmp-row" key={f.key}>
                <div className="cmp-field">{f.label}</div>
                <div className="cmp-cell">{da?.[f.key] ? <Est text={da[f.key]} /> : <span className="cmp-empty">—</span>}</div>
                <div className="cmp-cell">{db?.[f.key] ? <Est text={db[f.key]} /> : <span className="cmp-empty">—</span>}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparisonView({ a, b }) {
  const nameA = a.resultQuery || 'Company A';
  const nameB = b.resultQuery || 'Company B';

  return (
    <div className="results">
      {/* Sticky-ish header naming the two columns */}
      <div className="cmp-header">
        <div className="cmp-header-field" />
        <div className="cmp-header-name">{nameA}</div>
        <div className="cmp-header-name">{nameB}</div>
      </div>

      {/* Executive summaries side by side */}
      {(a.synthesis?.executiveSummary || b.synthesis?.executiveSummary) && (
        <div className="cmp-grid cmp-summary">
          <div className="cmp-row">
            <div className="cmp-field">Executive Summary</div>
            <div className="cmp-cell">
              {a.synthesis?.executiveSummary || <span className="cmp-empty">—</span>}
            </div>
            <div className="cmp-cell">
              {b.synthesis?.executiveSummary || <span className="cmp-empty">—</span>}
            </div>
          </div>
        </div>
      )}

      {SECTIONS.map((section, idx) => (
        <ComparisonSection key={section.key} section={section} a={a} b={b} defaultOpen={idx === 0} />
      ))}
    </div>
  );
}
