import type { ModelPricingV1 } from './types';
import { parseModelPricingV1 } from './schema';

export const MODEL_PRICING_STORAGE_KEY = 'cli-proxy-model-pricing-v1';
export const LEGACY_MODEL_PRICE_STORAGE_KEY = 'cli-proxy-model-prices-v2';
export const EARLY_MODEL_PRICE_STORAGE_KEY = 'model-prices';
export const MODEL_PRICING_STORAGE_KEYS = [
  MODEL_PRICING_STORAGE_KEY,
  LEGACY_MODEL_PRICE_STORAGE_KEY,
  EARLY_MODEL_PRICE_STORAGE_KEY,
] as const;

type LegacyModelPrice = { prompt: number; completion: number; cache: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toNonNegative = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(num, 0);
};

const parseLegacyModelPrices = (value: unknown): Record<string, LegacyModelPrice> => {
  if (!isRecord(value)) return {};
  const normalized: Record<string, LegacyModelPrice> = {};

  Object.entries(value).forEach(([model, price]) => {
    const name = String(model ?? '').trim();
    if (!name) return;
    const record = isRecord(price) ? price : null;
    const promptRaw = record ? Number(record.prompt) : Number.NaN;
    const completionRaw = record ? Number(record.completion) : Number.NaN;
    const cacheRaw = record ? Number(record.cache) : Number.NaN;

    if (!Number.isFinite(promptRaw) && !Number.isFinite(completionRaw) && !Number.isFinite(cacheRaw)) {
      return;
    }

    const prompt = Number.isFinite(promptRaw) ? toNonNegative(promptRaw) : 0;
    const completion = Number.isFinite(completionRaw) ? toNonNegative(completionRaw) : 0;
    const cache = Number.isFinite(cacheRaw)
      ? toNonNegative(cacheRaw)
      : Number.isFinite(promptRaw)
        ? toNonNegative(promptRaw)
        : prompt;

    normalized[name] = { prompt, completion, cache };
  });

  return normalized;
};

export function migrateLegacyModelPricesToPricingMap(legacy: Record<string, LegacyModelPrice>): Record<string, ModelPricingV1> {
  const result: Record<string, ModelPricingV1> = {};
  Object.entries(legacy).forEach(([modelName, price]) => {
    const prompt = toNonNegative(price.prompt);
    const completion = toNonNegative(price.completion);
    const cache = toNonNegative(price.cache);
    const cachePer1M = cache !== prompt ? cache : undefined;

    result[modelName] = {
      currencySymbol: '$',
      ...(cachePer1M !== undefined ? { cachePer1M } : {}),
      tiers: [
        {
          maxPromptTokens: null,
          promptPer1M: prompt,
          completionPer1M: completion,
        },
      ],
    };
  });
  return result;
}

const readJson = (key: string): unknown => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readPricingMap = (key: string): Record<string, ModelPricingV1> => {
  const parsed = readJson(key);
  if (!isRecord(parsed)) return {};

  const normalized: Record<string, ModelPricingV1> = {};
  Object.entries(parsed).forEach(([modelName, pricingRaw]) => {
    const name = String(modelName ?? '').trim();
    if (!name) return;
    try {
      normalized[name] = parseModelPricingV1(pricingRaw);
    } catch {
      // ignore invalid model pricing entries
    }
  });

  return normalized;
};

const safeWriteJson = (key: string, value: unknown): void => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

export function saveModelPricingMap(map: Record<string, ModelPricingV1>): void {
  safeWriteJson(MODEL_PRICING_STORAGE_KEY, map);
}

export function loadModelPricingMap(): Record<string, ModelPricingV1> {
  try {
    const current = readPricingMap(MODEL_PRICING_STORAGE_KEY);
    if (Object.keys(current).length > 0) {
      return current;
    }

    for (const key of [LEGACY_MODEL_PRICE_STORAGE_KEY, EARLY_MODEL_PRICE_STORAGE_KEY]) {
      const legacyParsed = readJson(key);
      const legacy = parseLegacyModelPrices(legacyParsed);
      if (Object.keys(legacy).length <= 0) {
        continue;
      }

      const migrated = migrateLegacyModelPricesToPricingMap(legacy);
      saveModelPricingMap(migrated);
      return migrated;
    }

    return {};
  } catch {
    return {};
  }
}
