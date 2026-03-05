export type CurrencySymbol = string;

export type ModelPricingTierV1 = {
  maxPromptTokens: number | null; // null = Infinity
  promptPer1M: number; // currency per 1M prompt tokens (non-cached portion)
  completionPer1M: number; // currency per 1M completion tokens (includes reasoning tokens)
  label?: string;
};

export type ModelPricingV1 = {
  currencySymbol: CurrencySymbol;
  cachePer1M?: number; // optional; when missing, falls back to selected tier's promptPer1M
  tiers: ModelPricingTierV1[];
};

export type ModelPricingExportV1 = {
  version: 1;
  exportedAt: string; // ISO string
  models: Record<string, ModelPricingV1>;
};

