import type { ReducedOperation } from './OperationReducer';

export interface ValidationError {
  operationIndex: number;
  entity_type: string;
  entity_id: string;
  message: string;
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  user: ['id', 'email'],
  subject: ['id', 'name', 'user_id'],
  course: ['id', 'name', 'user_id'],
  assessment: ['id', 'subject_id', 'name'],
  schedule: ['id', 'subject_id'],
  'flashcard-deck': ['id', 'name'],
  flashcard: ['id', 'deck_id'],
  photo: ['id', 'user_id'],
  'audio-recording': ['id', 'user_id'],
  'scanned-document': ['id', 'user_id'],
  'calendar-event': ['id', 'user_id', 'title'],
};

export function validateOperations(operations: ReducedOperation[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    if (!op.entity_type) {
      errors.push({ operationIndex: i, entity_type: '', entity_id: op.entity_id, message: 'Missing entity_type' });
      continue;
    }

    if (!op.entity_id) {
      errors.push({ operationIndex: i, entity_type: op.entity_type, entity_id: '', message: 'Missing entity_id' });
    }

    if (op.operation === 'CREATE' || op.operation === 'RESTORE') {
      const required = REQUIRED_FIELDS[op.entity_type];
      if (required && op.payload) {
        for (const field of required) {
          if (op.payload[field] === undefined || op.payload[field] === null) {
            errors.push({
              operationIndex: i,
              entity_type: op.entity_type,
              entity_id: op.entity_id,
              message: `Missing required field: ${field}`,
            });
          }
        }
      }
    }
  }

  return errors;
}

export function validateEntityIds(operations: ReducedOperation[], existingEntityIds: Set<string>): ValidationError[] {
  const errors: ValidationError[] = [];
  const createdIds = new Set<string>();

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    if (op.operation === 'CREATE' || op.operation === 'RESTORE') {
      createdIds.add(`${op.entity_type}:${op.entity_id}`);
    }

    if ((op.operation === 'UPDATE' || op.operation === 'DELETE') && op.entity_id) {
      const key = `${op.entity_type}:${op.entity_id}`;
      if (!existingEntityIds.has(key) && !createdIds.has(key)) {
        errors.push({
          operationIndex: i,
          entity_type: op.entity_type,
          entity_id: op.entity_id,
          message: `Entity does not exist locally or in this batch`,
        });
      }
    }
  }

  return errors;
}
