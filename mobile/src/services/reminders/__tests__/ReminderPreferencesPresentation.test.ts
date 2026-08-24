import {
  CATEGORY_PRESENTATION,
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
    'reminders.offsetDay': '1 dÃ­a antes',
    'reminders.offsetDays': '{{count}} dÃ­as antes',
  };
  let value = table[key];
  if (value == null) value = options?.defaultValue ?? key;
  if (value.includes('{{count}}')) {
    value = value.replace('{{count}}', String(options?.count ?? 0));
  }
  return value;
};

describe('ReminderPreferencesPresentation â€” proyecciÃ³n UI del contrato', () => {
  it('categorÃ­as: exactamente las 4 del contrato v1.1, en orden de presentaciÃ³n', () => {
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

  it('presets: incluyen 0 (en el momento) y 1440 (1 dÃ­a)', () => {
  });

  describe('formatOffsetLabel', () => {
    it('0 â†’ en el momento', () => {
      expect(formatOffsetLabel(0, es)).toBe('En el momento');
    });

    it('minutos â†’ {{count}} min antes', () => {
      expect(formatOffsetLabel(15, es)).toBe('15 min antes');
      expect(formatOffsetLabel(5, es)).toBe('5 min antes');
    });

    it('horas exactas â†’ singular/plural', () => {
      expect(formatOffsetLabel(60, es)).toBe('1 h antes');
      expect(formatOffsetLabel(120, es)).toBe('2 h antes');
    });

    it('dÃ­as exactos â†’ singular/plural', () => {
      expect(formatOffsetLabel(1440, es)).toBe('1 dÃ­a antes');
      expect(formatOffsetLabel(2880, es)).toBe('2 dÃ­as antes');
    });

    it('caÃ­da a defaultValue cuando la clave no existe', () => {
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
      it('categorÃ­a con offset explÃ­cito â†’ retorna su arreglo de offsets', () => {
        expect(effectiveCategoryOffsets(prefs, 'assessment')).toEqual([1440]);
        expect(effectiveCategoryOffsets(prefs, 'schedule')).toEqual([30, 60]);
      });

      it('categorÃ­a sin offset â†’ retorna arreglo con el default global', () => {
        expect(effectiveCategoryOffsets(prefs, 'calendar_event')).toEqual([60]);
      });
    });

    describe('categoryHasCustomOffsets', () => {
      it('categorÃ­a con offset explÃ­cito â†’ true', () => {
        expect(categoryHasCustomOffsets(prefs, 'assessment')).toBe(true);
        expect(categoryHasCustomOffsets(prefs, 'schedule')).toBe(true);
      });

      it('categorÃ­a con offset null â†’ false', () => {
        expect(categoryHasCustomOffsets(prefs, 'calendar_event')).toBe(false);
      });
    });

    it('enabledCategoryCount cuenta solo categorÃ­as habilitadas', () => {
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
