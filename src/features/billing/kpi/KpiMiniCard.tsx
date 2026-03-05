import styles from '../BillingPage.module.scss';

export type KpiMiniCardProps = {
  label: string;
  value: string;
  valueClassName?: string;
};

export function KpiMiniCard({ label, value, valueClassName }: KpiMiniCardProps) {
  return (
    <div className={styles.kpiMiniCard}>
      <div className={styles.kpiMiniLabel}>{label}</div>
      <div className={valueClassName ? `${styles.kpiMiniValue} ${valueClassName}` : styles.kpiMiniValue}>{value}</div>
    </div>
  );
}

