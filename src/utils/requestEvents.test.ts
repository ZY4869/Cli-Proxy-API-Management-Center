import { describe, expect, it } from 'vitest';
import { collectUsageRequestEvents, createUsageRequestEvent } from './requestEvents';
import type { UsageDetailWithEndpoint } from './usage';

describe('createUsageRequestEvent', () => {
  it('prefers explicit total_tokens when it exists', () => {
    const detail: UsageDetailWithEndpoint = {
      timestamp: '2026-03-06T00:00:00.000Z',
      source: 't:provider-a',
      auth_index: 1,
      request_id: 'req-explicit',
      failed: false,
      tokens: {
        input_tokens: 10,
        output_tokens: 20,
        reasoning_tokens: 5,
        cached_tokens: 7,
        total_tokens: 99,
      },
      __modelName: 'gpt-4o',
      __endpoint: 'POST /v1/chat/completions',
      __endpointMethod: 'POST',
      __endpointPath: '/v1/chat/completions',
      __timestampMs: Date.parse('2026-03-06T00:00:00.000Z'),
      __sourceRaw: 'provider-a-raw',
    };

    const event = createUsageRequestEvent(detail);

    expect(event.requestId).toBe('req-explicit');
    expect(event.totalTokens).toBe(99);
    expect(event.cachedTokens).toBe(7);
    expect(event.sourceRaw).toBe('provider-a-raw');
    expect(event.endpointLabel).toBe('POST /v1/chat/completions');
  });

  it('reconstructs total_tokens from input/output/reasoning/cache_tokens', () => {
    const detail = {
      timestamp: '2026-03-06T01:00:00.000Z',
      source: 't:provider-b',
      auth_index: 2,
      failed: true,
      tokens: {
        input_tokens: 11,
        output_tokens: 13,
        reasoning_tokens: 17,
        cache_tokens: 19,
      },
      __modelName: 'claude-3-7-sonnet',
      __endpoint: 'POST /v1/messages',
      __endpointMethod: 'POST',
      __endpointPath: '/v1/messages',
      __timestampMs: Date.parse('2026-03-06T01:00:00.000Z'),
      __sourceRaw: 'provider-b-raw',
    } as UsageDetailWithEndpoint;

    const event = createUsageRequestEvent(detail, 3);

    expect(event.failed).toBe(true);
    expect(event.cachedTokens).toBe(19);
    expect(event.totalTokens).toBe(60);
    expect(event.endpointPath).toBe('/v1/messages');
    expect(event.id).toContain('claude-3-7-sonnet');
  });
});

describe('collectUsageRequestEvents', () => {
  it('collects events from usage data and sorts newest first', () => {
    const usage = {
      apis: {
        'POST /v1/messages': {
          models: {
            claude: {
              details: [
                {
                  timestamp: '2026-03-06T00:00:00.000Z',
                  source: 'provider-a',
                  auth_index: 0,
                  request_id: 'req-old',
                  failed: false,
                  tokens: {
                    input_tokens: 1,
                    output_tokens: 2,
                    total_tokens: 3,
                  },
                },
                {
                  timestamp: '2026-03-06T02:00:00.000Z',
                  source: 'provider-b',
                  auth_index: 1,
                  request_id: 'req-new',
                  failed: false,
                  tokens: {
                    input_tokens: 2,
                    output_tokens: 3,
                    reasoning_tokens: 4,
                    cache_tokens: 5,
                  },
                },
              ],
            },
          },
        },
      },
    };

    const events = collectUsageRequestEvents(usage);

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.requestId)).toEqual(['req-new', 'req-old']);
    expect(events[0].sourceRaw).toBe('provider-b');
    expect(events[0].totalTokens).toBe(14);
    expect(events[0].endpointMethod).toBe('POST');
    expect(events[0].endpointPath).toBe('/v1/messages');
  });
});
