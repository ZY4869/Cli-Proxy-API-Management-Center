import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { animate } from 'motion/mini';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconChevronDown, IconChevronUp, IconTrash2 } from '@/components/ui/icons';
import { generateId } from '@/utils/helpers';
import styles from './BillingEndpointEditPage.module.scss';

export type TierDraft = {
  id: string;
  maxPromptTokens: string; // empty = Infinity
  inputPer1M: string;
  outputPer1M: string;
  cacheReadPer1M: string;
  cacheStoragePer1MHour: string;
  label: string;
};

export type TierEditorProps = {
  tiers: TierDraft[];
  onChange: (next: TierDraft[]) => void;
};

export function TierEditor({ tiers, onChange }: TierEditorProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastAddedIdRef = useRef<string>('');

  useEffect(() => {
    const id = lastAddedIdRef.current;
    if (!id) return;
    lastAddedIdRef.current = '';
    const el = rootRef.current?.querySelector(`[data-tier-id="${id}"]`) as HTMLElement | null;
    if (!el) return;
    const controls = animate(
      el,
      { opacity: [0, 1], transform: ['scale(0.985)', 'scale(1)'] },
      { duration: 0.18, ease: (p) => 1 - (1 - p) ** 3 }
    );
    return () => controls.stop();
  }, [tiers]);

  const updateTier = (id: string, patch: Partial<Omit<TierDraft, 'id'>>) => {
    onChange(
      tiers.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier))
    );
  };

  const moveTier = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= tiers.length) return;
    const next = [...tiers];
    const temp = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = temp;
    onChange(next);
  };

  const deleteTier = (id: string) => {
    if (tiers.length <= 1) return;
    onChange(tiers.filter((tier) => tier.id !== id));
  };

  const addTier = () => {
    const hasInfinity = tiers.some((tier) => tier.maxPromptTokens.trim() === '');
    const newTier: TierDraft = {
      id: generateId(),
      maxPromptTokens: hasInfinity ? '200000' : '',
      inputPer1M: '0',
      outputPer1M: '0',
      cacheReadPer1M: '0',
      cacheStoragePer1MHour: '0',
      label: '',
    };

    const insertIndex = hasInfinity
      ? Math.max(0, tiers.findIndex((tier) => tier.maxPromptTokens.trim() === ''))
      : tiers.length;
    const next = [...tiers];
    next.splice(insertIndex, 0, newTier);
    lastAddedIdRef.current = newTier.id;
    onChange(next);
  };

  return (
    <div ref={rootRef}>
      <div className={styles.tierList}>
        {tiers.map((tier, index) => {
          const title = tier.label.trim() || t('billing.tier_n', { n: index + 1 });
          const isInfinity = tier.maxPromptTokens.trim() === '';

          return (
            <div key={tier.id} className={styles.tierRow} data-tier-id={tier.id}>
              <div className={styles.tierRowTop}>
                <div className={styles.tierTitle}>
                  {title} {isInfinity ? '∞' : ''}
                </div>
                <div className={styles.tierActions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => moveTier(index, -1)}
                    disabled={index === 0}
                    title={t('billing.tier_move_up')}
                  >
                    <IconChevronUp size={16} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => moveTier(index, 1)}
                    disabled={index === tiers.length - 1}
                    title={t('billing.tier_move_down')}
                  >
                    <IconChevronDown size={16} />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => deleteTier(tier.id)}
                    disabled={tiers.length <= 1}
                    title={t('billing.tier_delete')}
                  >
                    <IconTrash2 size={16} />
                  </Button>
                </div>
              </div>

              <div className={styles.tierFields}>
                <Input
                  label={t('billing.max_prompt_tokens')}
                  type="number"
                  value={tier.maxPromptTokens}
                  onChange={(e) => updateTier(tier.id, { maxPromptTokens: e.target.value })}
                  placeholder={t('billing.infinity_placeholder')}
                  step="1"
                />
                <Input
                  label={t('billing.tier_label')}
                  type="text"
                  value={tier.label}
                  onChange={(e) => updateTier(tier.id, { label: e.target.value })}
                  placeholder={t('billing.tier_label_placeholder')}
                />
                <Input
                  label={t('billing.input_price')}
                  type="number"
                  value={tier.inputPer1M}
                  onChange={(e) => updateTier(tier.id, { inputPer1M: e.target.value })}
                  placeholder="0.00"
                  step="0.0001"
                />
                <Input
                  label={t('billing.output_price')}
                  type="number"
                  value={tier.outputPer1M}
                  onChange={(e) => updateTier(tier.id, { outputPer1M: e.target.value })}
                  placeholder="0.00"
                  step="0.0001"
                />
                <Input
                  label={t('billing.cache_read_price')}
                  type="number"
                  value={tier.cacheReadPer1M}
                  onChange={(e) => updateTier(tier.id, { cacheReadPer1M: e.target.value })}
                  placeholder="0.00"
                  step="0.0001"
                />
                <Input
                  label={t('billing.cache_storage_price')}
                  type="number"
                  value={tier.cacheStoragePer1MHour}
                  onChange={(e) => updateTier(tier.id, { cacheStoragePer1MHour: e.target.value })}
                  placeholder="0.00"
                  step="0.0001"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.tierAddRow}>
        <Button variant="secondary" onClick={addTier}>
          {t('billing.tier_add')}
        </Button>
        <span className={styles.hint}>{t('billing.tier_infinity_hint')}</span>
      </div>
    </div>
  );
}

