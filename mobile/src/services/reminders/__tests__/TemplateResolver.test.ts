import { TemplateResolver } from '../TemplateResolver';
import { ReminderSnapshot } from '../types';
import type { I18nService } from '../I18nService';
import type { DeliveryPlan, DeliveryPlanResolved, DeliveryReminderDomain } from '../types';

class FakeI18n implements I18nService {
  translate(key: string, params?: Record<string, any>): string {
    if (key === 'intentTitle.prepare_exam') return 'Examen de ' + params?.entity + ' - ' + params?.time;
    if (key === 'intentTitle.attend_class') return 'Clase en 5 min';
    if (key === 'intentTitle.review_cards') return 'Repasar ' + params?.entity;
    if (key === 'intentTitle.follow_up') return 'Seguimiento ' + params?.entity;
    if (key === 'intentBody.follow_up') return 'No olvides hacer seguimiento de ' + params?.entity;
    if (key.startsWith('entity.')) return params?.default || key;
    if (key === 'intentBody.prepare_exam') return 'Tu examen de ' + params?.entity + ' se acerca';
    if (key === 'intentBody.review_cards') return 'Tienes tarjetas pendientes de ' + params?.entity;
    return key;
  }
}

function domainPlan(overrides?: Partial<DeliveryPlan>): DeliveryPlan {
  return {
    planId: 'plan-1',
    version: 1,
    generatedAt: new Date('2026-07-10T12:00:00Z'),
    deliverables: [],
    ...overrides,
  };
}

function domainReminder(overrides: Partial<DeliveryReminderDomain> = {}): DeliveryReminderDomain {
  return {
    id: 'r1',
    scheduledAt: new Date('2026-07-11T10:00:00Z'),
    entityType: 'assessment',
    entityId: 'a-1',
    subjectId: 'subj-1',
    intent: 'prepare_exam',
    priority: 'high',
    snapshot: new ReminderSnapshot({ entity: { id: 'a-1', type: 'assessment', name: '' } }),
    ...overrides,
  };
}

describe('TemplateResolver', () => {
  let resolver: TemplateResolver;
  let i18n: FakeI18n;

  beforeEach(() => {
    i18n = new FakeI18n();
    resolver = new TemplateResolver(i18n);
  });

  it('adds title and body to deliverables', () => {
    const plan = domainPlan({ deliverables: [domainReminder()] });
    const resolved: DeliveryPlanResolved = resolver.enrich(plan);
    expect(resolved.deliverables[0].title).toBeDefined();
    expect(resolved.deliverables[0].body).toBeDefined();
  });

  it('does not modify planId/version/generatedAt', () => {
    const plan = domainPlan({ deliverables: [domainReminder()] });
    const resolved = resolver.enrich(plan);
    expect(resolved.planId).toBe('plan-1');
    expect(resolved.version).toBe(1);
    expect(resolved.generatedAt).toEqual(new Date('2026-07-10T12:00:00Z'));
  });

  it('does not modify id/scheduledAt/entityType/entityId/intent/priority', () => {
    const dom = domainReminder();
    const plan = domainPlan({ deliverables: [dom] });
    const e = resolver.enrich(plan).deliverables[0];
    expect(e.id).toBe(dom.id);
    expect(e.scheduledAt).toEqual(dom.scheduledAt);
    expect(e.entityType).toBe(dom.entityType);
    expect(e.entityId).toBe(dom.entityId);
    expect(e.intent).toBe(dom.intent);
    expect(e.priority).toBe(dom.priority);
  });

  it('enriches assessment prepare_exam with deeplink', () => {
    const dom = domainReminder({ entityType: 'assessment', intent: 'prepare_exam' });
    const plan = domainPlan({ deliverables: [dom] });
    const resolved = resolver.enrich(plan);
    expect(resolved.deliverables[0].deeplink).toBe('threshold://assessments/a-1');
  });

  it('enriches schedule with deeplink', () => {
    const dom = domainReminder({ entityType: 'schedule' });
    const plan = domainPlan({ deliverables: [dom] });
    const resolved = resolver.enrich(plan);
    expect(resolved.deliverables[0].deeplink).toBe('threshold://schedules/a-1');
  });

  it('critical priority adds badge', () => {
    const dom = domainReminder({ priority: 'critical' });
    const plan = domainPlan({ deliverables: [dom] });
    const resolved = resolver.enrich(plan);
    expect(resolved.deliverables[0].badge).toBe(1);
  });

  it('high priority does not add badge', () => {
    const dom = domainReminder({ priority: 'high' });
    const plan = domainPlan({ deliverables: [dom] });
    const resolved = resolver.enrich(plan);
    expect(resolved.deliverables[0].badge).toBeUndefined();
  });

  it('enriches multiple deliverables', () => {
    const dom1 = domainReminder({ id: 'r1', intent: 'review_cards', entityType: 'flashcard_deck', entityId: 'd-1' });
    const dom2 = domainReminder({ id: 'r2', intent: 'attend_class', entityType: 'schedule', entityId: 's-1' });
    const plan = domainPlan({ deliverables: [dom1, dom2] });
    const resolved = resolver.enrich(plan);
    expect(resolved.deliverables).toHaveLength(2);
    expect(resolved.deliverables[0].title).toBeDefined();
    expect(resolved.deliverables[1].title).toBeDefined();
  });

  it('empty deliverables produces empty plan', () => {
    const plan = domainPlan();
    const resolved = resolver.enrich(plan);
    expect(resolved.deliverables).toHaveLength(0);
  });
});
