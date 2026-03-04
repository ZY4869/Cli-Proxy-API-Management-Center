export type CostMode = 'model' | 'endpoint';

export type BillingTierV1 = {
  maxPromptTokens: number | null; // null = Infinity
  inputPer1M: number; // USD
  outputPer1M: number; // USD (includes reasoning tokens)
  cacheReadPer1M: number; // USD
  cacheStoragePer1MHour: number; // USD per 1M token per hour
  label?: string;
};

export type BillingRuleV1 = {
  enabled: boolean;
  cacheStorageHours: number;
  tiers: BillingTierV1[];
};

export type BillingExportV1 = {
  version: 1;
  exportedAt: string; // ISO string
  costMode?: CostMode;
  defaultRule: BillingRuleV1;
  endpointRules: Record<string, BillingRuleV1>; // key = normalized endpoint (e.g. "POST /v1/chat/completions")
};

