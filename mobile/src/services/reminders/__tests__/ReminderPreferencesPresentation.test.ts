import {
  CATEGORY_PRESENTATION,
  OFFSET_PRESETS,
  categoryCount,
  categoryHasCustomOffsets,
  effectiveCategoryOffsets,
  enabledCategoryCount,
  formatOffsetLabel,
} from '../ReminderPreferencesPresentation';
import { DEFAULT_PREFERENCES, parseReminderPreferences } from '../ReminderPreferences';
import type { ReminderPreferences } from '../ReminderPreferences';

const es: (key: string, options?: { count?: number; defaultValue?: string }) => string = (key, options) => {
  const table: Record<string, string> = {
    'reminders.offsetNow': 'En el momento',
    'reminders.offsetMinutes': '{{count}} min antes',
    'reminders.offsetHour': '1 h antes',
    'reminders.offsetHours': '{{count}} h antes',
    'reminders.offsetDay': '1 día antes',
    'reminders.offsetDays': '{{count}} días antes',
  };
  let value = table[key];
  if (value == null) value = options?.defaultValue ?? key;
  if (value.includes('{{count}}')) {
    value = value.replace('{{count}}', String(options?.count ?? 0));
  }
  return value;
};

describe('ReminderPreferencesPresentation — proyección UI del contrato', () => {
  it('categorías: exactamente las 4 del contrato v1.1, en orden de presentación', () => {
    expect(CATEGORY_PRESENTATION.map(c => c.name)).toEqual([
      'schedule',
      'assessment',
      'calendar_event',
      'flashcard_deck',
    ]);
    for (const pres of CATEGORY_PRESENTATION) {
      expect(pres.labelKey.startsWith('reminders.category.')).toBe(true);
      expect(pres.icon.length).toBeGreaterThan(0);
    }
  });

  it('categoryCount refleja el contrato (4)', () => {
    expect(categoryCount()).toBe(4);
  });

  it('presets: incluyen 0 (en el momento) y 1440 (1 día)', () => {
    expect(OFFSET_PRESETS).toContain(0);
    expect(OFFSET_PRESETS).toContain(15);
    expect(OFFSET_PRESETS).toContain(1440);
  });

  describe('formatOffsetLabel', () => {
    it('0 → en el momento', () => {
      expect(formatOffsetLabel(0, es)).toBe('En el momento');
    });

    it('minutos → {{count}} min antes', () => {
      expect(formatOffsetLabel(15, es)).toBe('15 min antes');
      expect(formatOffsetLabel(5, es)).toBe('5 min antes');
    });

    it('horas exactas → singular/plural', () => {
      expect(formatOffsetLabel(60, es)).toBe('1 h antes');
      expect(formatOffsetLabel(120, es)).toBe('2 h antes');
    });

    it('días exactos → singular/plural', () => {
      expect(formatOffsetLabel(1440, es)).toBe('1 día antes');
      expect(formatOffsetLabel(2880, es)).toBe('2 días antes');
    });

    it('caída a defaultValue cuando la clave no existe', () => {
      const fallback = (key: string, options?: { count?: number; defaultValue?: string }) => {
        const value = options?.defaultValue ?? key;
        return value.replace('{{count}}', String(options?.count ?? 0));
      };
      expect(formatOffsetLabel(10, fallback)).toBe('10 min antes');
      expect(formatOffsetLabel(60, fallback)).toBe('1 h antes');
    });
  });

  describe('effectiveCategoryOffset / categoryHasCustomOffset / enabledCategoryCount', () => {
  describe('effectiveCategoryOffsets / categoryHasCustomOffsets / enabledCategoryCount', () => {
    const prefs: ReminderPreferences = {
      ...DEFAULT_PREFERENCES,
      defaultOffset: 60,
      categories: {
        ...DEFAULT_PREFERENCES.categories,
        schedule: { enabled: true, offsets: [30, 60] },
        assessment: { enabled: true, offsets: [1440] },
      },
    };

    describe('effectiveCategoryOffsets', () => {
      it('categoría con offset explícito → retorna su arreglo de offsets', () => {
        expect(effectiveCategoryOffsets(prefs, 'assessment')).toEqual([1440]);
        expect(effectiveCategoryOffsets(prefs, 'schedule')).toEqual([30, 60]);
      });

      it('categoría sin offset → retorna arreglo con el default global', () => {
        expect(effectiveCategoryOffsets(prefs, 'calendar_event')).toEqual([60]);
      });
    });

    describe('categoryHasCustomOffsets', () => {
      it('categoría con offset explícito → true', () => {
        expect(categoryHasCustomOffsets(prefs, 'assessment')).toBe(true);
        expect(categoryHasCustomOffsets(prefs, 'schedule')).toBe(true);
      });

      it('categoría con offset null → false', () => {
        expect(categoryHasCustomOffsets(prefs, 'calendar_event')).toBe(false);
      });
    });

    it('enabledCategoryCount cuenta solo categorías habilitadas', () => {
      expect(enabledCategoryCount(DEFAULT_PREFERENCES)).toBe(4);
      const prefs = parseReminderPreferences({
        categories: {
          schedule: { enabled: false },
          assessment: { enabled: false },
        },
      });
      expect(enabledCategoryCount(prefs)).toBe(2);
    });
    });
  });
});
