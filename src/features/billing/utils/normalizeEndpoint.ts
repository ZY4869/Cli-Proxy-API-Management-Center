const ENDPOINT_METHOD_PATH_REGEX = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)/i;

export function normalizeEndpointKey(endpoint: string): string {
  const raw = typeof endpoint === 'string' ? endpoint : String(endpoint ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const match = trimmed.match(ENDPOINT_METHOD_PATH_REGEX);
  if (!match) {
    return trimmed;
  }

  const method = match[1].toUpperCase();
  const pathWithQuery = match[2].trim();
  const path = pathWithQuery.split('?')[0] || '';
  return `${method} ${path}`.trim();
}

