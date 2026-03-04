import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BillingExportV1, BillingRuleV1, CostMode } from '../types';
import { normalizeEndpointKey } from '../utils/normalizeEndpoint';
import { parseBillingExportV1, parseBillingRuleV1 } from '../utils/schema';

const BILLING_RULES_STORAGE_KEY = 'cli-proxy-billing-rules-v1';
const COST_MODE_STORAGE_KEY = 'cli-proxy-cost-mode-v1';

const DEFAULT_RULE: BillingRuleV1 = {
  enabled: false,
  cacheStorageHours: 1,
  tiers: [
    {
      maxPromptTokens: null,
      inputPer1M: 0,
      outputPer1M: 0,
      cacheReadPer1M: 0,
      cacheStoragePer1MHour: 0,
    },
  ],
};

const loadCostMode = (): CostMode => {
  try {
    if (typeof localStorage === 'undefined') return 'model';
    const raw = localStorage.getItem(COST_MODE_STORAGE_KEY);
    return raw === 'endpoint' ? 'endpoint' : 'model';
  } catch {
    return 'model';
  }
};

const saveCostMode = (mode: CostMode) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(COST_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
};

type BillingStoreState = {
  costMode: CostMode;
  defaultRule: BillingRuleV1;
  endpointRules: Record<string, BillingRuleV1>;

  setCostMode: (mode: CostMode) => void;
  setDefaultRule: (rule: BillingRuleV1) => void;
  upsertEndpointRule: (endpointKey: string, rule: BillingRuleV1) => void;
  removeEndpointRule: (endpointKey: string) => void;
  resetEndpointRule: (endpointKey: string) => void;

  exportJson: () => BillingExportV1;
  importJsonMergeOverwrite: (payload: unknown) => { importedEndpoints: number };
};

export const useBillingStore = create<BillingStoreState>()(
  persist(
    (set, get) => ({
      costMode: loadCostMode(),
      defaultRule: DEFAULT_RULE,
      endpointRules: {},

      setCostMode: (mode) => {
        const next: CostMode = mode === 'endpoint' ? 'endpoint' : 'model';
        saveCostMode(next);
        set({ costMode: next });
      },

      setDefaultRule: (rule) => {
        set({ defaultRule: rule });
      },

      upsertEndpointRule: (endpointKey, rule) => {
        const normalized = normalizeEndpointKey(endpointKey);
        if (!normalized) return;
        set((state) => ({
          endpointRules: {
            ...state.endpointRules,
            [normalized]: rule,
          },
        }));
      },

      removeEndpointRule: (endpointKey) => {
        const normalized = normalizeEndpointKey(endpointKey);
        if (!normalized) return;
        set((state) => {
          const next = { ...state.endpointRules };
          delete next[normalized];
          return { endpointRules: next };
        });
      },

      resetEndpointRule: (endpointKey) => {
        get().removeEndpointRule(endpointKey);
      },

      exportJson: () => {
        const state = get();
        return {
          version: 1,
          exportedAt: new Date().toISOString(),
          costMode: state.costMode,
          defaultRule: state.defaultRule,
          endpointRules: state.endpointRules,
        };
      },

      importJsonMergeOverwrite: (payload) => {
        const parsed = parseBillingExportV1(payload);
        const endpoints = parsed.endpointRules ?? {};
        const importedEndpoints = Object.keys(endpoints).length;

        if (parsed.costMode) {
          saveCostMode(parsed.costMode);
          set({ costMode: parsed.costMode });
        }

        set((state) => ({
          defaultRule: parsed.defaultRule,
          endpointRules: {
            ...state.endpointRules,
            ...endpoints,
          },
        }));

        return { importedEndpoints };
      },
    }),
    {
      name: BILLING_RULES_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        defaultRule: state.defaultRule,
        endpointRules: state.endpointRules,
      }),
      merge: (persistedState, currentState) => {
        try {
          const persisted = persistedState as Record<string, unknown>;
          const defaultRule = parseBillingRuleV1(persisted?.defaultRule);
          const endpointRulesRaw = persisted?.endpointRules;
          const endpointRules: Record<string, BillingRuleV1> = {};

          if (endpointRulesRaw && typeof endpointRulesRaw === 'object') {
            Object.entries(endpointRulesRaw as Record<string, unknown>).forEach(([key, rule]) => {
              const normalized = normalizeEndpointKey(key);
              if (!normalized) return;
              endpointRules[normalized] = parseBillingRuleV1(rule);
            });
          }

          return {
            ...currentState,
            defaultRule,
            endpointRules,
          };
        } catch {
          return currentState;
        }
      },
    }
  )
);

