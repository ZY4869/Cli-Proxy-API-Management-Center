import { beforeEach, describe, expect, it } from 'vitest';
import { loadModelPricingMap } from './storage';

type LocalStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const createMemoryLocalStorage = (): LocalStorageLike & { _dump: () => Record<string, string> } => {
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
    _dump: () => Object.fromEntries(store.entries()),
  };
};

describe('model pricing storage', () => {
  const memory = createMemoryLocalStorage();

  beforeEach(() => {
    memory.clear();
    (globalThis as any).localStorage = memory;
  });

  it('migrates legacy model prices into model pricing map', () => {
    const legacyKey = 'cli-proxy-model-prices-v2';
    memory.setItem(
      legacyKey,
      JSON.stringify({
        'gpt-a': { prompt: 2, completion: 4, cache: 2 },
      })
    );

    const loaded = loadModelPricingMap();
    expect(loaded['gpt-a']?.currencySymbol).toBe('$');
    expect(loaded['gpt-a']?.tiers?.length).toBe(1);
    expect(loaded['gpt-a']?.tiers?.[0]?.maxPromptTokens).toBeNull();
    expect(loaded['gpt-a']?.cachePer1M).toBeUndefined();
  });

  it('loads existing model pricing without requiring legacy', () => {
    const key = 'cli-proxy-model-pricing-v1';
    memory.setItem(
      key,
      JSON.stringify({
        'gpt-b': {
          currencySymbol: '￥',
          cachePer1M: 1,
          tiers: [{ maxPromptTokens: null, promptPer1M: 10, completionPer1M: 0 }],
        },
      })
    );

    const loaded = loadModelPricingMap();
    expect(loaded['gpt-b']?.currencySymbol).toBe('￥');
    expect(loaded['gpt-b']?.cachePer1M).toBe(1);
    expect(loaded['gpt-b']?.tiers?.[0]?.promptPer1M).toBe(10);
  });
});

