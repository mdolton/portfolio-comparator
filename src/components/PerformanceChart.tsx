import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { PerformancePoint, Portfolio } from '@shared/types';
import { COLORS } from './PortfolioSelector';
import { formatCurrency, formatPercent } from '../utils/formatting';

interface Props {
  data: PerformancePoint[];
  portfolios: Portfolio[];
  selectedIds: number[];
  loading: boolean;
  metric: 'value' | 'growth';
}

export function PerformanceChart({ data, portfolios, selectedIds, loading, metric }: Props) {
  if (loading) return <div className="loading">Loading chart data...</div>;

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <p>Select portfolios and a date range to view performance.</p>
      </div>
    );
  }

  const selectedPortfolios = portfolios.filter((p) => selectedIds.includes(p.id));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(d: string) => {
            const date = new Date(d + 'T00:00:00');
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) =>
            metric === 'growth'
              ? `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`
              : `$${(v / 1000).toFixed(0)}k`
          }
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            metric === 'growth' ? formatPercent(value) : formatCurrency(value),
            name,
          ]}
          labelFormatter={(label: string) => {
            const d = new Date(label + 'T00:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          }}
        />
        <Legend />
        {selectedPortfolios.map((p) => (
          <Line
            key={p.id}
            type="monotone"
            dataKey={p.name}
            stroke={COLORS[portfolios.indexOf(p) % COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
