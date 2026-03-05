import type { CurrencySymbol } from './types';

const formatNumber2 = (value: number): string => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  const fixed = Math.abs(num).toFixed(2);
  return Number(fixed).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function formatMoney(currencySymbol: CurrencySymbol, value: number): string {
  const num = Number(value);
  const symbol = String(currencySymbol ?? '').trim() || '$';
  if (!Number.isFinite(num)) return `${symbol}0.00`;
  const sign = num < 0 ? '-' : '';
  return `${sign}${symbol}${formatNumber2(num)}`;
}

