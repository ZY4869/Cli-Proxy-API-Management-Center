import { describe, expect, it } from 'vitest';
import { BACKUP_LOCALSTORAGE_KEYS } from './constants';

describe('webdav backup localStorage keys', () => {
  it('includes model pricing and currency preferences', () => {
    expect(BACKUP_LOCALSTORAGE_KEYS).toEqual(
      expect.arrayContaining([
        'cli-proxy-model-pricing-v1',
        'cli-proxy-model-prices-v2',
        'model-prices',
        'cli-proxy-model-pricing-default-currency-v1',
        'cli-proxy-model-pricing-selected-currency-v1',
      ])
    );
  });
});
