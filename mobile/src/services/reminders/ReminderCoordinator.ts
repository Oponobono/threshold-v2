import { RepositoryFactory } from '../database/RepositoryFactory';
import { ReminderEngine } from './ReminderEngine';
import { ReminderSnapshotBuilder } from './ReminderSnapshotBuilder';
import type { EnvironmentContext } from './types';
import type { RepositoryEventBus } from '../events/RepositoryEventBus';
import type { PerformanceObserver } from './PerformanceObserver';
import { NullObserver } from './PerformanceObserver';

export interface EntityRepository {
  getById(id: string): Promise<any | null>;
}

export const ENTITY_TYPE_MAP: Record<string, string> = {
  assessment: 'assessments',
  schedule: 'schedules',
  flashcard_deck: 'flashcard_decks',
  calendar_event: 'calendar_events',
};

export class ReminderCoordinator {
  private engine: ReminderEngine;
  private builder: ReminderSnapshotBuilder;
  private repos: Record<string, EntityRepository>;
  private initialized = false;
  private unsubscribeBus: (() => void) | null = null;
  private _pendingResync: ReturnType<typeof setTimeout> | null = null;
  private _lastResyncAt = 0;
  private static RESYNC_DEBOUNCE_MS = 5000;

  constructor(
    engine: ReminderEngine,
    builder: ReminderSnapshotBuilder,
    repos: Record<string, EntityRepository>,
    observer?: PerformanceObserver,
  ) {
    this.engine = engine;
    this.builder = builder;
    this.repos = repos;
    this.observer = observer ?? new NullObserver();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const t0 = Date.now();
    const snapshot = await this.builder.build();
    this.observer.record('snapshot_builder.build', Date.now() - t0);
    this.engine.initialize(snapshot);
    this.initialized = true;
  }

  async resync(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this._lastResyncAt;
    if (elapsed < ReminderCoordinator.RESYNC_DEBOUNCE_MS) {
      const remaining = ReminderCoordinator.RESYNC_DEBOUNCE_MS - elapsed;
      if (this._pendingResync) clearTimeout(this._pendingResync);
      return new Promise<void>((resolve) => {
        this._pendingResync = setTimeout(() => {
          this._pendingResync = null;
          this._doResync().then(resolve);
        }, remaining);
      });
    }
    return this._doResync();
  }

  private async _doResync(): Promise<void> {
    this._lastResyncAt = Date.now();
    const t0 = Date.now();
    const snapshot = await this.builder.build();
    this.observer.record('snapshot_builder.build', Date.now() - t0);
    this.engine.initialize(snapshot);
  }

  private observer: PerformanceObserver;

  subscribeToEventBus(eventBus?: RepositoryEventBus): void {
    const { subscribeToEventBus: doSubscribe } = require('./subscribeToEventBus');
    if (this.unsubscribeBus) {
      this.unsubscribeBus();
      this.unsubscribeBus = null;
    }
    this.unsubscribeBus = doSubscribe(this, eventBus);
  }

  destroy(): void {
    this.engine.destroy();
    this.initialized = false;
    if (this.unsubscribeBus) {
      this.unsubscribeBus();
      this.unsubscribeBus = null;
    }
  }

  async handleEntityChanged(entityType: string, entityId: string, preFetchedEntity?: any): Promise<void> {
    const repo = this.repos[entityType];
    if (!repo) return;
    
    // Si el evento ya trae la entidad (upsertMany emite el objeto), evitamos un costoso
    // select N+1 a la base de datos por cada registro que llega por sincronización masiva.
    const entity = preFetchedEntity || await repo.getById(entityId);
    
    if (entity) {
      if (entityType === 'schedule' && entity.subject_id && !entity.subject_name) {
        try {
          const { subjectRepository } = require('../database/repositories/SubjectRepository');
          const subject = await RepositoryFactory.subjects().getById(entity.subject_id);
          if (subject) {
            entity.subject_name = subject.name;
          }
        } catch (e) {
          console.warn('[ReminderCoordinator] Failed to enrich schedule with subject_name', e);
        }
      }
      this.engine.onEntityChanged(entityType, entityId, entity);
    }
  }

  handleEntityDeleted(entityType: string, entityId: string): void {
    this.engine.onEntityDeleted(entityType, entityId);
  }

  handleActionCompleted(entityType: string, entityId: string): void {
    this.engine.onActionCompleted(entityType, entityId);
  }

  handleReminderTapped(reminderId: string): void {
    this.engine.onReminderTapped(reminderId);
  }

  handleEnvironmentChanged(context: EnvironmentContext): void {
    this.engine.onEnvironmentChanged(context);
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  getEngine(): ReminderEngine {
    return this.engine;
  }

  getDesiredSequences() {
    return this.engine.getDesiredSequences();
  }

  getTraceLog() {
    return this.engine.getTraceLog();
  }

  clearTraceLog(): void {
    this.engine.clearTraceLog();
  }
}
