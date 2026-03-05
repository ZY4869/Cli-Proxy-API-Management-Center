import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import type { UsageTimeRange } from '@/utils/usage';
import type { CurrencySymbol } from './modelPricing/types';
import styles from './BillingPage.module.scss';

const TIME_RANGE_OPTIONS: ReadonlyArray<{ value: UsageTimeRange; labelKey: string }> = [
  { value: '7h', labelKey: 'usage_stats.range_7h' },
  { value: '24h', labelKey: 'usage_stats.range_24h' },
  { value: '7d', labelKey: 'usage_stats.range_7d' },
  { value: 'all', labelKey: 'usage_stats.range_all' },
];

export type ModelBillingFiltersBarProps = {
  timeRange: UsageTimeRange;
  onTimeRangeChange: (next: UsageTimeRange) => void;
  currenciesInUse: CurrencySymbol[];
  selectedCurrency: CurrencySymbol;
  onSelectedCurrencyChange: (next: CurrencySymbol) => void;
  disabled?: boolean;
};

export function ModelBillingFiltersBar({
  timeRange,
  onTimeRangeChange,
  currenciesInUse,
  selectedCurrency,
  onSelectedCurrencyChange,
  disabled = false,
}: ModelBillingFiltersBarProps) {
  const { t } = useTranslation();

  const timeButtons = useMemo(
    () =>
      TIME_RANGE_OPTIONS.map((opt) => ({
        value: opt.value,
        label: t(opt.labelKey),
      })),
    [t]
  );

  const currencyOptions = useMemo(
    () => currenciesInUse.map((c) => ({ value: c, label: c })),
    [currenciesInUse]
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

      {currenciesInUse.length > 1 ? (
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('billing.currency')}</span>
          <Select
            value={selectedCurrency}
            options={currencyOptions}
            onChange={(value) => onSelectedCurrencyChange(String(value) as CurrencySymbol)}
            ariaLabel={t('billing.currency')}
            fullWidth={false}
          />
        </div>
      ) : null}
    </div>
  );
}

