import type { CurrencySymbol } from './types';

const SELECTED_CURRENCY_STORAGE_KEY = 'cli-proxy-model-pricing-selected-currency-v1';

export const loadSelectedCurrency = (): CurrencySymbol => {
  try {
    if (typeof localStorage === 'undefined') return '';
    const raw = localStorage.getItem(SELECTED_CURRENCY_STORAGE_KEY);
    return raw ? raw.trim() : '';
  } catch {
    return '';
  }
};

export const saveSelectedCurrency = (symbol: CurrencySymbol): void => {
  try {
    if (typeof localStorage === 'undefined') return;
    const safe = String(symbol ?? '').trim();
    if (!safe) {
      localStorage.removeItem(SELECTED_CURRENCY_STORAGE_KEY);
      return;
    }
    localStorage.setItem(SELECTED_CURRENCY_STORAGE_KEY, safe);
  } catch {
    // ignore
  }
};

export const resolveSelectedCurrency = (currenciesInUse: CurrencySymbol[], preferred: CurrencySymbol): CurrencySymbol => {
  const safePreferred = String(preferred ?? '').trim();
  if (safePreferred && currenciesInUse.includes(safePreferred)) return safePreferred;
  return currenciesInUse[0] ?? '';
};

