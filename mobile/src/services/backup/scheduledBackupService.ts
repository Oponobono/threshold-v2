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
import { getScheduledBackupConfig, runBackup, BACKUP_PREFS } from './backupService';
import { syncService } from '../database';
import { storageService } from '../storageService';
import {
  showBackupUploadNotification,
  updateBackupUploadNotification,
  cancelBackupUploadNotification,
} from '../notificationService';

export const BACKUP_TASK_NAME = 'threshold-scheduled-backup';

// ── Registrar el task handler (debe ejecutarse en el root del módulo) ────────
TaskManager.defineTask(BACKUP_TASK_NAME, async () => {
  try {
    const now = new Date();
    console.log(`[ScheduledBackup] 🕐 Task ejecutado por el sistema a las ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);

    const config = await getScheduledBackupConfig();
    if (!config.enabled) {
      console.log('[ScheduledBackup] ⏭️ Backup programado desactivado, saltando.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Estrategia: Ejecutar 1 vez por día en una ventana flexible
    // El SO de Android/iOS controla cuándo ejecutar, así que permitimos ejecución
    // entre las horas configuradas ± 2 horas de flexibilidad
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinutes;
    const scheduledTotalMinutes = config.hour * 60 + config.minute;
    
    // Ventana: 2 horas antes y después de la hora programada
    const WINDOW_MINUTES = 120;
    const minAllowed = scheduledTotalMinutes - WINDOW_MINUTES;
    const maxAllowed = scheduledTotalMinutes + WINDOW_MINUTES;
    
    // Comprobar si estamos dentro de la ventana
    const inWindow = (currentTotalMinutes >= minAllowed && currentTotalMinutes <= maxAllowed);
    
    if (!inWindow) {
      console.log(`[ScheduledBackup] ⏰ Hora actual (${String(currentHour).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}) fuera de ventana [${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')} ±2h]. Saltando.`);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    
    // Verificar que no se haya ejecutado ya hoy
    const lastRunStr = await storageService.getSecure('backup_scheduled_last_run');
    if (lastRunStr) {
      const lastRun = new Date(lastRunStr);
      const lastRunDate = `${lastRun.getFullYear()}-${String(lastRun.getMonth() + 1).padStart(2, '0')}-${String(lastRun.getDate()).padStart(2, '0')}`;
      const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      if (lastRunDate === todayDate) {
        console.log(`[ScheduledBackup] ✅ Backup ya ejecutado hoy a las ${lastRun.getHours()}:${String(lastRun.getMinutes()).padStart(2, '0')}. Saltando para evitar duplicados.`);
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }
    }
    
    console.log(`[ScheduledBackup] ✅ Ventana de ejecución válida. Ejecutando backup tipo: ${config.type}`);

    console.log(`[ScheduledBackup] ✅ Ejecutando backup tipo: ${config.type}`);

    // Mostrar notificación de progreso
    await showBackupUploadNotification(0).catch(() => {});

    // 1. Sincronizar datos de BD
    if (config.type === 'datos' || config.type === 'ambos') {
      const syncResult = await syncService.sync();
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
      console.log(`[ScheduledBackup] 🗂️ Multimedia: ${result.uploaded} subidos, ${result.errors} errores`);
    }

    // Guardar marca de tiempo de última ejecución
    await storageService.saveSecure(BACKUP_PREFS.SCHEDULED_LAST_RUN, new Date().toISOString()).catch(() => {});
    console.log(`[ScheduledBackup] 💾 Última ejecución registrada`);

    // Notificación desaparece al finalizar
    await cancelBackupUploadNotification().catch(() => {});

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[ScheduledBackup] ❌ Error en el task:', error);
    console.error('[ScheduledBackup] Stack:', error instanceof Error ? error.stack : 'No stack available');
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
      console.log('[ScheduledBackup] ✅ Task ya estaba registrado, actualizando intervalo...');
      // No volvemos a registrar si ya existe - el SO mantiene la configuración
      return;
    }

    console.log('[ScheduledBackup] 📝 Registrando nuevo task de backup programado...');
    await BackgroundFetch.registerTaskAsync(BACKUP_TASK_NAME, {
      minimumInterval: 15 * 60, // 15 minutos mínimo (el SO puede ejecutar más frecuentemente)
      stopOnTerminate: false,   // continúa aunque el usuario cierre la app
      startOnBoot: true,        // se reactiva al reiniciar el dispositivo
    });
    console.log('[ScheduledBackup] ✅ Task registrado correctamente con intervalo mínimo de 15 minutos.');
  } catch (error) {
    console.error('[ScheduledBackup] ❌ Error al registrar task:', error);
    if (error instanceof Error) {
      console.error('[ScheduledBackup] Detalles:', error.message);
    }
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

/**
 * Función de TESTING/DEBUG: Ejecuta el backup programado inmediatamente.
 * Ignora la verificación de hora para permitir testing rápido.
 * Usa la misma lógica del task pero forzado a ejecutar.
 */
export const testScheduledBackupNow = async (
  onProgress?: (progress: { done: number; total: number; current: string; errors: number }) => void
): Promise<{ success: boolean; uploaded: number; errors: number }> => {
  try {
    const now = new Date();
    console.log(`[ScheduledBackup] 🧪 TEST: Ejecutando backup programado manualmente a las ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);

    const config = await getScheduledBackupConfig();
    if (!config.enabled) {
      console.log('[ScheduledBackup] 🧪 TEST: Backup programado desactivado, continuando de todas formas...');
    }

    console.log(`[ScheduledBackup] 🧪 TEST: Ejecutando backup tipo: ${config.type}`);

    // Mostrar notificación de progreso
    await showBackupUploadNotification(0).catch(() => {});

    let hasNewData = false;
    let totalUploaded = 0;
    let totalErrors = 0;

    // 1. Sincronizar datos de BD
    if (config.type === 'datos' || config.type === 'ambos') {
      const syncResult = await syncService.sync();
      if (syncResult.success > 0) hasNewData = true;
      console.log(`[ScheduledBackup] 🧪 TEST - Datos: ${syncResult.success} éxitos, ${syncResult.failed} fallos`);
    }

    // 2. Respaldar archivos multimedia
    if (config.type === 'multimedia' || config.type === 'ambos') {
      const result = await runBackup((p) => {
        updateBackupUploadNotification(p.done, p.total, p.current).catch(() => {});
        onProgress?.(p);
      }, {
        includePhotos: true,
        includeAudio: true,
        includeDocs: true,
        includeTranscripts: true,
      });
      if (result.uploaded > 0) hasNewData = true;
      totalUploaded = result.uploaded;
      totalErrors = result.errors;
      console.log(`[ScheduledBackup] 🧪 TEST - Multimedia: ${result.uploaded} subidos, ${result.errors} errores`);
    }

    // Guardar marca de tiempo de última ejecución
    await storageService.saveSecure(BACKUP_PREFS.SCHEDULED_LAST_RUN, new Date().toISOString()).catch(() => {});
    console.log(`[ScheduledBackup] 🧪 TEST: Última ejecución registrada`);

    // Notificación desaparece al finalizar
    await cancelBackupUploadNotification().catch(() => {});

    console.log(`[ScheduledBackup] 🧪 TEST: Completado - ${totalUploaded} subidos, ${totalErrors} errores`);
    return { success: totalErrors === 0, uploaded: totalUploaded, errors: totalErrors };
  } catch (error) {
    console.error('[ScheduledBackup] 🧪 TEST: Error en ejecución manual:', error);
    if (error instanceof Error) {
      console.error('[ScheduledBackup] 🧪 TEST: Stack:', error.stack);
    }
    await cancelBackupUploadNotification().catch(() => {});
    return { success: false, uploaded: 0, errors: 1 };
  }
};
