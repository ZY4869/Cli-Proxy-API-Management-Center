import { collectUsageDetailsWithEndpoint, type ApiStats } from '@/utils/usage';
import type { BillingCostConfig } from './costing';
import { computeBillingCostForDetail } from './costing';
import { normalizeEndpointKey } from './normalizeEndpoint';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

type DerivedCounts = { success: number; failure: number };

type CostAggregate = { cost: number; missing: boolean; seen: boolean };

export function buildEndpointApiStats(usageData: unknown, config: BillingCostConfig): ApiStats[] {
  const usageRecord = isRecord(usageData) ? usageData : null;
  const apisRaw = usageRecord?.apis;
  const apis = isRecord(apisRaw) ? apisRaw : null;
  if (!apis) return [];

  const details = collectUsageDetailsWithEndpoint(usageData);
  const derivedEndpointCounts = new Map<string, DerivedCounts>();
  const derivedModelCounts = new Map<string, DerivedCounts>();
  const endpointCosts = new Map<string, CostAggregate>();

  details.forEach((detail) => {
    const endpointKey = normalizeEndpointKey(detail.__endpoint);
    if (!endpointKey) return;

    const endpointCounter = derivedEndpointCounts.get(endpointKey) ?? { success: 0, failure: 0 };
    if (detail.failed) {
      endpointCounter.failure += 1;
    } else {
      endpointCounter.success += 1;
    }
    derivedEndpointCounts.set(endpointKey, endpointCounter);

    const modelName = detail.__modelName ?? '';
    if (modelName) {
      const modelKey = `${endpointKey}::${modelName}`;
      const modelCounter = derivedModelCounts.get(modelKey) ?? { success: 0, failure: 0 };
      if (detail.failed) {
        modelCounter.failure += 1;
      } else {
        modelCounter.success += 1;
      }
      derivedModelCounts.set(modelKey, modelCounter);
    }

    const costAggregate = endpointCosts.get(endpointKey) ?? { cost: 0, missing: false, seen: false };
    costAggregate.seen = true;
    const costResult = computeBillingCostForDetail(detail, config);
    if (costResult.missingRule) {
      costAggregate.missing = true;
    } else {
      costAggregate.cost += costResult.breakdown.totalCost;
    }
    endpointCosts.set(endpointKey, costAggregate);
  });

  const result: ApiStats[] = [];

  Object.entries(apis).forEach(([endpoint, apiData]) => {
    if (!isRecord(apiData)) return;
    const endpointKey = normalizeEndpointKey(endpoint);
    if (!endpointKey) return;

    const models: ApiStats['models'] = {};
    let derivedSuccessCount = 0;
    let derivedFailureCount = 0;

    const modelsData = isRecord(apiData.models) ? apiData.models : {};
    Object.entries(modelsData).forEach(([modelName, modelData]) => {
      if (!isRecord(modelData)) return;

      const hasExplicitCounts =
        typeof modelData.success_count === 'number' || typeof modelData.failure_count === 'number';
      const explicitSuccessCount = Number(modelData.success_count) || 0;
      const explicitFailureCount = Number(modelData.failure_count) || 0;
      const derived = derivedModelCounts.get(`${endpointKey}::${modelName}`) ?? { success: 0, failure: 0 };
      const successCount = hasExplicitCounts ? explicitSuccessCount : derived.success;
      const failureCount = hasExplicitCounts ? explicitFailureCount : derived.failure;

      models[modelName] = {
        requests: Number(modelData.total_requests) || 0,
        successCount,
        failureCount,
        tokens: Number(modelData.total_tokens) || 0,
      };

      derivedSuccessCount += successCount;
      derivedFailureCount += failureCount;
    });

    const hasApiExplicitCounts =
      typeof apiData.success_count === 'number' || typeof apiData.failure_count === 'number';
    const successCount = hasApiExplicitCounts ? (Number(apiData.success_count) || 0) : derivedSuccessCount;
    const failureCount = hasApiExplicitCounts ? (Number(apiData.failure_count) || 0) : derivedFailureCount;

    const totalRequests = Number(apiData.total_requests) || 0;
    const costAggregate = endpointCosts.get(endpointKey);
    const totalCost =
      totalRequests <= 0
        ? 0
        : !costAggregate || !costAggregate.seen || costAggregate.missing
          ? Number.NaN
          : costAggregate.cost;

    result.push({
      endpoint: endpointKey,
      totalRequests,
      successCount,
      failureCount,
      totalTokens: Number(apiData.total_tokens) || 0,
      totalCost,
      models,
    });
  });

  return result;
}

export type EndpointModelStat = {
  model: string;
  requests: number;
  successCount: number;
  failureCount: number;
  tokens: number;
  cost: number;
};

export function buildEndpointModelStats(usageData: unknown, config: BillingCostConfig): EndpointModelStat[] {
  const usageRecord = isRecord(usageData) ? usageData : null;
  const apisRaw = usageRecord?.apis;
  const apis = isRecord(apisRaw) ? apisRaw : null;
  if (!apis) return [];

  const details = collectUsageDetailsWithEndpoint(usageData);
  const derivedModelCounts = new Map<string, DerivedCounts>();
  const modelCosts = new Map<string, CostAggregate>();

  details.forEach((detail) => {
    const modelName = detail.__modelName ?? '';
    if (!modelName) return;

    const counter = derivedModelCounts.get(modelName) ?? { success: 0, failure: 0 };
    if (detail.failed) {
      counter.failure += 1;
    } else {
      counter.success += 1;
    }
    derivedModelCounts.set(modelName, counter);

    const costAggregate = modelCosts.get(modelName) ?? { cost: 0, missing: false, seen: false };
    costAggregate.seen = true;
    const costResult = computeBillingCostForDetail(detail, config);
    if (costResult.missingRule) {
      costAggregate.missing = true;
    } else {
      costAggregate.cost += costResult.breakdown.totalCost;
    }
    modelCosts.set(modelName, costAggregate);
  });

  const modelMap = new Map<string, { requests: number; tokens: number; successCount: number; failureCount: number; hasExplicitCounts: boolean }>();

  Object.values(apis).forEach((apiData) => {
    if (!isRecord(apiData)) return;
    const modelsRaw = apiData.models;
    const models = isRecord(modelsRaw) ? modelsRaw : null;
    if (!models) return;

    Object.entries(models).forEach(([modelName, modelData]) => {
      if (!isRecord(modelData)) return;
      const existing =
        modelMap.get(modelName) ?? { requests: 0, tokens: 0, successCount: 0, failureCount: 0, hasExplicitCounts: false };
      existing.requests += Number(modelData.total_requests) || 0;
      existing.tokens += Number(modelData.total_tokens) || 0;

      const hasExplicitCounts =
        typeof modelData.success_count === 'number' || typeof modelData.failure_count === 'number';
      if (hasExplicitCounts) {
        existing.successCount += Number(modelData.success_count) || 0;
        existing.failureCount += Number(modelData.failure_count) || 0;
        existing.hasExplicitCounts = true;
      }

      modelMap.set(modelName, existing);
    });
  });

  const result: EndpointModelStat[] = Array.from(modelMap.entries()).map(([model, stats]) => {
    const derived = derivedModelCounts.get(model) ?? { success: 0, failure: 0 };
    const successCount = stats.hasExplicitCounts ? stats.successCount : derived.success;
    const failureCount = stats.hasExplicitCounts ? stats.failureCount : derived.failure;

    const costAggregate = modelCosts.get(model);
    const cost =
      stats.requests <= 0
        ? 0
        : !costAggregate || !costAggregate.seen || costAggregate.missing
          ? Number.NaN
          : costAggregate.cost;

    return {
      model,
      requests: stats.requests,
      tokens: stats.tokens,
      successCount,
      failureCount,
      cost,
    };
  });

  return result.sort((a, b) => b.requests - a.requests);
}
