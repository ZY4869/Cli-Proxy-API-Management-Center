import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { SecondaryScreenShell } from '@/components/common/SecondaryScreenShell';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useNotificationStore } from '@/stores';
import { generateId } from '@/utils/helpers';
import { useBillingStore } from './store/useBillingStore';
import type { BillingRuleV1 } from './types';
import { normalizeEndpointKey } from './utils/normalizeEndpoint';
import { parseBillingRuleV1 } from './utils/schema';
import { TierEditor, type TierDraft } from './TierEditor';
import { CalculatorCard } from './CalculatorCard';
import styles from './BillingEndpointEditPage.module.scss';

const DEFAULT_RULE_KEY = '__default__';

type RuleDraft = {
  enabled: boolean;
  cacheStorageHours: string;
  tiers: TierDraft[];
};

const ruleToDraft = (rule: BillingRuleV1): RuleDraft => ({
  enabled: rule.enabled,
  cacheStorageHours: String(rule.cacheStorageHours),
  tiers: (rule.tiers ?? []).map((tier) => ({
    id: generateId(),
    maxPromptTokens: tier.maxPromptTokens === null ? '' : String(tier.maxPromptTokens),
    inputPer1M: String(tier.inputPer1M),
    outputPer1M: String(tier.outputPer1M),
    cacheReadPer1M: String(tier.cacheReadPer1M),
    cacheStoragePer1MHour: String(tier.cacheStoragePer1MHour),
    label: tier.label ?? '',
  })),
});

const draftToRawRule = (draft: RuleDraft) => ({
  enabled: draft.enabled,
  cacheStorageHours: draft.cacheStorageHours,
  tiers: draft.tiers.map((tier) => ({
    maxPromptTokens: tier.maxPromptTokens.trim() === '' ? null : tier.maxPromptTokens,
    inputPer1M: tier.inputPer1M,
    outputPer1M: tier.outputPer1M,
    cacheReadPer1M: tier.cacheReadPer1M,
    cacheStoragePer1MHour: tier.cacheStoragePer1MHour,
    ...(tier.label.trim() ? { label: tier.label.trim() } : {}),
  })),
});

export function BillingEndpointEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const [searchParams] = useSearchParams();

  const rawKey = (searchParams.get('key') ?? '').trim();
  const isDefaultRule = rawKey === DEFAULT_RULE_KEY;
  const endpointKey = isDefaultRule ? DEFAULT_RULE_KEY : normalizeEndpointKey(rawKey);

  const defaultRule = useBillingStore((state) => state.defaultRule);
  const endpointRules = useBillingStore((state) => state.endpointRules);
  const setDefaultRule = useBillingStore((state) => state.setDefaultRule);
  const upsertEndpointRule = useBillingStore((state) => state.upsertEndpointRule);
  const removeEndpointRule = useBillingStore((state) => state.removeEndpointRule);

  const existingEndpointRule = !isDefaultRule && endpointKey ? endpointRules[endpointKey] : undefined;
  const hasOverrideRule = Boolean(existingEndpointRule);

  const initialDraftRef = useRef<RuleDraft | null>(null);
  if (!initialDraftRef.current) {
    const resolvedRule = isDefaultRule
      ? defaultRule
      : endpointKey
        ? endpointRules[endpointKey] ?? { ...defaultRule, enabled: true }
        : defaultRule;
    initialDraftRef.current = ruleToDraft(resolvedRule);
  }

  const [draft, setDraft] = useState<RuleDraft>(() => initialDraftRef.current ?? ruleToDraft(defaultRule));
  const savedHashRef = useRef<string>(JSON.stringify(initialDraftRef.current));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const store = useBillingStore.getState();
    const nextIsDefaultRule = rawKey === DEFAULT_RULE_KEY;
    const nextEndpointKey = nextIsDefaultRule ? DEFAULT_RULE_KEY : normalizeEndpointKey(rawKey);
    const nextRule = nextIsDefaultRule
      ? store.defaultRule
      : nextEndpointKey
        ? store.endpointRules[nextEndpointKey] ?? { ...store.defaultRule, enabled: true }
        : store.defaultRule;
    const nextDraft = ruleToDraft(nextRule);
    setDraft(nextDraft);
    savedHashRef.current = JSON.stringify(nextDraft);
  }, [rawKey]);

  const isDirty = useMemo(() => JSON.stringify(draft) !== savedHashRef.current, [draft]);

  const { allowNextNavigation } = useUnsavedChangesGuard({
    shouldBlock: isDirty,
    dialog: {
      title: t('common.unsaved_changes_title'),
      message: t('common.unsaved_changes_message'),
      confirmText: t('common.leave'),
      cancelText: t('common.stay'),
      variant: 'danger',
    },
  });

  const { parsedRule, parseError } = useMemo(() => {
    try {
      const parsed = parseBillingRuleV1(draftToRawRule(draft));
      return { parsedRule: parsed, parseError: '' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      return { parsedRule: null, parseError: message || t('billing.invalid_rule') };
    }
  }, [draft, t]);

  const handleSave = async () => {
    if (!parsedRule) {
      showNotification(parseError || t('billing.invalid_rule'), 'error');
      return;
    }

    setSaving(true);
    try {
      if (isDefaultRule) {
        setDefaultRule(parsedRule);
      } else if (endpointKey) {
        upsertEndpointRule(endpointKey, parsedRule);
      }

      savedHashRef.current = JSON.stringify(draft);
      showNotification(t('billing.save_success'), 'success');
      allowNextNavigation();
      navigate(-1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(`${t('billing.save_failed')}${message ? `: ${message}` : ''}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOverride = () => {
    if (isDefaultRule || !endpointKey) return;
    removeEndpointRule(endpointKey);
    showNotification(t('billing.override_removed'), 'success');
    allowNextNavigation();
    navigate(-1);
  };

  const title = isDefaultRule ? t('billing.default_rule') : endpointKey || t('billing.endpoint_rule');

  if (!isDefaultRule && !endpointKey) {
    return (
      <SecondaryScreenShell
        title={t('billing.endpoint_rule')}
        onBack={() => navigate(-1)}
        backLabel={t('common.back')}
      >
        <div className={styles.container}>
          <div className={styles.dangerHint}>{t('billing.invalid_endpoint_key')}</div>
        </div>
      </SecondaryScreenShell>
    );
  }

  return (
    <SecondaryScreenShell
      title={<span className={styles.mono}>{title}</span>}
      onBack={() => navigate(-1)}
      backLabel={t('common.back')}
      rightAction={
        <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={!isDirty || !parsedRule} loading={saving}>
          {t('common.save')}
        </Button>
      }
    >
      <div className={styles.container}>
        <Card title={t('billing.rule_settings')}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>{t('billing.rule_enabled')}</span>
            <ToggleSwitch
              checked={draft.enabled}
              onChange={(enabled) => setDraft((prev) => ({ ...prev, enabled }))}
              ariaLabel={t('billing.rule_enabled')}
            />
          </div>

          <Input
            label={t('billing.cache_storage_hours')}
            type="number"
            value={draft.cacheStorageHours}
            onChange={(e) => setDraft((prev) => ({ ...prev, cacheStorageHours: e.target.value }))}
            step="0.25"
            hint={t('billing.cache_storage_hours_hint')}
          />

          {!isDefaultRule && hasOverrideRule ? (
            <div className={styles.row}>
              <span className={styles.hint}>{t('billing.override_hint')}</span>
              <Button variant="danger" size="sm" onClick={handleRemoveOverride}>
                {t('billing.remove_override')}
              </Button>
            </div>
          ) : null}

          {parseError ? <div className={styles.dangerHint}>{parseError}</div> : null}
        </Card>

        <Card title={t('billing.tiers')}>
          <TierEditor
            tiers={draft.tiers}
            onChange={(tiers) => setDraft((prev) => ({ ...prev, tiers }))}
          />
        </Card>

        <CalculatorCard rule={parsedRule} parseError={parseError} />
      </div>
    </SecondaryScreenShell>
  );
}
