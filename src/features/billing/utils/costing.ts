import { formatDayLabel, formatHourLabel } from '@/utils/usage';
import type { UsageDetailWithEndpoint } from '@/utils/usage';
import type { BillingRuleV1, BillingTierV1 } from '../types';
import { normalizeEndpointKey } from './normalizeEndpoint';

const TOKENS_PER_UNIT = 1_000_000;

export type BillingRuleSource = 'endpoint' | 'default' | 'missing';

export type BillingTokenCounts = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
};

export type BillingCostBreakdown = {
  input: number;
  output: number;
  reasoning: number;
  cached: number;
  inputNonCached: number;
  outputBillable: number;
  cacheRead: number;
  cacheStorageTokenHours: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheStorageCost: number;
  totalCost: number;
};

export type BillingCostResult = {
  endpointKey: string;
  ruleSource: BillingRuleSource;
  missingRule: boolean;
  tierIndex: number | null;
  tier: BillingTierV1 | null;
  breakdown: BillingCostBreakdown;
};

export type BillingCostConfig = {
  defaultRule: BillingRuleV1;
  endpointRules: Record<string, BillingRuleV1>;
};

const toNonNegative = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(num, 0);
};

const safeCost = (value: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return num;
};

export function extractBillingTokens(detail: UsageDetailWithEndpoint): BillingTokenCounts {
  const tokens = detail.tokens ?? ({} as UsageDetailWithEndpoint['tokens']);
  const inputTokens = toNonNegative(tokens.input_tokens);
  const outputTokens = toNonNegative(tokens.output_tokens);
  const reasoningTokens = toNonNegative(tokens.reasoning_tokens);
  const cachedTokens = Math.max(toNonNegative(tokens.cached_tokens), toNonNegative(tokens.cache_tokens));
  return { inputTokens, outputTokens, reasoningTokens, cachedTokens };
}

export function selectBillingTier(rule: BillingRuleV1, promptTokens: number): { tier: BillingTierV1; tierIndex: number } | null {
  if (!rule?.tiers?.length) return null;
  const normalizedPrompt = toNonNegative(promptTokens);

  const sortable = rule.tiers
    .map((tier, index) => ({
      tier,
      tierIndex: index,
      max: tier.maxPromptTokens === null ? Number.POSITIVE_INFINITY : toNonNegative(tier.maxPromptTokens)
    }))
    .sort((a, b) => (a.max !== b.max ? a.max - b.max : a.tierIndex - b.tierIndex));

  const chosen = sortable.find((entry) => normalizedPrompt <= entry.max) ?? sortable[sortable.length - 1];
  return chosen ? { tier: chosen.tier, tierIndex: chosen.tierIndex } : null;
}

export function computeBillingCostForEnabledRule(rule: BillingRuleV1, tokens: BillingTokenCounts): Omit<BillingCostResult, 'endpointKey' | 'ruleSource'> {
  if (!rule?.enabled) {
    return {
      missingRule: true,
      tierIndex: null,
      tier: null,
      breakdown: {
        input: tokens.inputTokens,
        output: tokens.outputTokens,
        reasoning: tokens.reasoningTokens,
        cached: tokens.cachedTokens,
        inputNonCached: Math.max(tokens.inputTokens - tokens.cachedTokens, 0),
        outputBillable: tokens.outputTokens + tokens.reasoningTokens,
        cacheRead: tokens.cachedTokens,
        cacheStorageTokenHours: 0,
        inputCost: 0,
        outputCost: 0,
        cacheReadCost: 0,
        cacheStorageCost: 0,
        totalCost: 0,
      },
    };
  }

  const tierHit = selectBillingTier(rule, tokens.inputTokens);
  const tier = tierHit?.tier ?? null;
  const tierIndex = tierHit?.tierIndex ?? null;

  const input = tokens.inputTokens;
  const output = tokens.outputTokens;
  const reasoning = tokens.reasoningTokens;
  const cached = tokens.cachedTokens;
  const inputNonCached = Math.max(input - cached, 0);
  const outputBillable = output + reasoning;
  const cacheRead = cached;
  const cacheStorageHours = toNonNegative(rule.cacheStorageHours);
  const cacheStorageTokenHours = cached * (cacheStorageHours > 0 ? cacheStorageHours : 0);

  const inputPer1M = toNonNegative(tier?.inputPer1M);
  const outputPer1M = toNonNegative(tier?.outputPer1M);
  const cacheReadPer1M = toNonNegative(tier?.cacheReadPer1M);
  const cacheStoragePer1MHour = toNonNegative(tier?.cacheStoragePer1MHour);

  const inputCost = safeCost((inputNonCached / TOKENS_PER_UNIT) * inputPer1M);
  const outputCost = safeCost((outputBillable / TOKENS_PER_UNIT) * outputPer1M);
  const cacheReadCost = safeCost((cacheRead / TOKENS_PER_UNIT) * cacheReadPer1M);
  const cacheStorageCost = safeCost((cacheStorageTokenHours / TOKENS_PER_UNIT) * cacheStoragePer1MHour);
  const totalCost = safeCost(inputCost + outputCost + cacheReadCost + cacheStorageCost);

  return {
    missingRule: false,
    tierIndex,
    tier,
    breakdown: {
      input,
      output,
      reasoning,
      cached,
      inputNonCached,
      outputBillable,
      cacheRead,
      cacheStorageTokenHours,
      inputCost,
      outputCost,
      cacheReadCost,
      cacheStorageCost,
      totalCost,
    },
  };
}

export function resolveBillingRuleForEndpoint(endpointKey: string, config: BillingCostConfig): { rule: BillingRuleV1; source: Exclude<BillingRuleSource, 'missing'> } | null {
  const normalized = normalizeEndpointKey(endpointKey);
  if (!normalized) return null;

  const endpointRule = config.endpointRules[normalized];
  if (endpointRule) {
    return { rule: endpointRule, source: 'endpoint' };
  }

  return { rule: config.defaultRule, source: 'default' };
}

export function computeBillingCostForDetail(detail: UsageDetailWithEndpoint, config: BillingCostConfig): BillingCostResult {
  const endpointKey = normalizeEndpointKey(detail.__endpoint);
  const tokens = extractBillingTokens(detail);
  const resolved = resolveBillingRuleForEndpoint(endpointKey, config);

  if (!resolved) {
    return {
      endpointKey,
      ruleSource: 'missing',
      missingRule: true,
      tierIndex: null,
      tier: null,
      breakdown: {
        input: tokens.inputTokens,
        output: tokens.outputTokens,
        reasoning: tokens.reasoningTokens,
        cached: tokens.cachedTokens,
        inputNonCached: Math.max(tokens.inputTokens - tokens.cachedTokens, 0),
        outputBillable: tokens.outputTokens + tokens.reasoningTokens,
        cacheRead: tokens.cachedTokens,
        cacheStorageTokenHours: 0,
        inputCost: 0,
        outputCost: 0,
        cacheReadCost: 0,
        cacheStorageCost: 0,
        totalCost: 0,
      },
    };
  }

  const computed = computeBillingCostForEnabledRule(resolved.rule, tokens);
  const ruleSource: BillingRuleSource = computed.missingRule ? 'missing' : resolved.source;

  return {
    endpointKey,
    ruleSource,
    ...computed,
  };
}

export type BillingCostTotals = {
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheStorageCost: number;
  totalCost: number;
  missingRequestCount: number;
  missingEndpoints: string[];
};

export function summarizeBillingCosts(details: UsageDetailWithEndpoint[], config: BillingCostConfig): BillingCostTotals {
  let inputCost = 0;
  let outputCost = 0;
  let cacheReadCost = 0;
  let cacheStorageCost = 0;
  let totalCost = 0;
  let missingRequestCount = 0;
  const missingEndpoints = new Set<string>();

  details.forEach((detail) => {
    const result = computeBillingCostForDetail(detail, config);
    if (result.missingRule) {
      missingRequestCount += 1;
      if (result.endpointKey) missingEndpoints.add(result.endpointKey);
      return;
    }

    inputCost += result.breakdown.inputCost;
    outputCost += result.breakdown.outputCost;
    cacheReadCost += result.breakdown.cacheReadCost;
    cacheStorageCost += result.breakdown.cacheStorageCost;
    totalCost += result.breakdown.totalCost;
  });

  return {
    inputCost: safeCost(inputCost),
    outputCost: safeCost(outputCost),
    cacheReadCost: safeCost(cacheReadCost),
    cacheStorageCost: safeCost(cacheStorageCost),
    totalCost: safeCost(totalCost),
    missingRequestCount,
    missingEndpoints: Array.from(missingEndpoints).sort(),
  };
}

export type BillingCostSeries = {
  labels: string[];
  data: number[];
  hasData: boolean;
  missingRequestCount: number;
};

export function buildHourlyEndpointCostSeries(
  details: UsageDetailWithEndpoint[],
  config: BillingCostConfig,
  hourWindow: number = 24
): BillingCostSeries {
  const hourMs = 60 * 60 * 1000;
  const resolvedHourWindow =
    Number.isFinite(hourWindow) && hourWindow > 0
      ? Math.min(Math.max(Math.floor(hourWindow), 1), 24 * 31)
      : 24;
  const now = new Date();
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);

  const earliestBucket = new Date(currentHour);
  earliestBucket.setHours(earliestBucket.getHours() - (resolvedHourWindow - 1));
  const earliestTime = earliestBucket.getTime();

  const labels: string[] = [];
  for (let i = 0; i < resolvedHourWindow; i++) {
    labels.push(formatHourLabel(new Date(earliestTime + i * hourMs)));
  }

  const data = new Array(labels.length).fill(0);
  let hasData = false;
  let missingRequestCount = 0;

  details.forEach((detail) => {
    const timestamp = typeof detail.__timestampMs === 'number' ? detail.__timestampMs : Date.parse(detail.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return;
    const normalized = new Date(timestamp);
    normalized.setMinutes(0, 0, 0);
    const bucketStart = normalized.getTime();
    const lastBucketTime = earliestTime + (labels.length - 1) * hourMs;
    if (bucketStart < earliestTime || bucketStart > lastBucketTime) return;
    const bucketIndex = Math.floor((bucketStart - earliestTime) / hourMs);
    if (bucketIndex < 0 || bucketIndex >= labels.length) return;

    const costResult = computeBillingCostForDetail(detail, config);
    if (costResult.missingRule) {
      missingRequestCount += 1;
      return;
    }

    hasData = true;
    data[bucketIndex] += costResult.breakdown.totalCost;
  });

  return { labels, data, hasData, missingRequestCount };
}

export function buildDailyEndpointCostSeries(
  details: UsageDetailWithEndpoint[],
  config: BillingCostConfig
): BillingCostSeries {
  const dayMap: Record<string, number> = {};
  let hasData = false;
  let missingRequestCount = 0;

  details.forEach((detail) => {
    const timestamp = typeof detail.__timestampMs === 'number' ? detail.__timestampMs : Date.parse(detail.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return;
    const dayLabel = formatDayLabel(new Date(timestamp));
    if (!dayLabel) return;

    const costResult = computeBillingCostForDetail(detail, config);
    if (costResult.missingRule) {
      missingRequestCount += 1;
      return;
    }

    hasData = true;
    dayMap[dayLabel] = (dayMap[dayLabel] || 0) + costResult.breakdown.totalCost;
  });

  const labels = Object.keys(dayMap).sort();
  const data = labels.map((label) => dayMap[label]);

  return { labels, data, hasData, missingRequestCount };
}

export const formatTierLabel = (tier: BillingTierV1 | null): string => {
  if (!tier) return '--';
  if (tier.label?.trim()) return tier.label.trim();
  if (tier.maxPromptTokens === null) return '∞';
  return `<=${formatTokenCount(tier.maxPromptTokens)}`;
};

export const formatTokenCount = (value: number): string => {
  const num = toNonNegative(value);
  if (num >= 1_000_000) {
    const m = Math.round(num / 1_000_000);
    return `${m}M`;
  }
  if (num >= 1_000) {
    const k = Math.round(num / 1_000);
    return `${k}K`;
  }
  return Math.round(num).toString();
};
