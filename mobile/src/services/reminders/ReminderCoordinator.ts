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
  grading_period: 'grading_periods',
  calendar_event: 'calendar_events',
};

export class ReminderCoordinator {
  private engine: ReminderEngine;
  private builder: ReminderSnapshotBuilder;
  private repos: Record<string, EntityRepository>;
  private initialized = false;
  private unsubscribeBus: (() => void) | null = null;

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

  async handleEntityChanged(entityType: string, entityId: string): Promise<void> {
    const repo = this.repos[entityType];
    if (!repo) return;
    const entity = await repo.getById(entityId);
    if (entity) {
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
