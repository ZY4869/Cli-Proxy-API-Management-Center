import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScriptableContext } from 'chart.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { buildChartOptions, getHourChartMinWidth } from '@/utils/usage/chartConfig';
import { formatUsd } from '@/utils/usage';
import type { BillingAnalytics } from './utils/dashboard';
import styles from './BillingPage.module.scss';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const COST_COLOR = '#f59e0b';
const COST_BG = 'rgba(245, 158, 11, 0.15)';

function buildGradient(ctx: ScriptableContext<'line'>) {
  const chart = ctx.chart;
  const area = chart.chartArea;
  if (!area) return COST_BG;
  const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, 'rgba(245, 158, 11, 0.28)');
  gradient.addColorStop(0.6, 'rgba(245, 158, 11, 0.12)');
  gradient.addColorStop(1, 'rgba(245, 158, 11, 0.02)');
  return gradient;
}

export type CostTrendCardProps = {
  loading: boolean;
  analytics: BillingAnalytics;
  isDark: boolean;
  isMobile: boolean;
  timeRangeLabel: string;
};

export function CostTrendCard({ loading, analytics, isDark, isMobile, timeRangeLabel }: CostTrendCardProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'hour' | 'day'>('hour');

  const { chartData, chartOptions, hasData, missingRequestCount, subtitle } = useMemo(() => {
    if (!analytics.hasAnyEnabledRule) {
      return {
        chartData: { labels: [], datasets: [] },
        chartOptions: {},
        hasData: false,
        missingRequestCount: 0,
        subtitle: t('billing.no_enabled_rules'),
      };
    }

    const series = period === 'hour' ? analytics.trend.hour : analytics.trend.day;
    const data = {
      labels: series.labels,
      datasets: [
        {
          label: t('billing.total_cost'),
          data: series.data,
          borderColor: COST_COLOR,
          backgroundColor: buildGradient,
          pointBackgroundColor: COST_COLOR,
          pointBorderColor: COST_COLOR,
          fill: true,
          tension: 0.35,
        },
      ],
    };

    const baseOptions = buildChartOptions({ period, labels: series.labels, isDark, isMobile });
    const options = {
      ...baseOptions,
      scales: {
        ...baseOptions.scales,
        y: {
          ...baseOptions.scales?.y,
          ticks: {
            ...(baseOptions.scales?.y && 'ticks' in baseOptions.scales.y ? baseOptions.scales.y.ticks : {}),
            callback: (value: string | number) => formatUsd(Number(value)),
          },
        },
      },
    };

    return {
      chartData: data,
      chartOptions: options,
      hasData: series.hasData,
      missingRequestCount: series.missingRequestCount,
      subtitle:
        series.missingRequestCount > 0
          ? `${timeRangeLabel} | ${t('billing.missing_rules_short', { missingRequests: series.missingRequestCount })}`
          : timeRangeLabel,
    };
  }, [analytics.hasAnyEnabledRule, analytics.trend.day, analytics.trend.hour, isDark, isMobile, period, t, timeRangeLabel]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>{t('billing.cost_trend')}</h3>
          <p className={styles.chartSubtitle}>{subtitle}</p>
        </div>
        <div className={styles.chartControls}>
          <button
            type="button"
            className={`${styles.chartControlBtn} ${period === 'hour' ? styles.active : ''}`}
            onClick={() => setPeriod('hour')}
          >
            {t('usage_stats.by_hour')}
          </button>
          <button
            type="button"
            className={`${styles.chartControlBtn} ${period === 'day' ? styles.active : ''}`}
            onClick={() => setPeriod('day')}
          >
            {t('usage_stats.by_day')}
          </button>
        </div>
      </div>

      <div className={styles.chartContent}>
        {loading ? (
          <div className={styles.chartEmpty}>{t('common.loading')}</div>
        ) : !analytics.hasAnyEnabledRule ? (
          <div className={styles.chartEmpty}>{t('billing.no_enabled_rules')}</div>
        ) : !hasData ? (
          <div className={styles.chartEmpty}>
            {missingRequestCount > 0 ? t('billing.missing_rules_chart_hint') : t('billing.no_cost_data')}
          </div>
        ) : (
          <div className={styles.chartScroller}>
            <div
              className={styles.chartCanvas}
              style={period === 'hour' ? { minWidth: getHourChartMinWidth(chartData.labels.length, isMobile) } : undefined}
            >
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

