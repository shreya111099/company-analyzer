import { useState } from 'react';
import Est from './Est.jsx';

const PROVIDER_LABEL = { gemini: 'Gemini', groq: 'Groq', huggingface: 'HF' };

export default function AccordionSection({ title, data, fields, defaultOpen, meta, failed }) {
  const [open, setOpen] = useState(defaultOpen);

  // Render even when failed, so the user sees which dimension is unavailable.
  if (!data && !failed) return null;

  const badge = meta
    ? PROVIDER_LABEL[meta.fellBack ? 'gemini' : meta.provider] || meta.provider
    : null;

  return (
    <div className={`accordion ${open ? 'accordion--open' : ''} ${failed ? 'accordion--failed' : ''}`}>
      <button
        className="accordion-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="accordion-title">{title}</span>
        <span className="accordion-meta">
          {failed ? (
            <span className="accordion-badge accordion-badge--failed">unavailable</span>
          ) : (
            badge && <span className="accordion-badge">{badge}</span>
          )}
          <span className="accordion-chevron">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="accordion-body">
          {failed ? (
            <p className="accordion-failed-note">
              This agent didn’t return a result (often a free-tier rate limit). Try again in a
              moment, or add more provider keys to spread the load.
            </p>
          ) : (
            <dl className="field-list">
              {fields.map((field) => {
                const value = data[field.key];
                if (!value) return null;
                return (
                  <div className="field-row" key={field.key}>
                    <dt className="field-label">{field.label}</dt>
                    <dd className="field-value"><Est text={value} /></dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
