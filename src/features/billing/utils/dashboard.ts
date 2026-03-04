import { formatDayLabel, formatHourLabel } from '@/utils/usage';
import type { UsageDetailWithEndpoint } from '@/utils/usage';
import type { BillingCostConfig } from './costing';
import { computeBillingCostForDetail, formatTierLabel } from './costing';
import { normalizeEndpointKey } from './normalizeEndpoint';

export type BillingEndpointStatus = 'default' | 'override' | 'missing' | 'disabled';
export type BillingStatusFilter = 'all' | BillingEndpointStatus;

export type BillingDashboardFilters = {
  endpointQuery: string;
  statusFilter: BillingStatusFilter;
};

export type CacheImpactSummary = {
  inputTokens: number;
  cachedTokens: number;
  cacheHitRatio: number;
  cacheReadCost: number;
  cacheStorageCost: number;
  baselineInputCostNoCache: number;
  actualCacheRelatedCost: number;
  netSavings: number;
};

export type EndpointTierHit = {
  tierKey: string;
  label: string;
  maxPromptTokens: number | null;
  requestCount: number;
  totalCost: number;
};

export type EndpointAggregate = {
  endpointKey: string;
  status: BillingEndpointStatus;
  requests: number;
  successCount: number;
  failureCount: number;
  knownCostRequests: number;
  missingCostRequests: number;
  promptTokens: number;
  cachedTokens: number;
  outputBillableTokens: number;
  costs: {
    inputCost: number;
    outputCost: number;
    cacheReadCost: number;
    cacheStorageCost: number;
    totalCost: number;
  };
  costKnown: boolean;
  cacheHitRatio: number;
  cacheImpact: CacheImpactSummary;
  tierHits: EndpointTierHit[];
  lastSeenMs: number;
};

export type TierAggregate = {
  tierKey: string;
  label: string;
  maxPromptTokens: number | null;
  requestCount: number;
  totalCost: number;
};

export type TrendSeries = {
  labels: string[];
  data: number[];
  hasData: boolean;
  missingRequestCount: number;
};

export type BillingAnalytics = {
  hasAnyEnabledRule: boolean;
  requestCount: number;
  successCount: number;
  failureCount: number;
  knownCostRequestCount: number;
  missingCostRequestCount: number;
  missingEndpoints: string[];
  promptTokens: number;
  cachedTokens: number;
  outputBillableTokens: number;
  costs: {
    inputCost: number;
    outputCost: number;
    cacheReadCost: number;
    cacheStorageCost: number;
    totalCost: number;
  };
  cacheImpact: CacheImpactSummary;
  endpoints: EndpointAggregate[];
  tiers: TierAggregate[];
  trend: {
    hour: TrendSeries;
    day: TrendSeries;
  };
};

export type BuildBillingAnalyticsOptions = {
  filters?: Partial<BillingDashboardFilters>;
  hourWindowHours?: number;
  now?: Date;
};

const TOKENS_PER_UNIT = 1_000_000;

const toNonNegative = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(num, 0);
};

const safeFinite = (value: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num;
};

const sumCosts = (a: EndpointAggregate['costs'], b: EndpointAggregate['costs']): EndpointAggregate['costs'] => ({
  inputCost: a.inputCost + b.inputCost,
  outputCost: a.outputCost + b.outputCost,
  cacheReadCost: a.cacheReadCost + b.cacheReadCost,
  cacheStorageCost: a.cacheStorageCost + b.cacheStorageCost,
  totalCost: a.totalCost + b.totalCost,
});

export function resolveBillingEndpointStatus(endpointKey: string, config: BillingCostConfig): BillingEndpointStatus {
  const normalized = normalizeEndpointKey(endpointKey);
  if (!normalized) return 'missing';
  const endpointRule = config.endpointRules?.[normalized];
  if (endpointRule) return endpointRule.enabled ? 'override' : 'disabled';
  return config.defaultRule?.enabled ? 'default' : 'missing';
}

export function matchesBillingEndpointFilters(
  endpointKey: string,
  status: BillingEndpointStatus,
  filters: BillingDashboardFilters
): boolean {
  const query = (filters.endpointQuery ?? '').trim().toLowerCase();
  if (query) {
    if (!endpointKey.toLowerCase().includes(query)) return false;
  }
  const statusFilter = filters.statusFilter ?? 'all';
  if (statusFilter !== 'all' && status !== statusFilter) return false;
  return true;
}

const buildEmptyCacheImpact = (): CacheImpactSummary => ({
  inputTokens: 0,
  cachedTokens: 0,
  cacheHitRatio: 0,
  cacheReadCost: 0,
  cacheStorageCost: 0,
  baselineInputCostNoCache: 0,
  actualCacheRelatedCost: 0,
  netSavings: 0,
});

export function buildBillingAnalytics(
  details: UsageDetailWithEndpoint[],
  config: BillingCostConfig,
  options: BuildBillingAnalyticsOptions = {}
): BillingAnalytics {
  const hasAnyEnabledRule =
    config.defaultRule?.enabled === true || Object.values(config.endpointRules ?? {}).some((rule) => rule.enabled);

  const resolvedHourWindow = (() => {
    const hourWindow = options.hourWindowHours ?? 24;
    if (!Number.isFinite(hourWindow) || hourWindow <= 0) return 24;
    return Math.min(Math.max(Math.floor(hourWindow), 1), 24 * 31);
  })();

  const now = options.now instanceof Date ? options.now : new Date();
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);
  const hourMs = 60 * 60 * 1000;
  const earliestBucket = new Date(currentHour);
  earliestBucket.setHours(earliestBucket.getHours() - (resolvedHourWindow - 1));
  const earliestTime = earliestBucket.getTime();
  const lastBucketTime = earliestTime + (resolvedHourWindow - 1) * hourMs;

  const hourLabels: string[] = [];
  for (let i = 0; i < resolvedHourWindow; i++) {
    hourLabels.push(formatHourLabel(new Date(earliestTime + i * hourMs)));
  }
  const hourData = new Array(hourLabels.length).fill(0);
  let hourHasData = false;
  let hourMissingCount = 0;

  const dayMap: Record<string, number> = {};
  let dayHasData = false;
  let dayMissingCount = 0;

  const filters: BillingDashboardFilters = {
    endpointQuery: options.filters?.endpointQuery ?? '',
    statusFilter: options.filters?.statusFilter ?? 'all',
  };

  let requestCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let knownCostRequestCount = 0;
  let missingCostRequestCount = 0;

  let promptTokens = 0;
  let cachedTokens = 0;
  let outputBillableTokens = 0;

  let costs: EndpointAggregate['costs'] = {
    inputCost: 0,
    outputCost: 0,
    cacheReadCost: 0,
    cacheStorageCost: 0,
    totalCost: 0,
  };

  const cacheImpactTotals = buildEmptyCacheImpact();

  const missingEndpoints = new Set<string>();
  const endpointMap = new Map<string, EndpointAggregate & { _tierMap: Map<string, EndpointTierHit> }>();
  const tierMap = new Map<string, TierAggregate>();

  details.forEach((detail) => {
    const endpointKey = normalizeEndpointKey(detail.__endpoint);
    if (!endpointKey) return;

    const status = resolveBillingEndpointStatus(endpointKey, config);
    if (!matchesBillingEndpointFilters(endpointKey, status, filters)) return;

    requestCount += 1;
    if (detail.failed) {
      failureCount += 1;
    } else {
      successCount += 1;
    }

    const tokens = detail.tokens ?? ({} as UsageDetailWithEndpoint['tokens']);
    const inputTokens = toNonNegative(tokens.input_tokens);
    const outputTokens = toNonNegative(tokens.output_tokens);
    const reasoningTokens = toNonNegative(tokens.reasoning_tokens);
    const cached = Math.max(toNonNegative(tokens.cached_tokens), toNonNegative(tokens.cache_tokens));
    const outputBillable = outputTokens + reasoningTokens;

    promptTokens += inputTokens;
    cachedTokens += cached;
    outputBillableTokens += outputBillable;

    const timestampMs =
      typeof detail.__timestampMs === 'number' && Number.isFinite(detail.__timestampMs) && detail.__timestampMs > 0
        ? detail.__timestampMs
        : Date.parse(detail.timestamp);

    const agg =
      endpointMap.get(endpointKey) ??
      (() => {
        const created: EndpointAggregate & { _tierMap: Map<string, EndpointTierHit> } = {
          endpointKey,
          status,
          requests: 0,
          successCount: 0,
          failureCount: 0,
          knownCostRequests: 0,
          missingCostRequests: 0,
          promptTokens: 0,
          cachedTokens: 0,
          outputBillableTokens: 0,
          costs: {
            inputCost: 0,
            outputCost: 0,
            cacheReadCost: 0,
            cacheStorageCost: 0,
            totalCost: 0,
          },
          costKnown: false,
          cacheHitRatio: 0,
          cacheImpact: buildEmptyCacheImpact(),
          tierHits: [],
          _tierMap: new Map<string, EndpointTierHit>(),
          lastSeenMs: 0,
        };
        endpointMap.set(endpointKey, created);
        return created;
      })();

    agg.requests += 1;
    agg.promptTokens += inputTokens;
    agg.cachedTokens += cached;
    agg.outputBillableTokens += outputBillable;
    if (detail.failed) {
      agg.failureCount += 1;
    } else {
      agg.successCount += 1;
    }
    if (Number.isFinite(timestampMs) && timestampMs > 0) {
      agg.lastSeenMs = Math.max(agg.lastSeenMs, timestampMs);
    }

    const costResult = computeBillingCostForDetail(detail, config);
    if (costResult.missingRule) {
      missingCostRequestCount += 1;
      agg.missingCostRequests += 1;
      hourMissingCount += Number.isFinite(timestampMs) && timestampMs >= earliestTime && timestampMs <= lastBucketTime ? 1 : 0;
      dayMissingCount += Number.isFinite(timestampMs) && timestampMs > 0 ? 1 : 0;
      missingEndpoints.add(endpointKey);
      return;
    }

    knownCostRequestCount += 1;
    agg.knownCostRequests += 1;

    const breakdown = costResult.breakdown;
    const pieceCosts: EndpointAggregate['costs'] = {
      inputCost: safeFinite(breakdown.inputCost),
      outputCost: safeFinite(breakdown.outputCost),
      cacheReadCost: safeFinite(breakdown.cacheReadCost),
      cacheStorageCost: safeFinite(breakdown.cacheStorageCost),
      totalCost: safeFinite(breakdown.totalCost),
    };
    costs = sumCosts(costs, pieceCosts);
    agg.costs = sumCosts(agg.costs, pieceCosts);

    const tier = costResult.tier;
    const tierKey = `${tier?.maxPromptTokens ?? 'inf'}::${tier?.label ?? ''}`;
    const tierLabel = formatTierLabel(tier);
    const tierMax = tier?.maxPromptTokens ?? null;

    const tierAgg = tierMap.get(tierKey) ?? {
      tierKey,
      label: tierLabel,
      maxPromptTokens: tierMax,
      requestCount: 0,
      totalCost: 0,
    };
    tierAgg.requestCount += 1;
    tierAgg.totalCost += pieceCosts.totalCost;
    tierMap.set(tierKey, tierAgg);

    const endpointTierAgg =
      agg._tierMap.get(tierKey) ??
      (() => {
        const createdTier: EndpointTierHit = {
          tierKey,
          label: tierLabel,
          maxPromptTokens: tierMax,
          requestCount: 0,
          totalCost: 0,
        };
        agg._tierMap.set(tierKey, createdTier);
        return createdTier;
      })();
    endpointTierAgg.requestCount += 1;
    endpointTierAgg.totalCost += pieceCosts.totalCost;

    const baselineInputCostNoCache =
      safeFinite((toNonNegative(breakdown.input) / TOKENS_PER_UNIT) * toNonNegative(tier?.inputPer1M));
    const actualCacheRelatedCost = safeFinite(pieceCosts.inputCost + pieceCosts.cacheReadCost + pieceCosts.cacheStorageCost);
    const netSavings = safeFinite(baselineInputCostNoCache - actualCacheRelatedCost);

    cacheImpactTotals.inputTokens += toNonNegative(breakdown.input);
    cacheImpactTotals.cachedTokens += toNonNegative(breakdown.cached);
    cacheImpactTotals.cacheReadCost += pieceCosts.cacheReadCost;
    cacheImpactTotals.cacheStorageCost += pieceCosts.cacheStorageCost;
    cacheImpactTotals.baselineInputCostNoCache += baselineInputCostNoCache;
    cacheImpactTotals.actualCacheRelatedCost += actualCacheRelatedCost;
    cacheImpactTotals.netSavings += netSavings;

    agg.cacheImpact.inputTokens += toNonNegative(breakdown.input);
    agg.cacheImpact.cachedTokens += toNonNegative(breakdown.cached);
    agg.cacheImpact.cacheReadCost += pieceCosts.cacheReadCost;
    agg.cacheImpact.cacheStorageCost += pieceCosts.cacheStorageCost;
    agg.cacheImpact.baselineInputCostNoCache += baselineInputCostNoCache;
    agg.cacheImpact.actualCacheRelatedCost += actualCacheRelatedCost;
    agg.cacheImpact.netSavings += netSavings;

    if (Number.isFinite(timestampMs) && timestampMs > 0) {
      const normalized = new Date(timestampMs);
      normalized.setMinutes(0, 0, 0);
      const bucketStart = normalized.getTime();
      if (bucketStart >= earliestTime && bucketStart <= lastBucketTime) {
        const bucketIndex = Math.floor((bucketStart - earliestTime) / hourMs);
        if (bucketIndex >= 0 && bucketIndex < hourData.length) {
          hourHasData = true;
          hourData[bucketIndex] += pieceCosts.totalCost;
        }
      }

      const dayLabel = formatDayLabel(new Date(timestampMs));
      if (dayLabel) {
        dayHasData = true;
        dayMap[dayLabel] = (dayMap[dayLabel] || 0) + pieceCosts.totalCost;
      }
    }
  });

  cacheImpactTotals.cacheHitRatio =
    cacheImpactTotals.inputTokens > 0 ? cacheImpactTotals.cachedTokens / cacheImpactTotals.inputTokens : 0;

  const endpoints = Array.from(endpointMap.values()).map((entry) => {
    entry.costKnown = entry.requests > 0 && entry.missingCostRequests === 0 && entry.knownCostRequests > 0;
    entry.cacheHitRatio = entry.promptTokens > 0 ? entry.cachedTokens / entry.promptTokens : 0;
    entry.cacheImpact.cacheHitRatio =
      entry.cacheImpact.inputTokens > 0 ? entry.cacheImpact.cachedTokens / entry.cacheImpact.inputTokens : 0;
    entry.tierHits = Array.from(entry._tierMap.values())
      .sort((a, b) => b.requestCount - a.requestCount)
      .map((tierHit) => ({
        ...tierHit,
        totalCost: safeFinite(tierHit.totalCost),
      }));
    const { _tierMap: _, ...clean } = entry;
    return clean;
  });

  const tiers = Array.from(tierMap.values()).sort((a, b) => {
    const maxA = a.maxPromptTokens === null ? Number.POSITIVE_INFINITY : a.maxPromptTokens;
    const maxB = b.maxPromptTokens === null ? Number.POSITIVE_INFINITY : b.maxPromptTokens;
    if (maxA !== maxB) return maxA - maxB;
    return a.label.localeCompare(b.label);
  });

  const dayLabels = Object.keys(dayMap).sort();
  const dayData = dayLabels.map((label) => dayMap[label] ?? 0);

  return {
    hasAnyEnabledRule,
    requestCount,
    successCount,
    failureCount,
    knownCostRequestCount,
    missingCostRequestCount,
    missingEndpoints: Array.from(missingEndpoints).sort(),
    promptTokens,
    cachedTokens,
    outputBillableTokens,
    costs: {
      inputCost: safeFinite(costs.inputCost),
      outputCost: safeFinite(costs.outputCost),
      cacheReadCost: safeFinite(costs.cacheReadCost),
      cacheStorageCost: safeFinite(costs.cacheStorageCost),
      totalCost: safeFinite(costs.totalCost),
    },
    cacheImpact: {
      ...cacheImpactTotals,
      inputTokens: safeFinite(cacheImpactTotals.inputTokens),
      cachedTokens: safeFinite(cacheImpactTotals.cachedTokens),
      cacheReadCost: safeFinite(cacheImpactTotals.cacheReadCost),
      cacheStorageCost: safeFinite(cacheImpactTotals.cacheStorageCost),
      baselineInputCostNoCache: safeFinite(cacheImpactTotals.baselineInputCostNoCache),
      actualCacheRelatedCost: safeFinite(cacheImpactTotals.actualCacheRelatedCost),
      netSavings: safeFinite(cacheImpactTotals.netSavings),
    },
    endpoints,
    tiers,
    trend: {
      hour: {
        labels: hourLabels,
        data: hourData.map((v) => safeFinite(v)),
        hasData: hourHasData,
        missingRequestCount: hourMissingCount,
      },
      day: {
        labels: dayLabels,
        data: dayData.map((v) => safeFinite(v)),
        hasData: dayHasData,
        missingRequestCount: dayMissingCount,
      },
    },
  };
}

