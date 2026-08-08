// ── ReminderPreferencesService (IO) ──────────────────────────────────────
// Persistencia device-local en MMKV (síncrono). La validación y la caída a
// defaults viven en ReminderPreferences (módulo puro). Este servicio NUNCA
// lanza: corrupción, schema viejo, ausencia de datos o MMKV no disponible →
// defaults. Backend fuera de la ruta crítica.
//
// Consumo: el ReminderSystemFactory inyecta `getReminderPreferencesService().get`
// como preferencesProvider del ReminderEngine (WIRING, Ago 2026). El engine
// consulta las preferencias en cada initialize/evento; el servicio permanece
// fuera de la ruta crítica del arranque (MMKV lazy, nunca lanza).

import {
  parseReminderPreferences,
  mergePreferences,
  DEFAULT_PREFERENCES,
} from './ReminderPreferences';
import type { ReminderPreferences, ReminderPreferencesPatch } from './ReminderPreferences';

export interface KeyValueStore {
  getString(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}

export const REMINDER_PREFERENCES_KEY = 'threshold.reminderPreferences.v1';

export class ReminderPreferencesService {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key: string = REMINDER_PREFERENCES_KEY,
  ) {}

  get defaults(): ReminderPreferences {
    return DEFAULT_PREFERENCES;
  }

  get(): ReminderPreferences {
    try {
      const raw = this.store.getString(this.key);
      if (raw == null || raw.length === 0) {
        return parseReminderPreferences(DEFAULT_PREFERENCES);
      }
      return parseReminderPreferences(JSON.parse(raw));
    } catch {
      return parseReminderPreferences(DEFAULT_PREFERENCES);
    }
  }

  set(patch: ReminderPreferencesPatch): ReminderPreferences {
    const current = this.get();
    const validated = parseReminderPreferences(mergePreferences(current, patch));
    try {
      this.store.set(this.key, JSON.stringify(validated));
    } catch {
      // Persistencia falló (p.ej. MMKV no disponible): se devuelve el estado válido en memoria.
    }
    return validated;
  }

  reset(): ReminderPreferences {
    try {
      this.store.delete(this.key);
    } catch {
      // Idempotente: sin persistencia, defaults en memoria.
    }
    return parseReminderPreferences(DEFAULT_PREFERENCES);
  }
}

// ── Producción: singleton con MMKV lazy (mismo patrón que el resto del codebase) ──

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

let _instance: ReminderPreferencesService | null = null;

export function getReminderPreferencesService(): ReminderPreferencesService {
  if (!_instance) {
    _instance = new ReminderPreferencesService(mmkvStore);
  }
  return _instance;
}
