import type { ApiStats, UsageDetail } from '@/utils/usage';
import { maskUsageSensitiveValue } from '@/utils/usage';
import { computeCostForDetail } from './costing';
import type { CurrencySymbol, ModelPricingV1 } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const getApisRecord = (usageData: unknown): Record<string, unknown> | null => {
  const usageRecord = isRecord(usageData) ? usageData : null;
  const apisRaw = usageRecord ? usageRecord.apis : null;
  return isRecord(apisRaw) ? apisRaw : null;
};

const toNumber = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const addCostIfMatchingCurrency = (
  currency: CurrencySymbol,
  detail: UsageDetail,
  pricingByModel: Record<string, ModelPricingV1>,
  state: { total: number; hasAny: boolean }
) => {
  if (!currency) return;
  const res = computeCostForDetail(detail, pricingByModel);
  if (res.missingPricing) return;
  if (res.currencySymbol !== currency) return;
  state.hasAny = true;
  state.total += Number(res.breakdown.totalCost) || 0;
};

export function getApiStatsWithModelPricing(
  usageData: unknown,
  pricingByModel: Record<string, ModelPricingV1>,
  selectedCurrency: CurrencySymbol
): ApiStats[] {
  const apis = getApisRecord(usageData);
  if (!apis) return [];

  const result: ApiStats[] = [];

  Object.entries(apis).forEach(([endpoint, apiData]) => {
    if (!isRecord(apiData)) return;
    const models: ApiStats['models'] = {};
    let derivedSuccessCount = 0;
    let derivedFailureCount = 0;
    const totalCost = { total: 0, hasAny: false };

    const modelsData = isRecord(apiData.models) ? apiData.models : {};
    Object.entries(modelsData).forEach(([modelName, modelData]) => {
      if (!isRecord(modelData)) return;
      const details = Array.isArray(modelData.details) ? modelData.details : [];
      const hasExplicitCounts =
        typeof modelData.success_count === 'number' || typeof modelData.failure_count === 'number';

      let successCount = 0;
      let failureCount = 0;
      if (hasExplicitCounts) {
        successCount += toNumber(modelData.success_count);
        failureCount += toNumber(modelData.failure_count);
      }

      const modelCost = { total: 0, hasAny: false };
      if (details.length > 0 && (!hasExplicitCounts || selectedCurrency)) {
        details.forEach((detail) => {
          const detailRecord = isRecord(detail) ? detail : null;
          if (!detailRecord) return;

          if (!hasExplicitCounts) {
            if (detailRecord.failed === true) failureCount += 1;
            else successCount += 1;
          }

          if (selectedCurrency) {
            addCostIfMatchingCurrency(
              selectedCurrency,
              { ...(detailRecord as unknown as UsageDetail), __modelName: modelName },
              pricingByModel,
              modelCost
            );
          }
        });
      }

      if (modelCost.hasAny) {
        totalCost.hasAny = true;
        totalCost.total += modelCost.total;
      }

      models[modelName] = {
        requests: toNumber(modelData.total_requests),
        successCount,
        failureCount,
        tokens: toNumber(modelData.total_tokens),
      };
      derivedSuccessCount += successCount;
      derivedFailureCount += failureCount;
    });

    const hasApiExplicitCounts =
      typeof apiData.success_count === 'number' || typeof apiData.failure_count === 'number';
    const successCount = hasApiExplicitCounts ? toNumber(apiData.success_count) : derivedSuccessCount;
    const failureCount = hasApiExplicitCounts ? toNumber(apiData.failure_count) : derivedFailureCount;

    result.push({
      endpoint: maskUsageSensitiveValue(endpoint) || endpoint,
      totalRequests: toNumber(apiData.total_requests),
      successCount,
      failureCount,
      totalTokens: toNumber(apiData.total_tokens),
      totalCost: totalCost.hasAny ? totalCost.total : Number.NaN,
      models,
    });
  });

  return result;
}

export function getModelStatsWithModelPricing(
  usageData: unknown,
  pricingByModel: Record<string, ModelPricingV1>,
  selectedCurrency: CurrencySymbol
): Array<{ model: string; requests: number; successCount: number; failureCount: number; tokens: number; cost: number }> {
  const apis = getApisRecord(usageData);
  if (!apis) return [];

  const modelMap = new Map<
    string,
    { requests: number; successCount: number; failureCount: number; tokens: number; cost: { total: number; hasAny: boolean } }
  >();

  Object.values(apis).forEach((apiData) => {
    if (!isRecord(apiData)) return;
    const modelsRaw = apiData.models;
    const models = isRecord(modelsRaw) ? modelsRaw : null;
    if (!models) return;

    Object.entries(models).forEach(([modelName, modelData]) => {
      if (!isRecord(modelData)) return;
      const existing = modelMap.get(modelName) ?? {
        requests: 0,
        successCount: 0,
        failureCount: 0,
        tokens: 0,
        cost: { total: 0, hasAny: false },
      };

      existing.requests += toNumber(modelData.total_requests);
      existing.tokens += toNumber(modelData.total_tokens);

      const details = Array.isArray(modelData.details) ? modelData.details : [];

      const hasExplicitCounts =
        typeof modelData.success_count === 'number' || typeof modelData.failure_count === 'number';
      if (hasExplicitCounts) {
        existing.successCount += toNumber(modelData.success_count);
        existing.failureCount += toNumber(modelData.failure_count);
      }

      if (details.length > 0 && (!hasExplicitCounts || selectedCurrency)) {
        details.forEach((detail) => {
          const detailRecord = isRecord(detail) ? detail : null;
          if (!detailRecord) return;

          if (!hasExplicitCounts) {
            if (detailRecord.failed === true) existing.failureCount += 1;
            else existing.successCount += 1;
          }

          if (selectedCurrency) {
            addCostIfMatchingCurrency(
              selectedCurrency,
              { ...(detailRecord as unknown as UsageDetail), __modelName: modelName },
              pricingByModel,
              existing.cost
            );
          }
        });
      }

      modelMap.set(modelName, existing);
    });
  });

  return Array.from(modelMap.entries())
    .map(([model, stats]) => ({
      model,
      requests: stats.requests,
      successCount: stats.successCount,
      failureCount: stats.failureCount,
      tokens: stats.tokens,
      cost: stats.cost.hasAny ? stats.cost.total : Number.NaN,
    }))
    .sort((a, b) => b.requests - a.requests);
}

