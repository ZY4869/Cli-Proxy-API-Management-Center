import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { formatUsd } from '@/utils/usage';
import type { BillingAnalytics } from './utils/dashboard';
import styles from './BillingPage.module.scss';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type ViewMode = 'requests' | 'cost';

export type TierDistributionCardProps = {
  loading: boolean;
  analytics: BillingAnalytics;
  isDark: boolean;
  timeRangeLabel: string;
};

export function TierDistributionCard({ loading, analytics, isDark, timeRangeLabel }: TierDistributionCardProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('requests');

  const hasData = useMemo(() => analytics.tiers.some((tier) => (viewMode === 'requests' ? tier.requestCount > 0 : tier.totalCost > 0)), [analytics.tiers, viewMode]);

  const chartData = useMemo(() => ({
    labels: analytics.tiers.map((tier) => tier.label),
    datasets: [
      {
        label: viewMode === 'requests' ? t('billing.requests') : t('billing.cost'),
        data: analytics.tiers.map((tier) => (viewMode === 'requests' ? tier.requestCount : tier.totalCost)),
        backgroundColor: viewMode === 'requests' ? 'rgba(59, 130, 246, 0.28)' : 'rgba(245, 158, 11, 0.28)',
        borderColor: viewMode === 'requests' ? '#3b82f6' : '#f59e0b',
        borderWidth: 1,
        borderRadius: 8,
        maxBarThickness: 28,
      },
    ],
  }), [analytics.tiers, t, viewMode]);

  const chartOptions = useMemo(() => ({
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
            if (viewMode === 'requests') return `${t('billing.requests')}: ${Math.round(value).toLocaleString()}`;
            return `${t('billing.cost')}: ${formatUsd(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(17, 24, 39, 0.72)',
          font: { size: 11 },
        },
      },
      y: {
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(17, 24, 39, 0.06)' },
        ticks: {
          color: isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(17, 24, 39, 0.72)',
          font: { size: 11 },
          callback: (value: string | number) => {
            const num = typeof value === 'number' ? value : Number(value);
            if (viewMode === 'requests') return Math.round(num).toLocaleString();
            return formatUsd(num);
          },
        },
      },
    },
  }), [isDark, t, viewMode]);

  const subtitle = useMemo(() => {
    if (!analytics.hasAnyEnabledRule && viewMode === 'cost') return t('billing.no_enabled_rules');
    return timeRangeLabel;
  }, [analytics.hasAnyEnabledRule, t, timeRangeLabel, viewMode]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>{t('billing.tier_distribution_title')}</h3>
          <p className={styles.chartSubtitle}>{subtitle}</p>
        </div>
        <div className={styles.chartControls}>
          <button
            type="button"
            className={`${styles.chartControlBtn} ${viewMode === 'requests' ? styles.active : ''}`}
            onClick={() => setViewMode('requests')}
          >
            {t('billing.sort_requests')}
          </button>
          <button
            type="button"
            className={`${styles.chartControlBtn} ${viewMode === 'cost' ? styles.active : ''}`}
            onClick={() => setViewMode('cost')}
          >
            {t('billing.sort_cost')}
          </button>
        </div>
      </div>

      <div className={styles.chartContent}>
        {loading ? (
          <div className={styles.chartEmpty}>{t('common.loading')}</div>
        ) : !hasData ? (
          <div className={styles.chartEmpty}>
            {viewMode === 'cost' && !analytics.hasAnyEnabledRule ? t('billing.no_enabled_rules') : t('billing.no_cost_data')}
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

