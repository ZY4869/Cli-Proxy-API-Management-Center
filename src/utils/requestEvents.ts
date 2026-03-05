import {
  collectUsageDetailsWithEndpoint,
  extractTotalTokens,
  normalizeAuthIndex,
  type UsageDetail,
  type UsageDetailWithEndpoint,
} from './usage';

export interface UsageRequestEvent {
  id: string;
  timestamp: string;
  timestampMs: number;
  model: string;
  source: string;
  sourceRaw: string;
  authIndex: string;
  authIndexRaw: unknown;
  failed: boolean;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  endpointKey: string;
  endpointLabel: string;
  endpointMethod: string;
  endpointPath: string;
  requestId?: string;
}

const toNonNegative = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
};

const hasEndpointFields = (detail: UsageDetail | UsageDetailWithEndpoint): detail is UsageDetailWithEndpoint =>
  '__endpoint' in detail || '__endpointPath' in detail || '__endpointMethod' in detail;

export function createUsageRequestEvent(
  detail: UsageDetail | UsageDetailWithEndpoint,
  index: number = 0
): UsageRequestEvent {
  const timestamp = detail.timestamp;
  const timestampMs =
    typeof detail.__timestampMs === 'number' && detail.__timestampMs > 0
      ? detail.__timestampMs
      : Date.parse(timestamp) || 0;
  const tokens = detail.tokens ?? ({} as UsageDetail['tokens']);
  const model = String(detail.__modelName ?? '').trim() || '-';
  const source = String(detail.source ?? '').trim() || '-';
  const sourceRaw = String(detail.__sourceRaw ?? detail.source ?? '').trim() || source;
  const authIndex = normalizeAuthIndex(detail.auth_index) || '-';
  const inputTokens = toNonNegative(tokens.input_tokens);
  const outputTokens = toNonNegative(tokens.output_tokens);
  const reasoningTokens = toNonNegative(tokens.reasoning_tokens);
  const cachedTokens = Math.max(toNonNegative(tokens.cached_tokens), toNonNegative(tokens.cache_tokens));
  const totalTokens = Math.max(toNonNegative(tokens.total_tokens), extractTotalTokens(detail));
  const requestId = typeof detail.request_id === 'string' && detail.request_id.trim() ? detail.request_id : undefined;

  const endpointKey = hasEndpointFields(detail)
    ? String(detail.__endpoint ?? '').trim() || String(detail.__endpointPath ?? '').trim() || '-'
    : '-';
  const endpointMethod = hasEndpointFields(detail) ? String(detail.__endpointMethod ?? '').trim() : '';
  const endpointPath = hasEndpointFields(detail) ? String(detail.__endpointPath ?? '').trim() : '';
  const endpointLabel =
    endpointMethod && endpointPath
      ? `${endpointMethod} ${endpointPath}`
      : endpointPath || endpointKey || '-';

  return {
    id: requestId || `${timestampMs}-${endpointKey}-${model}-${sourceRaw}-${authIndex}-${index}`,
    timestamp,
    timestampMs,
    model,
    source,
    sourceRaw,
    authIndex,
    authIndexRaw: detail.auth_index,
    failed: detail.failed === true,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cachedTokens,
    totalTokens,
    endpointKey,
    endpointLabel,
    endpointMethod,
    endpointPath,
    requestId,
  };
}

export function collectUsageRequestEvents(usageData: unknown): UsageRequestEvent[] {
  return collectUsageDetailsWithEndpoint(usageData)
    .map((detail, index) => createUsageRequestEvent(detail, index))
    .sort((a, b) => b.timestampMs - a.timestampMs);
}
