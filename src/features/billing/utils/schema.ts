import type { BillingExportV1, BillingRuleV1, BillingTierV1, CostMode } from '../types';
import { normalizeEndpointKey } from './normalizeEndpoint';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toNumber = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : Number.NaN;
};

const ensureNonNegative = (value: unknown, fieldName: string): number => {
  const num = toNumber(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid ${fieldName}: expected non-negative number`);
  }
  return num;
};

const ensurePositive = (value: unknown, fieldName: string): number => {
  const num = toNumber(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`Invalid ${fieldName}: expected positive number`);
  }
  return num;
};

const parseCostMode = (value: unknown): CostMode | undefined => {
  if (value === 'model' || value === 'endpoint') return value;
  return undefined;
};

export function parseBillingRuleV1(value: unknown): BillingRuleV1 {
  if (!isRecord(value)) {
    throw new Error('Invalid billing rule: expected object');
  }

  const enabled = value.enabled === true;
  const cacheStorageHours = ensurePositive(value.cacheStorageHours, 'cacheStorageHours');

  const tiersRaw = value.tiers;
  if (!Array.isArray(tiersRaw) || tiersRaw.length < 1) {
    throw new Error('Invalid tiers: expected non-empty array');
  }

  const tiers: BillingTierV1[] = tiersRaw.map((tierRaw, idx) => {
    if (!isRecord(tierRaw)) {
      throw new Error(`Invalid tier[${idx}]: expected object`);
    }

    const maxPromptTokens =
      tierRaw.maxPromptTokens === null
        ? null
        : ensureNonNegative(tierRaw.maxPromptTokens, `tiers[${idx}].maxPromptTokens`);

    return {
      maxPromptTokens,
      inputPer1M: ensureNonNegative(tierRaw.inputPer1M, `tiers[${idx}].inputPer1M`),
      outputPer1M: ensureNonNegative(tierRaw.outputPer1M, `tiers[${idx}].outputPer1M`),
      cacheReadPer1M: ensureNonNegative(tierRaw.cacheReadPer1M, `tiers[${idx}].cacheReadPer1M`),
      cacheStoragePer1MHour: ensureNonNegative(
        tierRaw.cacheStoragePer1MHour,
        `tiers[${idx}].cacheStoragePer1MHour`
      ),
      ...(typeof tierRaw.label === 'string' && tierRaw.label.trim()
        ? { label: tierRaw.label.trim() }
        : {}),
    };
  });

  const infinityCount = tiers.filter((tier) => tier.maxPromptTokens === null).length;
  if (infinityCount !== 1) {
    throw new Error('Invalid tiers: must have exactly one Infinity tier (maxPromptTokens = null)');
  }

  return { enabled, cacheStorageHours, tiers };
}

export function parseBillingExportV1(value: unknown): BillingExportV1 {
  if (!isRecord(value)) {
    throw new Error('Invalid billing export: expected object');
  }

  if (value.version !== 1) {
    throw new Error('Invalid billing export: unsupported version');
  }

  if (typeof value.exportedAt !== 'string' || !value.exportedAt.trim()) {
    throw new Error('Invalid billing export: exportedAt must be a non-empty string');
  }

  const defaultRule = parseBillingRuleV1(value.defaultRule);

  const endpointRulesRaw = value.endpointRules;
  if (!isRecord(endpointRulesRaw)) {
    throw new Error('Invalid billing export: endpointRules must be an object');
  }

  const endpointRules: Record<string, BillingRuleV1> = {};
  Object.entries(endpointRulesRaw).forEach(([key, ruleRaw]) => {
    const normalizedKey = normalizeEndpointKey(key);
    if (!normalizedKey) {
      throw new Error('Invalid billing export: endpoint key cannot be empty');
    }
    endpointRules[normalizedKey] = parseBillingRuleV1(ruleRaw);
  });

  const costMode = parseCostMode(value.costMode);

  return {
    version: 1,
    exportedAt: value.exportedAt,
    ...(costMode ? { costMode } : {}),
    defaultRule,
    endpointRules,
  };
}

