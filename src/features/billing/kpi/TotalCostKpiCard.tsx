import { useTranslation } from 'react-i18next';
import type { CurrencyCostMap, CurrencyCostTotals } from '../modelPricing/analyticsTypes';
import type { CurrencySymbol } from '../modelPricing/types';
import { formatMoney } from '../modelPricing/money';
import { useBillingCollapse } from '../collapse/useBillingCollapse';
import { CollapseToggleButton } from '../collapse/CollapseToggleButton';
import { KpiMiniCard } from './KpiMiniCard';
import styles from '../BillingPage.module.scss';

export type TotalCostKpiCardProps = {
  loading: boolean;
  timeRangeLabel: string;
  totalsByCurrency: CurrencyCostMap;
  selectedCurrency: CurrencySymbol;
  selectedTotals?: CurrencyCostTotals;
  missingCostRequestCount: number;
};

const renderMoneyList = (amounts: CurrencyCostMap, loading: boolean) => {
  if (loading) return '--';
  const entries = Object.entries(amounts)
    .filter(([, v]) => Number.isFinite(v.totalCost) && v.totalCost !== 0)
    .sort((a, b) => (b[1].totalCost ?? 0) - (a[1].totalCost ?? 0) || a[0].localeCompare(b[0]));
  if (!entries.length) return '--';
  return (
    <div className={styles.moneyList}>
      {entries.map(([symbol, totals]) => (
        <div key={symbol} className={styles.moneyItem}>
          {formatMoney(symbol, totals.totalCost)}
        </div>
      ))}
    </div>
  );
};

export function TotalCostKpiCard({
  loading,
  timeRangeLabel,
  totalsByCurrency,
  selectedCurrency,
  selectedTotals,
  missingCostRequestCount,
}: TotalCostKpiCardProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useBillingCollapse('kpi-total-cost');

  return (
    <div className={`${styles.kpiCard} ${styles.amber}`}>
      <div className={styles.kpiTitle}>
        <span className={styles.kpiLabel}>{t('billing.total_cost')}</span>
        <span className={styles.kpiTitleActions}>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
          <CollapseToggleButton collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
        </span>
      </div>
      <div className={styles.kpiValue}>{renderMoneyList(totalsByCurrency, loading)}</div>
      {collapsed ? null : (
        <>
          <div className={styles.kpiMiniGrid}>
            <KpiMiniCard
              label={t('billing.model_pricing_prompt_cost')}
              value={!selectedTotals || loading ? '--' : formatMoney(selectedCurrency, selectedTotals.promptCost)}
            />
            <KpiMiniCard
              label={t('billing.model_pricing_completion_cost')}
              value={!selectedTotals || loading ? '--' : formatMoney(selectedCurrency, selectedTotals.completionCost)}
            />
            <KpiMiniCard
              label={t('billing.model_pricing_cache_cost')}
              value={!selectedTotals || loading ? '--' : formatMoney(selectedCurrency, selectedTotals.cacheCost)}
            />
          </div>
          <div className={styles.kpiMeta}>
            {!selectedTotals ? <span className={styles.kpiSubtle}>{t('billing.select_currency')}</span> : null}
            {missingCostRequestCount > 0 ? (
              <span className={styles.kpiSubtle}>
                {t('billing.model_pricing_missing_prices', { missingRequests: missingCostRequestCount })}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

