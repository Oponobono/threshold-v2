export type EntityEventType = 'created' | 'updated' | 'deleted';
export type EventPriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface EntityEvent {
  entityType: string;
  eventType: EntityEventType;
  entityId: string;
  entity?: any;
  timestamp: number;
  priority: EventPriority;
}

export interface BatchEntityEvent {
  entityType: string;
  eventType: 'batch_created' | 'batch_updated' | 'batch_deleted';
  entities: { id: string; data?: any }[];
  timestamp: number;
  priority: EventPriority;
}

type EventHandler = (event: EntityEvent) => void;
type BatchEventHandler = (event: BatchEntityEvent) => void;

export class RepositoryEventBus {
  private _listeners: Map<string, Set<EventHandler>> = new Map();
  private _batchListeners: Map<string, Set<BatchEventHandler>> = new Map();
  private _wildcardListeners: Set<EventHandler> = new Set();
  private _batchTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private _pendingBatches: Map<string, { id: string; data?: any }[]> = new Map();

  private _batchWindowMs = 50;

  setBatchWindow(ms: number): void {
    this._batchWindowMs = ms;
  }

  emit(event: EntityEvent): void {
    const entityListeners = this._listeners.get(event.entityType);
    if (entityListeners) {
      entityListeners.forEach(fn => {
        try { fn(event); } catch (err) {
          console.warn(`[RepositoryEventBus] Error in ${event.entityType} listener:`, err);
        }
      });
    }
    this._wildcardListeners.forEach(fn => {
      try { fn(event); } catch (err) {
        console.warn('[RepositoryEventBus] Error in wildcard listener:', err);
      }
    });
    this._debounceBatch(event);
  }

  private _debounceBatch(event: EntityEvent): void {
    if (event.priority === 'HIGH') return;

    const batchKey = `${event.entityType}:${event.eventType}`;
    if (!this._pendingBatches.has(batchKey)) {
      this._pendingBatches.set(batchKey, []);
    }
    this._pendingBatches.get(batchKey)!.push({ id: event.entityId, data: event.entity });

    if (this._batchTimers.has(batchKey)) return;

    this._batchTimers.set(batchKey, setTimeout(() => {
      this._flushBatch(batchKey, event.entityType, event.eventType);
    }, this._batchWindowMs));
  }

  private _flushBatch(batchKey: string, entityType: string, eventType: EntityEventType): void {
    this._batchTimers.delete(batchKey);
    const items = this._pendingBatches.get(batchKey) || [];
    this._pendingBatches.delete(batchKey);
    if (items.length === 0) return;

    const batchEventType = `batch_${eventType}` as BatchEntityEvent['eventType'];
    const batchEvent: BatchEntityEvent = {
      entityType,
      eventType: batchEventType,
      entities: items,
      timestamp: Date.now(),
      priority: 'NORMAL',
    };

    const batchListeners = this._batchListeners.get(entityType);
    if (batchListeners) {
      batchListeners.forEach(fn => {
        try { fn(batchEvent); } catch (err) {
          console.warn(`[RepositoryEventBus] Error in batch listener for ${entityType}:`, err);
        }
      });
    }
  }

  on(entityType: string, handler: EventHandler): () => void {
    if (!this._listeners.has(entityType)) {
      this._listeners.set(entityType, new Set());
    }
    this._listeners.get(entityType)!.add(handler);
    return () => this._listeners.get(entityType)?.delete(handler);
  }

  onBatch(entityType: string, handler: BatchEventHandler): () => void {
    if (!this._batchListeners.has(entityType)) {
      this._batchListeners.set(entityType, new Set());
    }
    this._batchListeners.get(entityType)!.add(handler);
    return () => this._batchListeners.get(entityType)?.delete(handler);
  }

  onAny(handler: EventHandler): () => void {
    this._wildcardListeners.add(handler);
    return () => this._wildcardListeners.delete(handler);
  }

  off(entityType: string, handler: EventHandler): void {
    this._listeners.get(entityType)?.delete(handler);
  }

  removeAll(): void {
    this._listeners.clear();
    this._batchListeners.clear();
    this._wildcardListeners.clear();
    for (const timer of this._batchTimers.values()) {
      clearTimeout(timer);
    }
    this._batchTimers.clear();
    this._pendingBatches.clear();
  }
}

export const repositoryEventBus = new RepositoryEventBus();
