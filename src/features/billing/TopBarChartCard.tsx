import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { formatCompactNumber } from '@/utils/usage';
import styles from './BillingPage.module.scss';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export type TopBarChartViewMode = 'cost' | 'requests' | 'tokens';

export type TopBarChartItem = {
  label: string;
  cost: number;
  requests: number;
  tokens: number;
};

export type TopBarChartCardProps = {
  title: string;
  subtitle: string;
  loading: boolean;
  isDark: boolean;
  items: TopBarChartItem[];
  costLabel: string;
  requestsLabel: string;
  tokensLabel: string;
  costFormatter: (value: number) => string;
  emptyText: string;
};

const MODE_COLORS: Record<TopBarChartViewMode, string> = {
  cost: '#f59e0b',
  requests: '#3b82f6',
  tokens: '#8b5cf6',
};

const MODE_BG: Record<TopBarChartViewMode, string> = {
  cost: 'rgba(245, 158, 11, 0.28)',
  requests: 'rgba(59, 130, 246, 0.28)',
  tokens: 'rgba(139, 92, 246, 0.28)',
};

function shortenLabel(label: string, maxLen: number) {
  const safeMax = Math.max(maxLen, 4);
  if (!label) return '';
  if (label.length <= safeMax) return label;
  return `${label.slice(0, safeMax - 3)}...`;
}

export function TopBarChartCard({
  title,
  subtitle,
  loading,
  isDark,
  items,
  costLabel,
  requestsLabel,
  tokensLabel,
  costFormatter,
  emptyText,
}: TopBarChartCardProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<TopBarChartViewMode>('cost');

  const top = useMemo(() => {
    return items
      .map((e) => ({
        label: e.label,
        value: viewMode === 'cost' ? e.cost : viewMode === 'requests' ? e.requests : e.tokens,
      }))
      .filter((x) => Number.isFinite(x.value) && x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [items, viewMode]);

  const hasData = top.length > 0;

  const chartData = useMemo(
    () => ({
      labels: top.map((x) => x.label),
      datasets: [
        {
          label: viewMode === 'cost' ? costLabel : viewMode === 'requests' ? requestsLabel : tokensLabel,
          data: top.map((x) => x.value),
          backgroundColor: MODE_BG[viewMode],
          borderColor: MODE_COLORS[viewMode],
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: 18,
        },
      ],
    }),
    [costLabel, requestsLabel, tokensLabel, top, viewMode]
  );

  const chartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? 'rgba(17, 24, 39, 0.92)' : 'rgba(255, 255, 255, 0.98)',
          titleColor: isDark ? '#ffffff' : '#111827',
          bodyColor: isDark ? 'rgba(255, 255, 255, 0.86)' : '#374151',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(17, 24, 39, 0.10)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: (ctx: any[]) => ctx?.[0]?.label ?? '',
            label: (ctx: any) => {
              const value = Number(ctx.raw) || 0;
              if (viewMode === 'cost') return `${costLabel}: ${costFormatter(value)}`;
              if (viewMode === 'requests') return `${requestsLabel}: ${Math.round(value).toLocaleString()}`;
              return `${tokensLabel}: ${formatCompactNumber(value)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(17, 24, 39, 0.06)' },
          ticks: {
            color: isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(17, 24, 39, 0.72)',
            font: { size: 11 },
            callback: (value: string | number) => {
              const num = typeof value === 'number' ? value : Number(value);
              if (viewMode === 'cost') return costFormatter(num);
              if (viewMode === 'requests') return Math.round(num).toLocaleString();
              return formatCompactNumber(num);
            },
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(17, 24, 39, 0.72)',
            font: { size: 11 },
            callback: (value: string | number, index: number) => shortenLabel(top[index]?.label ?? String(value), 26),
          },
        },
      },
    }),
    [costFormatter, costLabel, isDark, requestsLabel, tokensLabel, top, viewMode]
  );

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>{title}</h3>
          <p className={styles.chartSubtitle}>{subtitle}</p>
        </div>
        <div className={styles.chartControls}>
          <button
            type="button"
            className={`${styles.chartControlBtn} ${viewMode === 'cost' ? styles.active : ''}`}
            onClick={() => setViewMode('cost')}
          >
            {t('billing.sort_cost')}
          </button>
          <button
            type="button"
            className={`${styles.chartControlBtn} ${viewMode === 'requests' ? styles.active : ''}`}
            onClick={() => setViewMode('requests')}
          >
            {t('billing.sort_requests')}
          </button>
          <button
            type="button"
            className={`${styles.chartControlBtn} ${viewMode === 'tokens' ? styles.active : ''}`}
            onClick={() => setViewMode('tokens')}
          >
            {t('billing.sort_tokens')}
          </button>
        </div>
      </div>

      <div className={styles.chartContent}>
        {loading ? (
          <div className={styles.chartEmpty}>{t('common.loading')}</div>
        ) : !hasData ? (
          <div className={styles.chartEmpty}>{emptyText}</div>
        ) : (
          <div className={styles.barChartContent}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        )}
      </div>
    </div>
  );
}

