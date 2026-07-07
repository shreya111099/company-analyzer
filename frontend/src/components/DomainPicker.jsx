import { useEffect, useRef, useState } from 'react';
import { SECTIONS } from '../utils/schema.js';

// Quick presets over the 12 value-chain domains.
export const CORE_4 = ['strategyAndMarket', 'competition', 'businessModel', 'financials'];
const ALL_KEYS = SECTIONS.map((s) => s.key);
const PRESETS = [
  { label: 'Core 4', keys: CORE_4 },
  { label: 'All 12', keys: ALL_KEYS },
];

// Multi-select over the 12 value-chain domains. Replaces the blunt depth count.
export default function DomainPicker({ selected, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const set = new Set(selected);
  const toggle = (k) => {
    const next = new Set(set);
    next.has(k) ? next.delete(k) : next.add(k);
    onChange([...next]);
  };

  return (
    <div className="domain-picker" ref={ref}>
      <span className="depth-label">Domains</span>
      <button
        type="button"
        className="domain-btn"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
      >
        {selected.length}/12 <span className="domain-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="domain-panel" role="listbox" aria-label="Choose domains to analyze">
          <div className="domain-presets">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => onChange(p.keys)}>
                {p.label}
              </button>
            ))}
            <button type="button" onClick={() => onChange([])}>Clear</button>
          </div>
          <ul className="domain-list">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <label className="domain-item">
                  <input type="checkbox" checked={set.has(s.key)} onChange={() => toggle(s.key)} />
                  <span>{s.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
