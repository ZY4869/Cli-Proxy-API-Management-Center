import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCompactNumber, formatUsd } from '@/utils/usage';
import type { BillingAnalytics } from './utils/dashboard';
import styles from './BillingPage.module.scss';

const formatPercent = (ratio: number, digits: number = 1) => {
  const safe = Number.isFinite(ratio) ? ratio : 0;
  return `${(safe * 100).toFixed(digits)}%`;
};

export type CacheImpactCardProps = {
  loading: boolean;
  analytics: BillingAnalytics;
  timeRangeLabel: string;
};

export function CacheImpactCard({ loading, analytics, timeRangeLabel }: CacheImpactCardProps) {
  const { t } = useTranslation();

  const cacheHitRatio = useMemo(() => {
    if (analytics.promptTokens <= 0) return 0;
    return analytics.cachedTokens / analytics.promptTokens;
  }, [analytics.cachedTokens, analytics.promptTokens]);

  const baseline = analytics.cacheImpact.baselineInputCostNoCache;
  const actual = analytics.cacheImpact.actualCacheRelatedCost;
  const max = Math.max(baseline, actual, 0.000001);

  const baselinePct = Math.min((baseline / max) * 100, 100);
  const actualPct = Math.min((actual / max) * 100, 100);

  const netSavings = analytics.cacheImpact.netSavings;
  const netClass =
    netSavings < 0 ? styles.negativeValue : netSavings > 0 ? styles.positiveValue : styles.neutralValue;

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>{t('billing.cache_impact')}</h3>
          <p className={styles.chartSubtitle}>{timeRangeLabel}</p>
        </div>
      </div>

      <div className={styles.cacheImpactContent}>
        <div className={styles.cacheMetricGrid}>
          <div className={styles.cacheMetricItem}>
            <div className={styles.cacheMetricLabel}>{t('billing.cache_hit_ratio')}</div>
            <div className={styles.cacheMetricValue}>{loading ? '--' : formatPercent(cacheHitRatio)}</div>
            <div className={styles.cacheMetricHint}>
              {t('usage_stats.cached_tokens')}: {loading ? '--' : formatCompactNumber(analytics.cachedTokens)}
            </div>
          </div>
          <div className={styles.cacheMetricItem}>
            <div className={styles.cacheMetricLabel}>{t('billing.cache_read_cost')}</div>
            <div className={styles.cacheMetricValue}>{loading ? '--' : formatUsd(analytics.costs.cacheReadCost)}</div>
            <div className={styles.cacheMetricHint}>
              {t('billing.cache_storage_cost')}: {loading ? '--' : formatUsd(analytics.costs.cacheStorageCost)}
            </div>
          </div>
          <div className={styles.cacheMetricItem}>
            <div className={styles.cacheMetricLabel}>{t('billing.cache_baseline_input_cost')}</div>
            <div className={styles.cacheMetricValue}>{loading ? '--' : formatUsd(baseline)}</div>
            <div className={styles.cacheMetricHint}>
              {t('billing.cache_actual_cache_cost')}: {loading ? '--' : formatUsd(actual)}
            </div>
          </div>
          <div className={styles.cacheMetricItem}>
            <div className={styles.cacheMetricLabel}>{t('billing.cache_net_savings')}</div>
            <div className={`${styles.cacheMetricValue} ${netClass}`}>{loading ? '--' : formatUsd(netSavings)}</div>
            {analytics.hasAnyEnabledRule && analytics.missingCostRequestCount > 0 && (
              <div className={styles.cacheMetricHint}>{t('billing.cache_impact_partial_hint')}</div>
            )}
          </div>
        </div>

        <div
          className={styles.cacheCompareBar}
          style={
            {
              '--baseline-pct': `${baselinePct}%`,
              '--actual-pct': `${actualPct}%`,
            } as CSSProperties
          }
        >
          <div className={styles.cacheBarRow}>
            <div className={styles.cacheBarLabel}>{t('billing.cache_baseline_input_cost')}</div>
            <div className={styles.cacheBarTrack}>
              <div className={styles.cacheBarFillBaseline} />
            </div>
            <div className={styles.cacheBarValue}>{loading ? '--' : formatUsd(baseline)}</div>
          </div>
          <div className={styles.cacheBarRow}>
            <div className={styles.cacheBarLabel}>{t('billing.cache_actual_cache_cost')}</div>
            <div className={styles.cacheBarTrack}>
              <div className={styles.cacheBarFillActual} />
            </div>
            <div className={styles.cacheBarValue}>{loading ? '--' : formatUsd(actual)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
