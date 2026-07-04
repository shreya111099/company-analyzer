import { useState } from 'react';

export default function AccordionSection({ title, data, fields, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!data) return null;

  return (
    <div className={`accordion ${open ? 'accordion--open' : ''}`}>
      <button
        className="accordion-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="accordion-title">{title}</span>
        <span className="accordion-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="accordion-body">
          <dl className="field-list">
            {fields.map((field) => {
              const value = data[field.key];
              if (!value) return null;
              return (
                <div className="field-row" key={field.key}>
                  <dt className="field-label">{field.label}</dt>
                  <dd className="field-value">{value}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </div>
  );
}
