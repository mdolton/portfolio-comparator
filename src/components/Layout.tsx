import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

function getInitialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <div style={{ minHeight: '100vh' }}>
      <header
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          padding: '0 2rem',
          display: 'flex',
          alignItems: 'center',
          height: 56,
          gap: '2rem',
        }}
      >
        <Link to="/" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)' }}>
          Portfolio Comparator
        </Link>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <Link
            to="/"
            style={{
              color: location.pathname === '/' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: location.pathname === '/' ? 600 : 400,
            }}
          >
            Dashboard
          </Link>
          <Link
            to="/portfolios"
            style={{
              color: location.pathname.startsWith('/portfolios') ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: location.pathname.startsWith('/portfolios') ? 600 : 400,
            }}
          >
            Portfolios
          </Link>
        </nav>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '0.375rem 0.5rem',
            fontSize: '1.1rem',
            lineHeight: 1,
            cursor: 'pointer',
            color: 'var(--text)',
          }}
        >
          {theme === 'light' ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
        </button>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 2rem' }}>{children}</main>
    </div>
  );
}
