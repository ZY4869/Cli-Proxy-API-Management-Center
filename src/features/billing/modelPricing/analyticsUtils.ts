import type { UsageDetailWithEndpoint } from '@/utils/usage';
import type { CurrencyCostMap, CurrencyCostTotals } from './analyticsTypes';
import type { CurrencySymbol } from './types';

export const EMPTY_CURRENCY_TOTALS: CurrencyCostTotals = {
  promptCost: 0,
  completionCost: 0,
  cacheCost: 0,
  totalCost: 0,
};

export const ensureCurrencyTotals = (map: CurrencyCostMap, symbol: CurrencySymbol): CurrencyCostTotals => {
  if (!map[symbol]) {
    map[symbol] = { ...EMPTY_CURRENCY_TOTALS };
  }
  return map[symbol];
};

export const addCostTotals = (target: CurrencyCostTotals, patch: CurrencyCostTotals) => {
  target.promptCost += patch.promptCost;
  target.completionCost += patch.completionCost;
  target.cacheCost += patch.cacheCost;
  target.totalCost += patch.totalCost;
};

export const safeTimestampMs = (detail: UsageDetailWithEndpoint): number => {
  const raw = typeof detail.__timestampMs === 'number' ? detail.__timestampMs : Date.parse(detail.timestamp);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
};

export const normalizeAuthIndex = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  if (typeof value === 'string') return value.trim();
  return '';
};

export const sumAllCurrencies = (costs: CurrencyCostMap): number =>
  Object.values(costs).reduce((acc, c) => acc + (Number.isFinite(c.totalCost) ? c.totalCost : 0), 0);

