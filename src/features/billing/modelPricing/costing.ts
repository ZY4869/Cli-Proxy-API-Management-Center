import type { UsageDetail } from '@/utils/usage';
import type { ModelPricingTierV1, ModelPricingV1 } from './types';

const TOKENS_PER_UNIT = 1_000_000;

const toNonNegative = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(num, 0);
};

const safeCost = (value: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return 0;
  return num;
};

export type ModelPricingTokenCounts = {
  inputTokens: number;
  cachedTokens: number;
  promptBillableTokens: number;
  outputBillableTokens: number;
};

export type ModelPricingCostBreakdown = ModelPricingTokenCounts & {
  promptCost: number;
  completionCost: number;
  cacheCost: number;
  totalCost: number;
};

export type ModelPricingCostResult = {
  modelName: string;
  missingPricing: boolean;
  currencySymbol: string;
  tierIndex: number | null;
  tier: ModelPricingTierV1 | null;
  tierLabel: string;
  breakdown: ModelPricingCostBreakdown;
};

const formatTokenCount = (value: number): string => {
  const num = toNonNegative(value);
  if (num >= 1_000_000) return `${Math.round(num / 1_000_000)}M`;
  if (num >= 1_000) return `${Math.round(num / 1_000)}K`;
  return Math.round(num).toString();
};

export const formatTierLabel = (tier: ModelPricingTierV1 | null): string => {
  if (!tier) return '--';
  if (tier.label?.trim()) return tier.label.trim();
  if (tier.maxPromptTokens === null) return '∞';
  return `<=${formatTokenCount(tier.maxPromptTokens)}`;
};

export function selectTier(
  tiers: ModelPricingTierV1[],
  promptTokensInput: number
): { tier: ModelPricingTierV1; tierIndex: number } | null {
  if (!Array.isArray(tiers) || tiers.length < 1) return null;
  const normalizedPrompt = toNonNegative(promptTokensInput);

  const sortable = tiers
    .map((tier, index) => ({
      tier,
      tierIndex: index,
      max: tier.maxPromptTokens === null ? Number.POSITIVE_INFINITY : toNonNegative(tier.maxPromptTokens),
    }))
    .sort((a, b) => (a.max !== b.max ? a.max - b.max : a.tierIndex - b.tierIndex));

  const chosen = sortable.find((entry) => normalizedPrompt <= entry.max) ?? sortable[sortable.length - 1];
  return chosen ? { tier: chosen.tier, tierIndex: chosen.tierIndex } : null;
}

export function extractPricingTokens(detail: UsageDetail): ModelPricingTokenCounts {
  const tokens = detail.tokens ?? ({} as UsageDetail['tokens']);
  const inputTokens = toNonNegative(tokens.input_tokens);
  const outputTokens = toNonNegative(tokens.output_tokens);
  const reasoningTokens = toNonNegative(tokens.reasoning_tokens);
  const cachedTokens = Math.max(toNonNegative(tokens.cached_tokens), toNonNegative(tokens.cache_tokens));

  const promptBillableTokens = Math.max(inputTokens - cachedTokens, 0);
  const outputBillableTokens = outputTokens + reasoningTokens;

  return { inputTokens, cachedTokens, promptBillableTokens, outputBillableTokens };
}

export function computeCostForDetail(
  detail: UsageDetail,
  pricingMap: Record<string, ModelPricingV1>
): ModelPricingCostResult {
  const modelName = String(detail.__modelName ?? '').trim();
  const tokens = extractPricingTokens(detail);

  const missing = () => ({
    modelName,
    missingPricing: true,
    currencySymbol: '',
    tierIndex: null,
    tier: null,
    tierLabel: '--',
    breakdown: {
      ...tokens,
      promptCost: 0,
      completionCost: 0,
      cacheCost: 0,
      totalCost: 0,
    },
  });

  if (!modelName) return missing();

  const pricing = pricingMap?.[modelName];
  if (!pricing) return missing();

  const tierHit = selectTier(pricing.tiers, tokens.inputTokens);
  const tier = tierHit?.tier ?? null;
  const tierIndex = tierHit?.tierIndex ?? null;
  const tierLabel = formatTierLabel(tier);

  const promptPer1M = toNonNegative(tier?.promptPer1M);
  const completionPer1M = toNonNegative(tier?.completionPer1M);
  const cachePer1M =
    pricing.cachePer1M === undefined || pricing.cachePer1M === null
      ? promptPer1M
      : toNonNegative(pricing.cachePer1M);

  const promptCost = safeCost((tokens.promptBillableTokens / TOKENS_PER_UNIT) * promptPer1M);
  const completionCost = safeCost((tokens.outputBillableTokens / TOKENS_PER_UNIT) * completionPer1M);
  const cacheCost = safeCost((tokens.cachedTokens / TOKENS_PER_UNIT) * cachePer1M);
  const totalCost = safeCost(promptCost + completionCost + cacheCost);

  return {
    modelName,
    missingPricing: false,
    currencySymbol: String(pricing.currencySymbol ?? '').trim() || '$',
    tierIndex,
    tier,
    tierLabel,
    breakdown: {
      ...tokens,
      promptCost,
      completionCost,
      cacheCost,
      totalCost,
    },
  };
}

