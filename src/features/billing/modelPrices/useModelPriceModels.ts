import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { apiKeysApi } from '@/services/api';
import { useAuthStore, useConfigStore, useModelsStore, useNotificationStore } from '@/stores';
import { getModelNamesFromUsage } from '@/utils/usage';
import type { ModelInfo } from '@/utils/models';
import { useUsageStatsStore } from '@/stores/useUsageStatsStore';

const normalizeApiKeyList = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const keys: string[] = [];

  input.forEach((item) => {
    const record =
      item !== null && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : null;
    const value =
      typeof item === 'string'
        ? item
        : record
          ? (record['api-key'] ?? record['apiKey'] ?? record.key ?? record.Key)
          : '';
    const trimmed = String(value ?? '').trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    keys.push(trimmed);
  });

  return keys;
};

export type ModelListSource = 'models' | 'usage';

export type UseModelPriceModelsResult = {
  models: ModelInfo[];
  source: ModelListSource;
  loading: boolean;
  error: string | null;
  refresh: (forceRefresh?: boolean) => Promise<void>;
};

export function useModelPriceModels(): UseModelPriceModelsResult {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);

  const apiBase = useAuthStore((state) => state.apiBase);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const configApiKeys = useConfigStore((state) => state.config?.apiKeys);
  const usage = useUsageStatsStore((state) => state.usage);

  const storeModels = useModelsStore((state) => state.models);
  const storeLoading = useModelsStore((state) => state.loading);
  const storeError = useModelsStore((state) => state.error);
  const fetchModels = useModelsStore((state) => state.fetchModels);

  const apiKeysCacheRef = useRef<string[]>([]);

  const resolveApiKeysForModels = useCallback(async () => {
    if (apiKeysCacheRef.current.length) {
      return apiKeysCacheRef.current;
    }

    const configKeys = normalizeApiKeyList(configApiKeys);
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
  }, [configApiKeys]);

  const doRefresh = useCallback(
    async (forceRefresh: boolean, notifyOnError: boolean) => {
      if (connectionStatus !== 'connected' || !apiBase) {
        if (notifyOnError) {
          showNotification(t('notification.connection_required'), 'warning');
        }
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
        if (!notifyOnError) return;
        const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
        showNotification(`${t('system_info.models_error')}${message ? `: ${message}` : ''}`, 'error');
      }
    },
    [apiBase, connectionStatus, fetchModels, resolveApiKeysForModels, showNotification, t]
  );

  useEffect(() => {
    void doRefresh(false, false);
  }, [doRefresh]);

  const usageFallbackModels = useMemo((): ModelInfo[] => {
    const names = getModelNamesFromUsage(usage);
    return names.map((name) => ({ name }));
  }, [usage]);

  const resolved = useMemo(() => {
    if (storeModels.length > 0) return storeModels;
    return usageFallbackModels;
  }, [storeModels, usageFallbackModels]);

  const source: ModelListSource = storeModels.length > 0 ? 'models' : 'usage';

  return {
    models: resolved,
    source,
    loading: storeLoading,
    error: storeError,
    refresh: async (forceRefresh = true) => doRefresh(forceRefresh, true),
  };
}

