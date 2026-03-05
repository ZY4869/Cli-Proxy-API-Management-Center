import { create } from 'zustand';
import type { ModelPricingExportV1, ModelPricingV1 } from './types';
import { loadModelPricingMap, saveModelPricingMap } from './storage';
import { parseModelPricingExportV1, parseModelPricingV1 } from './schema';

type ModelPricingStoreState = {
  pricingByModel: Record<string, ModelPricingV1>;
  setPricingForModel: (modelName: string, pricing: unknown) => void;
  removePricingForModel: (modelName: string) => void;
  replaceAll: (pricingByModel: Record<string, ModelPricingV1>) => void;
  reload: () => void;
  exportJson: () => ModelPricingExportV1;
  importJsonMergeOverwrite: (payload: unknown) => { importedModels: number };
};

export const useModelPricingStore = create<ModelPricingStoreState>()((set, get) => ({
  pricingByModel: loadModelPricingMap(),

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

  exportJson: () => {
    const state = get();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      models: state.pricingByModel,
    };
  },

  importJsonMergeOverwrite: (payload) => {
    const parsed = parseModelPricingExportV1(payload);
    const incoming = parsed.models ?? {};
    const importedModels = Object.keys(incoming).length;
    const next = { ...get().pricingByModel, ...incoming };
    saveModelPricingMap(next);
    set({ pricingByModel: next });
    return { importedModels };
  },
}));

