import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNotificationStore, useThemeStore, useUsageStatsStore, USAGE_STATS_STALE_TIME_MS } from '@/stores';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { downloadBlob } from '@/utils/download';
import { collectUsageDetailsWithEndpoint, filterUsageByTimeRange, type UsageDetailWithEndpoint, type UsageTimeRange } from '@/utils/usage';
import { buildModelPricingAnalytics } from './modelPricing/analytics';
import { useModelPricingStore } from './modelPricing/useModelPricingStore';
import type { CurrencySymbol } from './modelPricing/types';
import { formatMoney } from './modelPricing/money';
import { loadSelectedCurrency, resolveSelectedCurrency, saveSelectedCurrency } from './modelPricing/selectedCurrency';
import { ModelBillingKpiCards } from './ModelBillingKpiCards';
import { ModelCostTrendCard } from './ModelCostTrendCard';
import { TopBarChartCard } from './TopBarChartCard';
import { ModelBillingFiltersBar } from './ModelBillingFiltersBar';
import { ModelListCard } from './ModelListCard';
import { TopEndpointsCard } from './TopEndpointsCard';
import { BillingDetailsCard } from './BillingDetailsCard';
import { useModelPriceModels } from './modelPrices/useModelPriceModels';
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
  const pricingByModel = useModelPricingStore((s) => s.pricingByModel);
  const exportPricing = useModelPricingStore((s) => s.exportJson);
  const exportPricingTemplate = useModelPricingStore((s) => s.exportTemplateJson);
  const importPricing = useModelPricingStore((s) => s.importJsonMergeOverwrite);
  const { models: availableModels } = useModelPriceModels();

  const [timeRange, setTimeRange] = useState<UsageTimeRange>(loadTimeRange);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingTemplate, setExportingTemplate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencySymbol>(() => loadSelectedCurrency());

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
      const payload = exportPricing();
      const safeTimestamp = new Date().toISOString();
      const filename = `model-pricing-${safeTimestamp.replace(/[:.]/g, '-')}.json`;
      downloadBlob({
        filename,
        blob: new Blob([JSON.stringify(payload ?? {}, null, 2)], { type: 'application/json' }),
      });
      showNotification(t('billing.model_pricing_export_success'), 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(`${t('billing.model_pricing_export_failed')}${message ? `: ${message}` : ''}`, 'error');
    } finally {
      setExporting(false);
    }
  }, [exportPricing, showNotification, t]);

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
        const result = importPricing(parsed);
        const suffix =
          result.skippedModels > 0
            ? ` · ${t('billing.model_pricing_import_skipped', {
                count: result.skippedModels,
                defaultValue: `跳过 ${result.skippedModels} 个未填写/无效`,
              })}`
            : '';
        showNotification(
          `${t('billing.model_pricing_import_success', { models: result.importedModels })}${suffix}`,
          'success'
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '';
        showNotification(`${t('billing.model_pricing_import_failed')}${message ? `: ${message}` : ''}`, 'error');
      } finally {
        setImporting(false);
      }
    },
    [importPricing, showNotification, t]
  );

  const filteredUsage = useMemo(
    () => (usage ? filterUsageByTimeRange(usage, timeRange) : null),
    [usage, timeRange]
  );

  const details = useMemo((): UsageDetailWithEndpoint[] => {
    if (!filteredUsage) return [];
    return collectUsageDetailsWithEndpoint(filteredUsage);
  }, [filteredUsage]);

  const hourWindowHours =
    timeRange === '7h' ? 7 : timeRange === '24h' ? 24 : timeRange === '7d' ? 7 * 24 : undefined;
  const analytics = useMemo(
    () => buildModelPricingAnalytics(details, pricingByModel, { hourWindowHours, now: lastRefreshedAt ?? undefined }),
    [details, hourWindowHours, lastRefreshedAt, pricingByModel]
  );

  const templateModelNames = useMemo(() => {
    const set = new Set<string>();
    availableModels.forEach((model) => {
      const name = String(model.name ?? '').trim();
      if (name) set.add(name);
    });
    Object.keys(pricingByModel).forEach((name) => set.add(name));
    analytics.models.forEach((model) => set.add(model.modelName));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [analytics.models, availableModels, pricingByModel]);

  const handleExportTemplate = useCallback(() => {
    setExportingTemplate(true);
    try {
      const payload = exportPricingTemplate(templateModelNames);
      const safeTimestamp = new Date().toISOString();
      const filename = `model-pricing-template-${safeTimestamp.replace(/[:.]/g, '-')}.json`;
      downloadBlob({
        filename,
        blob: new Blob([JSON.stringify(payload ?? {}, null, 2)], { type: 'application/json' }),
      });
      showNotification(
        t('billing.model_pricing_export_template_success', {
          models: templateModelNames.length,
          defaultValue: `已导出 ${templateModelNames.length} 个模型模板`,
        }),
        'success'
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(`${t('billing.model_pricing_export_failed')}${message ? `: ${message}` : ''}`, 'error');
    } finally {
      setExportingTemplate(false);
    }
  }, [exportPricingTemplate, showNotification, t, templateModelNames]);

  const timeRangeLabel = useMemo(() => t(TIME_RANGE_LABEL_KEY[timeRange]), [t, timeRange]);
  const resolvedSelectedCurrency = useMemo(
    () => resolveSelectedCurrency(analytics.currenciesInUse, selectedCurrency),
    [analytics.currenciesInUse, selectedCurrency]
  );

  useEffect(() => {
    if (resolvedSelectedCurrency !== selectedCurrency) {
      setSelectedCurrency(resolvedSelectedCurrency);
    }
    saveSelectedCurrency(resolvedSelectedCurrency);
  }, [resolvedSelectedCurrency, selectedCurrency]);

  const modelTopItems = useMemo(
    () =>
      analytics.models.map((m) => ({
        label: m.modelName,
        cost: Number(m.costs?.[resolvedSelectedCurrency]?.totalCost) || 0,
        requests: m.requests,
        tokens: m.inputTokens + m.outputBillableTokens,
      })),
    [analytics.models, resolvedSelectedCurrency]
  );

  const endpointTopItems = useMemo(
    () =>
      analytics.endpoints.map((e) => ({
        label: e.endpointKey,
        cost: Number(e.costs?.[resolvedSelectedCurrency]?.totalCost) || 0,
        requests: e.requests,
        tokens: e.inputTokens + e.outputBillableTokens,
      })),
    [analytics.endpoints, resolvedSelectedCurrency]
  );

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
          <p className={styles.pageSubtitle}>{t('billing.model_pricing_subtitle')}</p>
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
            {t('billing.model_pricing_export')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportTemplate}
            loading={exportingTemplate}
            disabled={loading || importing || exporting || templateModelNames.length === 0}
          >
            {t('billing.model_pricing_export_template', { defaultValue: '导出全模型模板' })}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleImport}
            loading={importing}
            disabled={loading || exporting}
          >
            {t('billing.model_pricing_import')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadUsage().catch(() => {})}
            disabled={loading || exporting || importing || exportingTemplate}
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

      <ModelBillingFiltersBar
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        currenciesInUse={analytics.currenciesInUse}
        selectedCurrency={resolvedSelectedCurrency}
        onSelectedCurrencyChange={setSelectedCurrency}
        disabled={loading && !usage}
      />

      <ModelBillingKpiCards
        loading={loading && !usage}
        timeRangeLabel={timeRangeLabel}
        analytics={analytics}
        selectedCurrency={resolvedSelectedCurrency}
      />

      <div className={styles.dashboardChartsGrid}>
        <ModelCostTrendCard
          loading={loading && !usage}
          analytics={analytics}
          isDark={isDark}
          isMobile={isMobile}
          timeRangeLabel={timeRangeLabel}
          selectedCurrency={resolvedSelectedCurrency}
        />
        <TopBarChartCard
          loading={loading && !usage}
          items={modelTopItems}
          isDark={isDark}
          title={t('billing.top_models_title')}
          subtitle={`${timeRangeLabel} | ${resolvedSelectedCurrency || t('billing.select_currency')}`}
          costLabel={t('billing.cost')}
          requestsLabel={t('billing.requests')}
          tokensLabel={t('billing.tokens')}
          costFormatter={(v) => formatMoney(resolvedSelectedCurrency, v)}
          emptyText={t('billing.no_cost_data')}
          collapseSectionId="chart-top-models"
        />
      </div>

      <div className={styles.detailsGrid}>
        <ModelListCard
          loading={loading && !usage}
          models={analytics.models}
          selectedCurrency={resolvedSelectedCurrency}
          pricingByModel={pricingByModel}
        />
        <TopEndpointsCard
          loading={loading && !usage}
          endpoints={analytics.endpoints}
          topItems={endpointTopItems}
          selectedCurrency={resolvedSelectedCurrency}
          timeRangeLabel={timeRangeLabel}
          isDark={isDark}
        />
      </div>

      <BillingDetailsCard
        loading={loading && !usage}
        refreshing={loading}
        lastUpdatedAt={lastRefreshedAt}
        onRefresh={() => void loadUsage().catch(() => {})}
        timeRangeLabel={timeRangeLabel}
        details={details}
        pricingByModel={pricingByModel}
        selectedCurrency={resolvedSelectedCurrency}
      />
    </div>
  );
}
