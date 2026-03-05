import { useLocalStorage } from '@/hooks';

const COLLAPSE_KEY_PREFIX = 'cli-proxy-billing-collapse-v1-';

export const useBillingCollapse = (sectionId: string, initialCollapsed: boolean = false) =>
  useLocalStorage<boolean>(`${COLLAPSE_KEY_PREFIX}${sectionId}`, initialCollapsed);

