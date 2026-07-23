import { OperationNotificationController } from '../OperationNotificationController';
import { NotificationProvider } from '../NotificationProvider';
import { OperationStage, OperationType, LongRunningOperation, OperationState } from '../../lro/OperationProgress';
import { operationProgressBus } from '../../lro/OperationProgressEmitter';

describe('OperationNotificationController', () => {
  let mockProvider: jest.Mocked<NotificationProvider>;
  let controller: OperationNotificationController;

  beforeEach(async () => {
    mockProvider = {
      initialize: jest.fn().mockResolvedValue(undefined),
      showOperationProgress: jest.fn().mockResolvedValue(undefined),
      showOperationCompleted: jest.fn().mockResolvedValue(undefined),
      showOperationFailed: jest.fn().mockResolvedValue(undefined),
      showOperationCancelled: jest.fn().mockResolvedValue(undefined),
      dismissOperation: jest.fn().mockResolvedValue(undefined),
      dismissAllOperations: jest.fn().mockResolvedValue(undefined),
    };

    controller = new OperationNotificationController(mockProvider);
    await controller.initialize();
  });

  afterEach(() => {
    controller.dispose();
  });

  it('should call dismissAllOperations on initialization', () => {
    expect(mockProvider.dismissAllOperations).toHaveBeenCalled();
  });

  it('should handle lifecycle (started -> progress -> completed)', async () => {
    const operation: LongRunningOperation = {
      id: 'test-1',
      type: OperationType.Backup,
      state: OperationState.Running,
      startedAt: Date.now(),
      stage: OperationStage.Preparing,
    };

    // 1. Started
    operationProgressBus.emit('started', { operation });
    expect(mockProvider.showOperationProgress).toHaveBeenCalledWith(operation);

    // 2. Progress
    operation.progress = { current: 50, total: 100, percentage: 50, indeterminate: false };
    operationProgressBus.emit('progress', { operation });
    expect(mockProvider.showOperationProgress).toHaveBeenCalledTimes(2); // started + progress

    // 3. Completed
    operationProgressBus.emit('completed', { operation, result: { success: 10 } });
    expect(mockProvider.showOperationCompleted).toHaveBeenCalledWith(operation, expect.stringContaining('10 sincronizados'));
  });

  it('should throttle progress updates but flush completed immediately', async () => {
    jest.useFakeTimers();

    const operation: LongRunningOperation = {
      id: 'test-throttle',
      type: OperationType.Backup,
      state: OperationState.Running,
      startedAt: Date.now(),
      stage: OperationStage.Uploading,
      progress: { current: 1, total: 100, percentage: 1, indeterminate: false }
    };

    // Emitimos el primero (pasa directo)
    operationProgressBus.emit('progress', { operation });
    expect(mockProvider.showOperationProgress).toHaveBeenCalledTimes(1);

    // Emitimos 100 veces sin avanzar el tiempo
    for (let i = 2; i <= 101; i++) {
      operation.progress = { current: i, total: 100, percentage: i, indeterminate: false };
      operationProgressBus.emit('progress', { operation });
    }

    // No deberia haber llamado de nuevo porque no pasaron 250ms
    expect(mockProvider.showOperationProgress).toHaveBeenCalledTimes(1);

    // Avanzamos 250ms
    jest.advanceTimersByTime(250);

    // Emitimos uno nuevo, este si deberia pasar
    operation.progress = { current: 102, total: 100, percentage: 100, indeterminate: false };
    operationProgressBus.emit('progress', { operation });
    expect(mockProvider.showOperationProgress).toHaveBeenCalledTimes(2);

    // Completado debe emitirse de inmediato sin esperar throttle
    operationProgressBus.emit('completed', { operation });
    expect(mockProvider.showOperationCompleted).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should clear operation maps on failed or cancelled', () => {
    const operation: LongRunningOperation = { id: 'test-2', type: OperationType.Sync, state: OperationState.Running, startedAt: Date.now() };
    
    // Started
    operationProgressBus.emit('started', { operation });
    expect(mockProvider.showOperationProgress).toHaveBeenCalled();

    // Cancelled
    operationProgressBus.emit('cancelled', { operation });
    expect(mockProvider.showOperationCancelled).toHaveBeenCalled();
  });
});
