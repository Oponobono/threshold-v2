import notifee, { AndroidImportance, AndroidStyle } from '@notifee/react-native';
import { NotificationProvider } from './NotificationProvider';
import { LongRunningOperation, OperationStage, OperationType } from '../lro/OperationProgress';

const CHANNEL_ID = 'lro_progress';
const CHANNEL_NAME = 'Operaciones en progreso';

const STAGE_LABELS: Partial<Record<OperationStage, string>> = {
  [OperationStage.Preparing]: 'Preparando...',
  [OperationStage.Collecting]: 'Recopilando elementos...',
  [OperationStage.Compressing]: 'Comprimiendo datos...',
  [OperationStage.Uploading]: 'Subiendo archivos...',
  [OperationStage.Downloading]: 'Descargando archivos...',
  [OperationStage.Processing]: 'Procesando...',
  [OperationStage.Verifying]: 'Verificando integridad...',
  [OperationStage.Finishing]: 'Finalizando...',
};

const OP_TITLES: Record<string, string> = {
  [OperationType.Backup]: '☁ Respaldando Threshold',
  [OperationType.Restore]: '☁ Restaurando datos',
  [OperationType.Sync]: '🔄 Sincronizando',
  [OperationType.Download]: '⬇ Descargando',
  [OperationType.Upload]: '⬆ Subiendo',
  [OperationType.Import]: '📥 Importando',
  [OperationType.Export]: '📤 Exportando',
  [OperationType.OCR]: '🔍 Procesando documento',
  [OperationType.Indexing]: '📚 Indexando',
};

const OP_COMPLETED_TITLES: Record<string, string> = {
  [OperationType.Backup]: '☁ Respaldo completado',
  [OperationType.Restore]: '☁ Restauración completada',
  [OperationType.Sync]: '🔄 Sincronización completada',
  [OperationType.Download]: '⬇ Descarga completada',
  [OperationType.Upload]: '⬆ Subida completada',
  [OperationType.Import]: '📥 Importación completada',
  [OperationType.Export]: '📤 Exportación completada',
  [OperationType.OCR]: '🔍 Documento procesado',
  [OperationType.Indexing]: '📚 Indexación completada',
};

const UPDATE_THROTTLE_MS = 2000;

export class NotifeeOperationProvider implements NotificationProvider {
  private channelCreated = false;
  private _lastUpdateMap: Map<string, number> = new Map();
  private _pendingUpdates: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async initialize(): Promise<void> {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: CHANNEL_NAME,
      importance: AndroidImportance.LOW, // Silencioso, sin sonido ni vibración
    });
    this.channelCreated = true;
    console.log('[NotifeeProvider] Canal LRO creado.');
  }

  async showOperationProgress(operation: LongRunningOperation): Promise<void> {
    /**
     * @dangerSISTEMA DESACTIVADO TEMPORALMENTE (DIAGNÓSTICO DESTELOS NEGROS)
     * 
     * Contexto:
     * En dispositivos Android con MIUI/HyperOS, la actualización frecuente de
     * notificaciones nativas (Notifee) durante el proceso de Delta Sync estaba
     * provocando timeouts en SurfaceFlinger. Esto se manifestaba visualmente como un
     * "destello negro" en la pantalla de la aplicación cada ~15 segundos.
     * 
     * Soluciones previas implementadas (que mitigan pero no eliminan el problema de raíz):
     * 1. Se eliminó la propiedad de `progress` (barra de progreso nativa) en favor de texto,
     *    ya que la barra forzaba a SystemUI a repintar a 60fps.
     * 2. Se implementó un "throttle" (UPDATE_THROTTLE_MS = 2000ms) para limitar
     *    la frecuencia de llamadas al módulo nativo.
     * 3. Se corrigió un bug en NotificationProvider (parseo de triggerDate) y se
     *    serializaron las llamadas al Reconciler (eliminando Promise.all).
     * 
     * Estado actual:
     * Para confirmar aislar 100% que Notifee es el causante del bloqueo en el hilo JS/Nativo,
     * todos los métodos visuales de LRO (progress, completed, failed, cancelled) han sido
     * DESACTIVADOS mediante un early return. Si con esto los destellos desaparecen, el siguiente
     * paso será rediseñar cómo se muestra el progreso de sincronización (quizá UI in-app en lugar
     * de notificaciones de sistema para LRO de alta frecuencia).
     */
    return;
  }



  async showOperationCompleted(operation: LongRunningOperation, message?: string): Promise<void> {
    return; // Completamente desactivado para pruebas
  }

  async showOperationFailed(operation: LongRunningOperation, errorMessage?: string): Promise<void> {
    return; // Completamente desactivado para pruebas
  }

  async showOperationCancelled(operation: LongRunningOperation): Promise<void> {
    return; // Completamente desactivado para pruebas
  }

  async dismissOperation(operationId: string): Promise<void> {
    if (this._pendingUpdates.has(operationId)) {
      clearTimeout(this._pendingUpdates.get(operationId));
      this._pendingUpdates.delete(operationId);
    }
    await notifee.cancelNotification(operationId);
  }

  async dismissAllOperations(): Promise<void> {
    for (const timeout of this._pendingUpdates.values()) {
      clearTimeout(timeout);
    }
    this._pendingUpdates.clear();
    await notifee.cancelAllNotifications();
  }
}
