import { PolicyRegistry } from '../policies/PolicyRegistry';
import { AssessmentPolicy } from '../policies/AssessmentPolicy';
import { ClassPolicy } from '../policies/ClassPolicy';
import { ReviewPolicy } from '../policies/ReviewPolicy';
import { EventPolicy } from '../policies/EventPolicy';
import { GradingPolicy } from '../policies/GradingPolicy';
import { SequenceFactory } from '../SequenceFactory';
import { FakeClock } from '../Clock';
import { InterruptionPolicy } from '../InterruptionPolicy';
import { TemplateResolver } from '../TemplateResolver';
import { NotificationReconciler } from '../NotificationReconciler';
import type {
  NotificationProvider,
  ScheduledNotificationInfo,
} from '../NotificationProvider';
import type { ScheduledReminder } from '../types';
import type { I18nService } from '../I18nService';
import type {
  ReminderProfile,
  ReminderSequence,
  DeliveryPlanResolved,
} from '../types';

// ── Fake implementations ──────────────────────────────────────────

class FakeI18n implements I18nService {
  translate(key: string, params?: any): string {
    const map: Record<string, string> = {
      'entity.assessment': 'Examen',
      'entity.schedule': 'Clase',
      'entity.flashcard_deck': 'Mazo',
      'entity.calendar_event': 'Evento',
      'entity.grading_period': 'Periodo',
      'intentTitle.prepare_exam': 'Preparar {entity}',
      'intentTitle.attend_class': 'Asistir a {entity}',
      'intentTitle.review_cards': 'Repasar {entity}',
      'intentTitle.follow_up': 'Seguimiento {entity}',
      'intentTitle.submit_work': 'Entregar {entity}',
      'intentBody.prepare_exam': 'Tu {entity} se acerca. Repasa los temas clave.',
      'intentBody.attend_class': 'Tu {entity} comienza pronto.',
      'intentBody.review_cards': 'Tienes tarjetas pendientes de {entity}.',
      'intentBody.follow_up': 'Revisa {entity}.',
      'intentBody.submit_work': 'Entrega pendiente de {entity}.',
    };
    const template = map[key] ?? key;
    const entityName = params?.entity ?? '';
    return template.replace('{entity}', entityName);
  }
}

class FakeProvider implements NotificationProvider {
  readonly scheduled: ScheduledReminder[] = [];
  readonly cancelled: string[] = [];

  async requestPermissions(): Promise<boolean> {
    return true;
  }

  async setupChannels(): Promise<void> {
    // no-op
  }

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
      const toCancel = this.scheduled
        .filter((r) => r.id.startsWith(prefix))
        .map((r) => r.id);
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
      identifier: r.id,
      title: r.title,
      body: r.body,
      triggerDate: r.scheduledAt,
    }));
  }

  reset(): void {
    this.scheduled.length = 0;
    this.cancelled.length = 0;
  }
}

// ── Helpers ────────────────────────────────────────────────────────

const ANCHOR = new Date('2026-07-10T10:00:00Z');
const ASSESSMENT_DATE = new Date('2026-07-15T10:00:00Z');
const SCHEDULE_END = new Date('2026-07-10T11:30:00Z');

const DEFAULT_PROFILE: ReminderProfile = {
  name: 'standard',
  defaultOffsets: [],
};

function createRegistry(): PolicyRegistry {
  const r = new PolicyRegistry();
  r.register(new AssessmentPolicy());
  r.register(new ClassPolicy());
  r.register(new ReviewPolicy());
  r.register(new EventPolicy());
  r.register(new GradingPolicy());
  return r;
}

function buildSequence(
  registry: PolicyRegistry,
  factory: SequenceFactory,
  entityType: string,
  entity: any,
  profileName: ReminderProfile['name'] = 'standard',
): ReminderSequence {
  const policy = registry.get(entityType);
  const profile: ReminderProfile = {
    name: profileName,
    defaultOffsets: policy.defaultProfile.defaultOffsets,
  };
  const offsets = policy.getOffsets(entity, profile);
  const expiresAt = policy.getExpiration(entity);
  return factory.buildSequence(entity, entityType, offsets, profile, expiresAt);
}

function entityForEntityType(entityType: string): any {
  switch (entityType) {
    case 'assessment':
      return {
        id: 'a-1',
        date: ASSESSMENT_DATE.toISOString(),
        status: 'active',
        title: 'Parcial Álgebra',
      };
    case 'schedule':
      return {
        id: 's-1',
        endTime: SCHEDULE_END.toISOString(),
        status: 'active',
        title: 'Álgebra Lineal',
      };
    case 'flashcard_deck':
      return {
        id: 'd-1',
        dueCardsCount: 10,
        status: 'active',
        title: 'Álgebra Flashcards',
      };
    case 'calendar_event':
      return {
        id: 'e-1',
        endDate: '2026-07-10T12:00:00Z',
        status: 'active',
        title: 'Reunión',
      };
    case 'grading_period':
      return {
        id: 'g-1',
        closeDate: '2026-07-20T23:59:00Z',
        status: 'open',
        title: 'Corte 1',
      };
    default:
      return { id: 'x-1' };
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Fase 3 - Cross-entity integration', () => {
  // Escenario 1: Pipeline completo — una entidad atraviesa toda la
  // cadena Policy → Factory → Interruption → TemplateResolver → Reconciler.
  it('completa el pipeline de assessment produciendo una notificacion programada', async () => {
    const clock = new FakeClock(ANCHOR);
    const registry = createRegistry();
    const factory = new SequenceFactory(clock);
    const interruption = new InterruptionPolicy(clock);
    const templates = new TemplateResolver(new FakeI18n());
    const reconciler = new NotificationReconciler();
    const provider = new FakeProvider();

    const entity = entityForEntityType('assessment');
    const seq = buildSequence(registry, factory, 'assessment', entity);

    // Policy → Factory → Interruption → TemplateResolver
    const resolved: DeliveryPlanResolved = templates.enrich(
      interruption.resolve([seq]),
    );

    // Reconciler: escribre en el provider
    expect(provider.scheduled).toHaveLength(0);
    await reconciler.sync(resolved, provider);

    // El provider recibió las notificaciones programadas
    expect(provider.scheduled.length).toBeGreaterThan(0);
    expect(provider.scheduled.length).toBeLessThanOrEqual(3);

    // Cada notificación tiene datos de presentación completos
    for (const r of provider.scheduled) {
      expect(r.title).toBeTruthy();
      expect(r.body).toBeTruthy();
      expect(r.scheduledAt).toBeInstanceOf(Date);
      expect(r.priority).toMatch(/^(low|normal|high|critical)$/);
      expect(r.id).toBeTruthy();
    }

    // El deeplink debe estar presente para assessment
    expect(provider.scheduled[0].deeplink).toMatch(/^threshold:\/\//);

    // No hubo cancelaciones inesperadas
    expect(provider.cancelled).toHaveLength(0);
  });

  // Escenario 2: Múltiples entidades — 3 policies distintas conviven,
  // InterruptionPolicy resuelve colisiones y aplica límite de 3.
  it('combina assessment + schedule + flashcard_deck respetando el limite de 3 recordatorios', async () => {
    const clock = new FakeClock(ANCHOR);
    const registry = createRegistry();
    const factory = new SequenceFactory(clock);
    const interruption = new InterruptionPolicy(clock);
    const templates = new TemplateResolver(new FakeI18n());
    const reconciler = new NotificationReconciler();
    const provider = new FakeProvider();

    // Assessment produce 5 reminders, Class produce 3, Review produce 1
    const seqA = buildSequence(registry, factory, 'assessment', entityForEntityType('assessment'));
    const seqS = buildSequence(registry, factory, 'schedule', entityForEntityType('schedule'));
    const seqR = buildSequence(registry, factory, 'flashcard_deck', entityForEntityType('flashcard_deck'));

    const resolved = templates.enrich(
      interruption.resolve([seqA, seqS, seqR]),
    );

    // InterruptionPolicy debe limitar a 3 simultáneos
    expect(resolved.deliverables.length).toBeLessThanOrEqual(3);

    await reconciler.sync(resolved, provider);
    expect(provider.scheduled.length).toBe(resolved.deliverables.length);
    expect(provider.cancelled).toHaveLength(0);

    // Verifica que todos los intents estén presentes (sin suppressReview)
    const intents = new Set(resolved.deliverables.map((d) => d.intent));
    expect(intents.has('review_cards')).toBe(true);
  });

  // Escenario 3: Resync — el examen se cancela y se crea una clase.
  // El reconciliador cancela notificaciones viejas y programa las nuevas.
  it('cancela notificaciones previas y programa nuevas tras cambio de entidades', async () => {
    const clock = new FakeClock(ANCHOR);
    const registry = createRegistry();
    const factory = new SequenceFactory(clock);
    const interruption = new InterruptionPolicy(clock);
    const templates = new TemplateResolver(new FakeI18n());
    const reconciler = new NotificationReconciler();
    const provider = new FakeProvider();

    // Plan A: assessment activo
    const seqA = buildSequence(registry, factory, 'assessment', entityForEntityType('assessment'));
    const planA = templates.enrich(interruption.resolve([seqA]));
    await reconciler.sync(planA, provider);
    expect(provider.scheduled.length).toBeGreaterThan(0);
    const oldCount = provider.scheduled.length;

    // Plan B: ya no hay assessment, ahora hay una clase
    // (simula lo que haría ReminderEngine: secuencia nueva, assessment omitido)
    const seqB = buildSequence(registry, factory, 'schedule', entityForEntityType('schedule'));
    const planB = templates.enrich(interruption.resolve([seqB]));

    // Los IDs de planB no existen en planA (son tipos distintos)
    const oldIds = new Set(planA.deliverables.map((d) => d.id));
    const hasNewIds = planB.deliverables.every((d) => !oldIds.has(d.id));
    expect(hasNewIds).toBe(true);

    await reconciler.sync(planB, provider);

    // El provider canceló todas las viejas (assessment)
    expect(provider.cancelled.length).toBe(oldCount);

    // El provider programó las nuevas (schedule)
    expect(provider.scheduled.length).toBe(planB.deliverables.length);
  });

  // Escenario 4: Estabilidad — mismo input produce mismo output
  it('produce deliverable ids y propiedades identicas para el mismo input', () => {
    const clock = new FakeClock(ANCHOR);
    const registry = createRegistry();
    const factory = new SequenceFactory(clock);
    const interruption = new InterruptionPolicy(clock);
    const templates = new TemplateResolver(new FakeI18n());

    const entity = entityForEntityType('assessment');
    const seq = buildSequence(registry, factory, 'assessment', entity);

    interruption.resetCounter();
    const plan1 = templates.enrich(interruption.resolve([seq]));
    interruption.resetCounter();
    const plan2 = templates.enrich(interruption.resolve([seq]));

    // planId es traza (timestamp + contador); puede diferir entre ejecuciones
    // si el clock avanza. Lo importante es el contenido de los deliverablees.
    expect(plan1.deliverables).toEqual(plan2.deliverables);
  });
});
