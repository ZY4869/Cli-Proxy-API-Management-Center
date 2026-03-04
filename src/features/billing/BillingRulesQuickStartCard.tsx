import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import styles from './BillingPage.module.scss';

export type BillingRulesQuickStartCardProps = {
  onEditDefaultRule: () => void;
  onEnableDefaultRule: () => void;
  onScrollToDefaultRule: () => void;
  onScrollToEndpointRules: () => void;
};

export function BillingRulesQuickStartCard({
  onEditDefaultRule,
  onEnableDefaultRule,
  onScrollToDefaultRule,
  onScrollToEndpointRules,
}: BillingRulesQuickStartCardProps) {
  const { t } = useTranslation();

  return (
    <div className={`${styles.chartCard} ${styles.quickStartCard}`}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>{t('billing.no_enabled_rules')}</h3>
          <p className={styles.chartSubtitle}>{t('billing.rules_quickstart_hint')}</p>
        </div>
        <div className={styles.quickStartActions}>
          <Button size="sm" onClick={onEditDefaultRule}>
            {t('billing.rules_quickstart_edit_default')}
          </Button>
          <Button variant="secondary" size="sm" onClick={onEnableDefaultRule}>
            {t('billing.rules_quickstart_enable_default')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onScrollToDefaultRule}>
            {t('billing.rules_quickstart_view_default')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onScrollToEndpointRules}>
            {t('billing.rules_quickstart_view_endpoints')}
          </Button>
        </div>
      </div>
      <div className={styles.quickStartFooter}>{t('billing.model_prices_usage_note')}</div>
    </div>
  );
}

