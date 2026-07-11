import { PolicyRegistry } from '../../policies/PolicyRegistry';
import { ReminderPolicy } from '../../policies/ReminderPolicy';
import type { ReminderProfile } from '../../types';

function createMockPolicy(entityType: string): ReminderPolicy {
  const profile: ReminderProfile = {
    name: 'standard',
    defaultOffsets: [0],
  };
  return {
    entityType,
    defaultProfile: profile,
    getOffsets: () => profile.defaultOffsets,
    shouldCancel: () => false,
    shouldCancelReminder: () => false,
    getExpiration: () => null,
  };
}

describe('PolicyRegistry', () => {
  let registry: PolicyRegistry;

  beforeEach(() => {
    registry = new PolicyRegistry();
  });

  it('registers and retrieves a policy', () => {
    const policy = createMockPolicy('assessment');
    registry.register(policy);
    expect(registry.get('assessment')).toBe(policy);
  });

  it('throws when getting unregistered type', () => {
    expect(() => registry.get('nonexistent')).toThrow(
      "No policy registered for entity type: 'nonexistent'",
    );
  });

  it('returns correct has() value', () => {
    registry.register(createMockPolicy('assessment'));
    expect(registry.has('assessment')).toBe(true);
    expect(registry.has('schedule')).toBe(false);
  });

  it('returns all registered policies', () => {
    const a = createMockPolicy('assessment');
    const b = createMockPolicy('schedule');
    registry.register(a);
    registry.register(b);
    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(a);
    expect(all).toContain(b);
  });

  it('removes a policy', () => {
    registry.register(createMockPolicy('assessment'));
    expect(registry.has('assessment')).toBe(true);
    registry.remove('assessment');
    expect(registry.has('assessment')).toBe(false);
  });

  it('clear removes all policies', () => {
    registry.register(createMockPolicy('assessment'));
    registry.register(createMockPolicy('schedule'));
    registry.clear();
    expect(registry.size).toBe(0);
  });

  it('tracks size accurately', () => {
    expect(registry.size).toBe(0);
    registry.register(createMockPolicy('a'));
    expect(registry.size).toBe(1);
    registry.register(createMockPolicy('b'));
    expect(registry.size).toBe(2);
    registry.remove('a');
    expect(registry.size).toBe(1);
  });

  it('overwrites existing policy on re-register', () => {
    const p1 = createMockPolicy('assessment');
    const p2 = createMockPolicy('assessment');
    registry.register(p1);
    registry.register(p2);
    expect(registry.get('assessment')).toBe(p2);
    expect(registry.size).toBe(1);
  });

  it('returns empty array when no policies', () => {
    expect(registry.getAll()).toEqual([]);
  });
});
