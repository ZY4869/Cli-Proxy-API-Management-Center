import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useNotificationStore } from '@/stores';
import { downloadBlob } from '@/utils/download';
import styles from './BillingPage.module.scss';

export type ImportExportCardProps = {
  onExport: () => unknown;
  onImport: (payload: unknown) => { importedEndpoints: number };
};

export function ImportExportCard({ onExport, onImport }: ImportExportCardProps) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    try {
      const payload = onExport();
      const safeTimestamp = new Date().toISOString();
      const filename = `billing-rules-${safeTimestamp.replace(/[:.]/g, '-')}.json`;
      downloadBlob({
        filename,
        blob: new Blob([JSON.stringify(payload ?? {}, null, 2)], { type: 'application/json' }),
      });
      showNotification(t('billing.export_success'), 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(`${t('billing.export_failed')}${message ? `: ${message}` : ''}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = onImport(parsed);
      showNotification(
        t('billing.import_success', { endpoints: result.importedEndpoints }),
        'success'
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(`${t('billing.import_failed')}${message ? `: ${message}` : ''}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card title={t('billing.import_export')}>
      <div className={styles.endpointControls}>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExport}
          loading={exporting}
          disabled={importing}
        >
          {t('billing.export')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleImport}
          loading={importing}
          disabled={exporting}
        >
          {t('billing.import')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleImportChange}
        />
      </div>
    </Card>
  );
}

