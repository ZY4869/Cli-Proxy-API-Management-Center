import { formatDayLabel, formatHourLabel } from '@/utils/usage';
import type { CurrencySymbol } from './types';
import type { TrendSeries } from './analyticsTypes';

export type TrendAccumulator = {
  hourLabels: string[];
  addKnownCost: (symbol: CurrencySymbol, timestampMs: number, totalCost: number) => void;
  addMissing: (timestampMs: number) => void;
  finalize: (currencies: CurrencySymbol[]) => Record<CurrencySymbol, { hour: TrendSeries; day: TrendSeries }>;
};

type TrendAccumulatorOptions = {
  hourWindowHours?: number;
  now?: Date;
};

export function createTrendAccumulator(options: TrendAccumulatorOptions = {}): TrendAccumulator {
  const hourWindow = (() => {
    const raw = options.hourWindowHours ?? 24;
    if (!Number.isFinite(raw) || raw <= 0) return 24;
    return Math.min(Math.max(Math.floor(raw), 1), 24 * 31);
  })();

  const now = options.now instanceof Date ? options.now : new Date();
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);
  const hourMs = 60 * 60 * 1000;
  const earliestBucket = new Date(currentHour);
  earliestBucket.setHours(earliestBucket.getHours() - (hourWindow - 1));
  const earliestTime = earliestBucket.getTime();
  const lastBucketTime = earliestTime + (hourWindow - 1) * hourMs;

  const hourLabels: string[] = [];
  for (let i = 0; i < hourWindow; i++) {
    hourLabels.push(formatHourLabel(new Date(earliestTime + i * hourMs)));
  }

  const hourDataByCurrency = new Map<CurrencySymbol, number[]>();
  const dayCostByCurrency = new Map<CurrencySymbol, Record<string, number>>();
  const hasDataByCurrency = new Set<CurrencySymbol>();

  let hourMissingCount = 0;
  let dayMissingCount = 0;

  const ensureHourData = (symbol: CurrencySymbol) => {
    const existing = hourDataByCurrency.get(symbol);
    if (existing) return existing;
    const next = new Array(hourLabels.length).fill(0);
    hourDataByCurrency.set(symbol, next);
    return next;
  };

  const ensureDayMap = (symbol: CurrencySymbol) => {
    const existing = dayCostByCurrency.get(symbol);
    if (existing) return existing;
    const next: Record<string, number> = {};
    dayCostByCurrency.set(symbol, next);
    return next;
  };

  const addKnownCost = (symbol: CurrencySymbol, timestampMs: number, totalCost: number) => {
    if (!symbol) return;
    if (!Number.isFinite(timestampMs) || timestampMs <= 0) return;

    const normalized = new Date(timestampMs);
    normalized.setMinutes(0, 0, 0);
    const bucketStart = normalized.getTime();
    if (bucketStart >= earliestTime && bucketStart <= lastBucketTime) {
      const bucketIndex = Math.floor((bucketStart - earliestTime) / hourMs);
      const data = ensureHourData(symbol);
      if (bucketIndex >= 0 && bucketIndex < data.length) {
        hasDataByCurrency.add(symbol);
        data[bucketIndex] += totalCost;
      }
    }

    const dayLabel = formatDayLabel(new Date(timestampMs));
    if (dayLabel) {
      hasDataByCurrency.add(symbol);
      const dayMap = ensureDayMap(symbol);
      dayMap[dayLabel] = (dayMap[dayLabel] || 0) + totalCost;
    }
  };

  const addMissing = (timestampMs: number) => {
    if (!Number.isFinite(timestampMs) || timestampMs <= 0) return;
    if (timestampMs >= earliestTime && timestampMs <= lastBucketTime) hourMissingCount += 1;
    dayMissingCount += 1;
  };

  const finalize = (currencies: CurrencySymbol[]) => {
    const trendByCurrency: Record<CurrencySymbol, { hour: TrendSeries; day: TrendSeries }> = {};

    currencies.forEach((symbol) => {
      const hourData = hourDataByCurrency.get(symbol) ?? new Array(hourLabels.length).fill(0);
      const dayMap = dayCostByCurrency.get(symbol) ?? {};
      const dayLabels = Object.keys(dayMap).sort();

      trendByCurrency[symbol] = {
        hour: {
          labels: hourLabels,
          data: hourData,
          hasData: hasDataByCurrency.has(symbol),
          missingRequestCount: hourMissingCount,
        },
        day: {
          labels: dayLabels,
          data: dayLabels.map((l) => dayMap[l] ?? 0),
          hasData: hasDataByCurrency.has(symbol),
          missingRequestCount: dayMissingCount,
        },
      };
    });

    return trendByCurrency;
  };

  return { hourLabels, addKnownCost, addMissing, finalize };
}

