import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { formatCompactNumber } from '@/utils/usage';
import type { CredentialAggregate } from './modelPricing/analyticsTypes';
import type { CurrencySymbol } from './modelPricing/types';
import { formatMoney } from './modelPricing/money';
import { sumAllCurrencies } from './modelPricing/analyticsUtils';
import styles from '@/pages/UsagePage.module.scss';
import filterStyles from './BillingModelPricesPage.module.scss';

export type ApiKeyBillingCardProps = {
  loading: boolean;
  keys: CredentialAggregate[];
  selectedCurrency: CurrencySymbol;
};

const renderCostList = (costs: CredentialAggregate['costs']) => {
  const entries = Object.entries(costs ?? {})
    .filter(([, v]) => Number.isFinite(v.totalCost) && v.totalCost !== 0)
    .sort((a, b) => (b[1].totalCost ?? 0) - (a[1].totalCost ?? 0) || a[0].localeCompare(b[0]));
  if (!entries.length) return '--';
  return (
    <div>
      {entries.map(([symbol, totals]) => (
        <div key={symbol}>{formatMoney(symbol, totals.totalCost)}</div>
      ))}
    </div>
  );
};

const displayKey = (key: string): string => {
  if (key.startsWith('auth:')) return `auth_index:${key.slice(5)}`;
  if (key.startsWith('t:')) return key.slice(2);
  return key;
};

const getCost = (row: CredentialAggregate, currency: CurrencySymbol): number =>
  Number(row.costs?.[currency]?.totalCost) || 0;

const renderTopModels = (row: CredentialAggregate, currency: CurrencySymbol) => {
  const entries = Object.entries(row.models ?? {})
    .map(([modelName, stats]) => ({
      modelName,
      requests: stats.requests,
      cost: Number(stats.costs?.[currency]?.totalCost) || 0,
    }))
    .sort((a, b) => b.cost - a.cost || b.requests - a.requests)
    .slice(0, 3);
  if (!entries.length) return '--';
  return entries.map((x) => x.modelName).join(', ');
};

export function ApiKeyBillingCard({ loading, keys, selectedCurrency }: ApiKeyBillingCardProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = keys.filter((k) => {
      if (!q) return true;
      const hay = `${k.key} ${k.authIndexes.join(',')} ${k.sourceIds.join(',')}`.toLowerCase();
      return hay.includes(q);
    });

    filtered.sort((a, b) => {
      const aCost = selectedCurrency ? getCost(a, selectedCurrency) : sumAllCurrencies(a.costs);
      const bCost = selectedCurrency ? getCost(b, selectedCurrency) : sumAllCurrencies(b.costs);
      if (aCost !== bCost) return bCost - aCost;
      return b.requests - a.requests;
    });

    return filtered;
  }, [keys, query, selectedCurrency]);

  return (
    <Card title={t('billing.api_key_billing_title')} className={styles.detailsFixedCard}>
      <div className={filterStyles.filtersRow}>
        <div className={filterStyles.search}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('billing.model_pricing_search_key')}
            aria-label={t('billing.model_pricing_search_key')}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.hint}>{t('common.loading')}</div>
      ) : rows.length ? (
        <div className={styles.detailsScroll}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('common.api_key')}</th>
                  <th>{t('usage_stats.requests_count')}</th>
                  <th>{t('billing.cost')}</th>
                  <th>{t('billing.model_pricing_top_models')}</th>
                  <th>{t('billing.model_pricing_missing_requests')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className={styles.modelCell}>
                      <div>{displayKey(row.key)}</div>
                      {row.authIndexes.length ? (
                        <div className={styles.hint}>auth_index: {row.authIndexes.join(', ')}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={styles.requestCountCell}>
                        <span>{row.requests.toLocaleString()}</span>
                        <span className={styles.requestBreakdown}>
                          (<span className={styles.statSuccess}>{row.successCount.toLocaleString()}</span>{' '}
                          <span className={styles.statFailure}>{row.failureCount.toLocaleString()}</span>)
                        </span>
                      </span>
                    </td>
                    <td>{renderCostList(row.costs)}</td>
                    <td>{renderTopModels(row, selectedCurrency)}</td>
                    <td>{formatCompactNumber(row.missingPricingRequests)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.hint}>{t('usage_stats.no_data')}</div>
      )}
    </Card>
  );
}

