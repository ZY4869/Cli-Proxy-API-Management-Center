import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import type { UsageTimeRange } from '@/utils/usage';
import type { BillingStatusFilter } from './utils/dashboard';
import styles from './BillingPage.module.scss';

const TIME_RANGE_OPTIONS: ReadonlyArray<{ value: UsageTimeRange; labelKey: string }> = [
  { value: '7h', labelKey: 'usage_stats.range_7h' },
  { value: '24h', labelKey: 'usage_stats.range_24h' },
  { value: '7d', labelKey: 'usage_stats.range_7d' },
  { value: 'all', labelKey: 'usage_stats.range_all' },
];

const STATUS_OPTIONS: ReadonlyArray<{ value: BillingStatusFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'billing.filter_all' },
  { value: 'default', labelKey: 'billing.rule_status_default' },
  { value: 'override', labelKey: 'billing.rule_status_override' },
  { value: 'missing', labelKey: 'billing.rule_status_missing' },
  { value: 'disabled', labelKey: 'billing.rule_status_disabled' },
];

export type BillingFiltersBarProps = {
  timeRange: UsageTimeRange;
  onTimeRangeChange: (next: UsageTimeRange) => void;
  endpointQuery: string;
  onEndpointQueryChange: (next: string) => void;
  statusFilter: BillingStatusFilter;
  onStatusFilterChange: (next: BillingStatusFilter) => void;
  includeUnused: boolean;
  onIncludeUnusedChange: (next: boolean) => void;
  disabled?: boolean;
};

export function BillingFiltersBar({
  timeRange,
  onTimeRangeChange,
  endpointQuery,
  onEndpointQueryChange,
  statusFilter,
  onStatusFilterChange,
  includeUnused,
  onIncludeUnusedChange,
  disabled = false,
}: BillingFiltersBarProps) {
  const { t } = useTranslation();

  const timeButtons = useMemo(
    () =>
      TIME_RANGE_OPTIONS.map((opt) => ({
        value: opt.value,
        label: t(opt.labelKey),
      })),
    [t]
  );

  const statusButtons = useMemo(
    () =>
      STATUS_OPTIONS.map((opt) => ({
        value: opt.value,
        label: t(opt.labelKey),
      })),
    [t]
  );

  return (
    <div className={styles.filters}>
      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>{t('usage_stats.range_filter')}</span>
        <div className={styles.timeButtons}>
          {timeButtons.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.timeButton} ${timeRange === opt.value ? styles.active : ''}`}
              onClick={() => onTimeRangeChange(opt.value)}
              disabled={disabled}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>{t('billing.endpoint')}</span>
        <div className={styles.filterSearch}>
          <Input
            value={endpointQuery}
            onChange={(e) => onEndpointQueryChange(e.target.value)}
            placeholder={t('billing.search_placeholder')}
            aria-label={t('billing.search_placeholder')}
            disabled={disabled}
          />
        </div>
      </div>

      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>{t('billing.filter_status')}</span>
        <div className={styles.timeButtons}>
          {statusButtons.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.timeButton} ${statusFilter === opt.value ? styles.active : ''}`}
              onClick={() => onStatusFilterChange(opt.value)}
              disabled={disabled}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterGroup}>
        <ToggleSwitch
          checked={includeUnused}
          onChange={onIncludeUnusedChange}
          disabled={disabled}
          label={t('billing.include_unused')}
          ariaLabel={t('billing.include_unused')}
        />
      </div>
    </div>
  );
}

