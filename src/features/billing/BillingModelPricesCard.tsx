import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useModelPriceModels, type ModelListSource } from './modelPrices/useModelPriceModels';
import type { ModelPricingTierV1, ModelPricingV1 } from './modelPricing/types';
import { useModelPricingStore } from './modelPricing/useModelPricingStore';
import { formatTierLabel } from './modelPricing/costing';
import styles from './BillingModelPricesCard.module.scss';

type ModelRow = {
  name: string;
  alias?: string;
  description?: string;
  configured: boolean;
  pricing: ModelPricingV1 | null;
};

const toNonNegative = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(num, 0);
};

const sortTiers = (tiers: ModelPricingTierV1[]) =>
  [...tiers].sort((a, b) => {
    const maxA = a.maxPromptTokens === null ? Number.POSITIVE_INFINITY : toNonNegative(a.maxPromptTokens);
    const maxB = b.maxPromptTokens === null ? Number.POSITIVE_INFINITY : toNonNegative(b.maxPromptTokens);
    return maxA !== maxB ? maxA - maxB : formatTierLabel(a).localeCompare(formatTierLabel(b));
  });

const buildPricingMeta = (t: (key: string) => string, pricing: ModelPricingV1 | null) => {
  if (!pricing) return null;
  const symbol = String(pricing.currencySymbol ?? '').trim() || '$';
  const tiers = sortTiers(Array.isArray(pricing.tiers) ? pricing.tiers : []);
  const isFlat = tiers.length === 1 && tiers[0]?.maxPromptTokens === null;
  const cacheLabel =
    pricing.cachePer1M === undefined
      ? t('billing.model_pricing_cache_follow')
      : `${symbol}${toNonNegative(pricing.cachePer1M).toFixed(4)}/1M`;

  return (
    <div className={styles.priceMeta}>
      <span>
        <span className={styles.priceLabel}>{t('billing.model_pricing_currency_symbol')}:</span>
        {symbol}
      </span>
      <span>
        <span className={styles.priceLabel}>{t('billing.model_pricing_cache_per_1m')}:</span>
        {cacheLabel}
      </span>
      <span>
        <span className={styles.priceLabel}>{t('billing.tiers')}:</span>
        {tiers.length}
      </span>
      {isFlat && tiers[0] ? (
        <>
          <span>
            <span className={styles.priceLabel}>{t('billing.model_pricing_prompt_per_1m')}:</span>
            {symbol}
            {toNonNegative(tiers[0].promptPer1M).toFixed(4)}/1M
          </span>
          <span>
            <span className={styles.priceLabel}>{t('billing.model_pricing_completion_per_1m')}:</span>
            {symbol}
            {toNonNegative(tiers[0].completionPer1M).toFixed(4)}/1M
          </span>
        </>
      ) : null}
    </div>
  );
};

const resolveSourceLabelKey = (source: ModelListSource) =>
  source === 'models' ? 'billing.model_prices_source_models' : 'billing.model_prices_source_usage';

export function BillingModelPricesCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { models, source, loading, error, refresh } = useModelPriceModels();
  const pricingByModel = useModelPricingStore((s) => s.pricingByModel);

  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  const modelSet = useMemo(
    () => new Set(models.map((m) => String(m.name ?? '').trim()).filter(Boolean)),
    [models]
  );

  const rows = useMemo((): ModelRow[] => {
    const q = query.trim().toLowerCase();
    const list = models
      .map((model) => {
        const name = String(model.name ?? '').trim();
        if (!name) return null;
        const pricing = pricingByModel[name] ?? null;
        const row: ModelRow = {
          name,
          alias: model.alias,
          description: model.description,
          configured: Boolean(pricing),
          pricing,
        };
        return row;
      })
      .filter(Boolean) as ModelRow[];

    const filtered = list.filter((row) => {
      if (q) {
        const hay = `${row.name} ${row.alias ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (onlyMissing && row.configured) return false;
      return true;
    });

    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [models, onlyMissing, pricingByModel, query]);

  const configuredCount = useMemo(() => rows.filter((row) => row.configured).length, [rows]);
  const missingCount = useMemo(() => rows.length - configuredCount, [rows, configuredCount]);

  const orphanPriceModels = useMemo(
    () =>
      Object.keys(pricingByModel)
        .filter((modelName) => modelName && !modelSet.has(modelName))
        .sort((a, b) => a.localeCompare(b)),
    [pricingByModel, modelSet]
  );

  const subtitle = useMemo(() => {
    const sourceLabelKey = resolveSourceLabelKey(source);
    return `${t(sourceLabelKey)} · ${t('billing.model_prices_usage_note')}`;
  }, [source, t]);

  return (
    <Card
      title={t('billing.model_prices_title')}
      subtitle={t('billing.model_prices_subtitle')}
      extra={
        <div className={styles.rowActions}>
          <Button variant="secondary" size="sm" onClick={() => void refresh(true)} loading={loading}>
            {t('common.refresh')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/billing/models')}>
            {t('billing.model_prices')}
          </Button>
        </div>
      }
    >
      <div className={styles.intro}>
        <div className={styles.mutedHint}>{subtitle}</div>
      </div>

      <div className={styles.filtersRow}>
        <div className={styles.search}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('billing.model_prices_search_placeholder')}
            aria-label={t('billing.model_prices_search_placeholder')}
          />
        </div>
        <ToggleSwitch
          checked={onlyMissing}
          onChange={setOnlyMissing}
          label={t('billing.model_prices_only_missing')}
          ariaLabel={t('billing.model_prices_only_missing')}
        />
        <div className={styles.counts} aria-live="polite">
          <span className={styles.countItem}>{t('billing.model_prices_count_total', { count: rows.length })}</span>
          <span className={styles.countItem}>
            {t('billing.model_prices_count_configured', { count: configuredCount })}
          </span>
          <span className={styles.countItem}>{t('billing.model_prices_count_missing', { count: missingCount })}</span>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {models.length === 0 && orphanPriceModels.length === 0 ? (
        <div className="hint">{t('billing.model_prices_empty_models')}</div>
      ) : rows.length === 0 ? (
        <div className="hint">{t('billing.model_prices_no_results')}</div>
      ) : (
        <div className={styles.modelsListWrap}>
          <div className={styles.modelsList}>
            <div className={styles.modelHeader} aria-hidden="true">
              <div>{t('usage_stats.model_name')}</div>
              <div>{t('usage_stats.model_price_settings')}</div>
              <div>{t('billing.filter_status')}</div>
              <div />
            </div>
            {rows.map((row) => (
              <div key={row.name} className={styles.modelRow}>
                <div className={styles.modelName} title={row.description || row.name}>
                  <div className={styles.modelNameMain}>{row.name}</div>
                  {row.alias ? <div className={styles.modelNameSub}>{row.alias}</div> : null}
                </div>
                <div>{buildPricingMeta(t, row.pricing) ?? '--'}</div>
                <span
                  className={`${styles.statusBadge} ${row.configured ? styles.statusConfigured : styles.statusMissing}`}
                >
                  {row.configured ? t('billing.model_prices_configured') : t('billing.model_prices_missing')}
                </span>
                <div className={styles.rowActions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/billing/models?model=${encodeURIComponent(row.name)}`)}
                  >
                    {t('common.edit')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {orphanPriceModels.length > 0 ? (
        <>
          <div className={styles.sectionDivider} />
          <h3 className={styles.sectionTitle}>{t('billing.model_prices_orphans_title')}</h3>
          <p className={styles.sectionSubtitle}>{t('billing.model_prices_orphans_subtitle')}</p>
          <div className={styles.modelsListWrap}>
            <div className={styles.modelsList}>
              <div className={styles.modelHeader} aria-hidden="true">
                <div>{t('usage_stats.model_name')}</div>
                <div>{t('usage_stats.model_price_settings')}</div>
                <div>{t('billing.filter_status')}</div>
                <div />
              </div>
              {orphanPriceModels.map((modelName) => {
                const pricing = pricingByModel[modelName] ?? null;
                return (
                  <div key={modelName} className={styles.modelRow}>
                    <div className={styles.modelName} title={modelName}>
                      <div className={styles.modelNameMain}>{modelName}</div>
                      <div className={styles.modelNameSub}>{t('billing.model_prices_orphan_tag')}</div>
                    </div>
                    <div>{buildPricingMeta(t, pricing) ?? '--'}</div>
                    <span className={`${styles.statusBadge} ${styles.statusConfigured}`}>
                      {t('billing.model_prices_configured')}
                    </span>
                    <div className={styles.rowActions}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/billing/models?model=${encodeURIComponent(modelName)}`)}
                      >
                        {t('common.edit')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </Card>
  );
}
