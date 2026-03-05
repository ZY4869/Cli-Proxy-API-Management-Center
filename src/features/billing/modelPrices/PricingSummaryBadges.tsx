import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelPricingTierV1, ModelPricingV1 } from '../modelPricing/types';
import styles from '../BillingModelPricesPage.module.scss';

const toNonNegative = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(num, 0);
};

const sortTiers = (tiers: ModelPricingTierV1[]) =>
  [...tiers].sort((a, b) => {
    const maxA = a.maxPromptTokens === null ? Number.POSITIVE_INFINITY : toNonNegative(a.maxPromptTokens);
    const maxB = b.maxPromptTokens === null ? Number.POSITIVE_INFINITY : toNonNegative(b.maxPromptTokens);
    return maxA - maxB;
  });

export type PricingSummaryBadgesProps = {
  pricing: ModelPricingV1 | null;
};

export function PricingSummaryBadges({ pricing }: PricingSummaryBadgesProps) {
  const { t } = useTranslation();

  const meta = useMemo(() => {
    if (!pricing) return null;
    const symbol = String(pricing.currencySymbol ?? '').trim() || '$';
    const tiers = sortTiers(Array.isArray(pricing.tiers) ? pricing.tiers : []);
    const isFlat = tiers.length === 1 && tiers[0]?.maxPromptTokens === null;
    const infinityTier = tiers.find((tier) => tier.maxPromptTokens === null) ?? tiers[0] ?? null;
    const cacheLabel =
      pricing.cachePer1M === undefined
        ? t('billing.pricing_cache_follow_short', { defaultValue: '随输入' })
        : `${toNonNegative(pricing.cachePer1M).toFixed(4)}/1M`;

    return {
      symbol,
      tiersCount: tiers.length,
      isFlat,
      promptPer1M: infinityTier ? toNonNegative(infinityTier.promptPer1M).toFixed(4) : null,
      completionPer1M: infinityTier ? toNonNegative(infinityTier.completionPer1M).toFixed(4) : null,
      cacheLabel,
      cacheIsFollow: pricing.cachePer1M === undefined,
    };
  }, [pricing, t]);

  if (!meta) return <span className={styles.priceEmpty}>--</span>;

  return (
    <div className={styles.priceBadges}>
      <span className={`${styles.priceBadge} ${styles.priceBadgeCurrency}`}>{meta.symbol}</span>
      <span className={`${styles.priceBadge} ${styles.priceBadgeType}`}>
        {meta.isFlat
          ? t('billing.pricing_flat', { defaultValue: '固定' })
          : t('billing.pricing_tiers', { count: meta.tiersCount, defaultValue: `阶梯 ${meta.tiersCount}` })}
      </span>

      {meta.isFlat ? (
        <>
          <span className={`${styles.priceBadge} ${styles.priceBadgePrompt}`}>
            {t('billing.pricing_prompt', { defaultValue: '提示' })} {meta.promptPer1M}/1M
          </span>
          <span className={`${styles.priceBadge} ${styles.priceBadgeCompletion}`}>
            {t('billing.pricing_completion', { defaultValue: '补全' })} {meta.completionPer1M}/1M
          </span>
        </>
      ) : null}

      <span
        className={`${styles.priceBadge} ${styles.priceBadgeCache} ${
          meta.cacheIsFollow ? styles.priceBadgeCacheFollow : ''
        }`}
      >
        {t('billing.pricing_cache', { defaultValue: '缓存' })} {meta.cacheLabel}
      </span>
    </div>
  );
}

