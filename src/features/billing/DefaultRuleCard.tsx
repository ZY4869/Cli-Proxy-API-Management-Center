import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { formatTierLabel } from './utils/costing';
import type { BillingRuleV1 } from './types';
import styles from './BillingPage.module.scss';

export type DefaultRuleCardProps = {
  rule: BillingRuleV1;
  onRuleChange: (next: BillingRuleV1) => void;
  onEdit: () => void;
};

export function DefaultRuleCard({ rule, onRuleChange, onEdit }: DefaultRuleCardProps) {
  const { t } = useTranslation();

  const tiersSummary = useMemo(() => {
    const tiers = Array.isArray(rule.tiers) ? rule.tiers : [];
    return tiers.map((tier, index) => ({
      id: `${index}-${tier.maxPromptTokens === null ? 'inf' : tier.maxPromptTokens}`,
      label: formatTierLabel(tier),
      meta: `in:${tier.inputPer1M}/1M  out:${tier.outputPer1M}/1M  cR:${tier.cacheReadPer1M}/1M  cS:${tier.cacheStoragePer1MHour}/1M/h`,
    }));
  }, [rule.tiers]);

  return (
    <Card
      title={t('billing.default_rule')}
      extra={
        <Button variant="secondary" size="sm" onClick={onEdit}>
          {t('common.edit')}
        </Button>
      }
    >
      <div className={styles.rulesSummary}>
        <div className={styles.ruleRow}>
          <span className={styles.ruleRowLabel}>{t('billing.rule_enabled')}</span>
          <ToggleSwitch
            checked={rule.enabled}
            onChange={(enabled) => onRuleChange({ ...rule, enabled })}
            ariaLabel={t('billing.rule_enabled')}
          />
        </div>
        <div className={styles.ruleRow}>
          <span className={styles.ruleRowLabel}>{t('billing.cache_storage_hours')}</span>
          <span className={styles.ruleRowValueMono}>{rule.cacheStorageHours}h</span>
        </div>

        <div className={styles.tierList}>
          {tiersSummary.map((tier) => (
            <div key={tier.id} className={styles.tierItem}>
              <div className={styles.tierLabel}>{tier.label}</div>
              <div className={styles.tierMeta}>{tier.meta}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

