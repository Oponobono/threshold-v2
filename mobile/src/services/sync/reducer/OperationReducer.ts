import type { SyncQueueItem } from '../../database/repositories/SyncQueueRepository';

export type ReducedOperationType = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';

export interface ReducedOperation {
  operation: ReducedOperationType;
  entity_type: string;
  entity_id: string;
  payload: any;
  originalIds: number[];
}

interface EntityState {
  hasCreate: boolean;
  hasDelete: boolean;
  deleteAfterCreate: boolean;
  latestPayload: any;
  latestPayloadId: number | null;
  lastOp: 'CREATE' | 'UPDATE' | 'DELETE' | null;
}

const EMPTY_STATE: EntityState = {
  hasCreate: false,
  hasDelete: false,
  deleteAfterCreate: false,
  latestPayload: undefined,
  latestPayloadId: null,
  lastOp: null,
};

function getPayload(item: SyncQueueItem): any {
  if (!item.payload) return undefined;
  try {
    return JSON.parse(item.payload);
  } catch {
    return item.payload;
  }
}

export function reduceEntity(items: SyncQueueItem[]): ReducedOperation | null {
  if (items.length === 0) return null;

  const state: EntityState = { ...EMPTY_STATE };
  const originalIds: number[] = [];
  const sorted = [...items].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  for (const item of sorted) {
    originalIds.push(item.id ?? 0);

    switch (item.operation) {
      case 'CREATE':
        if (state.hasDelete && !state.hasCreate) {
          // DELETE antes de CREATE → restauración
          state.deleteAfterCreate = false;
        }
        state.hasCreate = true;
        state.lastOp = 'CREATE';
        state.latestPayload = getPayload(item);
        state.latestPayloadId = item.id ?? null;
        break;

      case 'UPDATE':
        if (!state.hasCreate) {
          state.lastOp = 'UPDATE';
        }
        const updatePayload = getPayload(item);
        if (state.latestPayload && typeof state.latestPayload === 'object' && updatePayload && typeof updatePayload === 'object') {
          state.latestPayload = { ...state.latestPayload, ...updatePayload };
        } else {
          state.latestPayload = updatePayload;
        }
        state.latestPayloadId = item.id ?? null;
        break;

      case 'DELETE':
        state.hasDelete = true;
        if (state.hasCreate) {
          state.deleteAfterCreate = true;
        }
        state.lastOp = 'DELETE';
        break;
    }
  }

  const entityType = sorted[0].entity_type;
  const entityId = sorted[0].entity_id!;

  // DELETE después de CREATE → todo offline, no-op
  if (state.deleteAfterCreate) {
    return null;
  }

  // DELETE + CREATE (restauración del mismo ID) → RESTORE
  if (state.hasDelete && state.hasCreate && !state.deleteAfterCreate) {
    return {
      operation: 'RESTORE',
      entity_type: entityType,
      entity_id: entityId,
      payload: state.latestPayload,
      originalIds,
    };
  }

  // CREATE sin DELETE → CREATE con último payload
  if (state.hasCreate && !state.hasDelete) {
    return {
      operation: 'CREATE',
      entity_type: entityType,
      entity_id: entityId,
      payload: state.latestPayload,
      originalIds,
    };
  }

  // DELETE sin CREATE → DELETE
  if (state.hasDelete && !state.hasCreate) {
    return {
      operation: 'DELETE',
      entity_type: entityType,
      entity_id: entityId,
      payload: undefined,
      originalIds,
    };
  }

  // Solo UPDATEs → UPDATE con último payload
  return {
    operation: 'UPDATE',
    entity_type: entityType,
    entity_id: entityId,
    payload: state.latestPayload,
    originalIds,
  };
}
