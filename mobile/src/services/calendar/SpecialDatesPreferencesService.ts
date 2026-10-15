/**
 * SpecialDatesPreferencesService.ts
 *
 * Servicio de persistencia device-local en MMKV (síncrono y resiliente).
 * Almacena las preferencias de categorías y los overrides remotos/locales.
 * Nunca lanza excepciones: en ausencia de MMKV o corrupción, recurre a defaults.
 */

import {
  SpecialDatesPreferences,
  SpecialDateOverride,
  DEFAULT_SPECIAL_DATES_PREFERENCES,
} from '../../domain/calendar/types';
import { clearSpecialDatesCache } from '../../domain/calendar/specialDatesEngine';

export interface KeyValueStore {
  getString(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}

export const SPECIAL_DATES_PREFERENCES_KEY = 'threshold.specialDatesPreferences.v1';
export const SPECIAL_DATES_OVERRIDES_KEY = 'threshold.specialDatesOverrides.v1';

export class SpecialDatesPreferencesService {
  constructor(private readonly store: KeyValueStore) {}

  getPreferences(): SpecialDatesPreferences {
    try {
      const raw = this.store.getString(SPECIAL_DATES_PREFERENCES_KEY);
      if (!raw) return DEFAULT_SPECIAL_DATES_PREFERENCES;
      const parsed = JSON.parse(raw);
      return {
        enabledCategories: {
          religiosa: parsed?.enabledCategories?.religiosa ?? true,
          nacional: parsed?.enabledCategories?.nacional ?? true,
          educacion: parsed?.enabledCategories?.educacion ?? true,
          internacional: parsed?.enabledCategories?.internacional ?? true,
        },
      };
    } catch {
      return DEFAULT_SPECIAL_DATES_PREFERENCES;
    }
  }

  setPreferences(patch: Partial<SpecialDatesPreferences['enabledCategories']>): SpecialDatesPreferences {
    const current = this.getPreferences();
    const updated: SpecialDatesPreferences = {
      enabledCategories: {
        ...current.enabledCategories,
        ...patch,
      },
    };
    try {
      this.store.set(SPECIAL_DATES_PREFERENCES_KEY, JSON.stringify(updated));
      clearSpecialDatesCache();
    } catch {
      // noop
    }
    return updated;
  }

  getOverrides(): readonly SpecialDateOverride[] {
    try {
      const raw = this.store.getString(SPECIAL_DATES_OVERRIDES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as SpecialDateOverride[];
      }
      return [];
    } catch {
      return [];
    }
  }

  setOverrides(overrides: readonly SpecialDateOverride[]): void {
    try {
      this.store.set(SPECIAL_DATES_OVERRIDES_KEY, JSON.stringify(overrides));
      clearSpecialDatesCache();
    } catch {
      // noop
    }
  }

  reset(): void {
    try {
      this.store.delete(SPECIAL_DATES_PREFERENCES_KEY);
      this.store.delete(SPECIAL_DATES_OVERRIDES_KEY);
      clearSpecialDatesCache();
    } catch {
      // noop
    }
  }
}

// ── Singleton con MMKV lazy ──────────────────────────────────────────────────

interface MmkvLike {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

let _mmkv: MmkvLike | null = null;

function getMMKV(): MmkvLike | null {
  if (_mmkv) return _mmkv;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require('react-native-mmkv');
    _mmkv = createMMKV();
  } catch {
    _mmkv = null;
  }
  return _mmkv;
}

const mmkvStore: KeyValueStore = {
  getString: (key) => {
    try {
      const mmkv = getMMKV();
      return mmkv ? (mmkv.getString(key) ?? null) : null;
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      const mmkv = getMMKV();
      if (mmkv) mmkv.set(key, value);
    } catch {
      // noop
    }
  },
  delete: (key) => {
    try {
      const mmkv = getMMKV();
      if (mmkv) mmkv.delete(key);
    } catch {
      // noop
    }
  },
};

let _instance: SpecialDatesPreferencesService | null = null;

export function getSpecialDatesPreferencesService(): SpecialDatesPreferencesService {
  if (!_instance) {
    _instance = new SpecialDatesPreferencesService(mmkvStore);
  }
  return _instance;
}
