import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import styles from '@/pages/UsagePage.module.scss';

export interface PriceSettingsCardProps {
  onGoToModelPricing: () => void;
}

export function PriceSettingsCard({ onGoToModelPricing }: PriceSettingsCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      title={t('billing.model_prices_title')}
      extra={
        <Button variant="secondary" size="sm" onClick={onGoToModelPricing}>
          {t('billing.model_prices')}
        </Button>
      }
    >
      <div className={styles.hint}>{t('billing.model_prices_usage_note')}</div>
    </Card>
  );
}

