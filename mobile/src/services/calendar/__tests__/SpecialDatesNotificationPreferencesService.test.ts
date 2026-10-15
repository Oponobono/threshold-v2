import {
  SpecialDatesNotificationPreferencesService,
  SPECIAL_DATES_NOTIFICATIONS_KEY,
} from '../SpecialDatesNotificationPreferencesService';
import {
  DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES,
  parseSpecialDatesNotificationPreferences,
  mergeSpecialDatesNotificationPreferences,
  isValidTimeString,
} from '../SpecialDatesNotificationPreferences';

describe('SpecialDatesNotificationPreferences', () => {
  it('valida correctamente formatos de hora HH:mm', () => {
    expect(isValidTimeString('08:00')).toBe(true);
    expect(isValidTimeString('00:00')).toBe(true);
    expect(isValidTimeString('23:59')).toBe(true);
    expect(isValidTimeString('24:00')).toBe(false);
    expect(isValidTimeString('8:00')).toBe(false);
    expect(isValidTimeString('invalid')).toBe(false);
    expect(isValidTimeString(null)).toBe(false);
  });

  it('retorna defaults en parseo de datos nulos o corruptos', () => {
    expect(parseSpecialDatesNotificationPreferences(null)).toEqual(
      DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES
    );
    expect(parseSpecialDatesNotificationPreferences({})).toEqual(
      DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES
    );
    expect(parseSpecialDatesNotificationPreferences({ holidaysTime: 'invalid' })).toEqual(
      DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES
    );
  });

  it('fusiona parches parciales preservando campos existentes', () => {
    const current = {
      holidaysEnabled: true,
      holidaysTime: '08:00',
      commemorationsEnabled: true,
      commemorationsTime: '08:00',
    };

    const merged = mergeSpecialDatesNotificationPreferences(current, {
      holidaysTime: '09:30',
      commemorationsEnabled: false,
    });

    expect(merged.holidaysEnabled).toBe(true);
    expect(merged.holidaysTime).toBe('09:30');
    expect(merged.commemorationsEnabled).toBe(false);
    expect(merged.commemorationsTime).toBe('08:00');
  });
});

describe('SpecialDatesNotificationPreferencesService', () => {
  let mockStore: {
    data: Record<string, string>;
    getString: (k: string) => string | null;
    set: (k: string, v: string) => void;
    delete: (k: string) => void;
  };
  let service: SpecialDatesNotificationPreferencesService;

  beforeEach(() => {
    mockStore = {
      data: {},
      getString(k: string) {
        return this.data[k] ?? null;
      },
      set(k: string, v: string) {
        this.data[k] = v;
      },
      delete(k: string) {
        delete this.data[k];
      },
    };
    service = new SpecialDatesNotificationPreferencesService(mockStore);
  });

  it('retorna defaults cuando la clave no existe en el store', () => {
    const prefs = service.getPreferences();
    expect(prefs).toEqual(DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES);
  });

  it('guarda y recupera preferencias modificadas', () => {
    const updated = service.setPreferences({
      holidaysTime: '07:00',
      commemorationsTime: '09:00',
    });

    expect(updated.holidaysTime).toBe('07:00');
    expect(updated.commemorationsTime).toBe('09:00');

    const retrieved = service.getPreferences();
    expect(retrieved.holidaysTime).toBe('07:00');
    expect(retrieved.commemorationsTime).toBe('09:00');
    expect(mockStore.data[SPECIAL_DATES_NOTIFICATIONS_KEY]).toBeDefined();
  });

  it('restablece los valores predeterminados al llamar a reset()', () => {
    service.setPreferences({ holidaysEnabled: false, holidaysTime: '11:00' });
    expect(service.getPreferences().holidaysEnabled).toBe(false);

    const resetDefaults = service.reset();
    expect(resetDefaults).toEqual(DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES);
    expect(mockStore.data[SPECIAL_DATES_NOTIFICATIONS_KEY]).toBeUndefined();
  });
});
