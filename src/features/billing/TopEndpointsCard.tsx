import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { formatCompactNumber, formatUsd } from '@/utils/usage';
import type { BillingAnalytics } from './utils/dashboard';
import styles from './BillingPage.module.scss';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type ViewMode = 'cost' | 'requests' | 'tokens';

const MODE_COLORS: Record<ViewMode, string> = {
  cost: '#f59e0b',
  requests: '#3b82f6',
  tokens: '#8b5cf6',
};

const MODE_BG: Record<ViewMode, string> = {
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

export type TopEndpointsCardProps = {
  loading: boolean;
  analytics: BillingAnalytics;
  isDark: boolean;
  timeRangeLabel: string;
};

export function TopEndpointsCard({ loading, analytics, isDark, timeRangeLabel }: TopEndpointsCardProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('cost');

  const candidates = useMemo(() => analytics.endpoints.filter((e) => e.requests > 0), [analytics.endpoints]);

  const top = useMemo(() => {
    const list = viewMode === 'cost' ? candidates.filter((e) => e.costKnown) : candidates;
    return list
      .map((e) => {
        const value =
          viewMode === 'cost' ? e.costs.totalCost : viewMode === 'requests' ? e.requests : e.promptTokens + e.outputBillableTokens;
        return { endpoint: e.endpointKey, value: Number.isFinite(value) ? value : 0 };
      })
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [candidates, viewMode]);

  const hasData = top.length > 0;

  const chartData = useMemo(
    () => ({
      labels: top.map((x) => x.endpoint),
      datasets: [
        {
          label:
            viewMode === 'cost'
              ? t('billing.sort_cost')
              : viewMode === 'requests'
                ? t('billing.sort_requests')
                : t('billing.sort_tokens'),
          data: top.map((x) => x.value),
          backgroundColor: MODE_BG[viewMode],
          borderColor: MODE_COLORS[viewMode],
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: 18,
        },
      ],
    }),
    [t, top, viewMode]
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
            title: (items: any[]) => items?.[0]?.label ?? '',
            label: (ctx: any) => {
              const value = Number(ctx.raw) || 0;
              if (viewMode === 'cost') return `${t('billing.cost')}: ${formatUsd(value)}`;
              if (viewMode === 'requests') return `${t('billing.requests')}: ${Math.round(value).toLocaleString()}`;
              return `${t('billing.tokens')}: ${formatCompactNumber(value)}`;
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
              if (viewMode === 'cost') return formatUsd(num);
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
            callback: (value: string | number, index: number) =>
              shortenLabel(top[index]?.endpoint ?? String(value), 26),
          },
        },
      },
    }),
    [isDark, t, top, viewMode]
  );

  const subtitle = useMemo(() => {
    if (!analytics.hasAnyEnabledRule && viewMode === 'cost') return t('billing.no_enabled_rules');
    if (viewMode === 'cost' && analytics.missingCostRequestCount > 0) {
      return `${timeRangeLabel} | ${t('billing.missing_rules_short', { missingRequests: analytics.missingCostRequestCount })}`;
    }
    return timeRangeLabel;
  }, [analytics.hasAnyEnabledRule, analytics.missingCostRequestCount, t, timeRangeLabel, viewMode]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>{t('billing.top_endpoints_title')}</h3>
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
          <div className={styles.chartEmpty}>
            {viewMode === 'cost' && !analytics.hasAnyEnabledRule ? t('billing.no_enabled_rules') : t('billing.no_endpoints')}
          </div>
        ) : (
          <div className={styles.barChartContent}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        )}
      </div>
    </div>
  );
}
