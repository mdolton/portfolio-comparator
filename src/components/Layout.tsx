import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div style={{ minHeight: '100vh' }}>
      <header
        style={{
          background: '#fff',
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
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 2rem' }}>{children}</main>
    </div>
  );
}
