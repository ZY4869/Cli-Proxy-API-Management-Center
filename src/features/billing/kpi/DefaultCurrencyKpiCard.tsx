import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import { useModelPricingStore } from '../modelPricing/useModelPricingStore';
import { useBillingCollapse } from '../collapse/useBillingCollapse';
import { CollapseToggleButton } from '../collapse/CollapseToggleButton';
import styles from '../BillingPage.module.scss';

export function DefaultCurrencyKpiCard() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useBillingCollapse('kpi-default-currency');

  const defaultCurrencySymbol = useModelPricingStore((s) => s.defaultCurrencySymbol);
  const setDefaultCurrencySymbol = useModelPricingStore((s) => s.setDefaultCurrencySymbol);
  const symbol = String(defaultCurrencySymbol ?? '$').trim() || '$';

  const options = useMemo(
    () => [
      { value: '$', label: t('billing.currency_usd', { defaultValue: '$ 美元' }) },
      { value: '￥', label: t('billing.currency_cny', { defaultValue: '￥ 人民币' }) },
    ],
    [t]
  );

  return (
    <div className={`${styles.kpiCard} ${styles.green}`}>
      <div className={styles.kpiTitle}>
        <span className={styles.kpiLabel}>{t('billing.default_currency', { defaultValue: '默认货币' })}</span>
        <span className={styles.kpiTitleActions}>
          <CollapseToggleButton collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
        </span>
      </div>
      <div className={styles.kpiValue}>{symbol}</div>
      {collapsed ? null : (
        <div className={styles.kpiDefaultCurrencyBody}>
          <Select
            value={symbol}
            options={options}
            onChange={(value) => setDefaultCurrencySymbol(value)}
            ariaLabel={t('billing.default_currency', { defaultValue: '默认货币' })}
            fullWidth={true}
          />
          <div className={styles.kpiSubtle}>
            {t('billing.default_currency_help', { defaultValue: '用于新建模型定价的默认币种符号' })}
          </div>
        </div>
      )}
    </div>
  );
}

