import { useEffect, useRef, useState } from 'react';

// Google-style autocomplete input. Debounced suggestions from /api/suggest,
// with keyboard navigation (↑/↓/Enter/Esc). Selecting fills the box (it does
// not auto-run — the user confirms with Analyze, since a run costs tokens).
export default function SearchInput({ value, onChange, mode, placeholder, disabled, autoFocus = true }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const timer = useRef(null);
  const lastReq = useRef(0);

  // Debounced fetch whenever the query or mode changes.
  useEffect(() => {
    const q = value.trim();
    clearTimeout(timer.current);
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const reqId = ++lastReq.current;
      try {
        const res = await fetch(`/api/suggest?mode=${mode}&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (reqId !== lastReq.current) return; // a newer request superseded this one
        setSuggestions(data.suggestions || []);
        setActive(-1);
      } catch {
        /* ignore */
      }
    }, 180);
    return () => clearTimeout(timer.current);
  }, [value, mode]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const showList = open && suggestions.length > 0;

  function choose(s) {
    onChange(s);
    setOpen(false);
    setSuggestions([]);
  }

  function handleKeyDown(e) {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (active >= 0) {
        e.preventDefault(); // pick the suggestion instead of submitting
        choose(suggestions[active]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="search-input" ref={boxRef}>
      <input
        className="company-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
      />
      {showList && (
        <ul className="suggest-list" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === active}
              className={`suggest-item ${i === active ? 'suggest-item--active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus, fire before blur
                choose(s);
              }}
            >
              <span className="suggest-icon" aria-hidden="true">🔍</span>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
