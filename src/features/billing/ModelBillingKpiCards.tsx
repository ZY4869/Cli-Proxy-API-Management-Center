import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCompactNumber } from '@/utils/usage';
import type { CurrencyCostMap, ModelPricingAnalytics } from './modelPricing/analyticsTypes';
import type { CurrencySymbol } from './modelPricing/types';
import { formatMoney } from './modelPricing/money';
import styles from './BillingPage.module.scss';

export type ModelBillingKpiCardsProps = {
  loading: boolean;
  timeRangeLabel: string;
  analytics: ModelPricingAnalytics;
  selectedCurrency: CurrencySymbol;
};

const formatPercent = (ratio: number, digits: number = 1) => {
  const safe = Number.isFinite(ratio) ? ratio : 0;
  return `${(safe * 100).toFixed(digits)}%`;
};

const sumTokens = (analytics: ModelPricingAnalytics) => {
  return analytics.models.reduce(
    (acc, m) => {
      acc.inputTokens += m.inputTokens;
      acc.cachedTokens += m.cachedTokens;
      acc.promptBillableTokens += m.promptBillableTokens;
      acc.outputBillableTokens += m.outputBillableTokens;
      return acc;
    },
    { inputTokens: 0, cachedTokens: 0, promptBillableTokens: 0, outputBillableTokens: 0 }
  );
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

export function ModelBillingKpiCards({ loading, timeRangeLabel, analytics, selectedCurrency }: ModelBillingKpiCardsProps) {
  const { t } = useTranslation();

  const successRate = useMemo(() => {
    if (analytics.requestCount <= 0) return 0;
    return analytics.successCount / analytics.requestCount;
  }, [analytics.requestCount, analytics.successCount]);

  const tokenTotals = useMemo(() => sumTokens(analytics), [analytics]);

  const selectedTotals = analytics.totalsByCurrency[selectedCurrency];

  return (
    <div className={styles.kpiGrid}>
      <div className={`${styles.kpiCard} ${styles.amber}`}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('billing.total_cost')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>{renderMoneyList(analytics.totalsByCurrency, loading)}</div>
        <div className={styles.kpiMeta}>
          {selectedTotals ? (
            <>
              <span>
                {t('billing.model_pricing_prompt_cost')}: {loading ? '--' : formatMoney(selectedCurrency, selectedTotals.promptCost)}
              </span>
              <span>
                {t('billing.model_pricing_completion_cost')}: {loading ? '--' : formatMoney(selectedCurrency, selectedTotals.completionCost)}
              </span>
              <span>
                {t('billing.model_pricing_cache_cost')}: {loading ? '--' : formatMoney(selectedCurrency, selectedTotals.cacheCost)}
              </span>
            </>
          ) : (
            <span className={styles.kpiSubtle}>{t('billing.select_currency')}</span>
          )}
          {analytics.missingCostRequestCount > 0 && (
            <span className={styles.kpiSubtle}>
              {t('billing.model_pricing_missing_prices', { missingRequests: analytics.missingCostRequestCount })}
            </span>
          )}
        </div>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('usage_stats.total_requests')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>{loading ? '--' : analytics.requestCount.toLocaleString()}</div>
        <div className={styles.kpiMeta}>
          <span>
            {t('usage_stats.success_requests')}: {loading ? '--' : analytics.successCount.toLocaleString()}
          </span>
          <span>
            {t('usage_stats.failed_requests')}: {loading ? '--' : analytics.failureCount.toLocaleString()}
          </span>
          <span>
            {t('monitor.kpi.rate')}: {loading ? '--' : formatPercent(successRate)}
          </span>
        </div>
      </div>

      <div className={`${styles.kpiCard} ${styles.purple}`}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('usage_stats.total_tokens')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>{loading ? '--' : formatCompactNumber(tokenTotals.inputTokens)}</div>
        <div className={styles.kpiMeta}>
          <span>
            {t('billing.model_pricing_prompt_billable_tokens')}: {loading ? '--' : formatCompactNumber(tokenTotals.promptBillableTokens)}
          </span>
          <span>
            {t('usage_stats.cached_tokens')}: {loading ? '--' : formatCompactNumber(tokenTotals.cachedTokens)}
          </span>
          <span>
            {t('billing.model_pricing_output_billable_tokens')}: {loading ? '--' : formatCompactNumber(tokenTotals.outputBillableTokens)}
          </span>
        </div>
      </div>

      <div className={`${styles.kpiCard} ${styles.cyan}`}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('billing.model_pricing_models')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>{loading ? '--' : analytics.models.length.toLocaleString()}</div>
        <div className={styles.kpiMeta}>
          <span>
            {t('billing.model_pricing_enabled_currencies')}: {loading ? '--' : analytics.currenciesInUse.length.toLocaleString()}
          </span>
          <span>
            {t('billing.model_pricing_missing_models')}: {loading ? '--' : analytics.missingModels.length.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

