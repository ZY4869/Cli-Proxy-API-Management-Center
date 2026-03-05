import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { formatCompactNumber } from '@/utils/usage';
import type { EndpointAggregateForAnalysis } from './modelPricing/analyticsTypes';
import type { CurrencySymbol } from './modelPricing/types';
import { formatMoney } from './modelPricing/money';
import { sumAllCurrencies } from './modelPricing/analyticsUtils';
import { useBillingCollapse } from './collapse/useBillingCollapse';
import { CollapseToggleButton } from './collapse/CollapseToggleButton';
import styles from '@/pages/UsagePage.module.scss';
import filterStyles from './BillingModelPricesPage.module.scss';
import billingStyles from './BillingPage.module.scss';

export type EndpointAnalysisListCardProps = {
  loading: boolean;
  endpoints: EndpointAggregateForAnalysis[];
  selectedCurrency: CurrencySymbol;
};

const getCost = (endpoint: EndpointAggregateForAnalysis, currency: CurrencySymbol): number =>
  Number(endpoint.costs?.[currency]?.totalCost) || 0;

const renderCostList = (costs: EndpointAggregateForAnalysis['costs']) => {
  const entries = Object.entries(costs ?? {})
    .filter(([, v]) => Number.isFinite(v.totalCost) && v.totalCost !== 0)
    .sort((a, b) => (b[1].totalCost ?? 0) - (a[1].totalCost ?? 0) || a[0].localeCompare(b[0]));
  if (!entries.length) return '--';
  return (
    <div className={billingStyles.valuePills}>
      {entries.map(([symbol, totals]) => (
        <span key={symbol} className={`${billingStyles.pill} ${billingStyles.pillTotal}`}>
          {formatMoney(symbol, totals.totalCost)}
        </span>
      ))}
    </div>
  );
};

const renderTopModels = (endpoint: EndpointAggregateForAnalysis, currency: CurrencySymbol) => {
  const entries = Object.entries(endpoint.models ?? {})
    .map(([model, stats]) => ({
      model,
      requests: stats.requests,
      cost: Number(stats.costs?.[currency]?.totalCost) || 0,
    }))
    .sort((a, b) => b.cost - a.cost || b.requests - a.requests)
    .slice(0, 3);
  if (!entries.length) return '--';
  return entries.map((x) => x.model).join(', ');
};

export function EndpointAnalysisList({ loading, endpoints, selectedCurrency }: EndpointAnalysisListCardProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = endpoints.filter((e) => {
      if (!q) return true;
      return e.endpointKey.toLowerCase().includes(q);
    });
    filtered.sort((a, b) => {
      const aCost = selectedCurrency ? getCost(a, selectedCurrency) : sumAllCurrencies(a.costs);
      const bCost = selectedCurrency ? getCost(b, selectedCurrency) : sumAllCurrencies(b.costs);
      if (aCost !== bCost) return bCost - aCost;
      return b.requests - a.requests;
    });
    return filtered;
  }, [endpoints, query, selectedCurrency]);

  return (
    <>
      <div className={filterStyles.filtersRow}>
        <div className={filterStyles.search}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('billing.search_placeholder')}
            aria-label={t('billing.search_placeholder')}
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
                  <th>{t('billing.endpoint')}</th>
                  <th>{t('usage_stats.requests_count')}</th>
                  <th>{t('usage_stats.tokens_count')}</th>
                  <th>{t('billing.cost')}</th>
                  <th>{t('billing.model_pricing_top_models')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const tokens = e.inputTokens + e.outputBillableTokens;
                  return (
                    <tr key={e.endpointKey}>
                      <td className={styles.modelCell}>{e.endpointKey}</td>
                      <td>
                        <div className={billingStyles.requestCell}>
                          <div className={billingStyles.requestMain}>
                            <span className={`${billingStyles.pill} ${billingStyles.pillNeutral}`}>
                              {e.requests.toLocaleString()}
                            </span>
                          </div>
                          <div className={billingStyles.requestPills}>
                            <span className={`${billingStyles.pill} ${billingStyles.pillSuccess}`}>
                              {t('stats.success')}: {e.successCount.toLocaleString()}
                            </span>
                            <span className={`${billingStyles.pill} ${billingStyles.pillFailure}`}>
                              {t('stats.failure')}: {e.failureCount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`${billingStyles.pill} ${billingStyles.pillNeutral}`}>
                          {formatCompactNumber(tokens)}
                        </span>
                      </td>
                      <td>{renderCostList(e.costs)}</td>
                      <td>{renderTopModels(e, selectedCurrency)}</td>
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
    </>
  );
}

export function EndpointAnalysisListCard({ loading, endpoints, selectedCurrency }: EndpointAnalysisListCardProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useBillingCollapse('table-endpoint-analysis');

  return (
    <Card
      title={t('billing.top_endpoints_title')}
      className={styles.detailsFixedCard}
      extra={<CollapseToggleButton collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />}
    >
      {collapsed ? null : <EndpointAnalysisList loading={loading} endpoints={endpoints} selectedCurrency={selectedCurrency} />}
    </Card>
  );
}
