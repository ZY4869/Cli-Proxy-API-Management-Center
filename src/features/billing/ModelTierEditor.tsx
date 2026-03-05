import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { animate } from 'motion/mini';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconChevronDown, IconChevronUp, IconTrash2 } from '@/components/ui/icons';
import { generateId } from '@/utils/helpers';
import styles from './BillingEndpointEditPage.module.scss';

export type ModelTierDraft = {
  id: string;
  maxPromptTokens: string; // empty = Infinity
  promptPer1M: string;
  completionPer1M: string;
  label: string;
};

export type ModelTierEditorProps = {
  tiers: ModelTierDraft[];
  onChange: (next: ModelTierDraft[]) => void;
};

export function ModelTierEditor({ tiers, onChange }: ModelTierEditorProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastAddedIdRef = useRef<string>('');

  const titlesById = (() => {
    const toNonNegative = (value: unknown): number => {
      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num)) return 0;
      return Math.max(num, 0);
    };

    const formatBound = (value: number): string => Math.round(toNonNegative(value)).toLocaleString();

    const normalized = tiers.map((tier, index) => {
      const label = tier.label.trim();
      const isInfinity = tier.maxPromptTokens.trim() === '';
      const max = isInfinity ? Number.POSITIVE_INFINITY : toNonNegative(tier.maxPromptTokens);
      return { id: tier.id, label, max, isInfinity, index };
    });

    const sorted = [...normalized].sort((a, b) => (a.max !== b.max ? a.max - b.max : a.index - b.index));

    const result = new Map<string, string>();
    let prevFiniteMax: number | null = null;
    for (const entry of sorted) {
      if (entry.label) {
        result.set(entry.id, entry.label);
      } else if (entry.isInfinity) {
        result.set(entry.id, prevFiniteMax === null ? '∞' : `>${formatBound(prevFiniteMax)}`);
      } else if (prevFiniteMax === null) {
        result.set(entry.id, `≤${formatBound(entry.max)}`);
      } else {
        const lower = prevFiniteMax + 1;
        result.set(entry.id, lower <= entry.max ? `${formatBound(lower)}–${formatBound(entry.max)}` : `≤${formatBound(entry.max)}`);
      }

      if (!entry.isInfinity && Number.isFinite(entry.max)) {
        prevFiniteMax = entry.max;
      }
    }
    return result;
  })();

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

  const updateTier = (id: string, patch: Partial<Omit<ModelTierDraft, 'id'>>) => {
    onChange(tiers.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier)));
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
    const target = tiers.find((t) => t.id === id);
    const isInfinity = target?.maxPromptTokens.trim() === '';
    const infinityCount = tiers.filter((t) => t.maxPromptTokens.trim() === '').length;
    if (isInfinity && infinityCount <= 1) return;
    onChange(tiers.filter((tier) => tier.id !== id));
  };

  const addTier = () => {
    const infinityIndex = tiers.findIndex((tier) => tier.maxPromptTokens.trim() === '');
    const base = infinityIndex >= 0 ? tiers[infinityIndex] : undefined;
    const newTier: ModelTierDraft = {
      id: generateId(),
      maxPromptTokens: infinityIndex >= 0 ? '200000' : '',
      promptPer1M: base?.promptPer1M ?? '0',
      completionPer1M: base?.completionPer1M ?? '0',
      label: '',
    };

    const insertIndex = infinityIndex >= 0 ? Math.max(0, infinityIndex) : tiers.length;
    const next = [...tiers];
    next.splice(insertIndex, 0, newTier);
    lastAddedIdRef.current = newTier.id;
    onChange(next);
  };

  return (
    <div ref={rootRef}>
      <div className={styles.tierList}>
        {tiers.map((tier, index) => {
          const isInfinity = tier.maxPromptTokens.trim() === '';
          const title = titlesById.get(tier.id) ?? (isInfinity ? '∞' : `≤${tier.maxPromptTokens}`);
          const infinityCount = tiers.filter((t) => t.maxPromptTokens.trim() === '').length;
          const canDelete = tiers.length > 1 && (!isInfinity || infinityCount > 1);

          return (
            <div key={tier.id} className={styles.tierRow} data-tier-id={tier.id}>
              <div className={styles.tierRowTop}>
                <div className={styles.tierTitle}>
                  {title}
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
                    disabled={!canDelete}
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
                  label={t('billing.model_pricing_prompt_per_1m')}
                  type="number"
                  value={tier.promptPer1M}
                  onChange={(e) => updateTier(tier.id, { promptPer1M: e.target.value })}
                  placeholder="0.00"
                  step="0.0001"
                />
                <Input
                  label={t('billing.model_pricing_completion_per_1m')}
                  type="number"
                  value={tier.completionPer1M}
                  onChange={(e) => updateTier(tier.id, { completionPer1M: e.target.value })}
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
