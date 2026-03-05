import { useTranslation } from 'react-i18next';
import { IconChevronDown, IconChevronUp } from '@/components/ui/icons';
import styles from '../BillingPage.module.scss';

type CollapseToggleButtonProps = {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
};

export function CollapseToggleButton({ collapsed, onToggle, className }: CollapseToggleButtonProps) {
  const { t } = useTranslation();
  const collapseLabel = t('sidebar.collapse', { defaultValue: '收起' });
  const expandLabel = t('sidebar.expand', { defaultValue: '展开' });
  const label = collapsed ? expandLabel : collapseLabel;

  return (
    <button
      type="button"
      className={className ? `${styles.collapseBtn} ${className}` : styles.collapseBtn}
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      {collapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
    </button>
  );
}

