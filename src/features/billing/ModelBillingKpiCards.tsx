import { useMemo } from 'react';
import type { ModelPricingAnalytics } from './modelPricing/analyticsTypes';
import type { CurrencySymbol } from './modelPricing/types';
import { TotalCostKpiCard } from './kpi/TotalCostKpiCard';
import { TotalRequestsKpiCard } from './kpi/TotalRequestsKpiCard';
import { TotalTokensKpiCard, type TokenTotals } from './kpi/TotalTokensKpiCard';
import { ModelCoverageKpiCard } from './kpi/ModelCoverageKpiCard';
import { DefaultCurrencyKpiCard } from './kpi/DefaultCurrencyKpiCard';
import styles from './BillingPage.module.scss';

export type ModelBillingKpiCardsProps = {
  loading: boolean;
  timeRangeLabel: string;
  analytics: ModelPricingAnalytics;
  selectedCurrency: CurrencySymbol;
};

const sumTokens = (analytics: ModelPricingAnalytics): TokenTotals => {
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

export function ModelBillingKpiCards({ loading, timeRangeLabel, analytics, selectedCurrency }: ModelBillingKpiCardsProps) {
  const tokenTotals = useMemo(() => sumTokens(analytics), [analytics]);
  const selectedTotals = analytics.totalsByCurrency[selectedCurrency];

  return (
    <div className={styles.kpiGrid}>
      <TotalCostKpiCard
        loading={loading}
        timeRangeLabel={timeRangeLabel}
        totalsByCurrency={analytics.totalsByCurrency}
        selectedCurrency={selectedCurrency}
        selectedTotals={selectedTotals}
        missingCostRequestCount={analytics.missingCostRequestCount}
      />
      <TotalRequestsKpiCard
        loading={loading}
        timeRangeLabel={timeRangeLabel}
        requestCount={analytics.requestCount}
        successCount={analytics.successCount}
        failureCount={analytics.failureCount}
      />
      <TotalTokensKpiCard loading={loading} timeRangeLabel={timeRangeLabel} tokenTotals={tokenTotals} />
      <ModelCoverageKpiCard
        loading={loading}
        timeRangeLabel={timeRangeLabel}
        modelCount={analytics.models.length}
        missingModelsCount={analytics.missingModels.length}
        currenciesCount={analytics.currenciesInUse.length}
      />
      <DefaultCurrencyKpiCard />
    </div>
  );
}

