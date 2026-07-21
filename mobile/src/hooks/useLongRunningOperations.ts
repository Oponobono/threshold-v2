import { useState, useEffect } from 'react';
import { operationProgressBus } from '../services/lro/OperationProgressEmitter';
import { LongRunningOperation } from '../services/lro/OperationProgress';

/**
 * Hook to consume all active Long Running Operations (LRO).
 * The UI never subscribes directly to the emitter; it uses this hook
 * which translates the bus events into React State.
 */
export function useLongRunningOperations(): LongRunningOperation[] {
  const [operations, setOperations] = useState<LongRunningOperation[]>(
    operationProgressBus.getActiveOperations()
  );

  useEffect(() => {
    const updateState = () => {
      setOperations([...operationProgressBus.getActiveOperations()]);
    };

    const unsubStarted = operationProgressBus.on('started', updateState);
    const unsubProgress = operationProgressBus.on('progress', updateState);
    const unsubCompleted = operationProgressBus.on('completed', updateState);
    const unsubFailed = operationProgressBus.on('failed', updateState);
    const unsubCancelled = operationProgressBus.on('cancelled', updateState);

    // Set initial state again in case it changed before the effect ran
    updateState();

    return () => {
      unsubStarted();
      unsubProgress();
      unsubCompleted();
      unsubFailed();
      unsubCancelled();
    };
  }, []);

  return operations;
}

/**
 * Hook to consume a specific active operation by ID.
 */
export function useOperation(id: string): LongRunningOperation | undefined {
  const operations = useLongRunningOperations();
  return operations.find(op => op.id === id);
}

/**
 * Hook to consume active operations by type (e.g., Backup).
 */
export function useOperationsByType(type: string): LongRunningOperation[] {
  const operations = useLongRunningOperations();
  return operations.filter(op => op.type === type);
}
