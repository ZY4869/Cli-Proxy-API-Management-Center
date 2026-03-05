import { beforeEach, describe, expect, it } from 'vitest';
import {
  EARLY_MODEL_PRICE_STORAGE_KEY,
  LEGACY_MODEL_PRICE_STORAGE_KEY,
  MODEL_PRICING_STORAGE_KEY,
  loadModelPricingMap,
  saveModelPricingMap,
} from './storage';

type LocalStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const createMemoryLocalStorage = (): LocalStorageLike & { dump: () => Record<string, string> } => {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    dump: () => Object.fromEntries(store.entries()),
  };
};

describe('model pricing storage', () => {
  const memory = createMemoryLocalStorage();

  beforeEach(() => {
    memory.clear();
    (globalThis as { localStorage?: LocalStorageLike }).localStorage = memory;
  });

  it('loads existing current-format pricing directly', () => {
    memory.setItem(
      MODEL_PRICING_STORAGE_KEY,
      JSON.stringify({
        'gpt-b': {
          currencySymbol: '$',
          cachePer1M: 1,
          tiers: [{ maxPromptTokens: null, promptPer1M: 10, completionPer1M: 3 }],
        },
      })
    );

    const loaded = loadModelPricingMap();
    expect(loaded['gpt-b']?.currencySymbol).toBe('$');
    expect(loaded['gpt-b']?.cachePer1M).toBe(1);
    expect(loaded['gpt-b']?.tiers?.[0]?.promptPer1M).toBe(10);
  });

  it('migrates legacy v2 pricing into current storage', () => {
    memory.setItem(
      LEGACY_MODEL_PRICE_STORAGE_KEY,
      JSON.stringify({
        'gpt-a': { prompt: 2, completion: 4, cache: 2 },
      })
    );

    const loaded = loadModelPricingMap();
    expect(loaded['gpt-a']?.currencySymbol).toBe('$');
    expect(loaded['gpt-a']?.tiers?.[0]?.maxPromptTokens).toBeNull();
    expect(memory.dump()[MODEL_PRICING_STORAGE_KEY]).toBeTruthy();
  });

  it('migrates very old backup pricing key into current storage', () => {
    memory.setItem(
      EARLY_MODEL_PRICE_STORAGE_KEY,
      JSON.stringify({
        'gpt-c': { prompt: 1, completion: 2, cache: 0.5 },
      })
    );

    const loaded = loadModelPricingMap();
    expect(loaded['gpt-c']?.tiers?.[0]?.promptPer1M).toBe(1);
    expect(loaded['gpt-c']?.tiers?.[0]?.completionPer1M).toBe(2);
    expect(loaded['gpt-c']?.cachePer1M).toBe(0.5);
    expect(memory.dump()[MODEL_PRICING_STORAGE_KEY]).toBeTruthy();
  });

  it('saves current-format pricing to the stable key', () => {
    saveModelPricingMap({
      'gpt-d': {
        currencySymbol: '$',
        tiers: [{ maxPromptTokens: null, promptPer1M: 8, completionPer1M: 16 }],
      },
    });

    const stored = memory.dump();
    expect(JSON.parse(stored[MODEL_PRICING_STORAGE_KEY] ?? '{}')).toMatchObject({
      'gpt-d': {
        currencySymbol: '$',
      },
    });
  });
});
