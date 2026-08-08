import type { Clock } from './Clock';
import type { PolicyRegistry } from './policies/PolicyRegistry';
import type { ReminderPolicy } from './policies/ReminderPolicy';
import type { SequenceFactory } from './SequenceFactory';
import type { InterruptionPolicy } from './InterruptionPolicy';
import type { TemplateResolver } from './TemplateResolver';
import type { NotificationReconciler } from './NotificationReconciler';
import type { NotificationProvider } from './NotificationProvider';
import { mergeScheduleRows } from './SessionMerger';
import type { LogicalSession } from './SessionMerger';
import { buildScheduleSequences } from './SchedulePlanBuilder';
import type { ScheduleBuildOutcome, SchedulePlanBuilderDeps } from './SchedulePlanBuilder';
import { buildReviewDueSequence, buildReviewDueSequences } from './ReviewDuePlanBuilder';
import type { ReviewBuildOutcome, ReviewDuePlanBuilderDeps } from './ReviewDuePlanBuilder';
import { DEFAULT_PREFERENCES, getCategoryOffsets, isCategoryEnabled } from './ReminderPreferences';
import type { ReminderPreferences } from './ReminderPreferences';
import type {
  ReminderSequence,
  ReminderProfile,
  ReminderSourceSnapshot,
  EnvironmentContext,
  EngineTraceEntry,
  StageTiming,
  DeliveryPlanResolved,
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

const ENTITY_TYPES = ['assessment', 'schedule', 'flashcard_deck', 'calendar_event'] as const;
const MAX_TRACE_SIZE = 200;

export class ReminderEngine {
  private desiredSequences = new Map<string, ReminderSequence>();
  private eventQueue: QueuedEvent[] = [];
  private processing = false;
  private destroyed = false;
  private traceBuffer: EngineTraceEntry[] = [];
  private scheduleRows: readonly any[] = [];
  private completedScheduleSessions = new Set<string>();

  constructor(
    private registry: PolicyRegistry,
    private factory: SequenceFactory,
    private interruption: InterruptionPolicy,
    private templates: TemplateResolver,
    private reconciler: NotificationReconciler,
    private provider: NotificationProvider,
    private clock: Clock,
    private preferencesProvider?: (() => ReminderPreferences) | null,
  ) {}

  async initialize(snapshot: ReminderSourceSnapshot): Promise<void> {
    const start = this.clock.now().getTime();

    const prefs = this.preferences;
    if (prefs) {
      this.scheduleRows = snapshot.schedules ?? [];
    }

    // Rebuild determinista: el snapshot es la verdad. Sin esto, secuencias
    // huérfanas (p.ej. una sesión lógica que desapareció) sobrevivirían al
    // siguiente reconcile. La memoria de "sesión completada" es efímera:
    // el plan se reconstruye desde la DB en cada initialize.
    this.desiredSequences.clear();
    this.completedScheduleSessions.clear();

    if (prefs && !prefs.notificationsEnabled) {
      console.log('[ENGINE] init | notifications disabled — plan vacío');
    } else {
      for (const seq of this._buildSnapshotSequences(snapshot, prefs, this.scheduleRows)) {
        this.desiredSequences.set(seq.id, seq);
      }
    }

    console.log(`[ENGINE] init | entities=${this.desiredSequences.size}`);

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
    return this._sortSequences(Array.from(this.desiredSequences.values()));
  }

  /**
   * Diagnóstico read-only: devuelve el plan enriquecido (título/cuerpo/deeplink)
   * tal como lo produciría el pipeline actual, SIN tocar el provider ni el SO.
   * Si se pasa un snapshot, recomputa las secuencias desde los datos crudos
   * (como en initialize); si no, usa las secuencias ya cacheadas en memoria.
   * Permite comparar lo que el motor "cree" que debe programar contra lo que
   * el sistema operativo tiene realmente agendado.
   */
  async computeCurrentPlan(snapshot?: ReminderSourceSnapshot): Promise<DeliveryPlanResolved> {
    if (this.destroyed) {
      return { planId: 'destroyed', version: 0, generatedAt: this.clock.now(), deliverables: [] };
    }

    let sequences: ReminderSequence[];
    if (snapshot) {
      const prefs = this.preferences;
      if (prefs && !prefs.notificationsEnabled) {
        sequences = [];
      } else {
        sequences = this._buildSnapshotSequences(snapshot, prefs, snapshot.schedules ?? []);
      }
    } else {
      sequences = this._collectSequences();
    }

    const plan = this.interruption.resolve(this._sortSequences(sequences));
    return this.templates.enrich(plan);
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
        if (event.entityType === 'schedule' && this.preferences) {
          this._upsertScheduleRow(event.entity);
          this._rebuildScheduleGroup();
        } else if (event.entityType === 'flashcard_deck') {
          const seq = buildReviewDueSequence(
            event.entity,
            this._reviewPrefs(),
            this._reviewDeps(),
            this._reviewBuildOptions(),
          );
          const key = `${event.entityType}::${event.entityId}::daily`;
          if (seq) {
            this.desiredSequences.set(seq.id, seq);
          } else {
            this.desiredSequences.delete(key);
          }
        } else {
          const seq = this._buildDesiredSequence(event.entity, event.entityType);
          if (seq) {
            this.desiredSequences.set(seq.id, seq);
          } else {
            const key = `${event.entityType}::${event.entityId}`;
            this.desiredSequences.delete(key);
          }
        }
        break;
      }
      case 'entity_deleted': {
        if (event.entityType === 'schedule' && this.preferences) {
          this._removeScheduleRow(event.entityId);
          this._rebuildScheduleGroup();
        } else if (event.entityType === 'flashcard_deck') {
          this.desiredSequences.delete(`${event.entityType}::${event.entityId}::daily`);
        } else {
          const key = `${event.entityType}::${event.entityId}`;
          this.desiredSequences.delete(key);
        }
        break;
      }
      case 'action_completed': {
        if (event.entityType === 'schedule' && this.preferences) {
          this._markScheduleSessionCompleted(event.entityId);
          this._rebuildScheduleGroup();
        } else if (event.entityType === 'flashcard_deck') {
          this.desiredSequences.delete(`${event.entityType}::${event.entityId}::daily`);
        } else {
          const key = `${event.entityType}::${event.entityId}`;
          this.desiredSequences.delete(key);
        }
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
    const sequences = this._collectSequences();
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

  private _buildDesiredSequence(entity: any, entityType: string): ReminderSequence | null {
    const now = this.clock.now();
    const policy = this.registry.get(entityType);
    let profile = this._getProfileFor(entityType);
    let offsets = policy.getOffsets(entity, profile);

    const prefs = this.preferences;
    if (prefs) {
      const isEnabled = isCategoryEnabled(prefs, entityType as any);
      if (!isEnabled) {
        this._logPipeline(entity, entityType, policy, offsets, null, now, null, 'skipped (disabled)');
        return null;
      }
      // Solo sobreescribir offsets para categorías offset-based con configuración explícita del usuario.
      // Si offsets === null → hereda el comportamiento del policy (p.ej. assessment con 5 triggers).
      // flashcard_deck usa checkTime, nunca offsets → no se toca.
      if (entityType !== 'flashcard_deck') {
        const catPrefs = prefs.categories[entityType as keyof typeof prefs.categories] as any;
        if (catPrefs && 'offsets' in catPrefs && catPrefs.offsets !== null) {
          const customOffsets = catPrefs.offsets as number[];
          offsets = customOffsets.map(o => -o);
          profile = { ...profile, defaultOffsets: offsets };
        }
      }
    }

    const eventTime = policy.getEventTime?.(entity, now) ?? null;

    if (eventTime && offsets.length > 0) {
      const maxOffset = Math.max(...offsets);
      const latestPossible = new Date(eventTime.getTime() + maxOffset * 60000);
      if (latestPossible < now) {
        this._logPipeline(entity, entityType, policy, offsets, eventTime, now, null, 'expired');
        return null;
      }
    }

    const expiresAt = policy.getExpiration(entity, now);
    const seq = this.factory.buildSequence(entity, entityType, offsets, profile, expiresAt, eventTime);

    if (policy.shouldCancel(seq, entity)) {
      this._logPipeline(entity, entityType, policy, offsets, eventTime, now, seq, 'cancelled');
      return null;
    }

    this._logPipeline(entity, entityType, policy, offsets, eventTime, now, seq, 'active');

    return seq;
  }

  private _logPipeline(
    entity: any,
    entityType: string,
    policy: ReminderPolicy,
    offsets: readonly number[],
    eventTime: Date | null,
    now: Date,
    seq: ReminderSequence | null,
    outcome: string,
  ): void {
    const entityId = this._entityId(entity);
    const baseTime = eventTime ?? now;
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(
        d.getHours(),
      ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const count = seq ? seq.reminders.length : 0;
    console.log(
      `[PIPELINE] ${entityType}::${entityId} | policy=${policy.constructor.name} | eventTime=${eventTime ? fmt(eventTime) : 'none'} | baseTime=${fmt(baseTime)} | sequence=${count} reminders | shouldCancel=${outcome === 'cancelled'}`,
    );
  }

  private _entityId(entity: any): string {
    return String(entity?.id ?? entity?.ID ?? '');
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

  private _getEntities(snapshot: ReminderSourceSnapshot, entityType: string): readonly any[] {
    switch (entityType) {
      case 'assessment':
        return snapshot.assessments ?? [];
      case 'schedule':
        return snapshot.schedules ?? [];
      case 'flashcard_deck':
        return snapshot.flashcard_decks ?? [];
      case 'calendar_event':
        return snapshot.calendar_events ?? [];
      default:
        return [];
    }
  }

  // ── WIRING: prefs + SessionMerger ────────────────────────────────────

  private get preferences(): ReminderPreferences | null {
    if (!this.preferencesProvider) return null;
    return this.preferencesProvider();
  }

  private _collectSequences(): ReminderSequence[] {
    const prefs = this.preferences;
    if (prefs && !prefs.notificationsEnabled) return [];
    return this._sortSequences(Array.from(this.desiredSequences.values()));
  }

  private _sortSequences(sequences: readonly ReminderSequence[]): ReminderSequence[] {
    return [...sequences].sort((a, b) => {
      const ra = ENTITY_TYPES.indexOf(a.entityType as (typeof ENTITY_TYPES)[number]);
      const rb = ENTITY_TYPES.indexOf(b.entityType as (typeof ENTITY_TYPES)[number]);
      const rankA = ra === -1 ? ENTITY_TYPES.length : ra;
      const rankB = rb === -1 ? ENTITY_TYPES.length : rb;
      if (rankA !== rankB) return rankA - rankB;
      return a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0;
    });
  }

  private _buildSnapshotSequences(
    snapshot: ReminderSourceSnapshot,
    prefs: ReminderPreferences | null,
    scheduleRows: readonly any[],
  ): ReminderSequence[] {
    const sequences: ReminderSequence[] = [];
    for (const entityType of ENTITY_TYPES) {
      if (entityType === 'schedule' && prefs) {
        sequences.push(
          ...buildScheduleSequences(
            scheduleRows,
            prefs,
            this._scheduleDeps(),
            this._scheduleBuildOptions(),
          ),
        );
      } else if (entityType === 'flashcard_deck') {
        sequences.push(
          ...buildReviewDueSequences(
            this._getEntities(snapshot, entityType),
            this._reviewPrefs(),
            this._reviewDeps(),
            this._reviewBuildOptions(),
          ),
        );
      } else {
        for (const entity of this._getEntities(snapshot, entityType)) {
          const seq = this._buildDesiredSequence(entity, entityType);
          if (seq) sequences.push(seq);
        }
      }
    }
    return sequences;
  }

  private _scheduleDeps(): SchedulePlanBuilderDeps {
    return {
      policy: this.registry.get('schedule'),
      factory: this.factory,
      now: this.clock.now(),
    };
  }

  private _scheduleBuildOptions(): {
    excludeSessionIds: ReadonlySet<string>;
    log: (session: LogicalSession, outcome: ScheduleBuildOutcome, eventTime?: Date | null, scheduledAt?: Date | null, offset?: number) => void;
  } {
    return {
      excludeSessionIds: this.completedScheduleSessions,
      log: (session, outcome, eventTime, scheduledAt, offset) =>
        this._logScheduleSession(session, outcome, eventTime, scheduledAt, offset),
    };
  }

  private _logScheduleSession(
    session: LogicalSession,
    outcome: ScheduleBuildOutcome,
    eventTime?: Date | null,
    scheduledAt?: Date | null,
    offset?: number,
  ): void {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(
        d.getHours(),
      ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    console.log(
      `[PIPELINE] schedule::${session.id} | policy=SchedulePlanBuilder | eventTime=${eventTime ? fmt(eventTime) : 'none'} | offset=${offset ?? 0} | scheduledAt=${scheduledAt ? fmt(scheduledAt) : 'none'} | outcome=${outcome}`,
    );
  }

  private _upsertScheduleRow(row: any): void {
    const id = String(row?.id ?? '');
    this.scheduleRows = [...this.scheduleRows.filter((r) => String(r?.id ?? '') !== id), row];
  }

  // ── WIRING: ReviewDue (FSRS agregado diario) ─────────────────────────

  private _reviewPrefs(): ReminderPreferences {
    return this.preferences ?? DEFAULT_PREFERENCES;
  }

  private _reviewDeps(): ReviewDuePlanBuilderDeps {
    return {
      policy: this.registry.get('flashcard_deck'),
      factory: this.factory,
      now: this.clock.now(),
    };
  }

  private _reviewBuildOptions(): {
    log: (deck: any, outcome: ReviewBuildOutcome, scheduledAt?: Date | null, checkTime?: string) => void;
  } {
    return {
      log: (deck, outcome, scheduledAt, checkTime) =>
        this._logReviewSequence(deck, outcome, scheduledAt, checkTime),
    };
  }

  private _logReviewSequence(
    deck: any,
    outcome: ReviewBuildOutcome,
    scheduledAt?: Date | null,
    checkTime?: string,
  ): void {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(
        d.getHours(),
      ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    console.log(
      `[PIPELINE] flashcard_deck::${deck?.id ?? ''}::daily | policy=ReviewDuePlanBuilder | checkTime=${checkTime ?? 'none'} | scheduledAt=${scheduledAt ? fmt(scheduledAt) : 'none'} | outcome=${outcome}`,
    );
  }

  private _removeScheduleRow(id: string): void {
    this.scheduleRows = this.scheduleRows.filter((r) => String(r?.id ?? '') !== id);
  }

  private _markScheduleSessionCompleted(physicalId: string): void {
    const target = mergeScheduleRows(this.scheduleRows as any).find((s) =>
      s.sourceScheduleIds.includes(physicalId),
    );
    if (target) this.completedScheduleSessions.add(target.id);
  }

  private _rebuildScheduleGroup(): void {
    const prefs = this.preferences;
    if (!prefs) return;
    for (const key of [...this.desiredSequences.keys()]) {
      if (this.desiredSequences.get(key)!.entityType === 'schedule') {
        this.desiredSequences.delete(key);
      }
    }
    if (prefs.notificationsEnabled) {
      const sequences = buildScheduleSequences(
        this.scheduleRows,
        prefs,
        this._scheduleDeps(),
        this._scheduleBuildOptions(),
      );
      for (const seq of sequences) this.desiredSequences.set(seq.id, seq);
    }
  }
}
