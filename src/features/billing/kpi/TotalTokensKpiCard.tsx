import { useTranslation } from 'react-i18next';
import { formatCompactNumber } from '@/utils/usage';
import { useBillingCollapse } from '../collapse/useBillingCollapse';
import { CollapseToggleButton } from '../collapse/CollapseToggleButton';
import { KpiMiniCard } from './KpiMiniCard';
import styles from '../BillingPage.module.scss';

export type TokenTotals = {
  inputTokens: number;
  cachedTokens: number;
  promptBillableTokens: number;
  outputBillableTokens: number;
};

export type TotalTokensKpiCardProps = {
  loading: boolean;
  timeRangeLabel: string;
  tokenTotals: TokenTotals;
};

export function TotalTokensKpiCard({ loading, timeRangeLabel, tokenTotals }: TotalTokensKpiCardProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useBillingCollapse('kpi-total-tokens');

  return (
    <div className={`${styles.kpiCard} ${styles.purple}`}>
      <div className={styles.kpiTitle}>
        <span className={styles.kpiLabel}>{t('usage_stats.total_tokens')}</span>
        <span className={styles.kpiTitleActions}>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
          <CollapseToggleButton collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
        </span>
      </div>
      <div className={styles.kpiValue}>{loading ? '--' : formatCompactNumber(tokenTotals.inputTokens)}</div>
      {collapsed ? null : (
        <div className={styles.kpiMiniGrid}>
          <KpiMiniCard
            label={t('billing.model_pricing_prompt_billable_tokens')}
            value={loading ? '--' : formatCompactNumber(tokenTotals.promptBillableTokens)}
          />
          <KpiMiniCard
            label={t('billing.model_pricing_output_billable_tokens')}
            value={loading ? '--' : formatCompactNumber(tokenTotals.outputBillableTokens)}
          />
          <KpiMiniCard label={t('usage_stats.cached_tokens')} value={loading ? '--' : formatCompactNumber(tokenTotals.cachedTokens)} />
        </div>
      )}
    </div>
  );
}

