/**
 * SpecialDatesNotificationPreferencesService.ts
 *
 * Servicio de persistencia device-local en MMKV para la configuración
 * de notificaciones de fechas especiales (Festivos y Conmemoraciones).
 *
 * Síncrono, resiliente y libre de excepciones: en ausencia de MMKV o corrupción,
 * recurre de manera segura a los defaults preestablecidos.
 */

import {
  SpecialDatesNotificationPreferences,
  DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES,
  parseSpecialDatesNotificationPreferences,
  mergeSpecialDatesNotificationPreferences,
} from './SpecialDatesNotificationPreferences';

export interface KeyValueStore {
  getString(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}

export const SPECIAL_DATES_NOTIFICATIONS_KEY = 'threshold.specialDatesNotifications.v1';

export class SpecialDatesNotificationPreferencesService {
  constructor(private readonly store: KeyValueStore) {}

  getPreferences(): SpecialDatesNotificationPreferences {
    try {
      const raw = this.store.getString(SPECIAL_DATES_NOTIFICATIONS_KEY);
      if (!raw) return DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES;
      const parsed = JSON.parse(raw);
      return parseSpecialDatesNotificationPreferences(parsed);
    } catch {
      return DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES;
    }
  }

  setPreferences(
    patch: Partial<SpecialDatesNotificationPreferences>
  ): SpecialDatesNotificationPreferences {
    const current = this.getPreferences();
    const updated = mergeSpecialDatesNotificationPreferences(current, patch);
    try {
      this.store.set(SPECIAL_DATES_NOTIFICATIONS_KEY, JSON.stringify(updated));
    } catch {
      // noop - resiliente ante errores de I/O
    }
    return updated;
  }

  reset(): SpecialDatesNotificationPreferences {
    try {
      this.store.delete(SPECIAL_DATES_NOTIFICATIONS_KEY);
    } catch {
      // noop
    }
    return DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES;
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

let _instance: SpecialDatesNotificationPreferencesService | null = null;

export function getSpecialDatesNotificationPreferencesService(): SpecialDatesNotificationPreferencesService {
  if (!_instance) {
    _instance = new SpecialDatesNotificationPreferencesService(mmkvStore);
  }
  return _instance;
}
