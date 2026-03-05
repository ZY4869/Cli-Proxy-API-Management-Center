import { MODEL_PRICING_STORAGE_KEYS } from '../billing/modelPricing/storage';
import type { AutoBackupInterval } from './types';

export const WEBDAV_STORE_KEY = 'cli-proxy-webdav';

export const BACKUP_FILE_PREFIX = 'cpamc-backup-';
export const BACKUP_FILE_EXT = '.json';

export const DEFAULT_BASE_PATH = '/cpamc-backups/';

export const BACKUP_ENCRYPTION_SALT = 'cpamc-webdav-backup::portable-key';

const BILLING_LOCALSTORAGE_KEYS = [
  ...MODEL_PRICING_STORAGE_KEYS,
  'cli-proxy-model-pricing-default-currency-v1',
  'cli-proxy-model-pricing-selected-currency-v1',
];

export const BACKUP_LOCALSTORAGE_KEYS = [
  'cli-proxy-theme',
  'cli-proxy-language',
  'cli-proxy-sidebar-collapsed',
  'cli-proxy-auth-files-page-size',
  ...BILLING_LOCALSTORAGE_KEYS,
  'disabled-models-store',
];

export const AUTO_BACKUP_INTERVALS: { value: AutoBackupInterval; ms: number }[] = [
  { value: '5m', ms: 5 * 60 * 1000 },
  { value: '30m', ms: 30 * 60 * 1000 },
  { value: '24h', ms: 24 * 60 * 60 * 1000 },
  { value: '3d', ms: 3 * 24 * 60 * 60 * 1000 },
];

export const DEFAULT_MAX_BACKUP_COUNT = 10;

export const MAX_BACKUP_COUNT_OPTIONS = [5, 10, 20, 50, 0] as const;

export const WEBDAV_TIMEOUT_MS = 30_000;
