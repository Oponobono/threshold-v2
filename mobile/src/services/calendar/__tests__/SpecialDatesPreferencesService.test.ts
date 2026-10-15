import {
  SpecialDatesPreferencesService,
  SPECIAL_DATES_PREFERENCES_KEY,
  SPECIAL_DATES_OVERRIDES_KEY,
} from '../SpecialDatesPreferencesService';
import { DEFAULT_SPECIAL_DATES_PREFERENCES } from '../../../domain/calendar/types';

describe('SpecialDatesPreferencesService', () => {
  let mockStore: {
    data: Record<string, string>;
    getString: (k: string) => string | null;
    set: (k: string, v: string) => void;
    delete: (k: string) => void;
  };
  let service: SpecialDatesPreferencesService;

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
    service = new SpecialDatesPreferencesService(mockStore);
  });

  it('retorna DEFAULT_SPECIAL_DATES_PREFERENCES en ausencia de datos en el store', () => {
    const prefs = service.getPreferences();
    expect(prefs).toEqual(DEFAULT_SPECIAL_DATES_PREFERENCES);
  });

  it('actualiza y persiste parcialmente las categorías habilitadas', () => {
    const updated = service.setPreferences({ religiosa: false });
    expect(updated.enabledCategories.religiosa).toBe(false);
    expect(updated.enabledCategories.nacional).toBe(true);

    const persisted = JSON.parse(mockStore.data[SPECIAL_DATES_PREFERENCES_KEY]);
    expect(persisted.enabledCategories.religiosa).toBe(false);
    expect(persisted.enabledCategories.nacional).toBe(true);
  });

  it('almacena y recupera overrides de fechas especiales', () => {
    expect(service.getOverrides()).toEqual([]);

    const override = {
      id: 'dia-civico',
      date: '2026-04-17',
      name: 'Día Cívico',
      category: 'nacional' as const,
      basis: 'ley' as const,
      action: 'add' as const,
      isHoliday: true,
    };

    service.setOverrides([override]);
    expect(service.getOverrides()).toEqual([override]);

    const persisted = JSON.parse(mockStore.data[SPECIAL_DATES_OVERRIDES_KEY]);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe('dia-civico');
  });

  it('reset limpia las claves y restablece los defaults', () => {
    service.setPreferences({ educacion: false });
    expect(mockStore.data[SPECIAL_DATES_PREFERENCES_KEY]).toBeDefined();

    service.reset();
    expect(mockStore.data[SPECIAL_DATES_PREFERENCES_KEY]).toBeUndefined();
    expect(mockStore.data[SPECIAL_DATES_OVERRIDES_KEY]).toBeUndefined();
    expect(service.getPreferences()).toEqual(DEFAULT_SPECIAL_DATES_PREFERENCES);
  });

  it('resiliente ante datos corruptos en el store', () => {
    mockStore.data[SPECIAL_DATES_PREFERENCES_KEY] = '{invalid-json';
    mockStore.data[SPECIAL_DATES_OVERRIDES_KEY] = '{invalid-json';

    expect(service.getPreferences()).toEqual(DEFAULT_SPECIAL_DATES_PREFERENCES);
    expect(service.getOverrides()).toEqual([]);
  });
});
