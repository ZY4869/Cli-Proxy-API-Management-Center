import { describe, expect, it } from 'vitest';
import type { UsageDetailWithEndpoint } from '@/utils/usage';
import type { BillingRuleV1 } from '../types';
import { buildBillingAnalytics } from './dashboard';

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

const makeDetail = (endpoint: string, tokens: UsageDetailWithEndpoint['tokens'], failed = false): UsageDetailWithEndpoint => ({
  timestamp: '2026-01-01T01:23:45.000Z',
  source: 'test',
  auth_index: 0,
  tokens,
  failed,
  __endpoint: endpoint,
  __timestampMs: Date.parse('2026-01-01T01:23:45.000Z'),
});

describe('billing dashboard analytics', () => {
  it('sorts tiers by maxPromptTokens with Infinity last', () => {
    const analytics = buildBillingAnalytics(
      [
        makeDetail('POST /v1/a', {
          input_tokens: 200_000,
          output_tokens: 0,
          reasoning_tokens: 0,
          cached_tokens: 0,
          total_tokens: 200_000,
        }),
        makeDetail('POST /v1/a', {
          input_tokens: 200_001,
          output_tokens: 0,
          reasoning_tokens: 0,
          cached_tokens: 0,
          total_tokens: 200_001,
        }),
      ],
      { defaultRule: makeRule(), endpointRules: {} },
      { now: new Date('2026-01-01T02:00:00.000Z'), hourWindowHours: 24 }
    );

    expect(analytics.tiers.map((t) => t.maxPromptTokens)).toEqual([200_000, null]);
    expect(analytics.tiers[0]?.requestCount).toBe(1);
    expect(analytics.tiers[1]?.requestCount).toBe(1);
  });

  it('computes net savings and allows negative values', () => {
    const rule = makeRule({
      cacheStorageHours: 2,
      tiers: [
        {
          maxPromptTokens: null,
          inputPer1M: 1,
          outputPer1M: 0,
          cacheReadPer1M: 10,
          cacheStoragePer1MHour: 10,
        },
      ],
    });

    const analytics = buildBillingAnalytics(
      [
        makeDetail('POST /v1/chat/completions', {
          input_tokens: 1000,
          output_tokens: 0,
          reasoning_tokens: 0,
          cached_tokens: 1000,
          total_tokens: 1000,
        }),
      ],
      { defaultRule: rule, endpointRules: {} },
      { now: new Date('2026-01-01T02:00:00.000Z'), hourWindowHours: 24 }
    );

    expect(analytics.cacheImpact.netSavings).toBeLessThan(0);
  });

  it('aggregates endpoint requests and costs', () => {
    const rule = makeRule();
    const analytics = buildBillingAnalytics(
      [
        makeDetail('POST /v1/a', {
          input_tokens: 10,
          output_tokens: 20,
          reasoning_tokens: 0,
          cached_tokens: 0,
          total_tokens: 30,
        }),
        makeDetail('POST /v1/a', {
          input_tokens: 10,
          output_tokens: 0,
          reasoning_tokens: 0,
          cached_tokens: 0,
          total_tokens: 10,
        }, true),
      ],
      { defaultRule: rule, endpointRules: {} },
      { now: new Date('2026-01-01T02:00:00.000Z'), hourWindowHours: 24 }
    );

    const endpoint = analytics.endpoints.find((e) => e.endpointKey === 'POST /v1/a');
    expect(endpoint).toBeTruthy();
    expect(endpoint?.requests).toBe(2);
    expect(endpoint?.successCount).toBe(1);
    expect(endpoint?.failureCount).toBe(1);
    expect(endpoint?.costKnown).toBe(true);
    expect(endpoint?.costs.totalCost).toBeGreaterThan(0);
  });

  it('counts missing rules when default is disabled', () => {
    const analytics = buildBillingAnalytics(
      [
        makeDetail('POST /v1/missing', {
          input_tokens: 10,
          output_tokens: 0,
          reasoning_tokens: 0,
          cached_tokens: 0,
          total_tokens: 10,
        }),
      ],
      { defaultRule: makeRule({ enabled: false }), endpointRules: {} },
      { now: new Date('2026-01-01T02:00:00.000Z'), hourWindowHours: 24 }
    );

    expect(analytics.hasAnyEnabledRule).toBe(false);
    expect(analytics.missingCostRequestCount).toBe(1);
    expect(analytics.missingEndpoints).toEqual(['POST /v1/missing']);
    expect(analytics.costs.totalCost).toBe(0);
  });
});

