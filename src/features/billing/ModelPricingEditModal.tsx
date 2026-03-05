import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useNotificationStore } from '@/stores';
import { ModelTierEditor, type ModelTierDraft } from './ModelTierEditor';
import type { ModelPricingTierV1, ModelPricingV1 } from './modelPricing/types';
import { parseModelPricingV1 } from './modelPricing/schema';
import { generateId } from '@/utils/helpers';
import styles from './BillingModelPricesPage.module.scss';

export type ModelPricingEditModalProps = {
  open: boolean;
  modelName: string;
  initialPricing: ModelPricingV1 | null;
  onSave: (pricing: ModelPricingV1) => void;
  onDelete: () => void;
  onClose: () => void;
};

const toTierDrafts = (tiers: ModelPricingTierV1[]): ModelTierDraft[] =>
  (tiers ?? []).map((tier) => ({
    id: generateId(),
    maxPromptTokens: tier.maxPromptTokens === null ? '' : String(tier.maxPromptTokens),
    promptPer1M: String(tier.promptPer1M),
    completionPer1M: String(tier.completionPer1M),
    label: tier.label ?? '',
  }));

const emptyTierDraft = (): ModelTierDraft => ({
  id: generateId(),
  maxPromptTokens: '',
  promptPer1M: '0',
  completionPer1M: '0',
  label: '',
});

export function ModelPricingEditModal({
  open,
  modelName,
  initialPricing,
  onSave,
  onDelete,
  onClose,
}: ModelPricingEditModalProps) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((s) => s.showNotification);

  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [cachePer1M, setCachePer1M] = useState('');
  const [useTiers, setUseTiers] = useState(false);
  const [flatPrompt, setFlatPrompt] = useState('');
  const [flatCompletion, setFlatCompletion] = useState('');
  const [tierDrafts, setTierDrafts] = useState<ModelTierDraft[]>([emptyTierDraft()]);

  useEffect(() => {
    const currency = String(initialPricing?.currencySymbol ?? '').trim() || '$';
    const cache = initialPricing?.cachePer1M;
    const tiers = initialPricing?.tiers ?? [];
    const isFlat = tiers.length === 1 && tiers[0]?.maxPromptTokens === null;
    const infinityTier = tiers.find((tier) => tier.maxPromptTokens === null) ?? tiers[0];

    setCurrencySymbol(currency);
    setCachePer1M(cache === undefined ? '' : String(cache));
    setUseTiers(!isFlat && tiers.length > 0);
    setFlatPrompt(infinityTier ? String(infinityTier.promptPer1M) : '');
    setFlatCompletion(infinityTier ? String(infinityTier.completionPer1M) : '');
    setTierDrafts(tiers.length ? toTierDrafts(tiers) : [emptyTierDraft()]);
  }, [initialPricing, modelName, open]);

  const cacheHint = useMemo(() => t('billing.model_pricing_cache_hint'), [t]);

  const handleSave = () => {
    try {
      const raw = {
        currencySymbol: currencySymbol.trim() || '$',
        cachePer1M: cachePer1M.trim() === '' ? undefined : cachePer1M,
        tiers: useTiers
          ? tierDrafts.map((tier) => ({
              maxPromptTokens: tier.maxPromptTokens.trim() === '' ? null : tier.maxPromptTokens,
              promptPer1M: tier.promptPer1M,
              completionPer1M: tier.completionPer1M,
              ...(tier.label.trim() ? { label: tier.label.trim() } : {}),
            }))
          : [
              {
                maxPromptTokens: null,
                promptPer1M: flatPrompt,
                completionPer1M: flatCompletion,
              },
            ],
      };

      const parsed = parseModelPricingV1(raw);
      onSave(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(`${t('billing.model_pricing_invalid')}${message ? `: ${message}` : ''}`, 'error');
    }
  };

  return (
    <Modal
      open={open}
      title={modelName}
      onClose={onClose}
      width={680}
      footer={
        <div className={styles.rowActions}>
          <Button variant="danger" onClick={onDelete} disabled={!initialPricing}>
            {t('common.delete')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!modelName}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className={styles.editModalBody}>
        <div className={styles.formField}>
          <label>{t('billing.model_pricing_currency_symbol')}</label>
          <Input
            type="text"
            value={currencySymbol}
            onChange={(e) => setCurrencySymbol(e.target.value)}
            placeholder="$"
          />
        </div>

        <div className={styles.formField}>
          <label>{t('billing.model_pricing_cache_per_1m')}</label>
          <Input
            type="number"
            value={cachePer1M}
            onChange={(e) => setCachePer1M(e.target.value)}
            placeholder={t('billing.model_pricing_cache_placeholder')}
            step="0.0001"
          />
          <div className={styles.mutedHint}>{cacheHint}</div>
        </div>

        <div className={styles.formField}>
          <ToggleSwitch
            checked={useTiers}
            onChange={setUseTiers}
            label={t('billing.model_pricing_use_tiers')}
            ariaLabel={t('billing.model_pricing_use_tiers')}
          />
        </div>

        {!useTiers ? (
          <div className={styles.filtersRow}>
            <div className={styles.search}>
              <Input
                label={t('billing.model_pricing_prompt_per_1m')}
                type="number"
                value={flatPrompt}
                onChange={(e) => setFlatPrompt(e.target.value)}
                placeholder="0.00"
                step="0.0001"
              />
            </div>
            <div className={styles.search}>
              <Input
                label={t('billing.model_pricing_completion_per_1m')}
                type="number"
                value={flatCompletion}
                onChange={(e) => setFlatCompletion(e.target.value)}
                placeholder="0.00"
                step="0.0001"
              />
            </div>
          </div>
        ) : (
          <div className={styles.formField}>
            <ModelTierEditor tiers={tierDrafts} onChange={setTierDrafts} />
          </div>
        )}
      </div>
    </Modal>
  );
}

