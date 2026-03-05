import type { UsageDetailWithEndpoint } from '@/utils/usage';
import { computeCostForDetail, type ModelPricingCostResult } from './costing';
import type { CurrencyCostTotals, CredentialAggregate, EndpointAggregateForAnalysis } from './analyticsTypes';
import { addCostTotals, ensureCurrencyTotals, normalizeAuthIndex, safeTimestampMs } from './analyticsUtils';
import type { ModelPricingV1 } from './types';
import type { TrendAccumulator } from './trend';
import { ensureCredentialAggregate, ensureEndpointAggregate, ensureModelAggregate, type ModelAggregateInternal } from './aggregateHelpers';

export type AggregationResult = {
  totalsByCurrency: Record<string, CurrencyCostTotals>;
  missingModels: Set<string>;
  requestCount: number;
  successCount: number;
  failureCount: number;
  knownCostRequestCount: number;
  missingCostRequestCount: number;
  modelMap: Map<string, ModelAggregateInternal>;
  endpointMap: Map<string, EndpointAggregateForAnalysis>;
  keyMap: Map<string, CredentialAggregate>;
};

const buildCostPatch = (res: ModelPricingCostResult): CurrencyCostTotals => ({
  promptCost: res.breakdown.promptCost,
  completionCost: res.breakdown.completionCost,
  cacheCost: res.breakdown.cacheCost,
  totalCost: res.breakdown.totalCost,
});

const mergeCredentialAggregates = (target: CredentialAggregate, patch: CredentialAggregate) => {
  target.requests += patch.requests;
  target.successCount += patch.successCount;
  target.failureCount += patch.failureCount;
  target.missingPricingRequests += patch.missingPricingRequests;

  patch.sourceIds.forEach((id) => {
    if (id && !target.sourceIds.includes(id)) target.sourceIds.push(id);
  });
  patch.authIndexes.forEach((idx) => {
    if (idx && !target.authIndexes.includes(idx)) target.authIndexes.push(idx);
  });

  Object.entries(patch.costs ?? {}).forEach(([symbol, totals]) => {
    addCostTotals(ensureCurrencyTotals(target.costs, symbol), totals);
  });

  Object.entries(patch.models ?? {}).forEach(([modelName, stats]) => {
    const targetModel = target.models[modelName] ?? { requests: 0, costs: {} };
    targetModel.requests += stats.requests;
    Object.entries(stats.costs ?? {}).forEach(([symbol, totals]) => {
      addCostTotals(ensureCurrencyTotals(targetModel.costs, symbol), totals);
    });
    target.models[modelName] = targetModel;
  });
};

export function accumulateModelPricing(
  details: UsageDetailWithEndpoint[],
  pricingMap: Record<string, ModelPricingV1>,
  trend: TrendAccumulator
): AggregationResult {
  const totalsByCurrency: Record<string, CurrencyCostTotals> = {};
  const missingModels = new Set<string>();
  let requestCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let knownCostRequestCount = 0;
  let missingCostRequestCount = 0;

  const modelMap = new Map<string, ModelAggregateInternal>();
  const endpointMap = new Map<string, EndpointAggregateForAnalysis>();
  const keyMap = new Map<string, CredentialAggregate>();
  const authIndexToPrimaryKey = new Map<string, string>();
  const authIndexFallbackMap = new Map<string, CredentialAggregate>();

  const ensureAuthFallback = (authIdx: string): CredentialAggregate => {
    const existing = authIndexFallbackMap.get(authIdx);
    if (existing) return existing;
    const created: CredentialAggregate = {
      key: `auth:${authIdx}`,
      sourceIds: [],
      authIndexes: authIdx ? [authIdx] : [],
      requests: 0,
      successCount: 0,
      failureCount: 0,
      costs: {},
      missingPricingRequests: 0,
      models: {},
    };
    authIndexFallbackMap.set(authIdx, created);
    return created;
  };

  details.forEach((detail) => {
    requestCount += 1;
    if (detail.failed) failureCount += 1;
    else successCount += 1;

    const modelName = String(detail.__modelName ?? '').trim();
    const endpointKey = String(detail.__endpoint ?? '').trim();
    const timestampMs = safeTimestampMs(detail);
    const costResult = computeCostForDetail(detail, pricingMap);
    const tokens = costResult.breakdown;
    const sourceId = String(detail.source ?? '').trim();
    const authIdx = normalizeAuthIndex(detail.auth_index);
    const credentialAgg = (() => {
      if (sourceId) {
        if (authIdx && !authIndexToPrimaryKey.has(authIdx)) authIndexToPrimaryKey.set(authIdx, sourceId);
        return ensureCredentialAggregate(keyMap, sourceId, sourceId, authIdx);
      }
      if (authIdx) return ensureAuthFallback(authIdx);
      return null;
    })();

    if (modelName) {
      const modelAgg = ensureModelAggregate(modelMap, modelName, costResult.currencySymbol);
      modelAgg.requests += 1;
      if (detail.failed) modelAgg.failureCount += 1;
      else modelAgg.successCount += 1;
      modelAgg.inputTokens += tokens.inputTokens;
      modelAgg.cachedTokens += tokens.cachedTokens;
      modelAgg.promptBillableTokens += tokens.promptBillableTokens;
      modelAgg.outputBillableTokens += tokens.outputBillableTokens;
      if (costResult.missingPricing) modelAgg.missingPricingRequests += 1;
    }

    if (endpointKey) {
      const endpointAgg = ensureEndpointAggregate(endpointMap, endpointKey);
      endpointAgg.requests += 1;
      if (detail.failed) endpointAgg.failureCount += 1;
      else endpointAgg.successCount += 1;
      endpointAgg.inputTokens += tokens.inputTokens;
      endpointAgg.cachedTokens += tokens.cachedTokens;
      endpointAgg.promptBillableTokens += tokens.promptBillableTokens;
      endpointAgg.outputBillableTokens += tokens.outputBillableTokens;
      if (costResult.missingPricing) endpointAgg.missingPricingRequests += 1;
      if (modelName) {
        endpointAgg.models[modelName] = endpointAgg.models[modelName] ?? { requests: 0, costs: {} };
        endpointAgg.models[modelName].requests += 1;
      }
    }

    if (credentialAgg) {
      credentialAgg.requests += 1;
      if (detail.failed) credentialAgg.failureCount += 1;
      else credentialAgg.successCount += 1;
      if (sourceId && !credentialAgg.sourceIds.includes(sourceId)) credentialAgg.sourceIds.push(sourceId);
      if (authIdx && !credentialAgg.authIndexes.includes(authIdx)) credentialAgg.authIndexes.push(authIdx);
      if (costResult.missingPricing) credentialAgg.missingPricingRequests += 1;
      if (modelName) {
        credentialAgg.models[modelName] = credentialAgg.models[modelName] ?? { requests: 0, costs: {} };
        credentialAgg.models[modelName].requests += 1;
      }
    }

    if (costResult.missingPricing) {
      missingCostRequestCount += 1;
      if (modelName) missingModels.add(modelName);
      trend.addMissing(timestampMs);
      return;
    }

    knownCostRequestCount += 1;
    const symbol = costResult.currencySymbol;
    const patch = buildCostPatch(costResult);

    addCostTotals(ensureCurrencyTotals(totalsByCurrency, symbol), patch);

    if (modelName) {
      const modelAgg = ensureModelAggregate(modelMap, modelName, symbol);
      addCostTotals(ensureCurrencyTotals(modelAgg.costs, symbol), patch);
      const tierKey = `${costResult.tier?.maxPromptTokens ?? 'inf'}::${costResult.tierLabel}`;
      const tierHit = modelAgg._tierMap.get(tierKey) ?? {
        tierLabel: costResult.tierLabel,
        maxPromptTokens: costResult.tier?.maxPromptTokens ?? null,
        requestCount: 0,
      };
      tierHit.requestCount += 1;
      modelAgg._tierMap.set(tierKey, tierHit);
    }

    if (endpointKey) {
      const endpointAgg = ensureEndpointAggregate(endpointMap, endpointKey);
      addCostTotals(ensureCurrencyTotals(endpointAgg.costs, symbol), patch);
      if (modelName) {
        addCostTotals(ensureCurrencyTotals(endpointAgg.models[modelName].costs, symbol), patch);
      }
    }

    if (credentialAgg) {
      addCostTotals(ensureCurrencyTotals(credentialAgg.costs, symbol), patch);
      if (modelName) {
        const modelStats = credentialAgg.models[modelName] ?? { requests: 0, costs: {} };
        addCostTotals(ensureCurrencyTotals(modelStats.costs, symbol), patch);
        credentialAgg.models[modelName] = modelStats;
      }
    }

    trend.addKnownCost(symbol, timestampMs, patch.totalCost);
  });

  authIndexFallbackMap.forEach((fallbackAgg, authIdx) => {
    const primaryKey = authIndexToPrimaryKey.get(authIdx);
    if (primaryKey) {
      const target = ensureCredentialAggregate(keyMap, primaryKey, primaryKey, authIdx);
      mergeCredentialAggregates(target, fallbackAgg);
      return;
    }

    const existing = keyMap.get(fallbackAgg.key);
    if (existing) mergeCredentialAggregates(existing, fallbackAgg);
    else keyMap.set(fallbackAgg.key, fallbackAgg);
  });

  return {
    totalsByCurrency,
    missingModels,
    requestCount,
    successCount,
    failureCount,
    knownCostRequestCount,
    missingCostRequestCount,
    modelMap,
    endpointMap,
    keyMap,
  };
}
