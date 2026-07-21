import { OperationType, LongRunningOperation, OperationStage } from '../lro/OperationProgress';

/**
 * NotificationProvider (Interface)
 * Abstracción sobre la librería de notificaciones concreta.
 * ExpoReminderProvider se usa para Reminder Notifications.
 * NotifeeOperationProvider se usa para Operation (LRO) Notifications.
 */
export interface NotificationProvider {
  /**
   * Initialize the provider (create channels, request permissions, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Display or update a progress notification for a long running operation.
   */
  showOperationProgress(operation: LongRunningOperation): Promise<void>;

  /**
   * Mark an operation notification as completed.
   */
  showOperationCompleted(operation: LongRunningOperation, message?: string): Promise<void>;

  /**
   * Mark an operation notification as failed.
   */
  showOperationFailed(operation: LongRunningOperation, errorMessage?: string): Promise<void>;

  /**
   * Mark an operation notification as cancelled.
   */
  showOperationCancelled(operation: LongRunningOperation): Promise<void>;

  /**
   * Dismiss the notification for a given operation.
   */
  dismissOperation(operationId: string): Promise<void>;

  /**
   * Dismiss all operation notifications.
   * Useful to clear phantom notifications after app restart.
   */
  dismissAllOperations(): Promise<void>;
}
