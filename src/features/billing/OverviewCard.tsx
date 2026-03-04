import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { animate } from 'motion/mini';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { formatUsd, type UsageTimeRange } from '@/utils/usage';
import type { BillingCostTotals } from './utils/costing';
import styles from './BillingPage.module.scss';

const TIME_RANGE_OPTIONS: ReadonlyArray<{ value: UsageTimeRange; labelKey: string }> = [
  { value: 'all', labelKey: 'usage_stats.range_all' },
  { value: '7h', labelKey: 'usage_stats.range_7h' },
  { value: '24h', labelKey: 'usage_stats.range_24h' },
  { value: '7d', labelKey: 'usage_stats.range_7d' },
];

export type OverviewCardProps = {
  timeRange: UsageTimeRange;
  onTimeRangeChange: (next: UsageTimeRange) => void;
  totals: BillingCostTotals;
};

export function OverviewCard({ timeRange, onTimeRangeChange, totals }: OverviewCardProps) {
  const { t } = useTranslation();
  const valuesRef = useRef<HTMLDivElement | null>(null);

  const timeRangeOptions = useMemo(
    () =>
      TIME_RANGE_OPTIONS.map((opt) => ({
        value: opt.value,
        label: t(opt.labelKey),
      })),
    [t]
  );

  useEffect(() => {
    const el = valuesRef.current;
    if (!el) return;
    const controls = animate(
      el,
      { opacity: [0, 1], transform: ['translate3d(0px, 8px, 0px)', 'translate3d(0px, 0px, 0px)'] },
      { duration: 0.22, ease: (p) => 1 - (1 - p) ** 3 }
    );
    return () => controls.stop();
  }, [
    timeRange,
    totals.totalCost,
    totals.inputCost,
    totals.outputCost,
    totals.cacheReadCost,
    totals.cacheStorageCost,
    totals.missingRequestCount,
  ]);

  return (
    <Card title={t('billing.overview')}>
      <div className={styles.overviewValues} ref={valuesRef}>
        <div className={styles.overviewMainValue}>
          <div className={styles.overviewMainLabel}>{t('billing.total_cost')}</div>
          <div className={styles.overviewMainNumber}>{formatUsd(totals.totalCost)}</div>
        </div>

        <div className={styles.overviewItem}>
          <div className={styles.overviewItemLabel}>{t('billing.input_cost')}</div>
          <div className={styles.overviewItemValue}>{formatUsd(totals.inputCost)}</div>
        </div>
        <div className={styles.overviewItem}>
          <div className={styles.overviewItemLabel}>{t('billing.output_cost')}</div>
          <div className={styles.overviewItemValue}>{formatUsd(totals.outputCost)}</div>
        </div>
        <div className={styles.overviewItem}>
          <div className={styles.overviewItemLabel}>{t('billing.cache_read_cost')}</div>
          <div className={styles.overviewItemValue}>{formatUsd(totals.cacheReadCost)}</div>
        </div>
        <div className={styles.overviewItem}>
          <div className={styles.overviewItemLabel}>{t('billing.cache_storage_cost')}</div>
          <div className={styles.overviewItemValue}>{formatUsd(totals.cacheStorageCost)}</div>
        </div>
      </div>

      <div className={styles.overviewMeta}>
        <div className={styles.timeRangeGroup}>
          <span className={styles.timeRangeLabel}>{t('usage_stats.range_filter')}</span>
          <Select
            value={timeRange}
            options={timeRangeOptions}
            onChange={(value) => onTimeRangeChange(value as UsageTimeRange)}
            className={styles.timeRangeSelectControl}
            ariaLabel={t('usage_stats.range_filter')}
            fullWidth={false}
          />
        </div>

        {totals.missingRequestCount > 0 ? (
          <span className={styles.metaHint}>
            {t('billing.missing_rules_hint', {
              missingRequests: totals.missingRequestCount,
              missingEndpoints: totals.missingEndpoints.length,
            })}
          </span>
        ) : (
          <span className={styles.metaHint}>{t('billing.all_rules_configured')}</span>
        )}
      </div>
    </Card>
  );
}

