/**
 * useBackupLogic
 * Hook que centraliza toda la lógica de backup en la nube para la pantalla de Settings.
 * Gestiona preferencias de upload y download, estadísticas y ejecución manual/automática.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { alertRef } from '../components/ui/CustomAlert';

// ─── Helpers de formato ──────────────────────────────────────────────────────

const formatRelativeTime = (isoDate: string | null, t: (key: string, options?: any) => string): string => {
  if (!isoDate) return t('backup.never');
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return t('backup.momentAgo');
  if (mins < 60) return t('backup.minAgo', { mins });
  if (hours < 24) return t('backup.hoursAgo', { hours });
  return t('backup.daysAgo', { days });
};

// ─── Hook principal ──────────────────────────────────────────────────────────

export const useBackupLogic = () => {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<BackupPreferences>({
    enabled: false,
    autoUpload: false,
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
        title: t('backup.disabled'),
        message: t('backup.enableFirst'),
        type: 'warning',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress({ total: 0, done: 0, current: t('backup.starting'), errors: 0 });

    try {
      const result = await runBackup((p) => setUploadProgress(p));

      if (result.uploaded === 0 && result.errors === 0) {
        alertRef.show({ title: t('backup.allUpToDate'), message: t('backup.noNewFiles'), type: 'success' });
      } else if (result.errors === 0) {
        alertRef.show({ title: t('backup.complete'), message: t('backup.uploadResult', { uploaded: result.uploaded }), type: 'success' });
      } else {
        alertRef.show({ title: t('backup.partial'), message: t('backup.uploadPartial', { uploaded: result.uploaded, errors: result.errors }), type: 'warning' });
      }

      await loadAll();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('backup.backupFailed'), type: 'error' });
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
        title: t('backup.disabled'),
        message: t('backup.enableFirstDownload'),
        type: 'warning',
      });
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({ total: 0, done: 0, current: t('backup.startingDownload'), errors: 0, skipped: 0 });

    try {
      const result = await downloadCloudItems((p) => setDownloadProgress(p));

      // Guardar fecha de última descarga
      await storageService.saveSecure(BACKUP_PREFS.LAST_DOWNLOAD, new Date().toISOString());
      await loadAll();

      if (result.downloaded === 0 && result.errors === 0) {
        alertRef.show({
          title: t('backup.synced'),
          message: result.skipped > 0
            ? t('backup.downloadSkipped', { skipped: result.skipped })
            : t('backup.noCloudFiles'),
          type: 'success',
        });
      } else if (result.errors === 0) {
        alertRef.show({
          title: t('backup.downloadComplete'),
          message: t('backup.downloadResult', { downloaded: result.downloaded, skipped: result.skipped }),
          type: 'success',
        });
      } else {
        alertRef.show({
          title: t('backup.downloadPartial'),
          message: t('backup.downloadPartialResult', { downloaded: result.downloaded, errors: result.errors }),
          type: 'warning',
        });
      }
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('backup.downloadFailed'), type: 'error' });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, [isDownloading, isUploading, prefs.enabled, loadAll]);

  // ─── Labels formateados ───────────────────────────────────────────────────

  const lastUploadLabel = formatRelativeTime(prefs.lastRun, t);
  const lastDownloadLabel = formatRelativeTime(prefs.lastDownload, t);

  const pendingCount =
    (Number(stats.photos.total) - Number(stats.photos.backed)) +
    (Number(stats.audio.total) - Number(stats.audio.backed)) +
    (Number(stats.docs.total) - Number(stats.docs.backed)) +
    (Number(stats.transcripts.total) - Number(stats.transcripts.backed));

  const totalCount = Number(stats.photos.total) + Number(stats.audio.total) + Number(stats.docs.total) + Number(stats.transcripts.total);
  const backedCount = Number(stats.photos.backed) + Number(stats.audio.backed) + Number(stats.docs.backed) + Number(stats.transcripts.backed);

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
