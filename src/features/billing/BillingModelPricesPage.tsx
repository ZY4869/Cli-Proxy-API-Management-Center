import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SecondaryScreenShell } from '@/components/common/SecondaryScreenShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { apiKeysApi } from '@/services/api';
import { useAuthStore, useConfigStore, useModelsStore, useNotificationStore } from '@/stores';
import { getModelNamesFromUsage, loadModelPrices, saveModelPrices, type ModelPrice } from '@/utils/usage';
import type { ModelInfo } from '@/utils/models';
import { useUsageStatsStore } from '@/stores/useUsageStatsStore';
import styles from './BillingModelPricesPage.module.scss';

const normalizeApiKeyList = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const keys: string[] = [];

  input.forEach((item) => {
    const record =
      item !== null && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : null;
    const value =
      typeof item === 'string' ? item : record ? (record['api-key'] ?? record['apiKey'] ?? record.key ?? record.Key) : '';
    const trimmed = String(value ?? '').trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    keys.push(trimmed);
  });

  return keys;
};

type ModelRow = {
  name: string;
  alias?: string;
  description?: string;
  price: ModelPrice | null;
  configured: boolean;
};

export function BillingModelPricesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showNotification = useNotificationStore((state) => state.showNotification);

  const apiBase = useAuthStore((state) => state.apiBase);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const config = useConfigStore((state) => state.config);

  const models = useModelsStore((state) => state.models);
  const modelsLoading = useModelsStore((state) => state.loading);
  const modelsError = useModelsStore((state) => state.error);
  const fetchModels = useModelsStore((state) => state.fetchModels);

  const usage = useUsageStatsStore((state) => state.usage);

  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [modelPrices, setModelPrices] = useState<Record<string, ModelPrice>>(() => loadModelPrices());

  const [editModel, setEditModel] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editCompletion, setEditCompletion] = useState('');
  const [editCache, setEditCache] = useState('');

  const apiKeysCacheRef = useRef<string[]>([]);

  const persistPrices = useCallback((next: Record<string, ModelPrice>) => {
    setModelPrices(next);
    saveModelPrices(next);
  }, []);

  const resolveApiKeysForModels = useCallback(async () => {
    if (apiKeysCacheRef.current.length) {
      return apiKeysCacheRef.current;
    }

    const configKeys = normalizeApiKeyList(config?.apiKeys);
    if (configKeys.length) {
      apiKeysCacheRef.current = configKeys;
      return configKeys;
    }

    try {
      const list = await apiKeysApi.list();
      const normalized = normalizeApiKeyList(list);
      if (normalized.length) {
        apiKeysCacheRef.current = normalized;
      }
      return normalized;
    } catch {
      return [];
    }
  }, [config?.apiKeys]);

  const loadModels = useCallback(
    async (forceRefresh: boolean) => {
      if (connectionStatus !== 'connected' || !apiBase) {
        showNotification(t('notification.connection_required'), 'warning');
        return;
      }

      if (forceRefresh) {
        apiKeysCacheRef.current = [];
      }

      try {
        const apiKeys = await resolveApiKeysForModels();
        const primaryKey = apiKeys[0];
        await fetchModels(apiBase, primaryKey, forceRefresh);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
        showNotification(`${t('system_info.models_error')}${message ? `: ${message}` : ''}`, 'error');
      }
    },
    [apiBase, connectionStatus, fetchModels, resolveApiKeysForModels, showNotification, t]
  );

  useEffect(() => {
    void loadModels(false);
  }, [loadModels]);

  const usageFallbackModels = useMemo((): ModelInfo[] => {
    const names = getModelNamesFromUsage(usage);
    return names.map((name) => ({ name }));
  }, [usage]);

  const resolvedModels = useMemo(() => {
    if (models.length > 0) return models;
    return usageFallbackModels;
  }, [models, usageFallbackModels]);

  const rows = useMemo((): ModelRow[] => {
    const q = query.trim().toLowerCase();
    const list = resolvedModels
      .map((model) => {
        const name = String(model.name ?? '').trim();
        if (!name) return null;
        const price = modelPrices[name] ?? null;
        return {
          name,
          alias: model.alias,
          description: model.description,
          price,
          configured: Boolean(price),
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
  }, [modelPrices, onlyMissing, query, resolvedModels]);

  const configuredCount = useMemo(() => rows.filter((row) => row.configured).length, [rows]);
  const missingCount = useMemo(() => rows.length - configuredCount, [rows, configuredCount]);

  const orphanPriceModels = useMemo(() => {
    const availableSet = new Set(resolvedModels.map((m) => String(m.name ?? '').trim()).filter(Boolean));
    return Object.keys(modelPrices)
      .filter((modelName) => modelName && !availableSet.has(modelName))
      .sort((a, b) => a.localeCompare(b));
  }, [modelPrices, resolvedModels]);

  const openEdit = useCallback(
    (modelName: string) => {
      const price = modelPrices[modelName];
      setEditModel(modelName);
      setEditPrompt(price?.prompt?.toString() ?? '');
      setEditCompletion(price?.completion?.toString() ?? '');
      setEditCache(price?.cache?.toString() ?? '');
    },
    [modelPrices]
  );

  const handleSaveEdit = useCallback(() => {
    if (!editModel) return;
    const prompt = Number.parseFloat(editPrompt) || 0;
    const completion = Number.parseFloat(editCompletion) || 0;
    const cache = editCache.trim() === '' ? prompt : Number.parseFloat(editCache) || 0;
    const next = { ...modelPrices, [editModel]: { prompt, completion, cache } };
    persistPrices(next);
    setEditModel(null);
    showNotification(t('billing.model_prices_saved'), 'success');
  }, [editCache, editCompletion, editModel, editPrompt, modelPrices, persistPrices, showNotification, t]);

  const handleDeletePrice = useCallback(
    (modelName: string) => {
      const next = { ...modelPrices };
      delete next[modelName];
      persistPrices(next);
      showNotification(t('billing.model_prices_deleted'), 'success');
    },
    [modelPrices, persistPrices, showNotification, t]
  );

  const subtitle = useMemo(() => {
    const hasModels = resolvedModels.length > 0;
    const sourceLabel =
      models.length > 0 ? t('billing.model_prices_source_models') : t('billing.model_prices_source_usage');
    if (!hasModels) return t('billing.model_prices_empty_models');
    return sourceLabel;
  }, [models.length, resolvedModels.length, t]);

  return (
    <SecondaryScreenShell
      title={t('billing.model_prices_title')}
      onBack={() => navigate('/billing')}
      backLabel={t('common.back')}
      rightAction={
        <Button variant="secondary" size="sm" onClick={() => void loadModels(true)} loading={modelsLoading}>
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
                  {row.price
                    ? `in:${row.price.prompt.toFixed(4)} out:${row.price.completion.toFixed(4)} cache:${row.price.cache.toFixed(4)}`
                    : '--'}
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
                  {row.configured ? (
                    <Button variant="danger" size="sm" onClick={() => handleDeletePrice(row.name)}>
                      {t('common.delete')}
                    </Button>
                  ) : null}
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
              const price = modelPrices[modelName];
              return (
                <div key={modelName} className={styles.modelRow}>
                  <div className={styles.modelName}>
                    <div className={styles.modelNameMain} title={modelName}>
                      {modelName}
                    </div>
                    <div className={styles.modelNameSub}>{t('billing.model_prices_orphan_tag')}</div>
                  </div>
                  <div className={styles.priceSummary}>
                    {price
                      ? `in:${price.prompt.toFixed(4)} out:${price.completion.toFixed(4)} cache:${price.cache.toFixed(4)}`
                      : '--'}
                  </div>
                  <span className={`${styles.statusBadge} ${styles.statusConfigured}`}>
                    {t('billing.model_prices_configured')}
                  </span>
                  <div className={styles.rowActions}>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(modelName)}>
                      {t('common.edit')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeletePrice(modelName)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Modal
        open={editModel !== null}
        title={editModel ?? ''}
        onClose={() => setEditModel(null)}
        width={520}
        footer={
          <div className={styles.rowActions}>
            <Button variant="secondary" onClick={() => setEditModel(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSaveEdit} disabled={!editModel}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className={styles.editModalBody}>
          <div className={styles.formField}>
            <label>{t('usage_stats.model_price_prompt')} ($/1M)</label>
            <Input
              type="number"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="0.00"
              step="0.0001"
            />
          </div>
          <div className={styles.formField}>
            <label>{t('usage_stats.model_price_completion')} ($/1M)</label>
            <Input
              type="number"
              value={editCompletion}
              onChange={(e) => setEditCompletion(e.target.value)}
              placeholder="0.00"
              step="0.0001"
            />
          </div>
          <div className={styles.formField}>
            <label>{t('usage_stats.model_price_cache')} ($/1M)</label>
            <Input
              type="number"
              value={editCache}
              onChange={(e) => setEditCache(e.target.value)}
              placeholder={t('billing.model_prices_cache_placeholder')}
              step="0.0001"
            />
            <div className={styles.mutedHint}>{t('billing.model_prices_cache_hint')}</div>
          </div>
        </div>
      </Modal>
    </SecondaryScreenShell>
  );
}
