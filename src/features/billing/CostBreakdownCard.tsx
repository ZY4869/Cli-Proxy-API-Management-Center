import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { formatUsd } from '@/utils/usage';
import type { BillingAnalytics } from './utils/dashboard';
import styles from './BillingPage.module.scss';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = [
  '#22c55e', // input
  '#f97316', // output
  '#3b82f6', // cache read
  '#8b5cf6', // cache storage
];

const BORDER_LIGHT = '#ffffff';
const BORDER_DARK = '#1f2937';

export type CostBreakdownCardProps = {
  loading: boolean;
  analytics: BillingAnalytics;
  isDark: boolean;
  timeRangeLabel: string;
};

export function CostBreakdownCard({ loading, analytics, isDark, timeRangeLabel }: CostBreakdownCardProps) {
  const { t } = useTranslation();

  const pieces = useMemo(
    () => [
      { key: 'input', label: t('billing.input_cost'), value: analytics.costs.inputCost, color: COLORS[0] },
      { key: 'output', label: t('billing.output_cost'), value: analytics.costs.outputCost, color: COLORS[1] },
      { key: 'cacheRead', label: t('billing.cache_read_cost'), value: analytics.costs.cacheReadCost, color: COLORS[2] },
      { key: 'cacheStorage', label: t('billing.cache_storage_cost'), value: analytics.costs.cacheStorageCost, color: COLORS[3] },
    ],
    [analytics.costs.cacheReadCost, analytics.costs.cacheStorageCost, analytics.costs.inputCost, analytics.costs.outputCost, t]
  );

  const total = useMemo(() => pieces.reduce((sum, p) => sum + (Number.isFinite(p.value) ? p.value : 0), 0), [pieces]);
  const hasData = total > 0 && analytics.hasAnyEnabledRule;

  const chartData = useMemo(
    () => ({
      labels: pieces.map((p) => p.label),
      datasets: [
        {
          data: pieces.map((p) => p.value),
          backgroundColor: pieces.map((p) => p.color),
          borderColor: isDark ? BORDER_DARK : BORDER_LIGHT,
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    }),
    [isDark, pieces]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
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
            label: (context: any) => {
              const value = Number(context.raw) || 0;
              const percent = total > 0 ? (value / total) * 100 : 0;
              return `${context.label}: ${formatUsd(value)} (${percent.toFixed(1)}%)`;
            },
          },
        },
      },
    }),
    [isDark, total]
  );

  const subtitle = useMemo(() => {
    if (!analytics.hasAnyEnabledRule) return t('billing.no_enabled_rules');
    if (analytics.missingCostRequestCount > 0) {
      return `${timeRangeLabel} | ${t('billing.missing_rules_short', { missingRequests: analytics.missingCostRequestCount })}`;
    }
    return timeRangeLabel;
  }, [analytics.hasAnyEnabledRule, analytics.missingCostRequestCount, t, timeRangeLabel]);

  const glowBg = useMemo(() => {
    const base = 'rgba(245, 158, 11, 0.28)';
    const fade = isDark ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.06)';
    return `radial-gradient(circle at 30% 30%, ${base} 0%, ${fade} 40%, rgba(0, 0, 0, 0) 70%)`;
  }, [isDark]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>{t('billing.cost_breakdown_title')}</h3>
          <p className={styles.chartSubtitle}>{subtitle}</p>
        </div>
      </div>

      <div className={styles.chartContent}>
        {loading ? (
          <div className={styles.chartEmpty}>{t('common.loading')}</div>
        ) : !analytics.hasAnyEnabledRule ? (
          <div className={styles.chartEmpty}>{t('billing.no_enabled_rules')}</div>
        ) : !hasData ? (
          <div className={styles.chartEmpty}>{t('billing.no_cost_data')}</div>
        ) : (
          <div className={styles.breakdownContent}>
            <div className={styles.donutWrapper}>
              <Doughnut data={chartData} options={chartOptions} />
              <div className={styles.donutCenter}>
                <div className={styles.donutLabel}>{t('billing.total_cost')}</div>
                <div className={styles.donutValue}>{formatUsd(total)}</div>
              </div>
              <div className={styles.donutGlow} style={{ background: glowBg }} aria-hidden="true" />
            </div>
            <div className={styles.legendList}>
              {pieces.map((p, idx) => {
                const percent = total > 0 ? (p.value / total) * 100 : 0;
                return (
                  <div key={p.key} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ backgroundColor: COLORS[idx] }} />
                    <span className={styles.legendName}>{p.label}</span>
                    <span className={styles.legendValue}>
                      {formatUsd(p.value)} ({percent.toFixed(1)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

