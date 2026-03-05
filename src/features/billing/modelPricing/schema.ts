import type { ModelPricingExportV1, ModelPricingTierV1, ModelPricingV1 } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toNumber = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : Number.NaN;
};

const ensureNonNegative = (value: unknown, fieldName: string): number => {
  const num = toNumber(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid ${fieldName}: expected non-negative number`);
  }
  return num;
};

const parseCurrencySymbol = (value: unknown): string => {
  const raw = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const trimmed = raw.trim();
  return trimmed || '$';
};

export function parseModelPricingV1(value: unknown): ModelPricingV1 {
  if (!isRecord(value)) {
    throw new Error('Invalid model pricing: expected object');
  }

  const currencySymbol = parseCurrencySymbol(value.currencySymbol);

  const cachePer1MRaw = value.cachePer1M;
  const cachePer1M =
    cachePer1MRaw === undefined || cachePer1MRaw === null || cachePer1MRaw === ''
      ? undefined
      : ensureNonNegative(cachePer1MRaw, 'cachePer1M');

  const tiersRaw = value.tiers;
  if (!Array.isArray(tiersRaw) || tiersRaw.length < 1) {
    throw new Error('Invalid tiers: expected non-empty array');
  }

  const tiers: ModelPricingTierV1[] = tiersRaw.map((tierRaw, idx) => {
    if (!isRecord(tierRaw)) {
      throw new Error(`Invalid tier[${idx}]: expected object`);
    }

    const maxPromptTokens =
      tierRaw.maxPromptTokens === null
        ? null
        : ensureNonNegative(tierRaw.maxPromptTokens, `tiers[${idx}].maxPromptTokens`);

    return {
      maxPromptTokens,
      promptPer1M: ensureNonNegative(tierRaw.promptPer1M, `tiers[${idx}].promptPer1M`),
      completionPer1M: ensureNonNegative(tierRaw.completionPer1M, `tiers[${idx}].completionPer1M`),
      ...(typeof tierRaw.label === 'string' && tierRaw.label.trim()
        ? { label: tierRaw.label.trim() }
        : {}),
    };
  });

  const infinityCount = tiers.filter((tier) => tier.maxPromptTokens === null).length;
  if (infinityCount !== 1) {
    throw new Error('Invalid tiers: must have exactly one Infinity tier (maxPromptTokens = null)');
  }

  return {
    currencySymbol,
    ...(cachePer1M !== undefined ? { cachePer1M } : {}),
    tiers,
  };
}

export function parseModelPricingExportV1(value: unknown): ModelPricingExportV1 {
  if (!isRecord(value)) {
    throw new Error('Invalid model pricing export: expected object');
  }

  if (value.version !== 1) {
    throw new Error('Invalid model pricing export: unsupported version');
  }

  if (typeof value.exportedAt !== 'string' || !value.exportedAt.trim()) {
    throw new Error('Invalid model pricing export: exportedAt must be a non-empty string');
  }

  const modelsRaw = value.models;
  if (!isRecord(modelsRaw)) {
    throw new Error('Invalid model pricing export: models must be an object');
  }

  const models: Record<string, ModelPricingV1> = {};
  Object.entries(modelsRaw).forEach(([modelName, pricingRaw]) => {
    const name = String(modelName ?? '').trim();
    if (!name) {
      throw new Error('Invalid model pricing export: model name cannot be empty');
    }
    models[name] = parseModelPricingV1(pricingRaw);
  });

  return {
    version: 1,
    exportedAt: value.exportedAt,
    models,
  };
}

