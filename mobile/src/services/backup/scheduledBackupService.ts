/**
 * scheduledBackupService.ts
 *
 * Servicio de backup automático programado.
 * Usa expo-background-fetch + expo-task-manager para ejecutar un backup
 * diario a la hora que el usuario configure.
 *
 * LIMITACIONES DEL SISTEMA OPERATIVO:
 * - Android: El intervalo mínimo real es ~15 min. Doze Mode puede retrasar la
 *   ejecución. La hora es aproximada (±15 min).
 * - iOS: El sistema controla cuándo ejecuta el fetch; la hora es orientativa.
 */
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { getScheduledBackupConfig, runBackup } from './backupService';
import { syncService } from '../database';
import {
  showBackupUploadNotification,
  updateBackupUploadNotification,
  cancelBackupUploadNotification,
} from '../notificationService';

export const BACKUP_TASK_NAME = 'threshold-scheduled-backup';

// ── Registrar el task handler (debe ejecutarse en el root del módulo) ────────
TaskManager.defineTask(BACKUP_TASK_NAME, async () => {
  try {
    console.log('[ScheduledBackup] 🕐 Task ejecutado por el sistema');

    const config = await getScheduledBackupConfig();
    if (!config.enabled) {
      console.log('[ScheduledBackup] ⏭️ Backup programado desactivado, saltando.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Verificar si la hora actual coincide con la hora programada (±15 min)
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const scheduledMinutes = config.hour * 60 + config.minute;
    const diff = Math.abs(currentMinutes - scheduledMinutes);

    // Tolerancia: 15 minutos antes o después
    const TOLERANCE_MINUTES = 15;
    if (diff > TOLERANCE_MINUTES && diff < (24 * 60 - TOLERANCE_MINUTES)) {
      console.log(`[ScheduledBackup] ⏰ Hora actual (${now.getHours()}:${now.getMinutes()}) no coincide con la programada (${config.hour}:${config.minute}). Saltando.`);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log(`[ScheduledBackup] ✅ Ejecutando backup tipo: ${config.type}`);

    // Mostrar notificación de progreso
    await showBackupUploadNotification(0).catch(() => {});

    let hasNewData = false;

    // 1. Sincronizar datos de BD
    if (config.type === 'datos' || config.type === 'ambos') {
      const syncResult = await syncService.sync();
      if (syncResult.success > 0) hasNewData = true;
      console.log(`[ScheduledBackup] 📊 Datos sincronizados: ${syncResult.success} éxitos, ${syncResult.failed} fallos`);
    }

    // 2. Respaldar archivos multimedia
    if (config.type === 'multimedia' || config.type === 'ambos') {
      const result = await runBackup((p) => {
        updateBackupUploadNotification(p.done, p.total, p.current).catch(() => {});
      }, {
        includePhotos: true,
        includeAudio: true,
        includeDocs: true,
        includeTranscripts: true,
      });
      if (result.uploaded > 0) hasNewData = true;
      console.log(`[ScheduledBackup] 🗂️ Multimedia: ${result.uploaded} subidos, ${result.errors} errores`);
    }

    // Notificación desaparece al finalizar
    await cancelBackupUploadNotification().catch(() => {});

    return hasNewData
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[ScheduledBackup] ❌ Error en el task:', error);
    await cancelBackupUploadNotification().catch(() => {});
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Registra el background task para el backup programado.
 * Intervalo mínimo: 15 minutos (limitación del SO).
 * Llamar al iniciar la app si el backup programado está activado.
 */
export const registerScheduledBackup = async (): Promise<void> => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKUP_TASK_NAME);
    if (isRegistered) {
      console.log('[ScheduledBackup] Task ya registrado.');
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKUP_TASK_NAME, {
      minimumInterval: 60 * 60, // cada hora (el SO decide cuándo ejecutar)
      stopOnTerminate: false,   // continúa aunque el usuario cierre la app
      startOnBoot: true,        // se reactiva al reiniciar el dispositivo
    });
    console.log('[ScheduledBackup] ✅ Task registrado correctamente.');
  } catch (error) {
    console.error('[ScheduledBackup] ❌ Error al registrar task:', error);
  }
};

/**
 * Cancela el background task.
 * Llamar cuando el usuario desactiva el backup programado.
 */
export const unregisterScheduledBackup = async (): Promise<void> => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKUP_TASK_NAME);
    if (!isRegistered) return;
    await BackgroundFetch.unregisterTaskAsync(BACKUP_TASK_NAME);
    console.log('[ScheduledBackup] ✅ Task cancelado.');
  } catch (error) {
    console.error('[ScheduledBackup] ❌ Error al cancelar task:', error);
  }
};

/**
 * Verifica si el task está actualmente registrado en el sistema.
 */
export const isScheduledBackupRegistered = async (): Promise<boolean> => {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKUP_TASK_NAME);
  } catch {
    return false;
  }
};
