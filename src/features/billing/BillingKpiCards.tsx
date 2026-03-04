import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCompactNumber, formatUsd } from '@/utils/usage';
import type { BillingAnalytics } from './utils/dashboard';
import styles from './BillingPage.module.scss';

export type BillingKpiCardsProps = {
  loading: boolean;
  timeRangeLabel: string;
  analytics: BillingAnalytics;
  onShowMissing: () => void;
};

const formatPercent = (ratio: number, digits: number = 1) => {
  const safe = Number.isFinite(ratio) ? ratio : 0;
  return `${(safe * 100).toFixed(digits)}%`;
};

export function BillingKpiCards({ loading, timeRangeLabel, analytics, onShowMissing }: BillingKpiCardsProps) {
  const { t } = useTranslation();

  const successRate = useMemo(() => {
    if (analytics.requestCount <= 0) return 0;
    return analytics.successCount / analytics.requestCount;
  }, [analytics.requestCount, analytics.successCount]);

  const costPerRequest = useMemo(() => {
    if (!analytics.hasAnyEnabledRule) return Number.NaN;
    if (analytics.knownCostRequestCount <= 0) return Number.NaN;
    return analytics.costs.totalCost / analytics.knownCostRequestCount;
  }, [analytics.costs.totalCost, analytics.hasAnyEnabledRule, analytics.knownCostRequestCount]);

  const costPer1kTokens = useMemo(() => {
    if (!analytics.hasAnyEnabledRule) return Number.NaN;
    const denom = (analytics.promptTokens + analytics.outputBillableTokens) / 1000;
    if (!Number.isFinite(denom) || denom <= 0) return Number.NaN;
    return analytics.costs.totalCost / denom;
  }, [analytics.costs.totalCost, analytics.hasAnyEnabledRule, analytics.outputBillableTokens, analytics.promptTokens]);

  const cacheHitRatio = useMemo(() => {
    if (analytics.promptTokens <= 0) return 0;
    return analytics.cachedTokens / analytics.promptTokens;
  }, [analytics.cachedTokens, analytics.promptTokens]);

  const coverageRate = useMemo(() => {
    if (analytics.requestCount <= 0) return 1;
    return 1 - analytics.missingCostRequestCount / analytics.requestCount;
  }, [analytics.missingCostRequestCount, analytics.requestCount]);

  const totalCostDisplay = loading
    ? '--'
    : analytics.hasAnyEnabledRule
      ? formatUsd(analytics.costs.totalCost)
      : '--';

  const cachedCostDisplay = loading ? '--' : analytics.hasAnyEnabledRule ? formatUsd(analytics.costs.cacheReadCost + analytics.costs.cacheStorageCost) : '--';
  const netSavingsDisplay = loading ? '--' : analytics.hasAnyEnabledRule ? formatUsd(analytics.cacheImpact.netSavings) : '--';

  const netSavingsClass =
    analytics.cacheImpact.netSavings < 0
      ? styles.kpiWarningValue
      : analytics.cacheImpact.netSavings > 0
        ? styles.kpiPositiveValue
        : styles.kpiNeutralValue;

  return (
    <div className={styles.kpiGrid}>
      <div className={`${styles.kpiCard} ${styles.amber}`}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('billing.total_cost')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>{totalCostDisplay}</div>
        <div className={styles.kpiMeta}>
          <span>
            {t('billing.input_cost')}: {loading ? '--' : formatUsd(analytics.costs.inputCost)}
          </span>
          <span>
            {t('billing.output_cost')}: {loading ? '--' : formatUsd(analytics.costs.outputCost)}
          </span>
          <span>
            {t('billing.cache_read_cost')}: {loading ? '--' : formatUsd(analytics.costs.cacheReadCost)}
          </span>
          <span>
            {t('billing.cache_storage_cost')}: {loading ? '--' : formatUsd(analytics.costs.cacheStorageCost)}
          </span>
          {analytics.hasAnyEnabledRule && analytics.missingCostRequestCount > 0 && (
            <span className={styles.kpiSubtle}>
              {t('usage_stats.endpoint_cost_missing_rules', { missingRequests: analytics.missingCostRequestCount })}
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
          <span>
            {t('billing.cost_per_request')}: {loading || !Number.isFinite(costPerRequest) ? '--' : formatUsd(costPerRequest)}
          </span>
        </div>
      </div>

      <div className={`${styles.kpiCard} ${styles.purple}`}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('usage_stats.total_tokens')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>{loading ? '--' : formatCompactNumber(analytics.promptTokens)}</div>
        <div className={styles.kpiMeta}>
          <span>
            {t('usage_stats.output_tokens')}: {loading ? '--' : formatCompactNumber(analytics.outputBillableTokens)}
          </span>
          <span>
            {t('usage_stats.cached_tokens')}: {loading ? '--' : formatCompactNumber(analytics.cachedTokens)}
          </span>
          <span>
            {t('billing.cost_per_1k_tokens')}: {loading || !Number.isFinite(costPer1kTokens) ? '--' : formatUsd(costPer1kTokens)}
          </span>
        </div>
      </div>

      <div className={`${styles.kpiCard} ${styles.green}`}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('billing.cache_impact')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>{loading ? '--' : formatPercent(cacheHitRatio)}</div>
        <div className={styles.kpiMeta}>
          <span>
            {t('billing.cache_read_cost')}/{t('billing.cache_storage_cost')}: {cachedCostDisplay}
          </span>
          <span className={netSavingsClass}>
            {t('billing.cache_net_savings')}: {netSavingsDisplay}
          </span>
          {analytics.hasAnyEnabledRule && analytics.missingCostRequestCount > 0 && (
            <span className={styles.kpiSubtle}>
              {t('billing.cache_impact_partial_hint')}
            </span>
          )}
        </div>
      </div>

      <div className={`${styles.kpiCard} ${styles.cyan}`}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('billing.rule_coverage')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>{loading ? '--' : analytics.missingCostRequestCount.toLocaleString()}</div>
        <div className={styles.kpiMeta}>
          <span>
            {t('billing.missing_endpoints')}: {loading ? '--' : analytics.missingEndpoints.length.toLocaleString()}
          </span>
          <span>
            {t('billing.coverage_rate')}: {loading ? '--' : formatPercent(coverageRate)}
          </span>
          <button
            type="button"
            className={styles.kpiActionButton}
            onClick={onShowMissing}
            disabled={loading || analytics.missingCostRequestCount <= 0}
          >
            {t('billing.show_missing')}
          </button>
        </div>
      </div>
    </div>
  );
}

