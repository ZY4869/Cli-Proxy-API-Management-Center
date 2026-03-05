import { useTranslation } from 'react-i18next';
import { useBillingCollapse } from '../collapse/useBillingCollapse';
import { CollapseToggleButton } from '../collapse/CollapseToggleButton';
import styles from '../BillingPage.module.scss';

export type ModelCoverageKpiCardProps = {
  loading: boolean;
  timeRangeLabel: string;
  modelCount: number;
  missingModelsCount: number;
  currenciesCount: number;
};

export function ModelCoverageKpiCard({
  loading,
  timeRangeLabel,
  modelCount,
  missingModelsCount,
  currenciesCount,
}: ModelCoverageKpiCardProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useBillingCollapse('kpi-model-coverage');
  const configuredModelsCount = Math.max(modelCount - missingModelsCount, 0);

  return (
    <div className={`${styles.kpiCard} ${styles.cyan}`}>
      <div className={styles.kpiTitle}>
        <span className={styles.kpiLabel}>{t('billing.model_pricing_models')}</span>
        <span className={styles.kpiTitleActions}>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
          <CollapseToggleButton collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
        </span>
      </div>
      {collapsed ? (
        <div className={styles.kpiValue}>{loading ? '--' : modelCount.toLocaleString()}</div>
      ) : (
        <>
          <div className={styles.kpiSplitGrid}>
            <div className={`${styles.kpiSplitCard} ${styles.kpiSplitPositive}`}>
              <div className={styles.kpiSplitLabel}>
                {t('billing.model_pricing_configured_models', { defaultValue: '已定价' })}
              </div>
              <div className={styles.kpiSplitValue}>{loading ? '--' : configuredModelsCount.toLocaleString()}</div>
            </div>
            <div className={styles.kpiSplitCard}>
              <div className={styles.kpiSplitLabel}>
                {t('billing.model_pricing_missing_models_short', { defaultValue: '未定价' })}
              </div>
              <div className={styles.kpiSplitValueMuted}>{loading ? '--' : missingModelsCount.toLocaleString()}</div>
            </div>
          </div>
          <div className={styles.kpiMeta}>
            <span>
              {t('billing.model_pricing_enabled_currencies')}: {loading ? '--' : currenciesCount.toLocaleString()}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

