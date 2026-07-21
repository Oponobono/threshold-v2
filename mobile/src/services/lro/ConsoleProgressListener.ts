import { operationProgressBus } from './OperationProgressEmitter';
import { OperationType, OperationState } from './OperationProgress';

export function initializeConsoleProgressListener() {
  operationProgressBus.on('started', (event) => {
    console.log(`[LRO-Bus] [${event.operation.type}] Started: ${event.operation.id}`);
  });

  operationProgressBus.on('progress', (event) => {
    const stage = event.operation.stage || 'running';
    const percent = event.operation.progress?.percentage || 0;
    const msg = event.operation.message ? ` - ${event.operation.message}` : '';
    console.log(`[LRO-Bus] [${event.operation.type}] ${stage}: ${percent.toFixed(1)}%${msg}`);
  });

  operationProgressBus.on('completed', (event) => {
    console.log(`[LRO-Bus] [${event.operation.type}] Completed! Result:`, event.result);
  });

  operationProgressBus.on('failed', (event) => {
    console.error(`[LRO-Bus] [${event.operation.type}] Failed! Error:`, event.error);
  });

  operationProgressBus.on('cancelled', (event) => {
    console.warn(`[LRO-Bus] [${event.operation.type}] Cancelled.`);
  });
}
