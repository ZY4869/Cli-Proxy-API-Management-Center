import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { formatCompactNumber, formatUsd } from '@/utils/usage';
import type { BillingRuleV1 } from './types';
import { computeBillingCostForEnabledRule, formatTierLabel } from './utils/costing';
import styles from './BillingEndpointEditPage.module.scss';

export type CalculatorCardProps = {
  rule: BillingRuleV1 | null;
  parseError?: string;
};

export function CalculatorCard({ rule, parseError }: CalculatorCardProps) {
  const { t } = useTranslation();
  const [promptTokens, setPromptTokens] = useState('1000');
  const [outputTokens, setOutputTokens] = useState('200');
  const [reasoningTokens, setReasoningTokens] = useState('0');
  const [cachedTokens, setCachedTokens] = useState('0');

  const computed = useMemo(() => {
    if (!rule) return null;
    const tokens = {
      inputTokens: Number(promptTokens) || 0,
      outputTokens: Number(outputTokens) || 0,
      reasoningTokens: Number(reasoningTokens) || 0,
      cachedTokens: Number(cachedTokens) || 0,
    };
    return computeBillingCostForEnabledRule({ ...rule, enabled: true }, tokens);
  }, [cachedTokens, outputTokens, promptTokens, reasoningTokens, rule]);

  return (
    <Card title={t('billing.calculator_title')}>
      {parseError ? (
        <div className={styles.dangerHint}>{parseError}</div>
      ) : null}

      <div className={styles.calculatorGrid}>
        <Input
          label={t('billing.calculator_prompt_tokens')}
          type="number"
          value={promptTokens}
          onChange={(e) => setPromptTokens(e.target.value)}
          step="1"
        />
        <Input
          label={t('billing.calculator_output_tokens')}
          type="number"
          value={outputTokens}
          onChange={(e) => setOutputTokens(e.target.value)}
          step="1"
        />
        <Input
          label={t('billing.calculator_reasoning_tokens')}
          type="number"
          value={reasoningTokens}
          onChange={(e) => setReasoningTokens(e.target.value)}
          step="1"
        />
        <Input
          label={t('billing.calculator_cached_tokens')}
          type="number"
          value={cachedTokens}
          onChange={(e) => setCachedTokens(e.target.value)}
          step="1"
        />
      </div>

      {!computed ? (
        <div className={styles.hint}>{t('billing.calculator_no_rule')}</div>
      ) : (
        <>
          <div className={styles.row}>
            <span className={styles.rowLabel}>{t('billing.calculator_tier_hit')}</span>
            <span className={`${styles.mono} ${styles.hint}`}>{formatTierLabel(computed.tier)}</span>
          </div>

          <div className={styles.breakdownGrid}>
            <div className={styles.breakdownItem}>
              <div className={styles.breakdownLabel}>{t('billing.total_cost')}</div>
              <div className={styles.breakdownValue}>{formatUsd(computed.breakdown.totalCost)}</div>
              <div className={styles.breakdownSub}>
                input:{formatCompactNumber(computed.breakdown.inputNonCached)} / output:{formatCompactNumber(computed.breakdown.outputBillable)}
              </div>
            </div>
            <div className={styles.breakdownItem}>
              <div className={styles.breakdownLabel}>{t('billing.input_cost')}</div>
              <div className={styles.breakdownValue}>{formatUsd(computed.breakdown.inputCost)}</div>
              <div className={styles.breakdownSub}>
                nonCached:{formatCompactNumber(computed.breakdown.inputNonCached)}
              </div>
            </div>
            <div className={styles.breakdownItem}>
              <div className={styles.breakdownLabel}>{t('billing.output_cost')}</div>
              <div className={styles.breakdownValue}>{formatUsd(computed.breakdown.outputCost)}</div>
              <div className={styles.breakdownSub}>
                billable:{formatCompactNumber(computed.breakdown.outputBillable)}
              </div>
            </div>
            <div className={styles.breakdownItem}>
              <div className={styles.breakdownLabel}>{t('billing.cache_read_cost')}</div>
              <div className={styles.breakdownValue}>{formatUsd(computed.breakdown.cacheReadCost)}</div>
              <div className={styles.breakdownSub}>
                cached:{formatCompactNumber(computed.breakdown.cacheRead)}
              </div>
            </div>
            <div className={styles.breakdownItem}>
              <div className={styles.breakdownLabel}>{t('billing.cache_storage_cost')}</div>
              <div className={styles.breakdownValue}>{formatUsd(computed.breakdown.cacheStorageCost)}</div>
              <div className={styles.breakdownSub}>
                token-hours:{formatCompactNumber(computed.breakdown.cacheStorageTokenHours)}
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

