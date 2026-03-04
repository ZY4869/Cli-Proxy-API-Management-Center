import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScriptableContext } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  buildHourlyCostSeries,
  buildDailyCostSeries,
  collectUsageDetailsWithEndpoint,
  formatUsd,
  type ModelPrice
} from '@/utils/usage';
import type { CostMode } from '@/features/billing/types';
import type { BillingCostConfig } from '@/features/billing/utils/costing';
import { buildDailyEndpointCostSeries, buildHourlyEndpointCostSeries } from '@/features/billing/utils/costing';
import { buildChartOptions, getHourChartMinWidth } from '@/utils/usage/chartConfig';
import type { UsagePayload } from './hooks/useUsageData';
import styles from '@/pages/UsagePage.module.scss';

export interface CostTrendChartProps {
  usage: UsagePayload | null;
  loading: boolean;
  isDark: boolean;
  isMobile: boolean;
  modelPrices: Record<string, ModelPrice>;
  costMode: CostMode;
  billingConfig: BillingCostConfig;
  hasEndpointPricing: boolean;
  hourWindowHours?: number;
}

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

export function CostTrendChart({
  usage,
  loading,
  isDark,
  isMobile,
  modelPrices,
  costMode,
  billingConfig,
  hasEndpointPricing,
  hourWindowHours
}: CostTrendChartProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'hour' | 'day'>('hour');
  const hasModelPrices = Object.keys(modelPrices).length > 0;
  const hasCosts = costMode === 'model' ? hasModelPrices : hasEndpointPricing;

  const { chartData, chartOptions, hasData, missingRequestCount } = useMemo(() => {
    if (!hasCosts || !usage) {
      return { chartData: { labels: [], datasets: [] }, chartOptions: {}, hasData: false, missingRequestCount: 0 };
    }

    const series =
      costMode === 'model'
        ? period === 'hour'
          ? buildHourlyCostSeries(usage, modelPrices, hourWindowHours)
          : buildDailyCostSeries(usage, modelPrices)
        : (() => {
            const details = collectUsageDetailsWithEndpoint(usage);
            return period === 'hour'
              ? buildHourlyEndpointCostSeries(details, billingConfig, hourWindowHours)
              : buildDailyEndpointCostSeries(details, billingConfig);
          })();

    const data = {
      labels: series.labels,
      datasets: [
        {
          label: t('usage_stats.total_cost'),
          data: series.data,
          borderColor: COST_COLOR,
          backgroundColor: buildGradient,
          pointBackgroundColor: COST_COLOR,
          pointBorderColor: COST_COLOR,
          fill: true,
          tension: 0.35
        }
      ]
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
            callback: (value: string | number) => formatUsd(Number(value))
          }
        }
      }
    };

    return {
      chartData: data,
      chartOptions: options,
      hasData: series.hasData,
      missingRequestCount: 'missingRequestCount' in series ? Number(series.missingRequestCount) || 0 : 0
    };
  }, [billingConfig, costMode, hasCosts, hourWindowHours, isDark, isMobile, modelPrices, period, t, usage]);

  return (
    <Card
      title={t('usage_stats.cost_trend')}
      extra={
        <div className={styles.periodButtons}>
          <Button
            variant={period === 'hour' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPeriod('hour')}
          >
            {t('usage_stats.by_hour')}
          </Button>
          <Button
            variant={period === 'day' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPeriod('day')}
          >
            {t('usage_stats.by_day')}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className={styles.hint}>{t('common.loading')}</div>
      ) : !hasCosts ? (
        <div className={styles.hint}>
          {costMode === 'model' ? t('usage_stats.cost_need_price') : t('usage_stats.endpoint_cost_need_rule')}
        </div>
      ) : !hasData ? (
        <div className={styles.hint}>
          {costMode === 'endpoint' && missingRequestCount > 0
            ? t('usage_stats.endpoint_cost_missing_rules_hint')
            : t('usage_stats.cost_no_data')}
        </div>
      ) : (
        <div className={styles.chartWrapper}>
          <div className={styles.chartArea}>
            <div className={styles.chartScroller}>
              <div
                className={styles.chartCanvas}
                style={
                  period === 'hour'
                    ? { minWidth: getHourChartMinWidth(chartData.labels.length, isMobile) }
                    : undefined
                }
              >
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
