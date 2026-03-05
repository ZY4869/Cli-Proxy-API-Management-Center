import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card } from '@/components/ui/Card';
import { authFilesApi } from '@/services/api';
import { useDisableModel } from '@/hooks';
import { normalizeAuthIndex } from '@/utils/usage';
import { collectUsageRequestEvents } from '@/utils/requestEvents';
import { resolveSourceDisplay } from '@/utils/sourceResolver';
import type { SourceInfo, CredentialInfo } from '@/types/sourceInfo';
import { TimeRangeSelector, formatTimeRangeCaption, type TimeRange } from './TimeRangeSelector';
import { DisableModelModal } from './DisableModelModal';
import { maskSecret, formatTimestamp, getRateClassName, filterDataByTimeRange, type DateRange } from '@/utils/monitor';
import type { UsageData } from '@/pages/MonitorPage';
import styles from '@/pages/MonitorPage.module.scss';

interface RequestLogsProps {
  data: UsageData | null;
  loading: boolean;
  providerMap: Record<string, string>;
  providerTypeMap: Record<string, string>;
  sourceInfoMap: Map<string, SourceInfo>;
  authFileMap?: Map<string, CredentialInfo>;
  apiFilter: string;
  onRefresh: () => void;
}

interface LogEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  apiKey: string;
  model: string;
  source: string;
  rawSource: string;
  displayName: string;
  providerName: string | null;
  providerType: string;
  maskedKey: string;
  failed: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  authIndex: string;
}

interface ChannelModelRequest {
  failed: boolean;
  timestamp: number;
}

interface PrecomputedStats {
  recentRequests: ChannelModelRequest[];
  successRate: string;
  totalCount: number;
}

const ROW_HEIGHT = 40;

export function RequestLogs({
  data,
  loading,
  providerMap,
  providerTypeMap,
  sourceInfoMap,
  authFileMap: propAuthFileMap,
  apiFilter,
  onRefresh,
}: RequestLogsProps) {
  const { t } = useTranslation();
  const [filterApi, setFilterApi] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'success' | 'failed'>('');
  const [filterProviderType, setFilterProviderType] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(10);
  const [countdown, setCountdown] = useState(0);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [localAuthFileMap, setLocalAuthFileMap] = useState<Map<string, CredentialInfo>>(new Map());

  const authFileMap = propAuthFileMap?.size ? propAuthFileMap : localAuthFileMap;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingRef = useRef(loading);
  const onRefreshRef = useRef(onRefresh);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const {
    disableState,
    disabling,
    isModelDisabled,
    handleDisableClick,
    handleConfirmDisable,
    handleCancelDisable,
  } = useDisableModel({ providerMap, sourceInfoMap });

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (propAuthFileMap?.size) {
      return;
    }

    let cancelled = false;
    void authFilesApi
      .list()
      .then((response) => {
        if (cancelled) return;
        const files = response?.files || [];
        const credMap = new Map<string, CredentialInfo>();
        files.forEach((file) => {
          const credKey = normalizeAuthIndex((file as Record<string, unknown>)['auth_index'] ?? file.authIndex);
          if (!credKey) return;
          credMap.set(credKey, {
            name: file.name || credKey,
            type: ((file as Record<string, unknown>).type || (file as Record<string, unknown>).provider || '').toString(),
          });
        });
        setLocalAuthFileMap(credMap);
      })
      .catch((err) => {
        console.warn('Failed to load auth files for index mapping:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [propAuthFileMap]);

  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (autoRefresh <= 0) {
      setCountdown(0);
      return;
    }

    setCountdown(autoRefresh);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (!loadingRef.current) {
            onRefreshRef.current();
          }
          return autoRefresh;
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
  }, [autoRefresh]);

  const handleScroll = useCallback(() => {
    if (tableContainerRef.current && headerRef.current) {
      headerRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  }, []);

  const handleTimeRangeChange = useCallback((range: TimeRange, custom?: DateRange) => {
    setTimeRange(range);
    setCustomRange(custom);
  }, []);

  const filteredData = useMemo(
    () => filterDataByTimeRange(data, timeRange, customRange),
    [customRange, data, timeRange]
  );

  const logEntries = useMemo(() => {
    const normalizedApiFilter = apiFilter.trim().toLowerCase();

    return collectUsageRequestEvents(filteredData)
      .filter((event) => {
        if (!normalizedApiFilter) return true;
        const endpointLabel = event.endpointLabel.toLowerCase();
        const endpointKey = event.endpointKey.toLowerCase();
        return endpointLabel.includes(normalizedApiFilter) || endpointKey.includes(normalizedApiFilter);
      })
      .map((event) => {
        const rawSource = event.sourceRaw || event.source || '-';
        const maskedKey = rawSource === '-' ? '-' : maskSecret(rawSource);
        const sourceInfo = resolveSourceDisplay(event.source, event.authIndexRaw, sourceInfoMap, authFileMap);
        const providerType = sourceInfo.type || providerTypeMap[rawSource] || providerTypeMap[event.source] || '--';
        const providerName = sourceInfo.displayName && sourceInfo.displayName !== event.source ? sourceInfo.displayName : null;
        const displayName = providerName ? `${providerName} (${maskedKey})` : maskedKey;

        return {
          id: event.id,
          timestamp: event.timestamp,
          timestampMs: event.timestampMs,
          apiKey: event.endpointLabel,
          model: event.model,
          source: event.source,
          rawSource,
          displayName,
          providerName,
          providerType,
          maskedKey,
          failed: event.failed,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          totalTokens: event.totalTokens,
          authIndex: event.authIndex,
        } satisfies LogEntry;
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [apiFilter, authFileMap, filteredData, providerTypeMap, sourceInfoMap]);

  const precomputedStats = useMemo(() => {
    const statsMap = new Map<string, PrecomputedStats>();
    const channelModelGroups: Record<string, LogEntry[]> = {};

    logEntries.forEach((entry) => {
      const key = `${entry.rawSource}|||${entry.model}`;
      (channelModelGroups[key] ||= []).push(entry);
    });

    Object.values(channelModelGroups).forEach((group) => {
      group.sort((a, b) => a.timestampMs - b.timestampMs);
      let successCount = 0;
      let totalCount = 0;
      const recentRequests: ChannelModelRequest[] = [];

      group.forEach((entry) => {
        totalCount += 1;
        if (!entry.failed) {
          successCount += 1;
        }

        recentRequests.push({ failed: entry.failed, timestamp: entry.timestampMs });
        if (recentRequests.length > 10) {
          recentRequests.shift();
        }

        const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0.0';
        statsMap.set(entry.id, {
          recentRequests: [...recentRequests],
          successRate,
          totalCount,
        });
      });
    });

    return statsMap;
  }, [logEntries]);

  const sourceLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    logEntries.forEach((entry) => {
      if (!map.has(entry.rawSource)) {
        map.set(entry.rawSource, entry.displayName);
      }
    });
    return map;
  }, [logEntries]);

  const { apis, models, sources, providerTypes } = useMemo(() => {
    const apiSet = new Set<string>();
    const modelSet = new Set<string>();
    const sourceSet = new Set<string>();
    const providerTypeSet = new Set<string>();

    logEntries.forEach((entry) => {
      apiSet.add(entry.apiKey);
      modelSet.add(entry.model);
      sourceSet.add(entry.rawSource);
      if (entry.providerType && entry.providerType !== '--') {
        providerTypeSet.add(entry.providerType);
      }
    });

    return {
      apis: Array.from(apiSet).sort(),
      models: Array.from(modelSet).sort(),
      sources: Array.from(sourceSet).sort(),
      providerTypes: Array.from(providerTypeSet).sort(),
    };
  }, [logEntries]);

  const filteredEntries = useMemo(() => {
    return logEntries.filter((entry) => {
      if (filterApi && entry.apiKey !== filterApi) return false;
      if (filterModel && entry.model !== filterModel) return false;
      if (filterSource && entry.rawSource !== filterSource) return false;
      if (filterStatus === 'success' && entry.failed) return false;
      if (filterStatus === 'failed' && !entry.failed) return false;
      if (filterProviderType && entry.providerType !== filterProviderType) return false;
      return true;
    });
  }, [filterApi, filterModel, filterProviderType, filterSource, filterStatus, logEntries]);

  const rowVirtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const showLoading = loading && !data;

  const getStats = useCallback(
    (entry: LogEntry): PrecomputedStats =>
      precomputedStats.get(entry.id) || {
        recentRequests: [],
        successRate: '0.0',
        totalCount: 0,
      },
    [precomputedStats]
  );

  const getCountdownText = () => {
    if (loading) {
      return t('monitor.logs.refreshing');
    }
    if (autoRefresh === 0) {
      return t('monitor.logs.manual_refresh');
    }
    if (countdown > 0) {
      return t('monitor.logs.refresh_in_seconds', { seconds: countdown });
    }
    return t('monitor.logs.refreshing');
  };

  const formatNumber = (num: number) => num.toLocaleString();

  const renderRow = (entry: LogEntry) => {
    const stats = getStats(entry);
    const rateValue = Number(stats.successRate) || 0;
    const disabled = isModelDisabled(entry.rawSource, entry.model);
    const authDisplayName = entry.authIndex || '-';

    return (
      <>
        <td title={authDisplayName}>{authDisplayName}</td>
        <td title={entry.apiKey}>{entry.apiKey}</td>
        <td>{entry.providerType}</td>
        <td title={entry.model}>{entry.model}</td>
        <td title={entry.displayName}>
          {entry.providerName ? (
            <>
              <span className={styles.channelName}>{entry.providerName}</span>
              <span className={styles.channelSecret}> ({entry.maskedKey})</span>
            </>
          ) : (
            entry.maskedKey
          )}
        </td>
        <td>
          <span className={`${styles.statusPill} ${entry.failed ? styles.failed : styles.success}`}>
            {entry.failed ? t('monitor.logs.failed') : t('monitor.logs.success')}
          </span>
        </td>
        <td>
          <div className={styles.statusBars}>
            {stats.recentRequests.map((req, idx) => (
              <div
                key={`${entry.id}-${idx}`}
                className={`${styles.statusBar} ${req.failed ? styles.failure : styles.success}`}
              />
            ))}
          </div>
        </td>
        <td className={getRateClassName(rateValue, styles)}>{stats.successRate}%</td>
        <td>{formatNumber(stats.totalCount)}</td>
        <td>{formatNumber(entry.inputTokens)}</td>
        <td>{formatNumber(entry.outputTokens)}</td>
        <td>{formatNumber(entry.totalTokens)}</td>
        <td>{formatTimestamp(entry.timestamp)}</td>
        <td>
          {entry.providerType.toLowerCase() === 'openai' && entry.rawSource && entry.rawSource !== '-' && entry.rawSource !== 'unknown' ? (
            disabled ? (
              <span className={styles.disabledLabel}>{t('monitor.logs.disabled')}</span>
            ) : (
              <button
                className={styles.disableBtn}
                title={t('monitor.logs.disable_model')}
                onClick={() => handleDisableClick(entry.rawSource, entry.model)}
              >
                {t('monitor.logs.disable')}
              </button>
            )
          ) : (
            '-'
          )}
        </td>
      </>
    );
  };

  return (
    <>
      <Card
        title={t('monitor.logs.title')}
        subtitle={
          <span>
            {formatTimeRangeCaption(timeRange, customRange, t)} | {t('monitor.logs.total_count', { count: logEntries.length })}
            <span style={{ color: 'var(--text-tertiary)' }}> | {t('monitor.logs.scroll_hint')}</span>
            <span style={{ color: 'var(--text-tertiary)' }}> | {t('monitor.logs.scope_notice')}</span>
          </span>
        }
        extra={<TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} customRange={customRange} />}
      >
        <div className={styles.logFilters}>
          <select className={styles.logSelect} value={filterApi} onChange={(e) => setFilterApi(e.target.value)}>
            <option value="">{t('monitor.logs.all_apis')}</option>
            {apis.map((api) => (
              <option key={api} value={api}>
                {api}
              </option>
            ))}
          </select>
          <select className={styles.logSelect} value={filterProviderType} onChange={(e) => setFilterProviderType(e.target.value)}>
            <option value="">{t('monitor.logs.all_provider_types')}</option>
            {providerTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select className={styles.logSelect} value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
            <option value="">{t('monitor.logs.all_models')}</option>
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <select className={styles.logSelect} value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
            <option value="">{t('monitor.logs.all_sources')}</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {sourceLabelMap.get(source) || maskSecret(source)}
              </option>
            ))}
          </select>
          <select className={styles.logSelect} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as '' | 'success' | 'failed')}>
            <option value="">{t('monitor.logs.all_status')}</option>
            <option value="success">{t('monitor.logs.success')}</option>
            <option value="failed">{t('monitor.logs.failed')}</option>
          </select>

          <span className={styles.logLastUpdate}>{getCountdownText()}</span>

          <select className={styles.logSelect} value={autoRefresh} onChange={(e) => setAutoRefresh(Number(e.target.value))}>
            <option value="0">{t('monitor.logs.manual_refresh')}</option>
            <option value="5">{t('monitor.logs.refresh_5s')}</option>
            <option value="10">{t('monitor.logs.refresh_10s')}</option>
            <option value="15">{t('monitor.logs.refresh_15s')}</option>
            <option value="30">{t('monitor.logs.refresh_30s')}</option>
            <option value="60">{t('monitor.logs.refresh_60s')}</option>
          </select>
        </div>

        <div className={styles.tableWrapper}>
          {showLoading ? (
            <div className={styles.emptyState}>{t('common.loading')}</div>
          ) : filteredEntries.length === 0 ? (
            <div className={styles.emptyState}>{t('monitor.no_data')}</div>
          ) : (
            <>
              <div ref={headerRef} className={styles.stickyHeader}>
                <table className={`${styles.table} ${styles.virtualTable}`}>
                  <thead>
                    <tr>
                      <th>{t('monitor.logs.header_auth')}</th>
                      <th>{t('monitor.logs.header_api')}</th>
                      <th>{t('monitor.logs.header_request_type')}</th>
                      <th>{t('monitor.logs.header_model')}</th>
                      <th>{t('monitor.logs.header_source')}</th>
                      <th>{t('monitor.logs.header_status')}</th>
                      <th>{t('monitor.logs.header_recent')}</th>
                      <th>{t('monitor.logs.header_rate')}</th>
                      <th>{t('monitor.logs.header_count')}</th>
                      <th>{t('monitor.logs.header_input')}</th>
                      <th>{t('monitor.logs.header_output')}</th>
                      <th>{t('monitor.logs.header_total')}</th>
                      <th>{t('monitor.logs.header_time')}</th>
                      <th>{t('monitor.logs.header_actions')}</th>
                    </tr>
                  </thead>
                </table>
              </div>

              <div
                ref={tableContainerRef}
                className={styles.virtualScrollContainer}
                style={{ height: 'calc(100vh - 420px)', minHeight: '360px', overflow: 'auto' }}
                onScroll={handleScroll}
              >
                <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                  <table className={`${styles.table} ${styles.virtualTable}`}>
                    <tbody>
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const entry = filteredEntries[virtualRow.index];
                        if (!entry) return null;
                        return (
                          <tr
                            key={entry.id}
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
                            {renderRow(entry)}
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

        {filteredEntries.length > 0 && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
            {t('monitor.logs.total_count', { count: filteredEntries.length })}
          </div>
        )}
      </Card>

      <DisableModelModal
        disableState={disableState}
        disabling={disabling}
        onConfirm={handleConfirmDisable}
        onCancel={handleCancelDisable}
      />
    </>
  );
}
