/**
 * useBackupLogic
 * Hook que centraliza toda la lógica de backup en la nube para la pantalla de Settings.
 * Gestiona preferencias de upload y download, estadísticas y ejecución manual/automática.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  getBackupPreferences,
  saveBackupPreferences,
  getBackupStats,
  runBackup,
  BackupPreferences,
  BackupStats,
  BackupProgress,
  BACKUP_PREFS,
} from '../services/backup/backupService';
import {
  downloadCloudItems,
  getCloudItemsCount,
  DownloadProgress,
} from '../services/backup/downloadService';
import { storageService } from '../services/storageService';
import { alertRef } from '../components/CustomAlert';

// ─── Helpers de formato ──────────────────────────────────────────────────────

const formatRelativeTime = (isoDate: string | null): string => {
  if (!isoDate) return 'Nunca';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${days} día(s)`;
};

// ─── Hook principal ──────────────────────────────────────────────────────────

export const useBackupLogic = () => {
  const [prefs, setPrefs] = useState<BackupPreferences>({
    enabled: false,
    autoDownload: false,
    includePhotos: true,
    includeAudio: true,
    includeDocs: true,
    includeTranscripts: true,
    lastRun: null,
    lastDownload: null,
  });

  const [stats, setStats] = useState<BackupStats>({
    photos: { total: 0, backed: 0 },
    audio: { total: 0, backed: 0 },
    docs: { total: 0, backed: 0 },
    transcripts: { total: 0, backed: 0 },
  });

  const [cloudItemsCount, setCloudItemsCount] = useState(0);

  // Estado de upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<BackupProgress | null>(null);

  // Estado de download
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  // ─── Carga inicial ────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    const [loadedPrefs, loadedStats, cloudCount] = await Promise.all([
      getBackupPreferences(),
      getBackupStats(),
      getCloudItemsCount(),
    ]);
    setPrefs(loadedPrefs);
    setStats(loadedStats);
    setCloudItemsCount(cloudCount);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Actualizar preferencia individual ───────────────────────────────────

  const updatePref = useCallback(
    async (key: keyof BackupPreferences, value: boolean) => {
      const updated = { ...prefs, [key]: value };
      setPrefs(updated);
      await saveBackupPreferences({ [key]: value });
    },
    [prefs]
  );

  // ─── Backup (Upload) manual ───────────────────────────────────────────────

  const handleBackupNow = useCallback(async () => {
    if (isUploading || isDownloading) return;
    if (!prefs.enabled) {
      alertRef.show({
        title: 'Backup desactivado',
        message: 'Activa el backup en la nube primero para poder respaldar tus archivos.',
        type: 'warning',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress({ total: 0, done: 0, current: 'Iniciando...', errors: 0 });

    try {
      const result = await runBackup((p) => setUploadProgress(p));

      if (result.uploaded === 0 && result.errors === 0) {
        alertRef.show({ title: '✅ Todo al día', message: 'No hay archivos nuevos que respaldar.', type: 'success' });
      } else if (result.errors === 0) {
        alertRef.show({ title: '✅ Backup completo', message: `${result.uploaded} archivo(s) respaldados correctamente.`, type: 'success' });
      } else {
        alertRef.show({ title: '⚠️ Backup parcial', message: `${result.uploaded} respaldados, ${result.errors} error(es).`, type: 'warning' });
      }

      await loadAll();
    } catch (error: any) {
      alertRef.show({ title: 'Error', message: error?.message || 'No se pudo completar el backup.', type: 'error' });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [isUploading, isDownloading, prefs.enabled, loadAll]);

  // ─── Download manual ──────────────────────────────────────────────────────

  const handleDownloadNow = useCallback(async () => {
    if (isDownloading || isUploading) return;
    if (!prefs.enabled) {
      alertRef.show({
        title: 'Backup desactivado',
        message: 'Activa el backup en la nube para poder descargar archivos.',
        type: 'warning',
      });
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({ total: 0, done: 0, current: 'Iniciando descarga...', errors: 0, skipped: 0 });

    try {
      const result = await downloadCloudItems((p) => setDownloadProgress(p));

      // Guardar fecha de última descarga
      await storageService.saveSecure(BACKUP_PREFS.LAST_DOWNLOAD, new Date().toISOString());
      await loadAll();

      if (result.downloaded === 0 && result.errors === 0) {
        alertRef.show({
          title: '✅ Sincronizado',
          message: result.skipped > 0
            ? `${result.skipped} archivo(s) ya estaban en el dispositivo.`
            : 'No hay archivos en la nube para descargar.',
          type: 'success',
        });
      } else if (result.errors === 0) {
        alertRef.show({
          title: '✅ Descarga completa',
          message: `${result.downloaded} archivo(s) descargados.${result.skipped > 0 ? ` ${result.skipped} ya existían.` : ''}`,
          type: 'success',
        });
      } else {
        alertRef.show({
          title: '⚠️ Descarga parcial',
          message: `${result.downloaded} descargados, ${result.errors} error(es).`,
          type: 'warning',
        });
      }
    } catch (error: any) {
      alertRef.show({ title: 'Error', message: error?.message || 'No se pudo completar la descarga.', type: 'error' });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, [isDownloading, isUploading, prefs.enabled, loadAll]);

  // ─── Labels formateados ───────────────────────────────────────────────────

  const lastUploadLabel = formatRelativeTime(prefs.lastRun);
  const lastDownloadLabel = formatRelativeTime(prefs.lastDownload);

  const pendingCount =
    (stats.photos.total - stats.photos.backed) +
    (stats.audio.total - stats.audio.backed) +
    (stats.docs.total - stats.docs.backed) +
    (stats.transcripts.total - stats.transcripts.backed);

  const totalCount = stats.photos.total + stats.audio.total + stats.docs.total + stats.transcripts.total;
  const backedCount = stats.photos.backed + stats.audio.backed + stats.docs.backed + stats.transcripts.backed;

  const isRunning = isUploading || isDownloading;

  return {
    prefs,
    updatePref,
    stats,
    cloudItemsCount,
    // Upload
    isUploading,
    uploadProgress,
    handleBackupNow,
    lastUploadLabel,
    // Download
    isDownloading,
    downloadProgress,
    handleDownloadNow,
    lastDownloadLabel,
    // Shared
    isRunning,
    pendingCount,
    totalCount,
    backedCount,
  };
};
