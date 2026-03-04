import { describe, expect, it } from 'vitest';
import type { UsageDetailWithEndpoint } from '@/utils/usage';
import type { BillingExportV1, BillingRuleV1 } from '../types';
import { computeBillingCostForDetail, computeBillingCostForEnabledRule } from './costing';
import { parseBillingExportV1 } from './schema';

const makeRule = (overrides: Partial<BillingRuleV1> = {}): BillingRuleV1 => ({
  enabled: true,
  cacheStorageHours: 2,
  tiers: [
    {
      maxPromptTokens: 200_000,
      inputPer1M: 2,
      outputPer1M: 12,
      cacheReadPer1M: 0.2,
      cacheStoragePer1MHour: 4.5,
      label: '<=200K',
    },
    {
      maxPromptTokens: null,
      inputPer1M: 4,
      outputPer1M: 18,
      cacheReadPer1M: 0.4,
      cacheStoragePer1MHour: 6,
      label: '>200K',
    },
  ],
  ...overrides,
});

const makeDetail = (endpoint: string, tokens: UsageDetailWithEndpoint['tokens']): UsageDetailWithEndpoint => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  source: 'test',
  auth_index: 0,
  tokens,
  failed: false,
  __endpoint: endpoint,
  __timestampMs: Date.parse('2026-01-01T00:00:00.000Z'),
});

describe('billing costing', () => {
  it('selects tier by prompt tokens threshold', () => {
    const rule = makeRule();

    const hit200k = computeBillingCostForEnabledRule(rule, {
      inputTokens: 200_000,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedTokens: 0,
    });
    expect(hit200k.tier?.maxPromptTokens).toBe(200_000);

    const hitNext = computeBillingCostForEnabledRule(rule, {
      inputTokens: 200_001,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedTokens: 0,
    });
    expect(hitNext.tier?.maxPromptTokens).toBeNull();
  });

  it('bills output tokens including reasoning', () => {
    const rule = makeRule();
    const res = computeBillingCostForEnabledRule(rule, {
      inputTokens: 0,
      outputTokens: 100,
      reasoningTokens: 50,
      cachedTokens: 0,
    });

    expect(res.breakdown.outputBillable).toBe(150);
    expect(res.breakdown.outputCost).toBeCloseTo((150 / 1_000_000) * 12, 10);
  });

  it('splits input into non-cached + cache read', () => {
    const rule = makeRule();
    const res = computeBillingCostForEnabledRule(rule, {
      inputTokens: 1000,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedTokens: 200,
    });

    expect(res.breakdown.inputNonCached).toBe(800);
    expect(res.breakdown.cacheRead).toBe(200);
    expect(res.breakdown.inputCost).toBeCloseTo((800 / 1_000_000) * 2, 10);
    expect(res.breakdown.cacheReadCost).toBeCloseTo((200 / 1_000_000) * 0.2, 10);
  });

  it('charges cache storage per token-hour', () => {
    const rule = makeRule({ cacheStorageHours: 2 });
    const res = computeBillingCostForEnabledRule(rule, {
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedTokens: 1000,
    });

    expect(res.breakdown.cacheStorageTokenHours).toBe(2000);
    expect(res.breakdown.cacheStorageCost).toBeCloseTo((1000 * 2 / 1_000_000) * 4.5, 10);
  });

  it('marks missing rule when default + endpoint are disabled', () => {
    const defaultRule = makeRule({ enabled: false });
    const detail = makeDetail('POST /v1/chat/completions', {
      input_tokens: 10,
      output_tokens: 0,
      reasoning_tokens: 0,
      cached_tokens: 0,
      total_tokens: 10,
    });

    const res = computeBillingCostForDetail(detail, {
      defaultRule,
      endpointRules: {},
    });

    expect(res.missingRule).toBe(true);
    expect(res.ruleSource).toBe('missing');
    expect(res.breakdown.totalCost).toBe(0);
  });
});

describe('billing import/export schema', () => {
  it('merges import by overwriting same endpoint key', () => {
    const current = {
      defaultRule: makeRule(),
      endpointRules: {
        'POST /a': makeRule({ cacheStorageHours: 1 }),
        'GET /b': makeRule({ cacheStorageHours: 3 }),
      },
    };

    const imported: BillingExportV1 = {
      version: 1,
      exportedAt: new Date().toISOString(),
      defaultRule: makeRule({ cacheStorageHours: 2 }),
      endpointRules: {
        'POST /a': makeRule({ cacheStorageHours: 9 }),
      },
    };

    const parsed = parseBillingExportV1(imported);
    const merged = { ...current.endpointRules, ...parsed.endpointRules };

    expect(merged['POST /a']?.cacheStorageHours).toBe(9);
    expect(merged['GET /b']?.cacheStorageHours).toBe(3);
  });

  it('rejects exports without exactly one Infinity tier', () => {
    const invalid = {
      version: 1,
      exportedAt: new Date().toISOString(),
      defaultRule: {
        enabled: true,
        cacheStorageHours: 1,
        tiers: [
          {
            maxPromptTokens: 100,
            inputPer1M: 0,
            outputPer1M: 0,
            cacheReadPer1M: 0,
            cacheStoragePer1MHour: 0,
          },
        ],
      },
      endpointRules: {},
    };

    expect(() => parseBillingExportV1(invalid)).toThrow(/Infinity/i);
  });
});

