import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import type { UsageDetailWithEndpoint } from '@/utils/usage';
import { computeCostForDetail } from './modelPricing/costing';
import type { ModelPricingV1 } from './modelPricing/types';
import { formatMoney } from './modelPricing/money';
import type { CurrencySymbol } from './modelPricing/types';
import { useBillingCollapse } from './collapse/useBillingCollapse';
import { CollapseToggleButton } from './collapse/CollapseToggleButton';
import styles from './BillingDetailsCard.module.scss';

const ROW_HEIGHT = 112;

type StatusFilter = 'all' | 'success' | 'failed';

type BillingDetailRow = {
  id: string;
  timestamp: string;
  timestampMs: number;
  timestampLabel: string;
  endpointLabel: string;
  endpointKey: string;
  modelName: string;
  failed: boolean;
  currencySymbol: CurrencySymbol;
  missingPricing: boolean;
  promptCost: number;
  completionCost: number;
  cacheCost: number;
  totalCost: number;
};

export type BillingDetailsCardProps = {
  loading: boolean;
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

export function BillingDetailsCard({ loading, timeRangeLabel, details, pricingByModel, selectedCurrency }: BillingDetailsCardProps) {
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useBillingCollapse('details-request-costs');

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [includeOthers, setIncludeOthers] = useState(false);

  const rows = useMemo((): BillingDetailRow[] => {
    const language = i18n.language;
    return details
      .map((detail, index) => {
        const timestamp = detail.timestamp;
        const timestampMs = Number(detail.__timestampMs) || Date.parse(timestamp) || 0;
        const date = timestampMs ? new Date(timestampMs) : null;
        const endpoint = toEndpointLabel(detail);
        const modelName = String(detail.__modelName ?? '').trim() || '-';
        const cost = computeCostForDetail(detail, pricingByModel);
        const currencySymbol = String(cost.currencySymbol ?? '').trim() as CurrencySymbol;
        return {
          id: `${timestampMs}-${endpoint.key}-${modelName}-${index}`,
          timestamp,
          timestampMs,
          timestampLabel: date ? date.toLocaleString(language) : timestamp || '-',
          endpointLabel: endpoint.label,
          endpointKey: endpoint.key,
          modelName,
          failed: detail.failed === true,
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

  const missingPricingCount = useMemo(() => rows.filter((r) => r.missingPricing).length, [rows]);
  const otherCurrencyCount = useMemo(() => {
    if (!selectedCurrency) return 0;
    return rows.filter((r) => !r.missingPricing && r.currencySymbol && r.currencySymbol !== selectedCurrency).length;
  }, [rows, selectedCurrency]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!includeOthers) {
        if (!selectedCurrency) return false;
        if (row.missingPricing) return false;
        if (row.currencySymbol !== selectedCurrency) return false;
      }
      if (status === 'success' && row.failed) return false;
      if (status === 'failed' && !row.failed) return false;
      if (!q) return true;
      const hay = `${row.modelName} ${row.endpointLabel} ${row.endpointKey}`.toLowerCase();
      return hay.includes(q);
    });
  }, [includeOthers, query, rows, selectedCurrency, status]);

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

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('usage_stats.filter_all') },
      { value: 'success', label: t('stats.success') },
      { value: 'failed', label: t('stats.failure') },
    ],
    [t]
  );

  const renderEmpty = () => {
    if (loading && rows.length === 0) return t('common.loading');
    if (!rows.length) return t('billing.billing_details_no_rows', { defaultValue: '暂无明细' });
    if (!includeOthers && !selectedCurrency) return t('billing.select_currency');
    return t('billing.billing_details_no_rows_filtered', {
      defaultValue: '当前币种下无可展示请求（可切换币种或开启包含缺失/其它币种）',
    });
  };

  return (
    <Card
      title={t('billing.billing_details_title', { defaultValue: '计费明细' })}
      subtitle={subtitle}
      extra={<CollapseToggleButton collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />}
    >
      {collapsed ? null : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarSearch}>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('billing.billing_details_search_placeholder', { defaultValue: '搜索模型/端点...' })}
                aria-label={t('billing.billing_details_search_placeholder', { defaultValue: '搜索模型/端点...' })}
              />
            </div>
            <div className={styles.toolbarRight}>
              <Select
                value={status}
                options={statusOptions}
                onChange={(value) => setStatus((value as StatusFilter) || 'all')}
                ariaLabel={t('billing.billing_details_status', { defaultValue: '状态' })}
                fullWidth={false}
              />
              <ToggleSwitch
                checked={includeOthers}
                onChange={setIncludeOthers}
                label={t('billing.billing_details_include_others', { defaultValue: '包含缺失/其它币种' })}
                ariaLabel={t('billing.billing_details_include_others', { defaultValue: '包含缺失/其它币种' })}
              />
            </div>
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

          {filteredRows.length === 0 ? (
            <div className={styles.empty}>{renderEmpty()}</div>
          ) : (
            <div ref={parentRef} className={styles.scroller}>
              <div className={styles.inner} style={{ height: rowVirtualizer.getTotalSize() }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = filteredRows[virtualRow.index];
                  if (!row) return null;

                  const currency = row.currencySymbol || selectedCurrency;
                  const hasCost = !row.missingPricing && Boolean(currency);
                  const totalCostLabel = hasCost ? formatMoney(currency, row.totalCost) : '--';
                  const promptLabel = hasCost ? formatMoney(currency, row.promptCost) : '--';
                  const completionLabel = hasCost ? formatMoney(currency, row.completionCost) : '--';
                  const cacheLabel = hasCost ? formatMoney(currency, row.cacheCost) : '--';
                  const otherCurrency = Boolean(selectedCurrency) && Boolean(row.currencySymbol) && row.currencySymbol !== selectedCurrency;

                  return (
                    <div
                      key={row.id}
                      className={styles.row}
                      style={{ transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
                    >
                      <div className={styles.rowMain}>
                        <div className={styles.rowLeft}>
                          <div className={styles.rowTitle}>
                            <span className={styles.time} title={row.timestamp}>
                              {row.timestampLabel}
                            </span>
                            <span className={styles.endpoint} title={row.endpointLabel}>
                              {row.endpointLabel}
                            </span>
                          </div>
                          <div className={styles.rowSub}>
                            <span className={styles.model} title={row.modelName}>
                              {row.modelName}
                            </span>
                            {row.missingPricing ? (
                              <span className={`${styles.tag} ${styles.tagMissing}`}>
                                {t('billing.model_prices_missing', { defaultValue: '未定价' })}
                              </span>
                            ) : otherCurrency ? (
                              <span className={`${styles.tag} ${styles.tagOtherCurrency}`}>{row.currencySymbol}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className={styles.rowRight}>
                          <span
                            className={`${styles.status} ${row.failed ? styles.statusFailure : styles.statusSuccess}`}
                          >
                            {row.failed ? t('stats.failure') : t('stats.success')}
                          </span>
                          <span className={styles.totalCost}>{totalCostLabel}</span>
                        </div>
                      </div>

                      <div className={styles.badges}>
                        <span className={`${styles.costBadge} ${styles.badgePrompt}`}>
                          {t('billing.model_pricing_prompt_cost')}: {promptLabel}
                        </span>
                        <span className={`${styles.costBadge} ${styles.badgeCompletion}`}>
                          {t('billing.model_pricing_completion_cost')}: {completionLabel}
                        </span>
                        <span className={`${styles.costBadge} ${styles.badgeCache}`}>
                          {t('billing.model_pricing_cache_cost')}: {cacheLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
