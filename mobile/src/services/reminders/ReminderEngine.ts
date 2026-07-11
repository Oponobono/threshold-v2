import type { Clock } from './Clock';
import type { PolicyRegistry } from './policies/PolicyRegistry';
import type { SequenceFactory } from './SequenceFactory';
import type { InterruptionPolicy } from './InterruptionPolicy';
import type { TemplateResolver } from './TemplateResolver';
import type { NotificationReconciler } from './NotificationReconciler';
import type { NotificationProvider } from './NotificationProvider';
import type {
  ReminderSequence,
  ReminderProfile,
  EntitySnapshot,
  EnvironmentContext,
  EngineTraceEntry,
  StageTiming,
} from './types';

type EngineEvent =
  | { readonly type: 'entity_changed'; entityType: string; entityId: string; entity: any }
  | { readonly type: 'entity_deleted'; entityType: string; entityId: string }
  | { readonly type: 'action_completed'; entityType: string; entityId: string }
  | { readonly type: 'environment_changed'; context: EnvironmentContext };

interface QueuedEvent {
  event: EngineEvent;
  resolve: () => void;
  reject: (error: unknown) => void;
}

const ENTITY_TYPES = ['assessment', 'schedule', 'flashcard_deck', 'calendar_event', 'grading_period'] as const;
const MAX_TRACE_SIZE = 200;

export class ReminderEngine {
  private desiredSequences = new Map<string, ReminderSequence>();
  private eventQueue: QueuedEvent[] = [];
  private processing = false;
  private destroyed = false;
  private traceBuffer: EngineTraceEntry[] = [];

  constructor(
    private registry: PolicyRegistry,
    private factory: SequenceFactory,
    private interruption: InterruptionPolicy,
    private templates: TemplateResolver,
    private reconciler: NotificationReconciler,
    private provider: NotificationProvider,
    private clock: Clock,
  ) {}

  async initialize(snapshot: EntitySnapshot): Promise<void> {
    const start = this.clock.now().getTime();

    for (const entityType of ENTITY_TYPES) {
      const entities = this._getEntities(snapshot, entityType);
      for (const entity of entities) {
        const seq = this._buildDesiredSequence(entity, entityType);
        this.desiredSequences.set(seq.id, seq);
      }
    }

    const stats = await this._runPipeline();
    const durationMs = this.clock.now().getTime() - start;
    this._trace('initialize', durationMs, stats);
  }

  async onEntityChanged(entityType: string, entityId: string, entity: any): Promise<void> {
    return this._enqueue({ type: 'entity_changed', entityType, entityId, entity });
  }

  async onEntityDeleted(entityType: string, entityId: string): Promise<void> {
    return this._enqueue({ type: 'entity_deleted', entityType, entityId });
  }

  async onActionCompleted(entityType: string, entityId: string): Promise<void> {
    return this._enqueue({ type: 'action_completed', entityType, entityId });
  }

  async onEnvironmentChanged(context: EnvironmentContext): Promise<void> {
    return this._enqueue({ type: 'environment_changed', context });
  }

  onReminderTapped(_reminderId: string): void {
    // Sincrono, solo navegación. El Engine no modifica estado.
  }

  async cancelAll(): Promise<void> {
    const start = this.clock.now().getTime();
    this.desiredSequences.clear();
    const stats = await this._runPipeline();
    const durationMs = this.clock.now().getTime() - start;
    this._trace('cancel_all', durationMs, stats);
  }

  getDesiredSequences(): readonly ReminderSequence[] {
    return Array.from(this.desiredSequences.values());
  }

  getTraceLog(): readonly EngineTraceEntry[] {
    return [...this.traceBuffer];
  }

  clearTraceLog(): void {
    this.traceBuffer = [];
  }

  destroy(): void {
    this.destroyed = true;
    for (const q of this.eventQueue) {
      q.reject(new Error('Engine destroyed'));
    }
    this.eventQueue = [];
    this.desiredSequences.clear();
  }

  private _getProfileFor(entityType: string): ReminderProfile {
    return this.registry.get(entityType).defaultProfile;
  }

  private _enqueue(event: EngineEvent): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('Engine destroyed'));
    }

    return new Promise<void>((resolve, reject) => {
      this.eventQueue.push({ event, resolve, reject });
      if (!this.processing) {
        this.processing = true;
        Promise.resolve().then(() => this._process());
      }
    });
  }

  private async _process(): Promise<void> {
    while (this.eventQueue.length > 0 && !this.destroyed) {
      const queued = this.eventQueue[0];
      this.eventQueue.shift();
      try {
        await this._handleEvent(queued.event);
        queued.resolve();
      } catch (error) {
        queued.reject(error);
      }
    }
    this.processing = false;
  }

  private async _handleEvent(event: EngineEvent): Promise<void> {
    const start = this.clock.now().getTime();

    switch (event.type) {
      case 'entity_changed': {
        const seq = this._buildDesiredSequence(event.entity, event.entityType);
        this.desiredSequences.set(seq.id, seq);
        break;
      }
      case 'entity_deleted': {
        const key = `${event.entityType}::${event.entityId}`;
        this.desiredSequences.delete(key);
        break;
      }
      case 'action_completed': {
        const key = `${event.entityType}::${event.entityId}`;
        this.desiredSequences.delete(key);
        break;
      }
      case 'environment_changed':
        break;
    }

    const stats = await this._runPipeline();
    const durationMs = this.clock.now().getTime() - start;
    this._trace(event.type, durationMs, stats);
  }

  private async _runPipeline(): Promise<{ scheduled: number; cancelled: number }> {
    if (this.destroyed) return { scheduled: 0, cancelled: 0 };

    const stages: StageTiming[] = [];

    const t0 = this.clock.now().getTime();
    const sequences = Array.from(this.desiredSequences.values());
    stages.push({ name: 'collect_sequences', durationMs: this.clock.now().getTime() - t0, sequenceCount: sequences.length });

    const t1 = this.clock.now().getTime();
    const plan = this.interruption.resolve(sequences);
    stages.push({ name: 'interruption.resolve', durationMs: this.clock.now().getTime() - t1, entityCount: sequences.length });

    const t2 = this.clock.now().getTime();
    const enriched = this.templates.enrich(plan);
    stages.push({ name: 'templates.enrich', durationMs: this.clock.now().getTime() - t2 });

    const t3 = this.clock.now().getTime();
    const result = await this.reconciler.sync(enriched, this.provider);
    stages.push({ name: 'reconciler.sync', durationMs: this.clock.now().getTime() - t3, scheduledCount: result.scheduled, cancelledCount: result.cancelled });

    this._pendingStages = stages;

    return result;
  }

  private _pendingStages?: StageTiming[];

  private _buildDesiredSequence(entity: any, entityType: string): ReminderSequence {
    const te0 = this.clock.now().getTime();
    const policy = this.registry.get(entityType);
    const profile = this._getProfileFor(entityType);
    const offsets = policy.getOffsets(entity, profile);
    const expiresAt = policy.getExpiration(entity);
    const seq = this.factory.buildSequence(entity, entityType, offsets, profile, expiresAt);
    if (!this._buildStages) this._buildStages = [];
    this._buildStages.push({ name: 'entity.build', durationMs: this.clock.now().getTime() - te0, entityCount: 1, sequenceCount: 1 });
    return seq;
  }

  private _buildStages?: StageTiming[];

  private _trace(eventType: string, durationMs: number, stats: { scheduled: number; cancelled: number }): void {
    if (this.traceBuffer.length >= MAX_TRACE_SIZE) {
      this.traceBuffer.shift();
    }
    const allStages = this._pendingStages ? [...this._pendingStages] : [];
    if (this._buildStages) {
      allStages.push(...this._buildStages);
    }
    this.traceBuffer.push({
      timestamp: this.clock.now(),
      eventType,
      durationMs,
      sequences: this.desiredSequences.size,
      scheduled: stats.scheduled,
      cancelled: stats.cancelled,
      stages: allStages.length > 0 ? allStages : undefined,
    });
    this._pendingStages = undefined;
    this._buildStages = undefined;
  }

  private _getEntities(snapshot: EntitySnapshot, entityType: string): readonly any[] {
    switch (entityType) {
      case 'assessment':
        return snapshot.assessments ?? [];
      case 'schedule':
        return snapshot.schedules ?? [];
      case 'flashcard_deck':
        return snapshot.flashcard_decks ?? [];
      case 'calendar_event':
        return snapshot.calendar_events ?? [];
      case 'grading_period':
        return snapshot.grading_periods ?? [];
      default:
        return [];
    }
  }
}
