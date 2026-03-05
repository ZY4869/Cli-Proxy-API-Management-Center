import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SecondaryScreenShell } from '@/components/common/SecondaryScreenShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useNotificationStore } from '@/stores';
import type { ModelPricingV1 } from './modelPricing/types';
import { useModelPricingStore } from './modelPricing/useModelPricingStore';
import { useModelPriceModels } from './modelPrices/useModelPriceModels';
import { ModelPricingEditModal } from './ModelPricingEditModal';
import styles from './BillingModelPricesPage.module.scss';

type ModelRow = {
  name: string;
  alias?: string;
  description?: string;
  pricing: ModelPricingV1 | null;
  configured: boolean;
};

const toNonNegative = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(num, 0);
};

const formatPricingSummary = (pricing: ModelPricingV1 | null): string => {
  if (!pricing) return '--';
  const symbol = String(pricing.currencySymbol ?? '').trim() || '$';
  const tiers = Array.isArray(pricing.tiers) ? pricing.tiers : [];
  const cache = pricing.cachePer1M;
  const cacheLabel = cache === undefined ? 'cache:follow' : `cache:${toNonNegative(cache).toFixed(4)}`;
  if (tiers.length === 1 && tiers[0]?.maxPromptTokens === null) {
    const t0 = tiers[0];
    return `${symbol} flat in:${toNonNegative(t0.promptPer1M).toFixed(4)} out:${toNonNegative(t0.completionPer1M).toFixed(4)} ${cacheLabel}`;
  }
  return `${symbol} tiers:${tiers.length} ${cacheLabel}`;
};

export function BillingModelPricesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const { models, source, loading: modelsLoading, error: modelsError, refresh } = useModelPriceModels();
  const pricingByModel = useModelPricingStore((s) => s.pricingByModel);
  const setPricingForModel = useModelPricingStore((s) => s.setPricingForModel);
  const removePricingForModel = useModelPricingStore((s) => s.removePricingForModel);

  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [editModel, setEditModel] = useState<string | null>(null);

  const rows = useMemo((): ModelRow[] => {
    const q = query.trim().toLowerCase();
    const list = models
      .map((model) => {
        const name = String(model.name ?? '').trim();
        if (!name) return null;
        const pricing = pricingByModel[name] ?? null;
        return {
          name,
          alias: model.alias,
          description: model.description,
          pricing,
          configured: Boolean(pricing),
        } satisfies ModelRow;
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

  const orphanPriceModels = useMemo(() => {
    const availableSet = new Set(models.map((m) => String(m.name ?? '').trim()).filter(Boolean));
    return Object.keys(pricingByModel)
      .filter((modelName) => modelName && !availableSet.has(modelName))
      .sort((a, b) => a.localeCompare(b));
  }, [models, pricingByModel]);

  const openEdit = useCallback(
    (modelName: string) => {
      setEditModel(modelName);
    },
    []
  );

  const clearModelSearchParam = useCallback(() => {
    if (!searchParams.get('model')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('model');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const fromQuery = searchParams.get('model');
    if (!fromQuery) return;
    if (editModel) return;
    openEdit(fromQuery);
  }, [editModel, openEdit, searchParams]);

  const subtitle = useMemo(() => {
    const hasModels = models.length > 0;
    const sourceLabel = source === 'models' ? t('billing.model_prices_source_models') : t('billing.model_prices_source_usage');
    if (!hasModels) return t('billing.model_prices_empty_models');
    return sourceLabel;
  }, [models.length, source, t]);

  return (
    <SecondaryScreenShell
      title={t('billing.model_prices_title')}
      onBack={() => navigate('/billing')}
      backLabel={t('common.back')}
      rightAction={
        <Button variant="secondary" size="sm" onClick={() => void refresh(true)} loading={modelsLoading}>
          {t('common.refresh')}
        </Button>
      }
    >
      <div className={styles.intro}>
        <div>{t('billing.model_prices_subtitle')}</div>
        <div className={styles.mutedHint}>{subtitle}</div>
      </div>

      <Card title={t('billing.model_prices_filters')}>
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
            <span className={styles.countItem}>
              {t('billing.model_prices_count_total', { count: rows.length })}
            </span>
            <span className={styles.countItem}>
              {t('billing.model_prices_count_configured', { count: configuredCount })}
            </span>
            <span className={styles.countItem}>
              {t('billing.model_prices_count_missing', { count: missingCount })}
            </span>
          </div>
        </div>

        {modelsError && <div className="error-box">{modelsError}</div>}
      </Card>

      <Card title={t('billing.model_prices_models_title')} subtitle={t('billing.model_prices_models_subtitle')}>
        {modelsLoading ? (
          <div className="hint">{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="hint">{t('billing.model_prices_empty_models')}</div>
        ) : (
            <div className={styles.modelsList}>
              <div className={styles.modelHeader} aria-hidden="true">
                <div>{t('usage_stats.model_name')}</div>
                <div>{t('usage_stats.model_price_settings')}</div>
                <div>{t('billing.filter_status')}</div>
                <div />
              </div>
              {rows.map((row) => (
                <div key={row.name} className={styles.modelRow}>
                  <div className={styles.modelName}>
                    <div className={styles.modelNameMain} title={row.name}>
                      {row.name}
                    </div>
                    {row.alias ? (
                      <div className={styles.modelNameSub} title={row.alias}>
                        {row.alias}
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.priceSummary}>
                    {formatPricingSummary(row.pricing)}
                  </div>
                <span
                  className={`${styles.statusBadge} ${row.configured ? styles.statusConfigured : styles.statusMissing}`}
                >
                  {row.configured ? t('billing.model_prices_configured') : t('billing.model_prices_missing')}
                </span>
                <div className={styles.rowActions}>
                  <Button variant="secondary" size="sm" onClick={() => openEdit(row.name)}>
                    {t('common.edit')}
                  </Button>
                </div>
                </div>
              ))}
            </div>
          )}
      </Card>

      {orphanPriceModels.length > 0 ? (
        <Card title={t('billing.model_prices_orphans_title')} subtitle={t('billing.model_prices_orphans_subtitle')}>
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
                  <div className={styles.modelName}>
                    <div className={styles.modelNameMain} title={modelName}>
                      {modelName}
                    </div>
                    <div className={styles.modelNameSub}>{t('billing.model_prices_orphan_tag')}</div>
                  </div>
                  <div className={styles.priceSummary}>
                    {formatPricingSummary(pricing)}
                  </div>
                  <span className={`${styles.statusBadge} ${styles.statusConfigured}`}>
                    {t('billing.model_prices_configured')}
                  </span>
                  <div className={styles.rowActions}>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(modelName)}>
                      {t('common.edit')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <ModelPricingEditModal
        open={editModel !== null}
        modelName={editModel ?? ''}
        initialPricing={editModel ? pricingByModel[editModel] ?? null : null}
        onClose={() => {
          setEditModel(null);
          clearModelSearchParam();
        }}
        onDelete={() => {
          if (!editModel) return;
          removePricingForModel(editModel);
          setEditModel(null);
          clearModelSearchParam();
          showNotification(t('billing.model_prices_deleted'), 'success');
        }}
        onSave={(pricing) => {
          if (!editModel) return;
          setPricingForModel(editModel, pricing);
          setEditModel(null);
          clearModelSearchParam();
          showNotification(t('billing.model_prices_saved'), 'success');
        }}
      />
    </SecondaryScreenShell>
  );
}
