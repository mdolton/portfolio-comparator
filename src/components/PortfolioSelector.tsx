import type { Portfolio } from '@shared/types';

interface Props {
  portfolios: Portfolio[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

const COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export function PortfolioSelector({ portfolios, selected, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {portfolios.map((p, i) => {
        const isSelected = selected.includes(p.id);
        const color = COLORS[i % COLORS.length];
        return (
          <button
            key={p.id}
            onClick={() => {
              onChange(
                isSelected ? selected.filter((id) => id !== p.id) : [...selected, p.id],
              );
            }}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: 20,
              fontSize: '0.8rem',
              fontWeight: 600,
              border: `2px solid ${color}`,
              background: isSelected ? color : 'transparent',
              color: isSelected ? '#fff' : color,
              transition: 'all 0.15s',
            }}
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

export { COLORS };
