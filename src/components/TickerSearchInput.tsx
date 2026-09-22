import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { useTickerSearch } from '../hooks/useTickerSearch';
import type { TickerSearchResult } from '@shared/types';

interface Props {
  value: string;
  onChange: (ticker: string) => void;
}

export function TickerSearchInput({ value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const { results, loading, search, clear } = useTickerSearch();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const confirmedRef = useRef(value);
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;

  // Sync query from value only when the parent sets a new confirmed ticker.
  // This prevents onChange('') from erasing what the user is typing.
  useEffect(() => {
    if (value !== '' && value !== confirmedRef.current) {
      setQuery(value);
      confirmedRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectResult = useCallback(
    (result: TickerSearchResult) => {
      setQuery(result.symbol);
      onChange(result.symbol);
      confirmedRef.current = result.symbol;
      setShowDropdown(false);
      setHighlightedIndex(-1);
      clear();
    },
    [onChange, clear],
  );

  const showHint = query !== '' && query !== value;

  const activeDescendant =
    showDropdown && highlightedIndex >= 0 && highlightedIndex < results.length
      ? `${listboxId}-option-${highlightedIndex}`
      : undefined;

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        id={inputId}
        type="text"
        value={query}
        placeholder="Search ticker..."
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
        style={{ width: '100%' }}
        onChange={(e) => {
          const val = e.target.value.toUpperCase();
          setQuery(val);
          if (val !== value) {
            onChange('');
          }
          search(val);
          setShowDropdown(true);
        }}
        onFocus={() => {
          if (results.length > 0) setShowDropdown(true);
        }}
        onKeyDown={(e) => {
          switch (e.key) {
            case 'ArrowDown':
              e.preventDefault();
              if (!showDropdown) {
                setShowDropdown(true);
              } else {
                setHighlightedIndex((prev) =>
                  prev < results.length - 1 ? prev + 1 : 0,
                );
              }
              break;
            case 'ArrowUp':
              e.preventDefault();
              if (showDropdown) {
                setHighlightedIndex((prev) =>
                  prev > 0 ? prev - 1 : results.length - 1,
                );
              }
              break;
            case 'Enter':
              if (
                showDropdown &&
                highlightedIndex >= 0 &&
                highlightedIndex < results.length
              ) {
                e.preventDefault();
                selectResult(results[highlightedIndex]);
              }
              break;
            case 'Escape':
              setShowDropdown(false);
              setHighlightedIndex(-1);
              break;
          }
        }}
      />
      {showHint && (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--danger)',
            marginTop: '0.25rem',
          }}
        >
          Select a ticker from the dropdown to confirm
        </div>
      )}
      {showDropdown && (results.length > 0 || loading) && (
        <div
          id={listboxId}
          role="listbox"
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
          {loading && (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              Searching...
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={r.symbol}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === highlightedIndex}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                background:
                  i === highlightedIndex ? 'var(--bg)' : 'transparent',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={() => setHighlightedIndex(i)}
              onMouseDown={() => selectResult(r)}
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
