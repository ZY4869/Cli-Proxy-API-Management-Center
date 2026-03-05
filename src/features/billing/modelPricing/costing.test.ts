import { describe, expect, it } from 'vitest';
import type { UsageDetail } from '@/utils/usage';
import type { ModelPricingV1 } from './types';
import { computeCostForDetail, selectTier } from './costing';

const makePricing = (overrides: Partial<ModelPricingV1> = {}): ModelPricingV1 => ({
  currencySymbol: '$',
  tiers: [
    {
      maxPromptTokens: 200_000,
      promptPer1M: 2,
      completionPer1M: 12,
      label: '<=200K',
    },
    {
      maxPromptTokens: null,
      promptPer1M: 4,
      completionPer1M: 18,
      label: '>200K',
    },
  ],
  ...overrides,
});

const makeDetail = (modelName: string, tokens: UsageDetail['tokens']): UsageDetail => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  source: 'test',
  auth_index: 0,
  tokens,
  failed: false,
  __modelName: modelName,
  __timestampMs: Date.parse('2026-01-01T00:00:00.000Z'),
});

describe('model pricing costing', () => {
  it('selects tier by input_tokens threshold', () => {
    const pricing = makePricing();
    const tiers = pricing.tiers;
    expect(selectTier(tiers, 200_000)?.tier.maxPromptTokens).toBe(200_000);
    expect(selectTier(tiers, 200_001)?.tier.maxPromptTokens).toBeNull();
  });

  it('bills completion tokens including reasoning', () => {
    const pricing = makePricing({
      tiers: [
        { maxPromptTokens: null, promptPer1M: 0, completionPer1M: 12 },
      ],
    });

    const res = computeCostForDetail(
      makeDetail('gpt-test', {
        input_tokens: 0,
        output_tokens: 100,
        reasoning_tokens: 50,
        cached_tokens: 0,
        total_tokens: 150,
      }),
      { 'gpt-test': pricing }
    );

    expect(res.missingPricing).toBe(false);
    expect(res.breakdown.outputBillableTokens).toBe(150);
    expect(res.breakdown.completionCost).toBeCloseTo((150 / 1_000_000) * 12, 10);
  });

  it('defaults cachePer1M to tier promptPer1M when missing', () => {
    const pricing = makePricing({
      cachePer1M: undefined,
      tiers: [{ maxPromptTokens: null, promptPer1M: 2, completionPer1M: 0 }],
    });

    const res = computeCostForDetail(
      makeDetail('gpt-test', {
        input_tokens: 0,
        output_tokens: 0,
        reasoning_tokens: 0,
        cached_tokens: 1000,
        total_tokens: 1000,
      }),
      { 'gpt-test': pricing }
    );

    expect(res.breakdown.cacheCost).toBeCloseTo((1000 / 1_000_000) * 2, 10);
  });
});

