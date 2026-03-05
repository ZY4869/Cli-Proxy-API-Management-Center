import { describe, expect, it } from 'vitest';
import { buildModelPricingTemplateExportV2, parseModelPricingExportV2Lenient } from './templateExport';

describe('buildModelPricingTemplateExportV2', () => {
  it('includes all model names and uses draft for missing pricing', () => {
    const exported = buildModelPricingTemplateExportV2({
      modelNames: ['b', 'a', '  ', 'a'],
      pricingByModel: {
        a: {
          currencySymbol: '$',
          tiers: [{ maxPromptTokens: null, promptPer1M: 1, completionPer1M: 2 }],
        },
      },
      defaultCurrencySymbol: '￥',
      exportedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(exported.version).toBe(2);
    expect(exported.template).toBe(true);
    expect(Object.keys(exported.models)).toEqual(['a', 'b']);
    expect((exported.models['a'] as any)?.tiers?.[0]?.promptPer1M).toBe(1);
    expect((exported.models['b'] as any)?.currencySymbol).toBe('￥');
    expect((exported.models['b'] as any)?.tiers?.[0]?.promptPer1M).toBe('TODO');
  });
});

describe('parseModelPricingExportV2Lenient', () => {
  it('imports valid models and skips invalid/null entries', () => {
    const parsed = parseModelPricingExportV2Lenient({
      version: 2,
      exportedAt: '2026-01-01T00:00:00.000Z',
      models: {
        ok: { currencySymbol: '$', tiers: [{ maxPromptTokens: null, promptPer1M: 1, completionPer1M: 2 }] },
        todo: { currencySymbol: '$', tiers: [{ maxPromptTokens: null, promptPer1M: 'TODO', completionPer1M: 'TODO' }] },
        empty: null,
      },
    });

    expect(Object.keys(parsed.models)).toEqual(['ok']);
    expect(parsed.skippedModels).toBe(2);
    expect(parsed.invalidModels).toEqual(['todo']);
  });
});

