import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCompactNumber } from '@/utils/usage';
import type { UsageDetailWithEndpoint } from '@/utils/usage';
import { computeCostForDetail } from './modelPricing/costing';
import type { ModelPricingV1 } from './modelPricing/types';
import { formatMoney } from './modelPricing/money';
import type { CurrencySymbol } from './modelPricing/types';
import { useBillingCollapse } from './collapse/useBillingCollapse';
import { CollapseToggleButton } from './collapse/CollapseToggleButton';
import monitorStyles from '@/pages/MonitorPage.module.scss';
import billingStyles from './BillingPage.module.scss';
import styles from './BillingDetailsCard.module.scss';

const ROW_HEIGHT = 40;

type StatusFilter = '' | 'success' | 'failed';

type BillingDetailRow = {
  id: string;
  timestamp: string;
  timestampMs: number;
  timestampLabel: string;
  endpointLabel: string;
  endpointKey: string;
  source: string;
  modelName: string;
  failed: boolean;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  currencySymbol: CurrencySymbol;
  missingPricing: boolean;
  promptCost: number;
  completionCost: number;
  cacheCost: number;
  totalCost: number;
};

export type BillingDetailsCardProps = {
  loading: boolean;
  refreshing: boolean;
  lastUpdatedAt: Date | null;
  onRefresh: () => void;
  timeRangeLabel: string;
  details: UsageDetailWithEndpoint[];
  pricingByModel: Record<string, ModelPricingV1>;
  selectedCurrency: CurrencySymbol;
};

const toEndpointLabel = (detail: UsageDetailWithEndpoint): { label: string; key: string } => {
  const method = String(detail.__endpointMethod ?? '').trim();
  const path = String(detail.__endpointPath ?? '').trim();
  const key = String(detail.__endpoint ?? '').trim() || `${method} ${path}`.trim();
  const label = method && path ? `${method} ${path}` : path || key || '-';
  return { label, key: key || label || '-' };
};

export function BillingDetailsCard({
  loading,
  refreshing,
  lastUpdatedAt,
  onRefresh,
  timeRangeLabel,
  details,
  pricingByModel,
  selectedCurrency,
}: BillingDetailsCardProps) {
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useBillingCollapse('details-request-costs');

  const [filterEndpoint, setFilterEndpoint] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('');
  const [includeOthers, setIncludeOthers] = useState(false);

  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<number>(10);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRefreshRef = useRef<() => void>(() => {});
  const refreshingRef = useRef(false);

  const rows = useMemo((): BillingDetailRow[] => {
    const language = i18n.language;
    return details
      .map((detail, index) => {
        const timestamp = detail.timestamp;
        const timestampMs = Number(detail.__timestampMs) || Date.parse(timestamp) || 0;
        const date = timestampMs ? new Date(timestampMs) : null;
        const endpoint = toEndpointLabel(detail);
        const modelName = String(detail.__modelName ?? '').trim() || '-';
        const tokens = detail.tokens ?? ({} as UsageDetailWithEndpoint['tokens']);
        const inputTokens = Number(tokens.input_tokens) || 0;
        const outputTokens = Number(tokens.output_tokens) || 0;
        const cachedTokens = Math.max(Number(tokens.cached_tokens) || 0, Number(tokens.cache_tokens) || 0);
        const totalTokens = Number(tokens.total_tokens) || inputTokens + outputTokens + cachedTokens;
        const cost = computeCostForDetail(detail, pricingByModel);
        const currencySymbol = String(cost.currencySymbol ?? '').trim() as CurrencySymbol;
        return {
          id: `${timestampMs}-${endpoint.key}-${modelName}-${index}`,
          timestamp,
          timestampMs,
          timestampLabel: date ? date.toLocaleString(language) : timestamp || '-',
          endpointLabel: endpoint.label,
          endpointKey: endpoint.key,
          source: String(detail.source ?? '').trim() || '-',
          modelName,
          failed: detail.failed === true,
          inputTokens,
          outputTokens,
          cachedTokens,
          totalTokens,
          currencySymbol,
          missingPricing: cost.missingPricing === true,
          promptCost: Number(cost.breakdown.promptCost) || 0,
          completionCost: Number(cost.breakdown.completionCost) || 0,
          cacheCost: Number(cost.breakdown.cacheCost) || 0,
          totalCost: Number(cost.breakdown.totalCost) || 0,
        };
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [details, i18n.language, pricingByModel]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (collapsed || autoRefreshSeconds <= 0) {
      setCountdown(0);
      return;
    }

    setCountdown(autoRefreshSeconds);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (!refreshingRef.current) {
            onRefreshRef.current();
          }
          return autoRefreshSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [autoRefreshSeconds, collapsed]);

  const missingPricingCount = useMemo(() => rows.filter((r) => r.missingPricing).length, [rows]);
  const otherCurrencyCount = useMemo(() => {
    if (!selectedCurrency) return 0;
    return rows.filter((r) => !r.missingPricing && r.currencySymbol && r.currencySymbol !== selectedCurrency).length;
  }, [rows, selectedCurrency]);

  const precomputedStats = useMemo(() => {
    const statsMap = new Map<string, { recent: { failed: boolean; timestampMs: number }[]; successRate: string; totalCount: number }>();
    const grouped: Record<string, BillingDetailRow[]> = {};

    rows.forEach((row) => {
      const key = `${row.endpointKey}|||${row.modelName}`;
      (grouped[key] ||= []).push(row);
    });

    Object.values(grouped).forEach((group) => {
      group.sort((a, b) => a.timestampMs - b.timestampMs);
      let successCount = 0;
      let totalCount = 0;
      const recent: { failed: boolean; timestampMs: number }[] = [];

      group.forEach((row) => {
        totalCount += 1;
        if (!row.failed) successCount += 1;
        recent.push({ failed: row.failed, timestampMs: row.timestampMs });
        if (recent.length > 10) recent.shift();
        const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0.0';
        statsMap.set(row.id, { recent: [...recent], successRate, totalCount });
      });
    });

    return statsMap;
  }, [rows]);

  const getStats = useCallback(
    (row: BillingDetailRow) =>
      precomputedStats.get(row.id) ?? { recent: [], successRate: '0.0', totalCount: 0 },
    [precomputedStats]
  );

  const { endpointOptions, modelOptions, sourceOptions } = useMemo(() => {
    const endpointSet = new Set<string>();
    const modelSet = new Set<string>();
    const sourceSet = new Set<string>();

    rows.forEach((row) => {
      endpointSet.add(row.endpointKey);
      modelSet.add(row.modelName);
      sourceSet.add(row.source);
    });

    return {
      endpointOptions: Array.from(endpointSet).sort(),
      modelOptions: Array.from(modelSet).sort(),
      sourceOptions: Array.from(sourceSet).sort(),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!includeOthers) {
        if (!selectedCurrency) return false;
        if (row.missingPricing) return false;
        if (row.currencySymbol !== selectedCurrency) return false;
      }
      if (filterEndpoint && row.endpointKey !== filterEndpoint) return false;
      if (filterModel && row.modelName !== filterModel) return false;
      if (filterSource && row.source !== filterSource) return false;
      if (filterStatus === 'success' && row.failed) return false;
      if (filterStatus === 'failed' && !row.failed) return false;
      return true;
    });
  }, [filterEndpoint, filterModel, filterSource, filterStatus, includeOthers, rows, selectedCurrency]);

  const subtitle = useMemo(() => {
    const currencyLabel = selectedCurrency || t('billing.select_currency');
    const parts: string[] = [timeRangeLabel, currencyLabel];
    if (!includeOthers) {
      if (missingPricingCount > 0) {
        parts.push(
          t('billing.billing_details_filtered_missing', {
            count: missingPricingCount,
            defaultValue: `缺失定价：${missingPricingCount}`,
          })
        );
      }
      if (otherCurrencyCount > 0) {
        parts.push(
          t('billing.billing_details_filtered_other_currency', {
            count: otherCurrencyCount,
            defaultValue: `非当前币种：${otherCurrencyCount}`,
          })
        );
      }
    }
    return parts.join(' | ');
  }, [includeOthers, missingPricingCount, otherCurrencyCount, selectedCurrency, t, timeRangeLabel]);

  const countdownText = useMemo(() => {
    if (refreshing) {
      return t('monitor.logs.refreshing', { defaultValue: '刷新中...' });
    }
    if (autoRefreshSeconds <= 0) {
      return t('monitor.logs.manual_refresh', { defaultValue: '手动刷新' });
    }
    if (countdown > 0) {
      return t('monitor.logs.refresh_in_seconds', {
        seconds: countdown,
        defaultValue: `${countdown}秒后刷新`,
      });
    }
    return t('monitor.logs.refreshing', { defaultValue: '刷新中...' });
  }, [autoRefreshSeconds, countdown, refreshing, t]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return '--';
    return lastUpdatedAt.toLocaleTimeString(i18n.language);
  }, [i18n.language, lastUpdatedAt]);

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const handleScroll = useCallback(() => {
    if (!tableContainerRef.current || !headerRef.current) return;
    headerRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const renderEmpty = () => {
    if (loading && rows.length === 0) return t('common.loading');
    if (!rows.length) return t('billing.billing_details_no_rows', { defaultValue: '暂无明细' });
    if (!includeOthers && !selectedCurrency) return t('billing.select_currency');
    return t('billing.billing_details_no_rows_filtered', {
      defaultValue: '当前币种下无可展示请求（可切换币种或开启包含缺失/其它币种）',
    });
  };

  const renderPill = (content: string, variantClass?: string) => (
    <span className={`${billingStyles.pill} ${variantClass ?? ''}`.trim()}>{content}</span>
  );

  const renderMoneyPill = (currency: CurrencySymbol, value: number, variantClass?: string) =>
    renderPill(formatMoney(currency, value), variantClass);

  return (
    <Card
      title={t('billing.billing_details_title', { defaultValue: '计费明细' })}
      subtitle={subtitle}
      extra={<CollapseToggleButton collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />}
    >
      {collapsed ? null : (
        <>
          <div className={monitorStyles.logFilters}>
            <select className={monitorStyles.logSelect} value={filterEndpoint} onChange={(e) => setFilterEndpoint(e.target.value)}>
              <option value="">{t('billing.all_endpoints', { defaultValue: '全部端点' })}</option>
              {endpointOptions.map((endpoint) => (
                <option key={endpoint} value={endpoint}>
                  {endpoint}
                </option>
              ))}
            </select>

            <select className={monitorStyles.logSelect} value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
              <option value="">{t('monitor.logs.all_models', { defaultValue: '全部模型' })}</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>

            <select className={monitorStyles.logSelect} value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
              <option value="">{t('monitor.logs.all_sources', { defaultValue: '全部来源' })}</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>

            <select className={monitorStyles.logSelect} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}>
              <option value="">{t('monitor.logs.all_status', { defaultValue: '全部状态' })}</option>
              <option value="success">{t('monitor.logs.success', { defaultValue: '成功' })}</option>
              <option value="failed">{t('monitor.logs.failed', { defaultValue: '失败' })}</option>
            </select>

            <label className={styles.includeOthers}>
              <input type="checkbox" checked={includeOthers} onChange={(e) => setIncludeOthers(e.target.checked)} />
              <span>{t('billing.billing_details_include_others', { defaultValue: '包含缺失/其它币种' })}</span>
            </label>

            <span className={monitorStyles.logLastUpdate}>
              {t('usage_stats.last_updated')}: {lastUpdatedLabel} · {countdownText}
            </span>

            <select
              className={monitorStyles.logSelect}
              value={autoRefreshSeconds}
              onChange={(e) => setAutoRefreshSeconds(Number(e.target.value))}
              aria-label={t('monitor.logs.auto_refresh', { defaultValue: '自动刷新' })}
            >
              <option value={0}>{t('monitor.logs.manual_refresh', { defaultValue: '手动刷新' })}</option>
              <option value={1}>1s</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>

            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label={t('common.refresh')}
            >
              {t('common.refresh')}
            </Button>
          </div>

          {!includeOthers && (missingPricingCount > 0 || otherCurrencyCount > 0) ? (
            <div className={styles.metaRow}>
              {missingPricingCount > 0 ? (
                <span className={styles.metaPill}>
                  {t('billing.billing_details_filtered_missing', {
                    count: missingPricingCount,
                    defaultValue: `缺失定价：${missingPricingCount}`,
                  })}
                </span>
              ) : null}
              {otherCurrencyCount > 0 ? (
                <span className={styles.metaPill}>
                  {t('billing.billing_details_filtered_other_currency', {
                    count: otherCurrencyCount,
                    defaultValue: `非当前币种：${otherCurrencyCount}`,
                  })}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className={monitorStyles.tableWrapper}>
            {filteredRows.length === 0 ? (
              <div className={monitorStyles.emptyState}>{renderEmpty()}</div>
            ) : (
              <>
                <div ref={headerRef} className={monitorStyles.stickyHeader}>
                  <table className={`${monitorStyles.table} ${styles.virtualTable}`}>
                    <thead>
                      <tr>
                        <th>{t('billing.endpoint', { defaultValue: '端点' })}</th>
                        <th>{t('usage_stats.model_name')}</th>
                        <th>{t('monitor.logs.header_source', { defaultValue: '来源' })}</th>
                        <th>{t('monitor.logs.header_status', { defaultValue: '状态' })}</th>
                        <th>{t('monitor.logs.header_recent', { defaultValue: '最近' })}</th>
                        <th>{t('monitor.logs.header_rate', { defaultValue: '成功率' })}</th>
                        <th>{t('monitor.logs.header_count', { defaultValue: '请求数' })}</th>
                        <th>{t('monitor.logs.header_input', { defaultValue: '输入' })}</th>
                        <th>{t('monitor.logs.header_output', { defaultValue: '输出' })}</th>
                        <th>{t('usage_stats.cached_tokens', { defaultValue: '缓存' })}</th>
                        <th>{t('monitor.logs.header_total', { defaultValue: '总 Token' })}</th>
                        <th>{t('billing.model_pricing_prompt_cost')}</th>
                        <th>{t('billing.model_pricing_completion_cost')}</th>
                        <th>{t('billing.model_pricing_cache_cost')}</th>
                        <th>{t('billing.cost')}</th>
                        <th>{t('monitor.logs.header_time', { defaultValue: '时间' })}</th>
                      </tr>
                    </thead>
                  </table>
                </div>

                <div
                  ref={tableContainerRef}
                  className={monitorStyles.virtualScrollContainer}
                  style={{ height: 520, minHeight: 360, overflow: 'auto' }}
                  onScroll={handleScroll}
                >
                  <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                    <table className={`${monitorStyles.table} ${styles.virtualTable}`}>
                      <tbody>
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                          const row = filteredRows[virtualRow.index];
                          if (!row) return null;

                          const stats = getStats(row);
                          const rateValue = Number(stats.successRate) || 0;
                          const rateClass =
                            rateValue >= 90 ? billingStyles.pillSuccess : rateValue >= 70 ? billingStyles.pillWarning : billingStyles.pillFailure;

                          const currency = (row.currencySymbol || selectedCurrency) as CurrencySymbol;
                          const hasCost = !row.missingPricing && Boolean(currency);

                          return (
                            <tr
                              key={row.id}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                                display: 'table',
                                tableLayout: 'fixed',
                              }}
                            >
                              <td title={row.endpointLabel}>{row.endpointLabel}</td>
                              <td title={row.modelName}>{row.modelName}</td>
                              <td title={row.source}>{row.source}</td>
                              <td>
                                <span className={`${monitorStyles.statusPill} ${row.failed ? monitorStyles.failed : monitorStyles.success}`}>
                                  {row.failed ? t('monitor.logs.failed', { defaultValue: '失败' }) : t('monitor.logs.success', { defaultValue: '成功' })}
                                </span>
                              </td>
                              <td>
                                <div className={monitorStyles.statusBars}>
                                  {stats.recent.map((req, idx) => (
                                    <div key={idx} className={`${monitorStyles.statusBar} ${req.failed ? monitorStyles.failure : monitorStyles.success}`} />
                                  ))}
                                </div>
                              </td>
                              <td>{renderPill(`${stats.successRate}%`, rateClass)}</td>
                              <td>{renderPill(stats.totalCount.toLocaleString(), billingStyles.pillNeutral)}</td>
                              <td>{renderPill(formatCompactNumber(row.inputTokens), billingStyles.pillNeutral)}</td>
                              <td>{renderPill(formatCompactNumber(row.outputTokens), billingStyles.pillNeutral)}</td>
                              <td>{renderPill(formatCompactNumber(row.cachedTokens), billingStyles.pillNeutral)}</td>
                              <td>{renderPill(formatCompactNumber(row.totalTokens), billingStyles.pillNeutral)}</td>
                              <td>{hasCost ? renderMoneyPill(currency, row.promptCost, billingStyles.pillPrompt) : '--'}</td>
                              <td>{hasCost ? renderMoneyPill(currency, row.completionCost, billingStyles.pillCompletion) : '--'}</td>
                              <td>{hasCost ? renderMoneyPill(currency, row.cacheCost, billingStyles.pillCache) : '--'}</td>
                              <td>
                                {row.missingPricing ? (
                                  renderPill(t('billing.model_prices_missing', { defaultValue: '未定价' }), billingStyles.pillMuted)
                                ) : hasCost ? (
                                  renderMoneyPill(currency, row.totalCost, billingStyles.pillTotal)
                                ) : (
                                  '--'
                                )}
                              </td>
                              <td>{renderPill(row.timestampLabel, billingStyles.pillNeutral)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          {filteredRows.length > 0 ? (
            <div className={styles.tableFooter}>
              {t('monitor.logs.total_count', { count: filteredRows.length, defaultValue: `总计：${filteredRows.length}` })}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
