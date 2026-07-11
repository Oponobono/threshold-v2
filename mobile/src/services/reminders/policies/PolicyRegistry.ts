import { ReminderPolicy } from './ReminderPolicy';

export class PolicyRegistry {
  private _policies = new Map<string, ReminderPolicy>();

  register(policy: ReminderPolicy): void {
    this._policies.set(policy.entityType, policy);
  }

  get(entityType: string): ReminderPolicy {
    const policy = this._policies.get(entityType);
    if (!policy) {
      throw new Error(`No policy registered for entity type: '${entityType}'`);
    }
    return policy;
  }

  has(entityType: string): boolean {
    return this._policies.has(entityType);
  }

  getAll(): readonly ReminderPolicy[] {
    return Array.from(this._policies.values());
  }

  remove(entityType: string): boolean {
    return this._policies.delete(entityType);
  }

  clear(): void {
    this._policies.clear();
  }

  get size(): number {
    return this._policies.size;
  }
}
