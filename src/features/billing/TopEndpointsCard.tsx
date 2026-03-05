import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Card } from '@/components/ui/Card';
import { formatCompactNumber } from '@/utils/usage';
import type { EndpointAggregateForAnalysis } from './modelPricing/analyticsTypes';
import type { CurrencySymbol } from './modelPricing/types';
import { formatMoney } from './modelPricing/money';
import type { TopBarChartItem, TopBarChartViewMode } from './TopBarChartCard';
import { useBillingCollapse } from './collapse/useBillingCollapse';
import { CollapseToggleButton } from './collapse/CollapseToggleButton';
import { EndpointAnalysisList } from './EndpointAnalysisListCard';
import styles from '@/pages/UsagePage.module.scss';
import billingStyles from './BillingPage.module.scss';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type TopEndpointsView = 'chart' | 'list';

export type TopEndpointsCardProps = {
  loading: boolean;
  isDark: boolean;
  timeRangeLabel: string;
  selectedCurrency: CurrencySymbol;
  topItems: TopBarChartItem[];
  endpoints: EndpointAggregateForAnalysis[];
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

export function TopEndpointsCard({
  loading,
  isDark,
  timeRangeLabel,
  selectedCurrency,
  topItems,
  endpoints,
}: TopEndpointsCardProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useBillingCollapse('table-endpoint-analysis');
  const [view, setView] = useState<TopEndpointsView>('list');
  const [viewMode, setViewMode] = useState<TopBarChartViewMode>('cost');

  const top = useMemo(() => {
    return topItems
      .map((e) => ({
        label: e.label,
        value: viewMode === 'cost' ? e.cost : viewMode === 'requests' ? e.requests : e.tokens,
      }))
      .filter((x) => Number.isFinite(x.value) && x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [topItems, viewMode]);

  const hasData = top.length > 0;
  const costFormatter = useMemo(() => (v: number) => formatMoney(selectedCurrency, v), [selectedCurrency]);

  const chartData = useMemo(
    () => ({
      labels: top.map((x) => x.label),
      datasets: [
        {
          label:
            viewMode === 'cost'
              ? t('billing.cost')
              : viewMode === 'requests'
                ? t('billing.requests')
                : t('billing.tokens'),
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
            title: (ctx: any[]) => ctx?.[0]?.label ?? '',
            label: (ctx: any) => {
              const value = Number(ctx.raw) || 0;
              if (viewMode === 'cost') return `${t('billing.cost')}: ${costFormatter(value)}`;
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
    [costFormatter, isDark, t, top, viewMode]
  );

  return (
    <Card
      title={t('billing.top_endpoints_title')}
      subtitle={`${timeRangeLabel} | ${selectedCurrency || t('billing.select_currency')}`}
      className={styles.detailsFixedCard}
      extra={
        <div className={billingStyles.chartHeaderActions}>
          <div className={billingStyles.chartControls}>
            <button
              type="button"
              className={`${billingStyles.chartControlBtn} ${view === 'chart' ? billingStyles.active : ''}`}
              onClick={() => setView('chart')}
            >
              {t('common.chart', { defaultValue: '图表' })}
            </button>
            <button
              type="button"
              className={`${billingStyles.chartControlBtn} ${view === 'list' ? billingStyles.active : ''}`}
              onClick={() => setView('list')}
            >
              {t('common.list', { defaultValue: '列表' })}
            </button>
          </div>
          <CollapseToggleButton collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
        </div>
      }
    >
      {collapsed ? null : view === 'list' ? (
        <EndpointAnalysisList loading={loading} endpoints={endpoints} selectedCurrency={selectedCurrency} />
      ) : (
        <>
          <div className={billingStyles.chartHeaderActions}>
            <div className={billingStyles.chartControls}>
              <button
                type="button"
                className={`${billingStyles.chartControlBtn} ${viewMode === 'cost' ? billingStyles.active : ''}`}
                onClick={() => setViewMode('cost')}
              >
                {t('billing.sort_cost')}
              </button>
              <button
                type="button"
                className={`${billingStyles.chartControlBtn} ${viewMode === 'requests' ? billingStyles.active : ''}`}
                onClick={() => setViewMode('requests')}
              >
                {t('billing.sort_requests')}
              </button>
              <button
                type="button"
                className={`${billingStyles.chartControlBtn} ${viewMode === 'tokens' ? billingStyles.active : ''}`}
                onClick={() => setViewMode('tokens')}
              >
                {t('billing.sort_tokens')}
              </button>
            </div>
          </div>

          <div className={billingStyles.chartContent}>
            {loading ? (
              <div className={billingStyles.chartEmpty}>{t('common.loading')}</div>
            ) : !hasData ? (
              <div className={billingStyles.chartEmpty}>{t('billing.no_endpoints')}</div>
            ) : (
              <div className={billingStyles.barChartContent}>
                <Bar data={chartData} options={chartOptions} />
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

