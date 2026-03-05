import type { CurrencySymbol } from './types';

const DEFAULT_CURRENCY_STORAGE_KEY = 'cli-proxy-model-pricing-default-currency-v1';
const FALLBACK_SYMBOL: CurrencySymbol = '$';
const SUPPORTED_SYMBOLS: ReadonlySet<CurrencySymbol> = new Set<CurrencySymbol>(['$', '￥']);

const normalizeSymbol = (value: unknown): CurrencySymbol => {
  const raw = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const trimmed = raw.trim();
  if (!trimmed) return FALLBACK_SYMBOL;
  if (!SUPPORTED_SYMBOLS.has(trimmed)) return FALLBACK_SYMBOL;
  return trimmed;
};

export const loadDefaultCurrencySymbol = (): CurrencySymbol => {
  try {
    if (typeof localStorage === 'undefined') return FALLBACK_SYMBOL;
    const stored = localStorage.getItem(DEFAULT_CURRENCY_STORAGE_KEY);
    return normalizeSymbol(stored);
  } catch {
    return FALLBACK_SYMBOL;
  }
};

export const saveDefaultCurrencySymbol = (symbol: CurrencySymbol): void => {
  try {
    if (typeof localStorage === 'undefined') return;
    const normalized = normalizeSymbol(symbol);
    localStorage.setItem(DEFAULT_CURRENCY_STORAGE_KEY, normalized);
  } catch {
    // ignore
  }
};

export const getSupportedDefaultCurrencies = (): CurrencySymbol[] => Array.from(SUPPORTED_SYMBOLS);

