import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNotificationStore, useThemeStore, useUsageStatsStore, USAGE_STATS_STALE_TIME_MS } from '@/stores';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { downloadBlob } from '@/utils/download';
import {
  collectUsageDetailsWithEndpoint,
  filterUsageByTimeRange,
  type UsageDetailWithEndpoint,
  type UsageTimeRange,
} from '@/utils/usage';
import { useBillingStore } from './store/useBillingStore';
import { DefaultRuleCard } from './DefaultRuleCard';
import { CostTrendCard } from './CostTrendCard';
import { CostBreakdownCard } from './CostBreakdownCard';
import { TopEndpointsCard } from './TopEndpointsCard';
import { TierDistributionCard } from './TierDistributionCard';
import { CacheImpactCard } from './CacheImpactCard';
import { BillingFiltersBar } from './BillingFiltersBar';
import { BillingKpiCards } from './BillingKpiCards';
import { EndpointListCard } from './EndpointListCard';
import {
  buildBillingAnalytics,
  matchesBillingEndpointFilters,
  resolveBillingEndpointStatus,
  type BillingDashboardFilters,
  type BillingStatusFilter,
  type EndpointAggregate,
} from './utils/dashboard';
import { normalizeEndpointKey } from './utils/normalizeEndpoint';
import styles from './BillingPage.module.scss';

const TIME_RANGE_STORAGE_KEY = 'cli-proxy-billing-time-range-v1';
const DEFAULT_TIME_RANGE: UsageTimeRange = '24h';
const TIME_RANGE_LABEL_KEY: Record<UsageTimeRange, string> = {
  '7h': 'usage_stats.range_7h',
  '24h': 'usage_stats.range_24h',
  '7d': 'usage_stats.range_7d',
  all: 'usage_stats.range_all',
};

const isUsageTimeRange = (value: unknown): value is UsageTimeRange =>
  value === '7h' || value === '24h' || value === '7d' || value === 'all';

const loadTimeRange = (): UsageTimeRange => {
  try {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_TIME_RANGE;
    }
    const raw = localStorage.getItem(TIME_RANGE_STORAGE_KEY);
    return isUsageTimeRange(raw) ? raw : DEFAULT_TIME_RANGE;
  } catch {
    return DEFAULT_TIME_RANGE;
  }
};

export function BillingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const showNotification = useNotificationStore((state) => state.showNotification);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  const usage = useUsageStatsStore((state) => state.usage);
  const loading = useUsageStatsStore((state) => state.loading);
  const error = useUsageStatsStore((state) => state.error);
  const loadUsageStats = useUsageStatsStore((state) => state.loadUsageStats);
  const lastRefreshedAtTs = useUsageStatsStore((state) => state.lastRefreshedAt);
  const lastRefreshedAt = useMemo(
    () => (lastRefreshedAtTs ? new Date(lastRefreshedAtTs) : null),
    [lastRefreshedAtTs]
  );

  const defaultRule = useBillingStore((state) => state.defaultRule);
  const setDefaultRule = useBillingStore((state) => state.setDefaultRule);
  const endpointRules = useBillingStore((state) => state.endpointRules);
  const exportJson = useBillingStore((state) => state.exportJson);
  const importJsonMergeOverwrite = useBillingStore((state) => state.importJsonMergeOverwrite);

  const [timeRange, setTimeRange] = useState<UsageTimeRange>(loadTimeRange);
  const [endpointQuery, setEndpointQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillingStatusFilter>('all');
  const [includeUnused, setIncludeUnused] = useState(true);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(TIME_RANGE_STORAGE_KEY, timeRange);
    } catch {
      // ignore
    }
  }, [timeRange]);

  const loadUsage = useCallback(async () => {
    await loadUsageStats({ force: true, staleTimeMs: USAGE_STATS_STALE_TIME_MS });
  }, [loadUsageStats]);

  useEffect(() => {
    void loadUsageStats({ staleTimeMs: USAGE_STATS_STALE_TIME_MS }).catch(() => {});
  }, [loadUsageStats]);

  useHeaderRefresh(loadUsage);

  const handleExport = useCallback(() => {
    setExporting(true);
    try {
      const payload = exportJson();
      const safeTimestamp = new Date().toISOString();
      const filename = `billing-rules-${safeTimestamp.replace(/[:.]/g, '-')}.json`;
      downloadBlob({
        filename,
        blob: new Blob([JSON.stringify(payload ?? {}, null, 2)], { type: 'application/json' }),
      });
      showNotification(t('billing.export_success'), 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(`${t('billing.export_failed')}${message ? `: ${message}` : ''}`, 'error');
    } finally {
      setExporting(false);
    }
  }, [exportJson, showNotification, t]);

  const handleImport = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      setImporting(true);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const result = importJsonMergeOverwrite(parsed);
        showNotification(t('billing.import_success', { endpoints: result.importedEndpoints }), 'success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '';
        showNotification(`${t('billing.import_failed')}${message ? `: ${message}` : ''}`, 'error');
      } finally {
        setImporting(false);
      }
    },
    [importJsonMergeOverwrite, showNotification, t]
  );

  const filteredUsage = useMemo(
    () => (usage ? filterUsageByTimeRange(usage, timeRange) : null),
    [usage, timeRange]
  );

  const details = useMemo((): UsageDetailWithEndpoint[] => {
    if (!filteredUsage) return [];
    return collectUsageDetailsWithEndpoint(filteredUsage);
  }, [filteredUsage]);

  const billingConfig = useMemo(
    () => ({ defaultRule, endpointRules }),
    [defaultRule, endpointRules]
  );

  const hourWindowHours =
    timeRange === '7h' ? 7 : timeRange === '24h' ? 24 : timeRange === '7d' ? 7 * 24 : undefined;

  const filters = useMemo(
    (): BillingDashboardFilters => ({
      endpointQuery,
      statusFilter,
    }),
    [endpointQuery, statusFilter]
  );

  const analytics = useMemo(
    () =>
      buildBillingAnalytics(details, billingConfig, {
        filters,
        hourWindowHours,
        now: lastRefreshedAt ?? undefined,
      }),
    [billingConfig, details, filters, hourWindowHours, lastRefreshedAt]
  );

  const timeRangeLabel = useMemo(() => t(TIME_RANGE_LABEL_KEY[timeRange]), [t, timeRange]);

  const endpointRows = useMemo((): EndpointAggregate[] => {
    const rowsByKey = new Map<string, EndpointAggregate>();
    analytics.endpoints.forEach((endpoint) => {
      rowsByKey.set(endpoint.endpointKey, endpoint);
    });

    if (includeUnused) {
      const emptyCosts: EndpointAggregate['costs'] = {
        inputCost: 0,
        outputCost: 0,
        cacheReadCost: 0,
        cacheStorageCost: 0,
        totalCost: 0,
      };
      const emptyCacheImpact: EndpointAggregate['cacheImpact'] = {
        inputTokens: 0,
        cachedTokens: 0,
        cacheHitRatio: 0,
        cacheReadCost: 0,
        cacheStorageCost: 0,
        baselineInputCostNoCache: 0,
        actualCacheRelatedCost: 0,
        netSavings: 0,
      };

      Object.keys(endpointRules).forEach((endpointKey) => {
        const normalized = normalizeEndpointKey(endpointKey);
        if (!normalized || rowsByKey.has(normalized)) return;
        const status = resolveBillingEndpointStatus(normalized, billingConfig);
        if (!matchesBillingEndpointFilters(normalized, status, filters)) return;
        rowsByKey.set(normalized, {
          endpointKey: normalized,
          status,
          requests: 0,
          successCount: 0,
          failureCount: 0,
          knownCostRequests: 0,
          missingCostRequests: 0,
          promptTokens: 0,
          cachedTokens: 0,
          outputBillableTokens: 0,
          costs: emptyCosts,
          costKnown: false,
          cacheHitRatio: 0,
          cacheImpact: emptyCacheImpact,
          tierHits: [],
          lastSeenMs: 0,
        });
      });
    }

    const rows = Array.from(rowsByKey.values());
    rows.sort((a, b) => {
      if (a.costKnown && b.costKnown) return b.costs.totalCost - a.costs.totalCost;
      if (a.costKnown && !b.costKnown) return -1;
      if (!a.costKnown && b.costKnown) return 1;
      return b.requests - a.requests;
    });
    return rows;
  }, [analytics.endpoints, billingConfig, endpointRules, filters, includeUnused]);

  return (
    <div className={styles.container}>
      {loading && !usage && (
        <div className={styles.loadingOverlay} aria-busy="true">
          <div className={styles.loadingOverlayContent}>
            <LoadingSpinner size={28} className={styles.loadingOverlaySpinner} />
            <span className={styles.loadingOverlayText}>{t('common.loading')}</span>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.pageTitle}>{t('billing.title')}</h1>
          <p className={styles.pageSubtitle}>{t('billing.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" size="sm" onClick={() => navigate('/billing/models')} disabled={loading}>
            {t('billing.model_prices')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            loading={exporting}
            disabled={loading || importing}
          >
            {t('billing.export')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleImport}
            loading={importing}
            disabled={loading || exporting}
          >
            {t('billing.import')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadUsage().catch(() => {})}
            disabled={loading || exporting || importing}
          >
            {loading ? t('common.loading') : t('common.refresh')}
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImportChange}
          />
          {lastRefreshedAt && (
            <span className={styles.lastRefreshed}>
              {t('usage_stats.last_updated')}: {lastRefreshedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && <div className={styles.errorBox}>{String(error)}</div>}

      <BillingFiltersBar
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        endpointQuery={endpointQuery}
        onEndpointQueryChange={setEndpointQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        includeUnused={includeUnused}
        onIncludeUnusedChange={setIncludeUnused}
        disabled={loading && !usage}
      />

      <BillingKpiCards
        loading={loading && !usage}
        timeRangeLabel={timeRangeLabel}
        analytics={analytics}
        onShowMissing={() => setStatusFilter('missing')}
      />

      <div className={styles.dashboardChartsGrid}>
        <CostTrendCard
          loading={loading && !usage}
          analytics={analytics}
          isDark={isDark}
          isMobile={isMobile}
          timeRangeLabel={timeRangeLabel}
        />
        <CostBreakdownCard
          loading={loading && !usage}
          analytics={analytics}
          isDark={isDark}
          timeRangeLabel={timeRangeLabel}
        />
        <TopEndpointsCard
          loading={loading && !usage}
          analytics={analytics}
          isDark={isDark}
          timeRangeLabel={timeRangeLabel}
        />
        <TierDistributionCard
          loading={loading && !usage}
          analytics={analytics}
          isDark={isDark}
          timeRangeLabel={timeRangeLabel}
        />
      </div>

      <div className={styles.statsGrid}>
        <CacheImpactCard loading={loading && !usage} analytics={analytics} timeRangeLabel={timeRangeLabel} />
        <DefaultRuleCard
          rule={defaultRule}
          onRuleChange={setDefaultRule}
          onEdit={() => navigate(`/billing/endpoint?key=${encodeURIComponent('__default__')}`)}
        />
      </div>

      <EndpointListCard
        loading={loading && !usage}
        rows={endpointRows}
        onEditEndpoint={(endpoint) => navigate(`/billing/endpoint?key=${encodeURIComponent(endpoint)}`)}
      />
    </div>
  );
}
