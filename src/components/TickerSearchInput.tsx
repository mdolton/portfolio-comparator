import { useState, useRef, useEffect } from 'react';
import { useTickerSearch } from '../hooks/useTickerSearch';

interface Props {
  value: string;
  onChange: (ticker: string) => void;
}

export function TickerSearchInput({ value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const { results, loading, search, clear } = useTickerSearch();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        placeholder="Search ticker..."
        style={{ width: '100%' }}
        onChange={(e) => {
          const val = e.target.value.toUpperCase();
          setQuery(val);
          search(val);
          setShowDropdown(true);
        }}
        onFocus={() => {
          if (results.length > 0) setShowDropdown(true);
        }}
      />
      {showDropdown && (results.length > 0 || loading) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 50,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {loading && <div style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>Searching...</div>}
          {results.map((r) => (
            <div
              key={r.symbol}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                setQuery(r.symbol);
                onChange(r.symbol);
                setShowDropdown(false);
                clear();
              }}
            >
              <div style={{ fontWeight: 600 }}>{r.symbol}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {r.name} {r.exchange && `(${r.exchange})`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
