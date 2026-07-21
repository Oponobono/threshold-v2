import { 
  LROStartedEvent, 
  LROProgressUpdatedEvent, 
  LROCompletedEvent, 
  LROFailedEvent, 
  LROCancelledEvent,
  LongRunningOperation,
  OperationState,
  STAGE_ORDER
} from './OperationProgress';

export type LROEventType = 
  | 'started' 
  | 'progress' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

type ListenersMap = {
  started: Set<(event: LROStartedEvent) => void>;
  progress: Set<(event: LROProgressUpdatedEvent) => void>;
  completed: Set<(event: LROCompletedEvent) => void>;
  failed: Set<(event: LROFailedEvent) => void>;
  cancelled: Set<(event: LROCancelledEvent) => void>;
};

class OperationProgressEmitter {
  private listeners: ListenersMap = {
    started: new Set(),
    progress: new Set(),
    completed: new Set(),
    failed: new Set(),
    cancelled: new Set()
  };

  private activeOperations: Map<string, LongRunningOperation> = new Map();

  public on<T extends LROEventType>(
    event: T, 
    listener: (data: ExtractEvent<T>) => void
  ): () => void {
    // @ts-ignore
    this.listeners[event].add(listener);
    return () => {
      // @ts-ignore
      this.listeners[event].delete(listener);
    };
  }

  public getActiveOperations(): LongRunningOperation[] {
    return Array.from(this.activeOperations.values());
  }

  public getOperation(id: string): LongRunningOperation | undefined {
    return this.activeOperations.get(id);
  }

  public getOperationsByType(type: string): LongRunningOperation[] {
    return Array.from(this.activeOperations.values()).filter(op => op.type === type);
  }

  public emit<T extends LROEventType>(event: T, data: ExtractEvent<T>): void {
    const operation = data.operation;

    if (event === 'started') {
      // Rule: Max 1 active operation per Type
      const existing = Array.from(this.activeOperations.values()).find(op => op.type === operation.type);
      if (existing) {
        console.warn(`[LRO-Bus] Operation of type ${operation.type} is already active (id: ${existing.id}).`);
      }
      operation.state = OperationState.Running;
      this.activeOperations.set(operation.id, { ...operation });
    } 
    else {
      const active = this.activeOperations.get(operation.id);
      if (!active) {
        console.warn(`[LRO-Bus] Emitting ${event} for unknown/inactive operation: ${operation.id}`);
      } else {
        // Lifecycle validation
        if (active.state === OperationState.Completed || active.state === OperationState.Failed || active.state === OperationState.Cancelled) {
          console.warn(`[LRO-Bus] Cannot emit ${event} for operation ${operation.id} because it is already ${active.state}.`);
          return; // Block invalid transition
        }

        // Monotonicity checks
        if (event === 'progress' && operation.progress && active.progress && !operation.progress.indeterminate) {
          if (operation.progress.percentage < active.progress.percentage) {
            console.warn(`[LRO-Bus] Progress for ${operation.id} went backwards from ${active.progress.percentage}% to ${operation.progress.percentage}%. Ignoring.`);
            return;
          }
        }

        if (event === 'progress' && operation.stage && active.stage) {
          if (STAGE_ORDER[operation.stage] < STAGE_ORDER[active.stage]) {
            console.warn(`[LRO-Bus] Stage for ${operation.id} went backwards from ${active.stage} to ${operation.stage}. Ignoring.`);
            return;
          }
        }
      }

      if (event === 'completed') {
        operation.state = OperationState.Completed;
        this.activeOperations.delete(operation.id);
      } else if (event === 'failed') {
        operation.state = OperationState.Failed;
        this.activeOperations.delete(operation.id);
      } else if (event === 'cancelled') {
        operation.state = OperationState.Cancelled;
        this.activeOperations.delete(operation.id);
      } else if (event === 'progress') {
        this.activeOperations.set(operation.id, { ...operation });
      }
    }

    // @ts-ignore
    this.listeners[event].forEach((listener) => listener(data));
  }
}

type ExtractEvent<T extends LROEventType> = 
  T extends 'started' ? LROStartedEvent :
  T extends 'progress' ? LROProgressUpdatedEvent :
  T extends 'completed' ? LROCompletedEvent :
  T extends 'failed' ? LROFailedEvent :
  T extends 'cancelled' ? LROCancelledEvent : never;

export const operationProgressBus = new OperationProgressEmitter();
