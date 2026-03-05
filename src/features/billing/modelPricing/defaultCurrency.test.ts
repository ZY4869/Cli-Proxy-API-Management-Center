import { beforeEach, describe, expect, it } from 'vitest';
import { getSupportedDefaultCurrencies, loadDefaultCurrencySymbol, saveDefaultCurrencySymbol } from './defaultCurrency';

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

describe('default currency symbol', () => {
  const memory = createMemoryLocalStorage();

  beforeEach(() => {
    memory.clear();
    (globalThis as any).localStorage = memory;
  });

  it('falls back to $ when empty', () => {
    expect(loadDefaultCurrencySymbol()).toBe('$');
  });

  it('loads supported symbol from localStorage', () => {
    memory.setItem('cli-proxy-model-pricing-default-currency-v1', '￥');
    expect(loadDefaultCurrencySymbol()).toBe('￥');
  });

  it('rejects unsupported symbol', () => {
    memory.setItem('cli-proxy-model-pricing-default-currency-v1', '€');
    expect(loadDefaultCurrencySymbol()).toBe('$');
  });

  it('normalizes writes to supported symbols', () => {
    saveDefaultCurrencySymbol('￥');
    expect(loadDefaultCurrencySymbol()).toBe('￥');

    saveDefaultCurrencySymbol('€');
    expect(loadDefaultCurrencySymbol()).toBe('$');
  });

  it('exposes supported symbol list', () => {
    expect(getSupportedDefaultCurrencies()).toEqual(expect.arrayContaining(['$', '￥']));
  });
});

