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
  getScheduledBackupConfig,
  saveScheduledBackupConfig,
  ScheduledBackupType,
  ScheduledBackupConfig,
  getScheduledBackupLastRun,
} from '../services/backup/backupService';
import {
  downloadCloudItems,
  getCloudItemsCount,
  DownloadProgress,
} from '../services/backup/downloadService';
import {
  registerScheduledBackup,
  unregisterScheduledBackup,
} from '../services/backup/scheduledBackupService';
import { storageService } from '../services/storageService';
import { alertRef } from '../components/ui/CustomAlert';
import { syncService } from '../services/database';
import {
  showBackupUploadNotification,
  updateBackupUploadNotification,
  cancelBackupUploadNotification,
  showBackupDownloadNotification,
  updateBackupDownloadNotification,
  cancelBackupDownloadNotification,
} from '../services/notificationService';
import { useConnectivityStore } from '../store/useConnectivityStore';

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
    includeAssessmentFiles: true,
    lastRun: null,
    lastDownload: null,
  });

  const [stats, setStats] = useState<BackupStats>({
    photos: { total: 0, backed: 0 },
    audio: { total: 0, backed: 0 },
    docs: { total: 0, backed: 0 },
    transcripts: { total: 0, backed: 0 },
    assessmentFiles: { total: 0, backed: 0 },
    flashcardDecks: { total: 0, backed: 0 },
    aiChats: { total: 0, backed: 0 },
  });

  const [cloudItemsCount, setCloudItemsCount] = useState(0);

  // Estado de upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<BackupProgress | null>(null);

  // Estado de download
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  // Estado del backup programado
  const [scheduledConfig, setScheduledConfig] = useState<ScheduledBackupConfig>({
    enabled: false,
    hour: 2,
    minute: 0,
    type: 'ambos',
  });

  // Última ejecución automática del backup programado
  const [scheduledLastRun, setScheduledLastRun] = useState<Date | null>(null);

  // ─── Carga inicial ────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    const [loadedPrefs, loadedStats, cloudCount, scheduledCfg, scheduledLR] = await Promise.all([
      getBackupPreferences(),
      getBackupStats(),
      getCloudItemsCount(),
      getScheduledBackupConfig(),
      getScheduledBackupLastRun(),
    ]);
    setPrefs(loadedPrefs);
    setStats(loadedStats);
    setCloudItemsCount(cloudCount);
    setScheduledConfig(scheduledCfg);
    setScheduledLastRun(scheduledLR);
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

  const handleBackupNow = useCallback(async (type: 'datos' | 'multimedia' | 'ambos' = 'ambos') => {
    if (isUploading || isDownloading) return;
    if (!prefs.enabled) {
      alertRef.show({
        title: t('backup.disabled'),
        message: t('backup.enableFirst'),
        type: 'warning',
      });
      return;
    }

    const isOffline = !useConnectivityStore.getState().isOnline;
    if (isOffline && type === 'multimedia') {
      console.warn('[useBackupLogic] Backup en modo offline: BD local como fuente de verdad, subida a Uploadthing fallará sin conexión');
    }

    setIsUploading(true);
    setUploadProgress({ total: 0, done: 0, current: t('backup.starting'), errors: 0 });

    try {
      let dataMessage = '';
      
      // 1. Respaldar Datos (SyncQueue → Backend)
      if (type === 'datos' || type === 'ambos') {
        const syncResult = await syncService.sync(undefined, { force: true });
        if (syncResult.success > 0) {
          dataMessage = `Datos sincronizados (${syncResult.success} subidos).`;
        } else if (syncResult.failed > 0) {
          dataMessage = `${syncResult.failed} operaciones fallaron. Reintenta o revisa conexión.`;
        } else {
          dataMessage = 'Tus datos ya están sincronizados.';
        }
        
        if (type === 'datos') {
          cancelBackupUploadNotification().catch(() => {});
          alertRef.show({
            title: syncResult.failed > 0 ? t('backup.partial') : t('backup.complete'),
            message: dataMessage,
            type: syncResult.failed > 0 ? 'warning' : 'success',
          });
          return;
        }
      }

      // 2. Respaldar Multimedia (Archivos en Uploadthing)
      if (type === 'multimedia' || type === 'ambos') {
        const overridePrefs = {
          includeDocs: true,
          includeTranscripts: true,
          includePhotos: true,
          includeAudio: true,
          includeAssessmentFiles: true,
        };

        await showBackupUploadNotification(0);
        const result = await runBackup((p) => {
          setUploadProgress(p);
          updateBackupUploadNotification(p.done, p.total, p.current).catch(() => {});
        }, overridePrefs);

        if (result.uploaded === 0 && result.errors === 0) {
          cancelBackupUploadNotification().catch(() => {});
          alertRef.show({ 
            title: t('backup.allUpToDate'), 
            message: type === 'ambos' ? `${dataMessage} No hay multimedia nueva.` : 'No hay multimedia nueva por respaldar.', 
            type: 'success' 
          });
        } else if (result.errors === 0) {
          cancelBackupUploadNotification().catch(() => {});
          alertRef.show({ 
            title: t('backup.complete'), 
            message: type === 'ambos' ? `${dataMessage} ${result.uploaded} archivos subidos.` : t('backup.uploadResult', { uploaded: result.uploaded }), 
            type: 'success' 
          });
        } else {
          cancelBackupUploadNotification().catch(() => {});
          alertRef.show({ 
            title: t('backup.partial'), 
            message: t('backup.uploadPartial', { uploaded: result.uploaded, errors: result.errors }), 
            type: 'warning' 
          });
        }
      }

      await loadAll();
    } catch (error: any) {
      cancelBackupUploadNotification().catch(() => {});
      alertRef.show({ title: t('common.error'), message: error?.message || t('backup.backupFailed'), type: 'error' });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [isUploading, isDownloading, prefs.enabled, loadAll, t]);

  // ─── Download manual ──────────────────────────────────────────────────────

  const handleDownloadNow = useCallback(async (type: 'datos' | 'multimedia' | 'ambos' = 'ambos') => {
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
      let dataMessage = '';
      
      // 1. Descargar Datos (JSON)
      if (type === 'datos' || type === 'ambos') {
        const { useDataStore } = await import('../store/useDataStore');
        await useDataStore.getState().loadAllData(true);
        dataMessage = 'Datos de la app descargados.';
        
        if (type === 'datos') {
          alertRef.show({ title: t('backup.downloadComplete'), message: dataMessage, type: 'success' });
          setIsDownloading(false);
          setDownloadProgress(null);
          return;
        }
      }

      // 2. Descargar Multimedia
      if (type === 'multimedia' || type === 'ambos') {
        await showBackupDownloadNotification(0);
        const result = await downloadCloudItems((p) => {
          setDownloadProgress(p);
          updateBackupDownloadNotification(p.done, p.total, p.current).catch(() => {});
        });

        // Guardar fecha de última descarga
        await storageService.saveSecure(BACKUP_PREFS.LAST_DOWNLOAD, new Date().toISOString());
        await loadAll();

        if (result.downloaded === 0 && result.errors === 0) {
          cancelBackupDownloadNotification().catch(() => {});
          alertRef.show({
            title: t('backup.synced'),
            message: result.skipped > 0
              ? type === 'ambos' ? `${dataMessage} ${t('backup.downloadSkipped', { skipped: result.skipped })}` : t('backup.downloadSkipped', { skipped: result.skipped })
              : type === 'ambos' ? `${dataMessage} ${t('backup.noCloudFiles')}` : t('backup.noCloudFiles'),
            type: 'success',
          });
        } else if (result.errors === 0) {
          cancelBackupDownloadNotification().catch(() => {});
          alertRef.show({
            title: t('backup.downloadComplete'),
            message: type === 'ambos' ? `${dataMessage} ${t('backup.downloadResult', { downloaded: result.downloaded, skipped: result.skipped })}` : t('backup.downloadResult', { downloaded: result.downloaded, skipped: result.skipped }),
            type: 'success',
          });
        } else {
          cancelBackupDownloadNotification().catch(() => {});
          alertRef.show({
            title: t('backup.downloadPartial'),
            message: t('backup.downloadPartialResult', { downloaded: result.downloaded, errors: result.errors }),
            type: 'warning',
          });
        }
      }
    } catch (error: any) {
      cancelBackupDownloadNotification().catch(() => {});
      alertRef.show({ title: t('common.error'), message: error?.message || t('backup.downloadFailed'), type: 'error' });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, [isDownloading, isUploading, prefs.enabled, loadAll, t]);

  // ─── Backup programado ────────────────────────────────────────────────────

  const handleToggleScheduled = useCallback(async (enabled: boolean) => {
    const updated = { ...scheduledConfig, enabled };
    setScheduledConfig(updated);
    await saveScheduledBackupConfig({ enabled });
    if (enabled) {
      await registerScheduledBackup();
      alertRef.show({
        title: 'Backup programado activado',
        message: `Se respaldará automáticamente a las ${String(updated.hour).padStart(2, '0')}:${String(updated.minute).padStart(2, '0')} cada día.`,
        type: 'success',
      });
    } else {
      await unregisterScheduledBackup();
      alertRef.show({
        title: 'Backup programado desactivado',
        message: 'No se ejecutarán backups automáticos.',
        type: 'info',
      });
    }
  }, [scheduledConfig]);

  const handleSaveScheduledTime = useCallback(async (hour: number, minute: number) => {
    const updated = { ...scheduledConfig, hour, minute };
    setScheduledConfig(updated);
    await saveScheduledBackupConfig({ hour, minute });
    // Re-registrar para que el sistema tome la nueva hora
    if (updated.enabled) {
      await unregisterScheduledBackup();
      await registerScheduledBackup();
    }
  }, [scheduledConfig]);

  const handleSetScheduledType = useCallback(async (type: ScheduledBackupType) => {
    setScheduledConfig(prev => ({ ...prev, type }));
    await saveScheduledBackupConfig({ type });
  }, []);

  // ─── Labels formateados ───────────────────────────────────────────────────

  const lastUploadLabel = formatRelativeTime(prefs.lastRun, t);
  const lastDownloadLabel = formatRelativeTime(prefs.lastDownload, t);

  const pendingCount =
    (Number(stats.photos.total) - Number(stats.photos.backed)) +
    (Number(stats.audio.total) - Number(stats.audio.backed)) +
    (Number(stats.docs.total) - Number(stats.docs.backed)) +
    (Number(stats.transcripts.total) - Number(stats.transcripts.backed)) +
    (Number(stats.assessmentFiles?.total || 0) - Number(stats.assessmentFiles?.backed || 0));

  const totalCount = Number(stats.photos.total) + Number(stats.audio.total) + Number(stats.docs.total) + Number(stats.transcripts.total) + Number(stats.assessmentFiles?.total || 0);
  const backedCount = Number(stats.photos.backed) + Number(stats.audio.backed) + Number(stats.docs.backed) + Number(stats.transcripts.backed) + Number(stats.assessmentFiles?.backed || 0);

  const isBackupRunning = isUploading || isDownloading;

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
    isBackupRunning,
    pendingCount,
    totalCount,
    backedCount,
    // Backup programado
    scheduledConfig,
    handleToggleScheduled,
    handleSaveScheduledTime,
    handleSetScheduledType,
    scheduledLastRun,
    scheduledLastRunFormatted: scheduledLastRun ? formatRelativeTime(scheduledLastRun.toISOString(), t) : t('backup.never'),
  };
};
