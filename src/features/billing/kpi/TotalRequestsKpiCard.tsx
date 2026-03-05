import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBillingCollapse } from '../collapse/useBillingCollapse';
import { CollapseToggleButton } from '../collapse/CollapseToggleButton';
import { KpiMiniCard } from './KpiMiniCard';
import styles from '../BillingPage.module.scss';

export type TotalRequestsKpiCardProps = {
  loading: boolean;
  timeRangeLabel: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
};

const formatPercent = (ratio: number, digits: number = 1) => {
  const safe = Number.isFinite(ratio) ? ratio : 0;
  return `${(safe * 100).toFixed(digits)}%`;
};

export function TotalRequestsKpiCard({
  loading,
  timeRangeLabel,
  requestCount,
  successCount,
  failureCount,
}: TotalRequestsKpiCardProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useBillingCollapse('kpi-total-requests');
  const successRate = useMemo(() => (requestCount > 0 ? successCount / requestCount : 0), [requestCount, successCount]);

  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiTitle}>
        <span className={styles.kpiLabel}>{t('usage_stats.total_requests')}</span>
        <span className={styles.kpiTitleActions}>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
          <CollapseToggleButton collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
        </span>
      </div>
      <div className={styles.kpiValue}>{loading ? '--' : requestCount.toLocaleString()}</div>
      {collapsed ? null : (
        <div className={styles.kpiMiniGrid}>
          <KpiMiniCard
            label={t('usage_stats.success_requests')}
            value={loading ? '--' : successCount.toLocaleString()}
            valueClassName={styles.kpiPositiveValue}
          />
          <KpiMiniCard
            label={t('usage_stats.failed_requests')}
            value={loading ? '--' : failureCount.toLocaleString()}
            valueClassName={styles.kpiWarningValue}
          />
          <KpiMiniCard
            label={t('monitor.kpi.rate')}
            value={loading ? '--' : formatPercent(successRate)}
            valueClassName={styles.kpiNeutralValue}
          />
        </div>
      )}
    </div>
  );
}

