import type { CredentialAggregate, EndpointAggregateForAnalysis, ModelAggregate, ModelTierHit } from './analyticsTypes';

export type ModelAggregateInternal = ModelAggregate & { _tierMap: Map<string, ModelTierHit> };

export const ensureModelAggregate = (
  map: Map<string, ModelAggregateInternal>,
  modelName: string,
  fallbackCurrency: string
): ModelAggregateInternal => {
  const existing = map.get(modelName);
  if (existing) return existing;
  const created: ModelAggregateInternal = {
    modelName,
    currencySymbol: fallbackCurrency || '$',
    requests: 0,
    successCount: 0,
    failureCount: 0,
    inputTokens: 0,
    cachedTokens: 0,
    promptBillableTokens: 0,
    outputBillableTokens: 0,
    costs: {},
    tierHits: [],
    missingPricingRequests: 0,
    _tierMap: new Map<string, ModelTierHit>(),
  };
  map.set(modelName, created);
  return created;
};

export const ensureEndpointAggregate = (
  map: Map<string, EndpointAggregateForAnalysis>,
  endpointKey: string
): EndpointAggregateForAnalysis => {
  const existing = map.get(endpointKey);
  if (existing) return existing;
  const created: EndpointAggregateForAnalysis = {
    endpointKey,
    requests: 0,
    successCount: 0,
    failureCount: 0,
    inputTokens: 0,
    cachedTokens: 0,
    promptBillableTokens: 0,
    outputBillableTokens: 0,
    costs: {},
    missingPricingRequests: 0,
    models: {},
  };
  map.set(endpointKey, created);
  return created;
};

export const ensureCredentialAggregate = (
  map: Map<string, CredentialAggregate>,
  keyId: string,
  sourceId: string,
  authIdx: string
): CredentialAggregate => {
  const existing = map.get(keyId);
  if (existing) return existing;
  const created: CredentialAggregate = {
    key: keyId,
    sourceIds: sourceId ? [sourceId] : [],
    authIndexes: authIdx ? [authIdx] : [],
    requests: 0,
    successCount: 0,
    failureCount: 0,
    costs: {},
    missingPricingRequests: 0,
    models: {},
  };
  map.set(keyId, created);
  return created;
};
