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

export class NotifeeOperationProvider implements NotificationProvider {
  private channelCreated = false;

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
    if (!this.channelCreated) await this.initialize();

    const title = OP_TITLES[operation.type] ?? 'Operación en progreso';
    const stage = operation.stage;
    const stageLabel = (stage && STAGE_LABELS[stage]) ?? operation.message ?? 'En progreso...';
    const progress = operation.progress;

    await notifee.displayNotification({
      id: operation.id,
      title,
      body: operation.message ?? stageLabel,
      android: {
        channelId: CHANNEL_ID,
        ongoing: true,          // No descartable mientras está activa
        onlyAlertOnce: true,    // No repetir sonido en actualizaciones
        progress: progress
          ? { max: 100, current: progress.percentage, indeterminate: progress.indeterminate }
          : { max: 100, current: 0, indeterminate: true }, // Estado inicial indeterminado

      },
    });
  }

  async showOperationCompleted(operation: LongRunningOperation, message?: string): Promise<void> {
    if (!this.channelCreated) await this.initialize();

    const title = OP_COMPLETED_TITLES[operation.type] ?? 'Operación completada';

    await notifee.displayNotification({
      id: operation.id,
      title,
      body: message ?? 'Proceso finalizado correctamente.',
      android: {
        channelId: CHANNEL_ID,
        ongoing: false,
        progress: { max: 100, current: 100, indeterminate: false },

        autoCancel: true, // Se descarta al tocarla
      },
    });

    // Auto-dismiss tras 4 segundos
    setTimeout(() => {
      notifee.cancelNotification(operation.id).catch(() => {});
    }, 4000);
  }

  async showOperationFailed(operation: LongRunningOperation, errorMessage?: string): Promise<void> {
    if (!this.channelCreated) await this.initialize();

    const title = `❌ ${OP_TITLES[operation.type] ?? 'Operación'} falló`;

    await notifee.displayNotification({
      id: operation.id,
      title,
      body: errorMessage ?? 'Ocurrió un error durante el proceso.',
      android: {
        channelId: CHANNEL_ID,
        ongoing: false,

        autoCancel: true,
      },
    });
  }

  async showOperationCancelled(operation: LongRunningOperation): Promise<void> {
    if (!this.channelCreated) await this.initialize();

    const title = `⚠️ ${OP_TITLES[operation.type] ?? 'Operación'} cancelada`;

    await notifee.displayNotification({
      id: operation.id,
      title,
      body: 'La operación fue cancelada.',
      android: {
        channelId: CHANNEL_ID,
        ongoing: false,

        autoCancel: true,
      },
    });
  }

  async dismissOperation(operationId: string): Promise<void> {
    await notifee.cancelNotification(operationId);
  }

  async dismissAllOperations(): Promise<void> {
    await notifee.cancelAllNotifications();
  }
}
