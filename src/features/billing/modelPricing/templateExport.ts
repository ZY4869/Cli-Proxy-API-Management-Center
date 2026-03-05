import type { ModelPricingExportV2, ModelPricingTemplateDraftV2, ModelPricingV1 } from './types';
import { parseModelPricingV1 } from './schema';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeModelName = (value: unknown): string => String(value ?? '').trim();

const uniqueSorted = (values: string[]): string[] => {
  const set = new Set<string>();
  values.forEach((value) => {
    const name = normalizeModelName(value);
    if (!name) return;
    set.add(name);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

const PLACEHOLDER = 'TODO';

const buildDraft = (defaultCurrencySymbol: string): ModelPricingTemplateDraftV2 => ({
  currencySymbol: normalizeModelName(defaultCurrencySymbol) || '$',
  cachePer1M: '',
  tiers: [
    {
      maxPromptTokens: null,
      promptPer1M: PLACEHOLDER,
      completionPer1M: PLACEHOLDER,
    },
  ],
});

export function buildModelPricingTemplateExportV2(options: {
  modelNames: string[];
  pricingByModel: Record<string, ModelPricingV1>;
  defaultCurrencySymbol: string;
  exportedAt: string;
}): ModelPricingExportV2 {
  const names = uniqueSorted(options.modelNames);
  const models: ModelPricingExportV2['models'] = {};

  names.forEach((name) => {
    const existing = options.pricingByModel?.[name];
    models[name] = existing ?? buildDraft(options.defaultCurrencySymbol);
  });

  return {
    version: 2,
    exportedAt: options.exportedAt,
    template: true,
    instructions:
      'Fill TODO with numbers (supports numeric strings). Keep one Infinity tier (maxPromptTokens = null). Delete entries you do not want to import.',
    models,
  };
}

export function parseModelPricingExportV2Lenient(payload: unknown): {
  models: Record<string, ModelPricingV1>;
  skippedModels: number;
  invalidModels: string[];
} {
  if (!isRecord(payload)) {
    throw new Error('Invalid model pricing export: expected object');
  }
  if (payload.version !== 2) {
    throw new Error('Invalid model pricing export: unsupported version');
  }
  if (typeof payload.exportedAt !== 'string' || !payload.exportedAt.trim()) {
    throw new Error('Invalid model pricing export: exportedAt must be a non-empty string');
  }
  const modelsRaw = payload.models;
  if (!isRecord(modelsRaw)) {
    throw new Error('Invalid model pricing export: models must be an object');
  }

  const models: Record<string, ModelPricingV1> = {};
  const invalidModels: string[] = [];
  let skippedModels = 0;

  Object.entries(modelsRaw).forEach(([modelName, pricingRaw]) => {
    const name = normalizeModelName(modelName);
    if (!name) return;
    if (pricingRaw === null || pricingRaw === undefined) {
      skippedModels += 1;
      return;
    }
    try {
      models[name] = parseModelPricingV1(pricingRaw);
    } catch {
      invalidModels.push(name);
      skippedModels += 1;
    }
  });

  invalidModels.sort((a, b) => a.localeCompare(b));
  return { models, skippedModels, invalidModels };
}

