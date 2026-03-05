import type { UsageDetailWithEndpoint } from '@/utils/usage';
import type { BuildModelPricingAnalyticsOptions, ModelAggregate, ModelPricingAnalytics } from './analyticsTypes';
import { sumAllCurrencies } from './analyticsUtils';
import { accumulateModelPricing } from './aggregate';
import type { ModelPricingV1 } from './types';
import { createTrendAccumulator } from './trend';

export function buildModelPricingAnalytics(
  details: UsageDetailWithEndpoint[],
  pricingMap: Record<string, ModelPricingV1>,
  options: BuildModelPricingAnalyticsOptions = {}
): ModelPricingAnalytics {
  const trend = createTrendAccumulator({ hourWindowHours: options.hourWindowHours, now: options.now });
  const aggregated = accumulateModelPricing(details, pricingMap, trend);

  const currenciesInUse = Object.entries(aggregated.totalsByCurrency)
    .filter(([, totals]) => Number.isFinite(totals.totalCost) && totals.totalCost !== 0)
    .sort((a, b) => (b[1].totalCost ?? 0) - (a[1].totalCost ?? 0) || a[0].localeCompare(b[0]))
    .map(([symbol]) => symbol);

  const models: ModelAggregate[] = Array.from(aggregated.modelMap.values())
    .map((m) => {
      m.tierHits = Array.from(m._tierMap.values()).sort((a, b) => b.requestCount - a.requestCount);
      const { _tierMap: _, ...clean } = m;
      return clean;
    })
    .sort((a, b) => sumAllCurrencies(b.costs) - sumAllCurrencies(a.costs));

  const endpoints = Array.from(aggregated.endpointMap.values()).sort(
    (a, b) => sumAllCurrencies(b.costs) - sumAllCurrencies(a.costs)
  );

  const keys = Array.from(aggregated.keyMap.values()).sort(
    (a, b) => sumAllCurrencies(b.costs) - sumAllCurrencies(a.costs)
  );

  const trendByCurrency = trend.finalize(currenciesInUse);

  return {
    currenciesInUse,
    totalsByCurrency: aggregated.totalsByCurrency,
    requestCount: aggregated.requestCount,
    successCount: aggregated.successCount,
    failureCount: aggregated.failureCount,
    knownCostRequestCount: aggregated.knownCostRequestCount,
    missingCostRequestCount: aggregated.missingCostRequestCount,
    missingModels: Array.from(aggregated.missingModels).sort(),
    models,
    endpoints,
    keys,
    trendByCurrency,
  };
}

