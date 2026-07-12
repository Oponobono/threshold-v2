import { PolicyRegistry } from '../policies/PolicyRegistry';
import { AssessmentPolicy } from '../policies/AssessmentPolicy';
import { ClassPolicy } from '../policies/ClassPolicy';
import { ReviewPolicy } from '../policies/ReviewPolicy';
import { EventPolicy } from '../policies/EventPolicy';
import { GradingPolicy } from '../policies/GradingPolicy';
import { SequenceFactory } from '../SequenceFactory';
import { ReminderSnapshotAssembler } from '../ReminderSnapshotAssembler';
import { ReminderEngine } from '../ReminderEngine';
import { ReminderSnapshotBuilder } from '../ReminderSnapshotBuilder';
import { FakeClock } from '../Clock';
import { InterruptionPolicy } from '../InterruptionPolicy';
import { TemplateResolver } from '../TemplateResolver';
import { NotificationReconciler } from '../NotificationReconciler';
import type { NotificationProvider, ScheduledNotificationInfo } from '../NotificationProvider';
import type { I18nService } from '../I18nService';
import type { ReminderSourceSnapshot, ScheduledReminder, ReminderSequence } from '../types';

// ── Fake implementations ──────────────────────────────────────────

class FakeI18n implements I18nService {
  translate(key: string, params?: any): string {
    const map: Record<string, string> = {
      'entity.assessment': 'Examen',
      'entity.schedule': 'Clase',
      'intentTitle.prepare_exam': 'Preparar {entity}',
      'intentTitle.attend_class': 'Asistir a {entity}',
      'intentTitle.review_cards': 'Repasar {entity}',
      'intentBody.prepare_exam': 'Tu {entity} se acerca.',
      'intentBody.attend_class': 'Tu {entity} comienza pronto.',
      'intentBody.review_cards': 'Tienes tarjetas pendientes.',
    };
    const template = map[key] ?? key;
    return template.replace('{entity}', params?.entity ?? '');
  }
}

class CaptureProvider implements NotificationProvider {
  readonly scheduled: ScheduledReminder[] = [];
  readonly cancelled: string[] = [];

  async requestPermissions(): Promise<boolean> { return true; }
  async setupChannels(): Promise<void> {}

  async schedule(reminder: ScheduledReminder): Promise<string> {
    this.scheduled.push(reminder);
    return reminder.id;
  }

  async cancel(id: string): Promise<void> {
    this.cancelled.push(id);
    const idx = this.scheduled.findIndex((r) => r.id === id);
    if (idx >= 0) this.scheduled.splice(idx, 1);
  }

  async cancelAll(prefix?: string): Promise<void> {
    if (prefix) {
      const toCancel = this.scheduled.filter((r) => r.id.startsWith(prefix)).map((r) => r.id);
      this.cancelled.push(...toCancel);
      for (const id of toCancel) {
        const idx = this.scheduled.findIndex((r) => r.id === id);
        if (idx >= 0) this.scheduled.splice(idx, 1);
      }
    } else {
      this.cancelled.push(...this.scheduled.map((r) => r.id));
      this.scheduled.length = 0;
    }
  }

  async getAll(): Promise<ScheduledNotificationInfo[]> {
    return this.scheduled.map((r) => ({
      identifier: r.id, title: r.title, body: r.body, triggerDate: r.scheduledAt,
    }));
  }

  reset(): void {
    this.scheduled.length = 0;
    this.cancelled.length = 0;
  }
}

// ── Fake repos for SnapshotBuilder ────────────────────────────────

class FakeRepos {
  assessments: { getAll: () => Promise<any[]> };
  schedules: { getAll: () => Promise<any[]> };
  flashcard_decks: { getAll: () => Promise<any[]> };
  grading_periods: { getAll: () => Promise<any[]> };
  calendar_events: { getAll: () => Promise<any[]> };

  constructor(initialData?: Record<string, any[]>) {
    this.assessments = { getAll: async () => [] };
    this.schedules = { getAll: async () => [] };
    this.flashcard_decks = { getAll: async () => [] };
    this.grading_periods = { getAll: async () => [] };
    this.calendar_events = { getAll: async () => [] };
    if (initialData) this.load(initialData);
  }

  private _store: Record<string, any[]> = {};

  load(data: Record<string, any[]>): void {
    this._store = {};
    for (const key of ['assessments', 'schedules', 'flashcard_decks', 'grading_periods', 'calendar_events']) {
      this._store[key] = [...(data[key] ?? [])];
    }
    this._rebuild();
  }

  applyCreate(entityType: string, entity: any): void {
    const key = this._entityTypeToKey(entityType);
    if (!key) return;
    this._store[key] = this._store[key] ?? [];
    this._store[key].push(entity);
    this._rebuild();
  }

  applyUpdate(entityType: string, entity: any): void {
    const key = this._entityTypeToKey(entityType);
    if (!key) return;
    const arr = this._store[key] ?? [];
    const idx = arr.findIndex((e: any) => e.id === entity.id);
    if (idx >= 0) arr[idx] = entity;
    else arr.push(entity);
    this._rebuild();
  }

  applyDelete(entityType: string, entityId: string): void {
    const key = this._entityTypeToKey(entityType);
    if (!key) return;
    this._store[key] = (this._store[key] ?? []).filter((e: any) => e.id !== entityId);
    this._rebuild();
  }

  private _entityTypeToKey(entityType: string): string | null {
    const map: Record<string, string> = {
      assessment: 'assessments',
      schedule: 'schedules',
      flashcard_deck: 'flashcard_decks',
      grading_period: 'grading_periods',
      calendar_event: 'calendar_events',
    };
    return map[entityType] ?? null;
  }

  private _rebuild(): void {
    this.assessments = { getAll: async () => [...(this._store.assessments ?? [])] };
    this.schedules = { getAll: async () => [...(this._store.schedules ?? [])] };
    this.flashcard_decks = { getAll: async () => [...(this._store.flashcard_decks ?? [])] };
    this.grading_periods = { getAll: async () => [...(this._store.grading_periods ?? [])] };
    this.calendar_events = { getAll: async () => [...(this._store.calendar_events ?? [])] };
  }
}

// ── Delta types ───────────────────────────────────────────────────

type Delta =
  | { type: 'create'; entityType: string; entity: any }
  | { type: 'update'; entityType: string; entity: any }
  | { type: 'delete'; entityType: string; entityId: string };

// ── Test infrastructure ──────────────────────────────────────────

const ANCHOR = new Date('2026-07-10T10:00:00Z');

interface EngineContext {
  clock: FakeClock;
  provider: CaptureProvider;
  engine: ReminderEngine;
}

function createEngineContext(): EngineContext {
  const clock = new FakeClock(ANCHOR);
  const registry = new PolicyRegistry();
  registry.register(new AssessmentPolicy());
  registry.register(new ClassPolicy());
  registry.register(new ReviewPolicy());
  registry.register(new EventPolicy());
  registry.register(new GradingPolicy());

  const assembler = new ReminderSnapshotAssembler();
  const factory = new SequenceFactory(clock, assembler);
  const interruption = new InterruptionPolicy(clock);
  const templates = new TemplateResolver(new FakeI18n());
  const provider = new CaptureProvider();
  const reconciler = new NotificationReconciler();
  const engine = new ReminderEngine(registry, factory, interruption, templates, reconciler, provider, clock);

  return { clock, provider, engine };
}

interface EngineState {
  sequences: readonly ReminderSequence[];
  scheduled: readonly ScheduledReminder[];
}

function captureState(ctx: EngineContext): EngineState {
  return {
    sequences: ctx.engine.getDesiredSequences(),
    scheduled: [...ctx.provider.scheduled],
  };
}

async function applyDeltas(ctx: EngineContext, deltas: Delta[]): Promise<void> {
  for (const delta of deltas) {
    switch (delta.type) {
      case 'create':
      case 'update':
        await ctx.engine.onEntityChanged(delta.entityType, delta.entity.id, delta.entity);
        break;
      case 'delete':
        await ctx.engine.onEntityDeleted(delta.entityType, delta.entityId);
        break;
    }
  }
}

async function buildSnapshot(repos: FakeRepos): Promise<ReminderSourceSnapshot> {
  const builder = new ReminderSnapshotBuilder(repos);
  return builder.build();
}

function stateAsJSON(state: EngineState): string {
  return JSON.stringify({
    seqCount: state.sequences.length,
    seqs: state.sequences.map(s => ({
      id: s.id,
      entityType: s.entityType,
      entityId: s.entityId,
      status: s.status,
      reminderCount: s.reminders.length,
      reminderIds: s.reminders.map(r => r.id),
      reminderTimes: s.reminders.map(r => r.scheduledAt.toISOString()),
    })),
    scheduledCount: state.scheduled.length,
    scheduledIds: state.scheduled.map(s => s.id),
  });
}

async function compareConvergence(
  initialData: Record<string, any[]>,
  deltas: Delta[],
): Promise<void> {
  const ctx = createEngineContext();

  // Phase 1: Initialize engine with initial data
  const initialRepos = new FakeRepos(initialData);
  const initSnapshot = await buildSnapshot(initialRepos);
  await ctx.engine.initialize(initSnapshot);

  // Phase 2: Apply deltas incrementally (simulating delta sync)
  // Also update the repos as deltas arrive (simulating DB write)
  const currentRepos = new FakeRepos(initialData);
  for (const delta of deltas) {
    switch (delta.type) {
      case 'create':
        currentRepos.applyCreate(delta.entityType, delta.entity);
        await ctx.engine.onEntityChanged(delta.entityType, delta.entity.id, delta.entity);
        break;
      case 'update':
        currentRepos.applyUpdate(delta.entityType, delta.entity);
        await ctx.engine.onEntityChanged(delta.entityType, delta.entity.id, delta.entity);
        break;
      case 'delete':
        currentRepos.applyDelete(delta.entityType, delta.entityId);
        await ctx.engine.onEntityDeleted(delta.entityType, delta.entityId);
        break;
    }
  }

  // Capture state after incremental processing
  const stateIncremental = captureState(ctx);

  // Phase 3: Rebuild snapshot from current repos and re-initialize
  const finalSnapshot = await buildSnapshot(currentRepos);
  await ctx.engine.initialize(finalSnapshot);

  // Capture state after snapshot rebuild
  const stateSnapshot = captureState(ctx);

  // Phase 4: Compare — both paths must produce identical state
  try {
    expect(stateSnapshot.sequences).toEqual(stateIncremental.sequences);
  } catch (e) {
    throw new Error(
      `Sequences differ after convergence\n\n` +
      `Incremental path: ${stateAsJSON(stateIncremental)}\n` +
      `Snapshot path:    ${stateAsJSON(stateSnapshot)}`
    );
  }

  try {
    expect(stateSnapshot.scheduled).toEqual(stateIncremental.scheduled);
  } catch (e) {
    throw new Error(
      `Scheduled notifications differ after convergence\n\n` +
      `Incremental path: ${JSON.stringify(stateIncremental.scheduled)}\n` +
      `Snapshot path:    ${JSON.stringify(stateSnapshot.scheduled)}`
    );
  }
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Sprint 6.2 — Delta Sync Convergence', () => {
  // ── Escenario A: Delta pequeño ──────────────────────────────────

  describe('Escenario A — Delta pequeño', () => {
    it('1 create + 1 update + 1 delete converge con snapshot', async () => {
      await compareConvergence(
        {},
        [
          { type: 'create', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Examen A' } },
          { type: 'update', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-16T10:00:00Z').toISOString(), title: 'Examen A (movido)' } },
          { type: 'delete', entityType: 'assessment', entityId: 'a1' },
        ],
      );
    });
  });

  // ── Escenario B: Delta mixto ────────────────────────────────────

  describe('Escenario B — Delta mixto', () => {
    it('entidades de varios tipos convergen', async () => {
      await compareConvergence(
        {},
        [
          { type: 'create', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Examen A' } },
          { type: 'create', entityType: 'schedule', entity: { id: 's1', startTime: new Date('2026-07-11T09:00:00Z').toISOString(), endTime: new Date('2026-07-11T10:30:00Z').toISOString(), title: 'Clase 1' } },
          { type: 'create', entityType: 'grading_period', entity: { id: 'g1', name: 'Q1', closeDate: new Date('2026-08-01T00:00:00Z').toISOString() } },
          { type: 'create', entityType: 'calendar_event', entity: { id: 'e1', title: 'Evento', startDate: new Date('2026-07-12T15:00:00Z').toISOString(), endDate: new Date('2026-07-12T16:00:00Z').toISOString() } },
          { type: 'update', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-20T10:00:00Z').toISOString(), title: 'Examen A (movido)' } },
          { type: 'delete', entityType: 'schedule', entityId: 's1' },
        ],
      );
    });
  });

  // ── Escenario C: Delta redundante ───────────────────────────────

  describe('Escenario C — Delta redundante', () => {
    it('multiples updates sobre misma entidad convergen', async () => {
      await compareConvergence(
        {},
        [
          { type: 'create', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Original' } },
          { type: 'update', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-16T10:00:00Z').toISOString(), title: 'Update 1' } },
          { type: 'update', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-17T10:00:00Z').toISOString(), title: 'Update 2' } },
          { type: 'update', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-18T10:00:00Z').toISOString(), title: 'Update 3' } },
          { type: 'update', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-19T10:00:00Z').toISOString(), title: 'Update 4' } },
        ],
      );
    });
  });

  // ── Escenario D: Resync completo ────────────────────────────────

  describe('Escenario D — Resync completo', () => {
    it('estado incremental y reconstruccion total son identicos', async () => {
      const ctx = createEngineContext();
      const repos = new FakeRepos();

      // Initialize empty
      const snapshot0 = await buildSnapshot(repos);
      await ctx.engine.initialize(snapshot0);

      // Apply mixed deltas (simulating real-world usage)
      const deltas: Delta[] = [
        { type: 'create', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Parcial' } },
        { type: 'create', entityType: 'schedule', entity: { id: 's1', startTime: new Date('2026-07-11T09:00:00Z').toISOString(), endTime: new Date('2026-07-11T10:30:00Z').toISOString(), title: 'Clase' } },
        { type: 'create', entityType: 'flashcard_deck', entity: { id: 'd1', name: 'Capitulo 3', dueCardsCount: 5 } },
        { type: 'update', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-20T10:00:00Z').toISOString(), title: 'Parcial (movido)' } },
        { type: 'create', entityType: 'calendar_event', entity: { id: 'e1', title: 'Revision', startDate: new Date('2026-07-12T15:00:00Z').toISOString(), endDate: new Date('2026-07-12T16:00:00Z').toISOString() } },
        { type: 'delete', entityType: 'flashcard_deck', entityId: 'd1' },
        { type: 'update', entityType: 'calendar_event', entity: { id: 'e1', title: 'Revision (confirmada)', startDate: new Date('2026-07-13T15:00:00Z').toISOString(), endDate: new Date('2026-07-13T16:00:00Z').toISOString() } },
        { type: 'create', entityType: 'grading_period', entity: { id: 'g1', name: 'Q2', closeDate: new Date('2026-09-01T00:00:00Z').toISOString() } },
      ];

      for (const delta of deltas) {
        switch (delta.type) {
          case 'create':
            repos.applyCreate(delta.entityType, delta.entity);
            await ctx.engine.onEntityChanged(delta.entityType, delta.entity.id, delta.entity);
            break;
          case 'update':
            repos.applyUpdate(delta.entityType, delta.entity);
            await ctx.engine.onEntityChanged(delta.entityType, delta.entity.id, delta.entity);
            break;
          case 'delete':
            repos.applyDelete(delta.entityType, delta.entityId);
            await ctx.engine.onEntityDeleted(delta.entityType, delta.entityId);
            break;
        }
      }

      const stateBefore = captureState(ctx);

      // Full resync: rebuild snapshot and re-initialize
      const finalSnapshot = await buildSnapshot(repos);
      await ctx.engine.initialize(finalSnapshot);

      const stateAfter = captureState(ctx);

      try {
        expect(stateAfter.sequences).toEqual(stateBefore.sequences);
      } catch (e) {
        throw new Error(
          `Resync changed sequences!\n\nBefore: ${stateAsJSON(stateBefore)}\nAfter:  ${stateAsJSON(stateAfter)}`
        );
      }

      try {
        expect(stateAfter.scheduled).toEqual(stateBefore.scheduled);
      } catch (e) {
        throw new Error(
          `Resync changed scheduled notifications!\n\nBefore: ${JSON.stringify(stateBefore.scheduled)}\nAfter:  ${JSON.stringify(stateAfter.scheduled)}`
        );
      }
    });

    it('resync con datos iniciales no cambia el estado', async () => {
      const ctx = createEngineContext();
      const repos = new FakeRepos({
        assessments: [{ id: 'a1', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Examen' }],
        schedules: [],
        flashcard_decks: [{ id: 'd1', name: 'Mazo', dueCardsCount: 10 }],
        grading_periods: [],
        calendar_events: [],
      });

      const snapshot = await buildSnapshot(repos);
      await ctx.engine.initialize(snapshot);

      const stateBefore = captureState(ctx);

      // Resync with same data
      const sameSnapshot = await buildSnapshot(repos);
      await ctx.engine.initialize(sameSnapshot);

      const stateAfter = captureState(ctx);

      expect(stateAfter.sequences).toEqual(stateBefore.sequences);
      expect(stateAfter.scheduled).toEqual(stateBefore.scheduled);
    });
  });

  // ── Escenario E (bonus): Delta en orden inverso ─────────────────

  describe('Escenario E — Delta en orden inverso', () => {
    it('create + delete + recreate produce mismo estado que solo create', async () => {
      await compareConvergence(
        {},
        [
          { type: 'create', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Examen' } },
          { type: 'delete', entityType: 'assessment', entityId: 'a1' },
          { type: 'create', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Examen' } },
        ],
      );
    });
  });
});
