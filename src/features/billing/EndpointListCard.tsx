import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { formatCompactNumber, formatUsd } from '@/utils/usage';
import type { EndpointAggregate } from './utils/dashboard';
import styles from './BillingPage.module.scss';

export type EndpointListCardProps = {
  loading: boolean;
  rows: EndpointAggregate[];
  onEditEndpoint: (endpoint: string) => void;
};

const badgeClassByStatus: Record<EndpointAggregate['status'], string> = {
  default: styles.badgeDefault,
  override: styles.badgeOverride,
  missing: styles.badgeMissing,
  disabled: styles.badgeDisabled,
};

const formatPercent = (ratio: number, digits: number = 1) => {
  const safe = Number.isFinite(ratio) ? ratio : 0;
  return `${(safe * 100).toFixed(digits)}%`;
};

export function EndpointListCard({ loading, rows, onEditEndpoint }: EndpointListCardProps) {
  const { t } = useTranslation();
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(() => new Set());

  const toggleExpanded = useCallback((endpointKey: string) => {
    setExpandedEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(endpointKey)) {
        next.delete(endpointKey);
      } else {
        next.add(endpointKey);
      }
      return next;
    });
  }, []);

  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      if (a.costKnown && b.costKnown) return b.costs.totalCost - a.costs.totalCost;
      if (a.costKnown && !b.costKnown) return -1;
      if (!a.costKnown && b.costKnown) return 1;
      return b.requests - a.requests;
    });
    return list;
  }, [rows]);

  return (
    <Card title={t('billing.endpoint_rules')}>
      {loading ? (
        <div className={styles.hint}>{t('common.loading')}</div>
      ) : sortedRows.length ? (
        <div className={styles.endpointTable}>
          <div className={styles.endpointHeaderRow} aria-hidden="true">
            <div>{t('billing.endpoint')}</div>
            <div>{t('billing.requests')}</div>
            <div>{t('billing.tokens')}</div>
            <div>{t('billing.cost')}</div>
            <div>{t('billing.cost_per_request')}</div>
            <div>{t('billing.cache_hit_ratio')}</div>
            <div>{t('billing.tier')}</div>
            <div>{t('billing.filter_status')}</div>
            <div />
          </div>

          {sortedRows.map((row) => {
            const expanded = expandedEndpoints.has(row.endpointKey);
            const costPerRequest =
              row.costKnown && row.requests > 0 ? row.costs.totalCost / row.requests : Number.NaN;
            const tierLabel =
              row.tierHits.length <= 0
                ? '--'
                : row.tierHits.length === 1
                  ? row.tierHits[0]?.label ?? '--'
                  : t('billing.tier_mixed');

            return (
              <div key={row.endpointKey} className={styles.endpointRowGroup}>
                <div
                  className={styles.endpointRow}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEditEndpoint(row.endpointKey)}
                  onKeyDown={(e) => (e.key === 'Enter' ? onEditEndpoint(row.endpointKey) : null)}
                >
                  <div className={styles.endpointCellEndpoint} title={row.endpointKey}>
                    {row.endpointKey}
                  </div>
                  <div className={styles.endpointCellRequests}>
                    <div className={styles.endpointMainMetric}>{row.requests.toLocaleString()}</div>
                    <div className={styles.endpointSubMetric}>
                      <span className={styles.endpointSuccess}>
                        {t('usage_stats.success_requests')}: {row.successCount.toLocaleString()}
                      </span>
                      <span className={styles.endpointFailure}>
                        {t('usage_stats.failed_requests')}: {row.failureCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className={styles.endpointCellTokens}>
                    <div className={styles.endpointMainMetric}>{formatCompactNumber(row.promptTokens)}</div>
                    <div className={styles.endpointSubMetric}>
                      <span>
                        {t('usage_stats.cached_tokens')}: {formatCompactNumber(row.cachedTokens)}
                      </span>
                      <span>
                        {t('usage_stats.output_tokens')}: {formatCompactNumber(row.outputBillableTokens)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.endpointCellCost}>
                    {row.costKnown ? formatUsd(row.costs.totalCost) : '--'}
                  </div>
                  <div className={styles.endpointCellCostPerReq}>
                    {Number.isFinite(costPerRequest) ? formatUsd(costPerRequest) : '--'}
                  </div>
                  <div className={styles.endpointCellCachePct}>{formatPercent(row.cacheHitRatio)}</div>
                  <div className={styles.endpointCellTier}>{tierLabel}</div>
                  <div className={styles.endpointCellStatus}>
                    <span className={`${styles.badge} ${badgeClassByStatus[row.status]}`}>
                      {t(`billing.rule_status_${row.status}`)}
                    </span>
                  </div>
                  <div className={styles.endpointCellExpand}>
                    <button
                      type="button"
                      className={styles.expandBtn}
                      aria-label={t('billing.endpoint_details')}
                      aria-expanded={expanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(row.endpointKey);
                      }}
                    >
                      {expanded ? '▾' : '▸'}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className={styles.expandedPanel}>
                    <div className={styles.expandedGrid}>
                      <div className={styles.expandedSection}>
                        <div className={styles.expandedTitle}>{t('billing.cost_breakdown_title')}</div>
                        <div className={styles.metricGrid}>
                          <div className={styles.metricItem}>
                            <div className={styles.metricLabel}>{t('billing.input_cost')}</div>
                            <div className={styles.metricValue}>
                              {row.costKnown ? formatUsd(row.costs.inputCost) : '--'}
                            </div>
                          </div>
                          <div className={styles.metricItem}>
                            <div className={styles.metricLabel}>{t('billing.output_cost')}</div>
                            <div className={styles.metricValue}>
                              {row.costKnown ? formatUsd(row.costs.outputCost) : '--'}
                            </div>
                          </div>
                          <div className={styles.metricItem}>
                            <div className={styles.metricLabel}>{t('billing.cache_read_cost')}</div>
                            <div className={styles.metricValue}>
                              {row.costKnown ? formatUsd(row.costs.cacheReadCost) : '--'}
                            </div>
                          </div>
                          <div className={styles.metricItem}>
                            <div className={styles.metricLabel}>{t('billing.cache_storage_cost')}</div>
                            <div className={styles.metricValue}>
                              {row.costKnown ? formatUsd(row.costs.cacheStorageCost) : '--'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={styles.expandedSection}>
                        <div className={styles.expandedTitle}>{t('billing.tier_distribution_title')}</div>
                        {row.tierHits.length ? (
                          <div className={styles.tierHitsList}>
                            {row.tierHits.slice(0, 3).map((hit) => {
                              const denom = Math.max(row.requests, 1);
                              const pct = (hit.requestCount / denom) * 100;
                              return (
                                <div key={hit.tierKey} className={styles.tierHitRow}>
                                  <div className={styles.tierHitLabel}>{hit.label}</div>
                                  <div className={styles.tierHitBarTrack}>
                                    <div className={styles.tierHitBarFill} style={{ width: `${pct}%` }} />
                                  </div>
                                  <div className={styles.tierHitValue}>
                                    {hit.requestCount.toLocaleString()} ({pct.toFixed(1)}%)
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={styles.expandedHint}>{t('billing.no_cost_data')}</div>
                        )}
                      </div>

                      <div className={styles.expandedSection}>
                        <div className={styles.expandedTitle}>{t('billing.cache_impact')}</div>
                        <div className={styles.metricGrid}>
                          <div className={styles.metricItem}>
                            <div className={styles.metricLabel}>{t('billing.cache_hit_ratio')}</div>
                            <div className={styles.metricValue}>{formatPercent(row.cacheHitRatio)}</div>
                          </div>
                          <div className={styles.metricItem}>
                            <div className={styles.metricLabel}>{t('billing.cache_net_savings')}</div>
                            <div className={styles.metricValue}>{formatUsd(row.cacheImpact.netSavings)}</div>
                          </div>
                        </div>
                      </div>

                      <div className={styles.expandedSection}>
                        <div className={styles.expandedTitle}>{t('billing.endpoint_last_seen')}</div>
                        <div className={styles.expandedHint}>
                          {row.lastSeenMs > 0 ? new Date(row.lastSeenMs).toLocaleString() : '--'}
                        </div>
                        <button
                          type="button"
                          className={styles.expandedCta}
                          onClick={() => onEditEndpoint(row.endpointKey)}
                        >
                          {t('billing.endpoint_edit')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.hint}>{t('billing.no_endpoints')}</div>
      )}
    </Card>
  );
}
