import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { formatCompactNumber } from '@/utils/usage';
import type { ModelAggregate } from './modelPricing/analyticsTypes';
import { sumAllCurrencies } from './modelPricing/analyticsUtils';
import type { CurrencySymbol } from './modelPricing/types';
import { formatMoney } from './modelPricing/money';
import styles from '@/pages/UsagePage.module.scss';
import filterStyles from './BillingModelPricesPage.module.scss';

export type ModelListCardProps = {
  loading: boolean;
  models: ModelAggregate[];
  selectedCurrency: CurrencySymbol;
};

const getCost = (model: ModelAggregate, currency: CurrencySymbol): number =>
  Number(model.costs?.[currency]?.totalCost) || 0;

const renderCostList = (costs: ModelAggregate['costs']) => {
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

const renderTierSummary = (model: ModelAggregate) => {
  const hits = model.tierHits ?? [];
  if (!hits.length) return '--';
  const top = hits.slice(0, 2).map((hit) => `${hit.tierLabel}(${hit.requestCount})`);
  return hits.length > 2 ? `${top.join(' / ')} +${hits.length - 2}` : top.join(' / ');
};

export function ModelListCard({ loading, models, selectedCurrency }: ModelListCardProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = models.filter((m) => {
      if (onlyMissing && m.missingPricingRequests <= 0) return false;
      if (!q) return true;
      return m.modelName.toLowerCase().includes(q);
    });

    filtered.sort((a, b) => {
      const aCost = selectedCurrency ? getCost(a, selectedCurrency) : sumAllCurrencies(a.costs);
      const bCost = selectedCurrency ? getCost(b, selectedCurrency) : sumAllCurrencies(b.costs);
      if (aCost !== bCost) return bCost - aCost;
      return b.requests - a.requests;
    });
    return filtered;
  }, [models, onlyMissing, query, selectedCurrency]);

  return (
    <Card title={t('billing.model_pricing_models')} className={styles.detailsFixedCard}>
      <div className={filterStyles.filtersRow}>
        <div className={filterStyles.search}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('billing.model_pricing_search_model')}
            aria-label={t('billing.model_pricing_search_model')}
          />
        </div>
        <ToggleSwitch
          checked={onlyMissing}
          onChange={setOnlyMissing}
          label={t('billing.model_pricing_only_missing')}
          ariaLabel={t('billing.model_pricing_only_missing')}
        />
      </div>

      {loading ? (
        <div className={styles.hint}>{t('common.loading')}</div>
      ) : rows.length ? (
        <div className={styles.detailsScroll}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('usage_stats.model_name')}</th>
                  <th>{t('usage_stats.requests_count')}</th>
                  <th>{t('usage_stats.tokens_count')}</th>
                  <th>{t('billing.cost')}</th>
                  <th>{t('billing.tier')}</th>
                  <th>{t('billing.filter_status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const tokens = m.inputTokens + m.outputBillableTokens;
                  const configured = m.missingPricingRequests <= 0;
                  return (
                    <tr key={m.modelName}>
                      <td className={styles.modelCell}>{m.modelName}</td>
                      <td>
                        <span className={styles.requestCountCell}>
                          <span>{m.requests.toLocaleString()}</span>
                          <span className={styles.requestBreakdown}>
                            (<span className={styles.statSuccess}>{m.successCount.toLocaleString()}</span>{' '}
                            <span className={styles.statFailure}>{m.failureCount.toLocaleString()}</span>)
                          </span>
                        </span>
                      </td>
                      <td>{formatCompactNumber(tokens)}</td>
                      <td>{renderCostList(m.costs)}</td>
                      <td>{renderTierSummary(m)}</td>
                      <td>{configured ? t('billing.model_prices_configured') : t('billing.model_prices_missing')}</td>
                    </tr>
                  );
                })}
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
