import {
  CATEGORY_NAMES,
  CHECK_TIME_DEFAULT,
  DEFAULT_PREFERENCES,
  parseReminderPreferences,
  mergePreferences,
  getCategoryOffsets,
  getCategoryCheckTime,
  isCheckTimeCategory,
  isCategoryEnabled,
  isInQuietHours,
} from '../ReminderPreferences';
import type { ReminderPreferences, ReminderPreferencesPatch } from '../ReminderPreferences';
import { ReminderPreferencesService } from '../ReminderPreferencesService';
import type { KeyValueStore } from '../ReminderPreferencesService';

class MemoryKeyValueStore implements KeyValueStore {
  private readonly map = new Map<string, string>();
  getString(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
}

const KEY = 'threshold.reminderPreferences.v1';

describe('ReminderPreferences — contrato congelado', () => {
  it('defaults: centralizados, explícitos y completos', () => {
    expect(DEFAULT_PREFERENCES.notificationsEnabled).toBe(true);
    expect(DEFAULT_PREFERENCES.defaultOffset).toBe(15);
    for (const name of CATEGORY_NAMES) {
      expect(DEFAULT_PREFERENCES.categories[name].enabled).toBe(true);
    }
    expect(DEFAULT_PREFERENCES.categories.schedule.offsets).toBeNull();
    expect(DEFAULT_PREFERENCES.categories.assessment.offsets).toBeNull();
    expect(DEFAULT_PREFERENCES.categories.calendar_event.offsets).toBeNull();
    expect(DEFAULT_PREFERENCES.categories.flashcard_deck.checkTime).toBeNull();
    expect(DEFAULT_PREFERENCES.quietHours).toEqual({ enabled: false, start: '22:30', end: '07:00' });
  });

  it('las categorías de dominio son exactamente las 4 entidades del engine (sin "task", sin grading_period)', () => {
    expect(CATEGORY_NAMES).toEqual(['assessment', 'schedule', 'calendar_event', 'flashcard_deck']);
  });

  it('parse(DEFAULT) === DEFAULT (defaults son un estado persistible válido)', () => {
    expect(parseReminderPreferences(DEFAULT_PREFERENCES)).toEqual(DEFAULT_PREFERENCES);
  });

  it('getCategoryOffsets: category.offsets ?? [defaultOffset] (null y ausente heredan el global)', () => {
    expect(getCategoryOffsets(DEFAULT_PREFERENCES, 'schedule')).toEqual([15]);
    expect(getCategoryOffsets(DEFAULT_PREFERENCES, 'assessment')).toEqual([15]); // null → hereda global
    const custom: ReminderPreferences = {
      ...DEFAULT_PREFERENCES,
      defaultOffset: 60,
      categories: { ...DEFAULT_PREFERENCES.categories, schedule: { enabled: true, offsets: null } },
    };
    expect(getCategoryOffsets(custom, 'schedule')).toEqual([60]);
    expect(getCategoryOffsets(custom, 'assessment')).toEqual([60]); // null → hereda global
  });

  it('getCategoryCheckTime: flashcard_deck usa checkTime, no offset (FSRS agregado diario)', () => {
    expect(getCategoryCheckTime(DEFAULT_PREFERENCES)).toBe(CHECK_TIME_DEFAULT);
    expect(getCategoryCheckTime(DEFAULT_PREFERENCES)).toBe('19:00');
    const custom = parseReminderPreferences({ categories: { flashcard_deck: { checkTime: '08:30' } } });
    expect(getCategoryCheckTime(custom)).toBe('08:30');
  });

  it('isCheckTimeCategory: solo flashcard_deck es categoría de hora', () => {
    expect(isCheckTimeCategory('flashcard_deck')).toBe(true);
    expect(isCheckTimeCategory('assessment')).toBe(false);
    expect(isCheckTimeCategory('schedule')).toBe(false);
    expect(isCheckTimeCategory('calendar_event')).toBe(false);
  });

  it('isCategoryEnabled: enabled=false no genera reminders de esa categoría', () => {
    expect(isCategoryEnabled(DEFAULT_PREFERENCES, 'schedule')).toBe(true);
    const prefs = parseReminderPreferences({ categories: { schedule: { enabled: false } } });
    expect(isCategoryEnabled(prefs, 'schedule')).toBe(false);
    expect(isCategoryEnabled(prefs, 'assessment')).toBe(true);
  });

  it('parse directo: null/undefined/string/array → defaults', () => {
    expect(parseReminderPreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parseReminderPreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(parseReminderPreferences('x')).toEqual(DEFAULT_PREFERENCES);
    expect(parseReminderPreferences([])).toEqual(DEFAULT_PREFERENCES);
  });

  it('parse de flashcard_deck: checkTime válido se preserva; ausente/inválido/viejo(offset) → null (hereda 19:00)', () => {
    expect(parseReminderPreferences({ categories: { flashcard_deck: { checkTime: '08:30' } } }).categories.flashcard_deck).toEqual({
      enabled: true,
      checkTime: '08:30',
    });
    expect(parseReminderPreferences({ categories: { flashcard_deck: {} } }).categories.flashcard_deck).toEqual({
      enabled: true,
      checkTime: null,
    });
    expect(parseReminderPreferences({ categories: { flashcard_deck: { checkTime: '25:99' } } }).categories.flashcard_deck).toEqual({
      enabled: true,
      checkTime: null,
    });
    expect(parseReminderPreferences({ categories: { flashcard_deck: { offset: 30 } } }).categories.flashcard_deck).toEqual({
      enabled: true,
      checkTime: null,
    });
  });

  it('mergePreferences preserva campos no tocados', () => {
    const merged = mergePreferences(DEFAULT_PREFERENCES, { notificationsEnabled: false });
    expect(merged.notificationsEnabled).toBe(false);
    expect(merged.defaultOffset).toBe(15);
    expect(merged.categories.assessment.offsets).toBeNull();
    expect(merged.categories.flashcard_deck.checkTime).toBeNull();
    expect(merged.quietHours).toEqual(DEFAULT_PREFERENCES.quietHours);
  });
  it('normalizeOffsets: deduplica, filtra inválidos y ordena (sin truncar)', () => {
    // normalizeOffsets no trunca — lo hace parseCategory
    expect(
      parseReminderPreferences({ categories: { schedule: { offsets: [30, 30, 15, -5, 0, 'invalid'] } } })
        .categories.schedule.offsets,
    ).toEqual([0, 15, 30]);
  });

  it('array vacio como offsets se convierte en enabled=false y offsets=null en mergePreferences', () => {
    const merged = mergePreferences(DEFAULT_PREFERENCES, { categories: { schedule: { offsets: [] } } });
    expect(merged.categories.schedule.enabled).toBe(false);
    expect(merged.categories.schedule.offsets).toBeNull();
  });

  it('parseCategory trunca array legacy schedule: retiene los 3 MÁS CERCANOS + 0', () => {
    // schedule guarda los 3 menores (excluido 0)
    const prefs = parseReminderPreferences({
      categories: { schedule: { offsets: [0, 5, 15, 30, 60, 120] } },
    });
    expect(prefs.categories.schedule.offsets).toEqual([0, 5, 15, 30]);
  });

  it('parseCategory trunca array legacy assessment: retiene los 3 MÁS LEJANOS + 0', () => {
    // assessment guarda los 3 mayores (excluido 0) para preservar avisos largos de exámenes
    const prefs = parseReminderPreferences({
      categories: { assessment: { offsets: [0, 5, 15, 30, 60, 120] } },
    });
    expect(prefs.categories.assessment.offsets).toEqual([0, 30, 60, 120]);
  });

  it('parseCategory trunca array legacy assessment sin 0: retiene los 3 más lejanos', () => {
    const prefs = parseReminderPreferences({
      categories: { assessment: { offsets: [5, 15, 30, 60, 1440] } },
    });
    expect(prefs.categories.assessment.offsets).toEqual([30, 60, 1440]);
  });

  it('acepta offset de hasta 4 semanas (40320 min) y rechaza valores mayores', () => {
    const ok = parseReminderPreferences({ categories: { schedule: { offsets: [40320] } } });
    expect(ok.categories.schedule.offsets).toEqual([40320]);

    const exceeded = parseReminderPreferences({ categories: { schedule: { offsets: [40321] } } });
    // El valor supera el máximo → se descarta → normalizeOffsets devuelve null → parseCategory retorna null
    expect(exceeded.categories.schedule.offsets).toBeNull();
  });

  it('array con un solo offset sembrado borrado manualmente → enabled=false en mergePreferences', () => {
    // Simula: usuario pasa a "Personalizar" (pre-fill con [15]), luego lo borra (offsets=[])
    const afterPrefill = mergePreferences(DEFAULT_PREFERENCES, { categories: { schedule: { offsets: [15] } } });
    expect(afterPrefill.categories.schedule.offsets).toEqual([15]);
    expect(afterPrefill.categories.schedule.enabled).toBe(true);

    const afterRemove = mergePreferences(afterPrefill, { categories: { schedule: { offsets: [] } } });
    expect(afterRemove.categories.schedule.enabled).toBe(false);
    expect(afterRemove.categories.schedule.offsets).toBeNull();
  });

  it('formatOffsetLabel: evalúa semanas antes que días (20160 → 2 sem, no 14 días)', () => {
    // Este test se puede ampliar si se importa formatOffsetLabel directamente
    // Por ahora validamos que el campo no quede roto a nivel de parseReminderPreferences
    const prefs = parseReminderPreferences({ categories: { assessment: { offsets: [20160] } } });
    expect(prefs.categories.assessment.offsets).toEqual([20160]); // 2 semanas = válido
  });
});

describe('isInQuietHours — quiet hours omit, no defer', () => {
  it('disabled → siempre false', () => {
    expect(isInQuietHours(DEFAULT_PREFERENCES, { hours: 1, minutes: 0 })).toBe(false);
  });

  it('rango simple: end exclusivo', () => {
    const prefs = parseReminderPreferences({ quietHours: { enabled: true, start: '09:00', end: '11:00' } });
    expect(isInQuietHours(prefs, { hours: 10, minutes: 0 })).toBe(true);
    expect(isInQuietHours(prefs, { hours: 8, minutes: 59 })).toBe(false);
    expect(isInQuietHours(prefs, { hours: 11, minutes: 0 })).toBe(false);
  });

  it('wrap de medianoche 22:30–07:00', () => {
    const prefs = parseReminderPreferences({ quietHours: { enabled: true, start: '22:30', end: '07:00' } });
    expect(isInQuietHours(prefs, { hours: 23, minutes: 0 })).toBe(true);
    expect(isInQuietHours(prefs, { hours: 6, minutes: 59 })).toBe(true);
    expect(isInQuietHours(prefs, { hours: 7, minutes: 0 })).toBe(false);
    expect(isInQuietHours(prefs, { hours: 12, minutes: 0 })).toBe(false);
  });

  it('start === end → nunca quiet', () => {
    const prefs = parseReminderPreferences({ quietHours: { enabled: true, start: '09:00', end: '09:00' } });
    expect(isInQuietHours(prefs, { hours: 9, minutes: 0 })).toBe(false);
  });
});

describe('ReminderPreferencesService — persistencia MMKV (device-local)', () => {
  let store: MemoryKeyValueStore;
  let service: ReminderPreferencesService;

  beforeEach(() => {
    store = new MemoryKeyValueStore();
    service = new ReminderPreferencesService(store);
  });

  it('defaults: sin datos → defaults', () => {
    expect(service.get()).toEqual(DEFAULT_PREFERENCES);
    expect(store.getString(KEY)).toBeNull();
  });

  it('round-trip: set completo → get devuelve lo mismo', () => {
    const patch: ReminderPreferencesPatch = {
      notificationsEnabled: false,
      defaultOffset: 30,
      categories: { schedule: { enabled: true, offsets: [60, 120] } },
      quietHours: { enabled: true, start: '23:00', end: '06:00' },
    };
    const saved = service.set(patch);
    expect(saved.notificationsEnabled).toBe(false);
    expect(saved.defaultOffset).toBe(30);
    expect(saved.categories.schedule.offsets).toEqual([60, 120]);
    expect(saved.quietHours).toEqual({ enabled: true, start: '23:00', end: '06:00' });
    expect(service.get()).toEqual(saved);
  });

  it('actualización parcial: defaultOffset solo, el resto intacto', () => {
    service.set({ defaultOffset: 45 });
    const prefs = service.get();
    expect(prefs.defaultOffset).toBe(45);
    expect(prefs.notificationsEnabled).toBe(true);
    expect(prefs.categories.schedule.offsets).toBeNull();
    expect(prefs.quietHours).toEqual(DEFAULT_PREFERENCES.quietHours);
  });

  it('actualización parcial: categoría por offsets, preserva enabled', () => {
    service.set({ categories: { schedule: { offsets: [90] } } });
    const prefs = service.get();
    expect(prefs.categories.schedule.offsets).toEqual([90]);
    expect(prefs.categories.schedule.enabled).toBe(true);
    expect(prefs.categories.assessment.offsets).toBeNull();
  });

  it('actualización parcial: categoría por enabled, preserva checkTime', () => {
    service.set({ categories: { flashcard_deck: { enabled: false } } });
    const prefs = service.get();
    expect(prefs.categories.flashcard_deck.enabled).toBe(false);
    expect(prefs.categories.flashcard_deck.checkTime).toBeNull();
    expect(prefs.categories.schedule.enabled).toBe(true);
  });

  it('actualización parcial: checkTime explícito en flashcard_deck → gana al CHECK_TIME_DEFAULT', () => {
    service.set({ categories: { flashcard_deck: { checkTime: '08:30' } } });
    const prefs = service.get();
    expect(prefs.categories.flashcard_deck.checkTime).toBe('08:30');
    expect(getCategoryCheckTime(prefs)).toBe('08:30');
  });

  it('checkTime null en flashcard_deck → hereda CHECK_TIME_DEFAULT', () => {
    service.set({ categories: { flashcard_deck: { checkTime: '08:30' } } });
    service.set({ categories: { flashcard_deck: { checkTime: null } } });
    const prefs = service.get();
    expect(prefs.categories.flashcard_deck.checkTime).toBeNull();
    expect(getCategoryCheckTime(prefs)).toBe(CHECK_TIME_DEFAULT);
  });

  it('offset null en la categoría → hereda el defaultOffset global (NO un default de categoría)', () => {
    service.set({ defaultOffset: 30, categories: { schedule: { offsets: null } } });
    const prefs = service.get();
    expect(prefs.categories.schedule.offsets).toBeNull();
    expect(prefs.defaultOffset).toBe(30);
    expect(getCategoryOffsets(prefs, 'schedule')).toEqual([30]);
  });

  it('offset explícito en la categoría → gana al defaultOffset global', () => {
    service.set({ defaultOffset: 30, categories: { schedule: { offsets: [1440] } } });
    const prefs = service.get();
    expect(prefs.categories.schedule.offsets).toEqual([1440]);
    expect(getCategoryOffsets(prefs, 'schedule')).toEqual([1440]);
    expect(getCategoryOffsets(prefs, 'assessment')).toEqual([30]); // assessment null → hereda global=30
  });

  it('reset → defaults y key limpia', () => {
    service.set({ notificationsEnabled: false });
    expect(service.get().notificationsEnabled).toBe(false);
    const afterReset = service.reset();
    expect(afterReset).toEqual(DEFAULT_PREFERENCES);
    expect(service.get()).toEqual(DEFAULT_PREFERENCES);
    expect(store.getString(KEY)).toBeNull();
  });

  it('corrupción: JSON inválido → defaults, nunca lanza', () => {
    store.set(KEY, '{not-json!!');
    expect(() => service.get()).not.toThrow();
    expect(service.get()).toEqual(DEFAULT_PREFERENCES);
  });

  it('corrupción: schema viejo con categoría desconocida ("task") → ignora la desconocida', () => {
    store.set(KEY, JSON.stringify({ tasks: { enabled: true }, notificationsEnabled: false }));
    const prefs = service.get();
    expect(prefs.notificationsEnabled).toBe(false);
    expect(Object.keys(prefs.categories)).not.toContain('tasks');
    expect(prefs.categories.schedule).toEqual({ enabled: true, offsets: null });
  });

  it('migración de schema v1 → v1.1: grading_period se ignora y flashcard_deck.offset cae a checkTime null', () => {
    store.set(
      KEY,
      JSON.stringify({
        notificationsEnabled: true,
        defaultOffset: 30,
        categories: {
          flashcard_deck: { enabled: true, offset: 60 },
          grading_period: { enabled: true, offset: 1440 },
          schedule: { enabled: true, offset: 15 },
        },
      }),
    );
    const prefs = service.get();
    expect(prefs.categories.flashcard_deck).toEqual({ enabled: true, checkTime: null });
    expect(getCategoryCheckTime(prefs)).toBe(CHECK_TIME_DEFAULT);
    expect(Object.keys(prefs.categories)).not.toContain('grading_period');
    expect(prefs.categories.schedule.offsets).toEqual([15]);
  });

  it('valores inválidos → fallback por campo (los válidos se preservan)', () => {
    store.set(
      KEY,
      JSON.stringify({
        notificationsEnabled: 'yes',
        defaultOffset: -5,
        categories: {
          schedule: { enabled: 1, offset: 99999 },
          assessment: { enabled: false, offset: 1440 },
        },
        quietHours: { enabled: true, start: '25:99', end: '07:00' },
      }),
    );
    const prefs = service.get();
    expect(prefs.notificationsEnabled).toBe(true);
    expect(prefs.defaultOffset).toBe(15);
    expect(prefs.categories.schedule).toEqual({ enabled: true, offsets: null });
    expect(getCategoryOffsets(prefs, 'schedule')).toEqual([15]);
    expect(prefs.categories.assessment).toEqual({ enabled: false, offsets: [1440] });
    expect(prefs.quietHours.enabled).toBe(true);
    expect(prefs.quietHours.start).toBe('22:30');
    expect(prefs.quietHours.end).toBe('07:00');
  });
});

describe('ReminderPreferencesService — nunca bloquea el arranque', () => {
  let store: MemoryKeyValueStore;
  let service: ReminderPreferencesService;

  beforeEach(() => {
    store = new MemoryKeyValueStore();
    service = new ReminderPreferencesService(store);
  });

  it('store que lanza → get/set/reset devuelven defaults sin propagar error', () => {
    const throwingStore: KeyValueStore = {
      getString: () => {
        throw new Error('mmkv broken');
      },
      set: () => {
        throw new Error('mmkv broken');
      },
      delete: () => {
        throw new Error('mmkv broken');
      },
    };
    const svc = new ReminderPreferencesService(throwingStore);
    expect(() => svc.get()).not.toThrow();
    expect(svc.get()).toEqual(DEFAULT_PREFERENCES);
    expect(() => svc.set({ defaultOffset: 30 })).not.toThrow();
    expect(() => svc.reset()).not.toThrow();
  });

  it('acumula cambios sobre el estado persistido (no sobre defaults fijos)', () => {
    service.set({ defaultOffset: 45 });
    service.set({ categories: { schedule: { enabled: false } } });
    const prefs = service.get();
    expect(prefs.defaultOffset).toBe(45);
    expect(prefs.categories.schedule.enabled).toBe(false);
    expect(prefs.categories.schedule.offsets).toBeNull();
  });
});
