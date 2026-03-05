import { describe, expect, it } from 'vitest';
import type { UsageDetailWithEndpoint } from '@/utils/usage';
import type { ModelPricingV1 } from './types';
import { buildModelPricingAnalytics } from './analytics';

const makeDetail = ({
  __endpoint,
  ...partial
}: Partial<UsageDetailWithEndpoint> & Pick<UsageDetailWithEndpoint, '__endpoint'>): UsageDetailWithEndpoint => ({
  timestamp: '2026-01-01T01:23:45.000Z',
  source: 'k:test',
  auth_index: 1,
  tokens: {
    input_tokens: 10,
    output_tokens: 20,
    reasoning_tokens: 0,
    cached_tokens: 0,
    total_tokens: 30,
  },
  failed: false,
  __modelName: 'm1',
  __endpoint,
  __timestampMs: Date.parse('2026-01-01T01:23:45.000Z'),
  ...partial,
});

describe('model pricing analytics', () => {
  it('aggregates totals by currency', () => {
    const usd: ModelPricingV1 = {
      currencySymbol: '$',
      tiers: [{ maxPromptTokens: null, promptPer1M: 2, completionPer1M: 4 }],
    };
    const cny: ModelPricingV1 = {
      currencySymbol: '￥',
      tiers: [{ maxPromptTokens: null, promptPer1M: 10, completionPer1M: 0 }],
    };

    const details = [
      makeDetail({ __endpoint: 'POST /v1/a', __modelName: 'm1' }),
      makeDetail({ __endpoint: 'POST /v1/b', __modelName: 'm2', tokens: { input_tokens: 100, output_tokens: 0, reasoning_tokens: 0, cached_tokens: 0, total_tokens: 100 } }),
    ];

    const analytics = buildModelPricingAnalytics(details, { m1: usd, m2: cny }, { now: new Date('2026-01-01T02:00:00.000Z'), hourWindowHours: 24 });

    expect(analytics.currenciesInUse.sort()).toEqual(['$', '￥'].sort());
    expect(analytics.totalsByCurrency['$']?.totalCost).toBeGreaterThan(0);
    expect(analytics.totalsByCurrency['￥']?.totalCost).toBeGreaterThan(0);
  });

  it('counts missing pricing and records missing models', () => {
    const pricing: ModelPricingV1 = {
      currencySymbol: '$',
      tiers: [{ maxPromptTokens: null, promptPer1M: 1, completionPer1M: 0 }],
    };

    const details = [
      makeDetail({ __endpoint: 'POST /v1/a', __modelName: 'm1' }),
      makeDetail({ __endpoint: 'POST /v1/a', __modelName: 'missing-model' }),
    ];

    const analytics = buildModelPricingAnalytics(details, { m1: pricing }, { now: new Date('2026-01-01T02:00:00.000Z'), hourWindowHours: 24 });

    expect(analytics.missingCostRequestCount).toBe(1);
    expect(analytics.missingModels).toEqual(['missing-model']);
  });

  it('merges auth_index-only requests into existing source key when possible', () => {
    const pricing: ModelPricingV1 = {
      currencySymbol: '$',
      tiers: [{ maxPromptTokens: null, promptPer1M: 1, completionPer1M: 0 }],
    };

    const withSource = makeDetail({ __endpoint: 'POST /v1/a', source: 'k:abc', auth_index: 7, __modelName: 'm1' });
    const missingSourceSameAuth = makeDetail({ __endpoint: 'POST /v1/a', source: '', auth_index: 7, __modelName: 'm1' });

    const analytics = buildModelPricingAnalytics([withSource, missingSourceSameAuth], { m1: pricing }, { now: new Date('2026-01-01T02:00:00.000Z'), hourWindowHours: 24 });

    const keyRow = analytics.keys.find((k) => k.key === 'k:abc');
    expect(keyRow).toBeTruthy();
    expect(keyRow?.requests).toBe(2);
    expect(keyRow?.authIndexes).toContain('7');
  });

  it('merges auth_index-only bucket created before source row', () => {
    const pricing: ModelPricingV1 = {
      currencySymbol: '$',
      tiers: [{ maxPromptTokens: null, promptPer1M: 1, completionPer1M: 0 }],
    };

    const missingSourceSameAuth = makeDetail({ __endpoint: 'POST /v1/a', source: '', auth_index: 7, __modelName: 'm1' });
    const withSourceLater = makeDetail({ __endpoint: 'POST /v1/a', source: 'k:abc', auth_index: 7, __modelName: 'm1' });

    const analytics = buildModelPricingAnalytics([missingSourceSameAuth, withSourceLater], { m1: pricing }, { now: new Date('2026-01-01T02:00:00.000Z'), hourWindowHours: 24 });

    const keyRow = analytics.keys.find((k) => k.key === 'k:abc');
    expect(keyRow).toBeTruthy();
    expect(keyRow?.requests).toBe(2);
    expect(keyRow?.authIndexes).toContain('7');
    expect(analytics.keys.find((k) => k.key === 'auth:7')).toBeFalsy();
  });
});
