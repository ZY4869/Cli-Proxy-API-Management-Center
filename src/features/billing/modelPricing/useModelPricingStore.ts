import { create } from 'zustand';
import type { ModelPricingExportV1, ModelPricingExportV2, ModelPricingV1 } from './types';
import { loadModelPricingMap, saveModelPricingMap } from './storage';
import { parseModelPricingExportV1, parseModelPricingV1 } from './schema';
import { loadDefaultCurrencySymbol, saveDefaultCurrencySymbol } from './defaultCurrency';
import { buildModelPricingTemplateExportV2, parseModelPricingExportV2Lenient } from './templateExport';

type ModelPricingStoreState = {
  pricingByModel: Record<string, ModelPricingV1>;
  defaultCurrencySymbol: string;
  setPricingForModel: (modelName: string, pricing: unknown) => void;
  removePricingForModel: (modelName: string) => void;
  replaceAll: (pricingByModel: Record<string, ModelPricingV1>) => void;
  reload: () => void;
  setDefaultCurrencySymbol: (symbol: string) => void;
  exportJson: () => ModelPricingExportV1;
  exportTemplateJson: (modelNames: string[]) => ModelPricingExportV2;
  importJsonMergeOverwrite: (payload: unknown) => { importedModels: number; skippedModels: number; invalidModels: string[] };
};

export const useModelPricingStore = create<ModelPricingStoreState>()((set, get) => ({
  pricingByModel: loadModelPricingMap(),
  defaultCurrencySymbol: loadDefaultCurrencySymbol(),

  setPricingForModel: (modelName, pricing) => {
    const name = String(modelName ?? '').trim();
    if (!name) return;
    const parsed = parseModelPricingV1(pricing);
    const next = { ...get().pricingByModel, [name]: parsed };
    saveModelPricingMap(next);
    set({ pricingByModel: next });
  },

  removePricingForModel: (modelName) => {
    const name = String(modelName ?? '').trim();
    if (!name) return;
    set((state) => {
      const next = { ...state.pricingByModel };
      delete next[name];
      saveModelPricingMap(next);
      return { pricingByModel: next };
    });
  },

  replaceAll: (pricingByModel) => {
    saveModelPricingMap(pricingByModel);
    set({ pricingByModel });
  },

  reload: () => {
    set({ pricingByModel: loadModelPricingMap() });
  },

  setDefaultCurrencySymbol: (symbol) => {
    const safe = String(symbol ?? '').trim();
    saveDefaultCurrencySymbol(safe);
    set({ defaultCurrencySymbol: loadDefaultCurrencySymbol() });
  },

  exportJson: () => {
    const state = get();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      models: state.pricingByModel,
    };
  },

  exportTemplateJson: (modelNames) => {
    const state = get();
    return buildModelPricingTemplateExportV2({
      modelNames: Array.isArray(modelNames) ? modelNames : [],
      pricingByModel: state.pricingByModel,
      defaultCurrencySymbol: state.defaultCurrencySymbol,
      exportedAt: new Date().toISOString(),
    });
  },

  importJsonMergeOverwrite: (payload) => {
    const version = payload !== null && typeof payload === 'object' && (payload as any).version;
    const resolved = version === 2 ? parseModelPricingExportV2Lenient(payload) : null;

    const incoming = resolved ? resolved.models : parseModelPricingExportV1(payload).models ?? {};
    const importedModels = Object.keys(incoming).length;
    const skippedModels = resolved ? resolved.skippedModels : 0;
    const invalidModels = resolved ? resolved.invalidModels : [];

    const next = { ...get().pricingByModel, ...incoming };
    saveModelPricingMap(next);
    set({ pricingByModel: next });
    return { importedModels, skippedModels, invalidModels };
  },
}));
