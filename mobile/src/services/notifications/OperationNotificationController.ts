import { NotificationProvider } from './NotificationProvider';
import { operationProgressBus } from '../lro/OperationProgressEmitter';
import { LROStartedEvent, LROProgressUpdatedEvent, LROCompletedEvent, LROFailedEvent, LROCancelledEvent } from '../lro/OperationProgress';
import { LongRunningOperation } from '../lro/OperationProgress';

const THROTTLE_MS = 250; // Max one Notifee update per 250ms per operation

/**
 * OperationNotificationController
 * 
 * Sits between OperationProgressEmitter and NotificationProvider.
 * Responsibilities:
 *  - Throttle progress updates to avoid hammering Android
 *  - Translate LRO events to NotificationProvider calls
 *  - Ignore invalid/duplicate states
 *  - Decide notification priority (progress vs. completed)
 *
 * The NotificationProvider knows nothing about LRO logic.
 * This controller knows nothing about Android APIs.
 */
export class OperationNotificationController {
  private provider: NotificationProvider;
  private lastUpdateMs: Map<string, number> = new Map();
  private lastPercentage: Map<string, number> = new Map();
  private unsubscribers: Array<() => void> = [];

  constructor(provider: NotificationProvider) {
    this.provider = provider;
  }

  async initialize(): Promise<void> {
    await this.provider.initialize();
    await this.provider.dismissAllOperations(); // Limpiar notificaciones fantasma al iniciar

    const unsubStarted = operationProgressBus.on('started', this.handleStarted.bind(this));
    const unsubProgress = operationProgressBus.on('progress', this.handleProgress.bind(this));
    const unsubCompleted = operationProgressBus.on('completed', this.handleCompleted.bind(this));
    const unsubFailed = operationProgressBus.on('failed', this.handleFailed.bind(this));
    const unsubCancelled = operationProgressBus.on('cancelled', this.handleCancelled.bind(this));

    this.unsubscribers = [unsubStarted, unsubProgress, unsubCompleted, unsubFailed, unsubCancelled];
    console.log('[OperationNotificationController] Subscribed to LRO bus.');
  }

  dispose(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  private async handleStarted(event: LROStartedEvent): Promise<void> {
    const { operation } = event;
    this.lastUpdateMs.delete(operation.id);
    this.lastPercentage.delete(operation.id);
    await this.provider.showOperationProgress(operation);
  }

  private async handleProgress(event: LROProgressUpdatedEvent): Promise<void> {
    const { operation } = event;
    const now = Date.now();
    const lastMs = this.lastUpdateMs.get(operation.id) ?? 0;
    const currentPct = operation.progress?.percentage ?? 0;
    const lastPct = this.lastPercentage.get(operation.id) ?? -1;

    const isThrottled = (now - lastMs) < THROTTLE_MS;
    const isSamePercent = currentPct === lastPct && !operation.progress?.indeterminate;

    // Skip if too soon AND percentage hasn't changed as integer
    if (isThrottled && isSamePercent) return;

    this.lastUpdateMs.set(operation.id, now);
    this.lastPercentage.set(operation.id, currentPct);

    await this.provider.showOperationProgress(operation);
  }

  private async handleCompleted(event: LROCompletedEvent): Promise<void> {
    const { operation, result } = event;
    this.lastUpdateMs.delete(operation.id);
    this.lastPercentage.delete(operation.id);

    const resultMsg = this.buildCompletedMessage(operation, result);
    await this.provider.showOperationCompleted(operation, resultMsg);
  }

  private async handleFailed(event: LROFailedEvent): Promise<void> {
    const { operation, error } = event;
    this.lastUpdateMs.delete(operation.id);
    this.lastPercentage.delete(operation.id);

    const errMsg = error instanceof Error ? error.message : String(error);
    await this.provider.showOperationFailed(operation, errMsg);
  }

  private async handleCancelled(event: LROCancelledEvent): Promise<void> {
    const { operation } = event;
    this.lastUpdateMs.delete(operation.id);
    this.lastPercentage.delete(operation.id);
    
    await this.provider.showOperationCancelled(operation);
  }

  private buildCompletedMessage(operation: LongRunningOperation, result?: any): string {
    if (!result) return 'Proceso finalizado correctamente.';
    const parts: string[] = [];
    if (result.uploaded != null) parts.push(`${result.uploaded} elementos`);
    if (result.downloaded != null) parts.push(`${result.downloaded} descargados`);
    if (result.success != null) parts.push(`${result.success} sincronizados`);
    return parts.length > 0 ? parts.join(' · ') : 'Proceso finalizado correctamente.';
  }
}
