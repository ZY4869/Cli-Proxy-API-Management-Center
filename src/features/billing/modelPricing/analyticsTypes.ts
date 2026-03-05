import type { CurrencySymbol } from './types';

export type CurrencyCostTotals = {
  promptCost: number;
  completionCost: number;
  cacheCost: number;
  totalCost: number;
};

export type CurrencyCostMap = Record<CurrencySymbol, CurrencyCostTotals>;

export type TrendSeries = {
  labels: string[];
  data: number[];
  hasData: boolean;
  missingRequestCount: number;
};

export type ModelTierHit = {
  tierLabel: string;
  maxPromptTokens: number | null;
  requestCount: number;
};

export type ModelAggregate = {
  modelName: string;
  currencySymbol: CurrencySymbol;
  requests: number;
  successCount: number;
  failureCount: number;
  inputTokens: number;
  cachedTokens: number;
  promptBillableTokens: number;
  outputBillableTokens: number;
  costs: CurrencyCostMap;
  tierHits: ModelTierHit[];
  missingPricingRequests: number;
};

export type EndpointAggregateForAnalysis = {
  endpointKey: string;
  requests: number;
  successCount: number;
  failureCount: number;
  inputTokens: number;
  cachedTokens: number;
  promptBillableTokens: number;
  outputBillableTokens: number;
  costs: CurrencyCostMap;
  missingPricingRequests: number;
  models: Record<string, { requests: number; costs: CurrencyCostMap }>;
};

export type CredentialAggregate = {
  key: string;
  sourceIds: string[];
  authIndexes: string[];
  requests: number;
  successCount: number;
  failureCount: number;
  costs: CurrencyCostMap;
  missingPricingRequests: number;
  models: Record<string, { requests: number; costs: CurrencyCostMap }>;
};

export type ModelPricingAnalytics = {
  currenciesInUse: CurrencySymbol[];
  totalsByCurrency: CurrencyCostMap;
  requestCount: number;
  successCount: number;
  failureCount: number;
  knownCostRequestCount: number;
  missingCostRequestCount: number;
  missingModels: string[];
  models: ModelAggregate[];
  endpoints: EndpointAggregateForAnalysis[];
  keys: CredentialAggregate[];
  trendByCurrency: Record<CurrencySymbol, { hour: TrendSeries; day: TrendSeries }>;
};

export type BuildModelPricingAnalyticsOptions = {
  hourWindowHours?: number;
  now?: Date;
};

