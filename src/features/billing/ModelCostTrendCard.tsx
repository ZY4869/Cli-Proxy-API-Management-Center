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
import type { ModelPricingAnalytics } from './modelPricing/analyticsTypes';
import type { CurrencySymbol } from './modelPricing/types';
import { formatMoney } from './modelPricing/money';
import { useBillingCollapse } from './collapse/useBillingCollapse';
import { CollapseToggleButton } from './collapse/CollapseToggleButton';
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

export type ModelCostTrendCardProps = {
  loading: boolean;
  analytics: ModelPricingAnalytics;
  selectedCurrency: CurrencySymbol;
  isDark: boolean;
  isMobile: boolean;
  timeRangeLabel: string;
};

export function ModelCostTrendCard({
  loading,
  analytics,
  selectedCurrency,
  isDark,
  isMobile,
  timeRangeLabel,
}: ModelCostTrendCardProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'hour' | 'day'>('hour');
  const [collapsed, setCollapsed] = useBillingCollapse('chart-cost-trend');

  const series = analytics.trendByCurrency[selectedCurrency]?.[period];

  const { chartData, chartOptions, hasData, subtitle } = useMemo(() => {
    if (!selectedCurrency || !series) {
      return {
        chartData: { labels: [], datasets: [] },
        chartOptions: {},
        hasData: false,
        subtitle: t('billing.select_currency'),
      };
    }

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
            callback: (value: string | number) => formatMoney(selectedCurrency, Number(value)),
          },
        },
      },
    };

    const missing = Number(series.missingRequestCount) || 0;
    const suffix = missing > 0 ? ` | ${t('billing.model_pricing_missing_prices', { missingRequests: missing })}` : '';

    return {
      chartData: data,
      chartOptions: options,
      hasData: series.hasData,
      subtitle: `${timeRangeLabel} | ${selectedCurrency}${suffix}`,
    };
  }, [isDark, isMobile, period, selectedCurrency, series, t, timeRangeLabel]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>{t('billing.cost_trend')}</h3>
          <p className={styles.chartSubtitle}>{subtitle}</p>
        </div>
        <div className={styles.chartHeaderActions}>
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
          <CollapseToggleButton collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
        </div>
      </div>

      {collapsed ? null : (
        <div className={styles.chartContent}>
          {loading ? (
            <div className={styles.chartEmpty}>{t('common.loading')}</div>
          ) : !selectedCurrency ? (
            <div className={styles.chartEmpty}>{t('billing.select_currency')}</div>
          ) : !hasData ? (
            <div className={styles.chartEmpty}>{t('billing.no_cost_data')}</div>
          ) : (
            <div className={styles.chartScroller}>
              <div
                className={styles.chartCanvas}
                style={
                  period === 'hour' ? { minWidth: getHourChartMinWidth(chartData.labels.length, isMobile) } : undefined
                }
              >
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
