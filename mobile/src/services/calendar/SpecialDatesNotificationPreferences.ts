/**
 * SpecialDatesNotificationPreferences.ts
 *
 * Contratos y utilidades puras para las preferencias de notificaciones
 * de fechas especiales (Festivos en Colombia y Fechas importantes/conmemorativas).
 *
 * Sin dependencias de UI, SQLite, red ni MMKV.
 */

export interface SpecialDatesNotificationPreferences {
  /** Notificaciones matutinas para días festivos oficiales de Colombia */
  readonly holidaysEnabled: boolean;
  /** Hora de entrega en formato 'HH:mm' para festivos (ej. '08:00') */
  readonly holidaysTime: string;

  /** Notificaciones para efemérides y conmemoraciones cívicas/culturales/religiosas */
  readonly commemorationsEnabled: boolean;
  /** Hora de entrega en formato 'HH:mm' para conmemoraciones (ej. '08:00') */
  readonly commemorationsTime: string;
}

export const DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES: SpecialDatesNotificationPreferences = {
  holidaysEnabled: true,
  holidaysTime: '08:00',
  commemorationsEnabled: true,
  commemorationsTime: '08:00',
};

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeString(time: unknown): time is string {
  return typeof time === 'string' && TIME_REGEX.test(time);
}

export function parseSpecialDatesNotificationPreferences(
  raw: unknown
): SpecialDatesNotificationPreferences {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES;
  }

  const obj = raw as Record<string, unknown>;

  const holidaysEnabled =
    typeof obj.holidaysEnabled === 'boolean'
      ? obj.holidaysEnabled
      : DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES.holidaysEnabled;

  const holidaysTime = isValidTimeString(obj.holidaysTime)
    ? obj.holidaysTime
    : DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES.holidaysTime;

  const commemorationsEnabled =
    typeof obj.commemorationsEnabled === 'boolean'
      ? obj.commemorationsEnabled
      : DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES.commemorationsEnabled;

  const commemorationsTime = isValidTimeString(obj.commemorationsTime)
    ? obj.commemorationsTime
    : DEFAULT_SPECIAL_DATES_NOTIFICATION_PREFERENCES.commemorationsTime;

  return {
    holidaysEnabled,
    holidaysTime,
    commemorationsEnabled,
    commemorationsTime,
  };
}

export function mergeSpecialDatesNotificationPreferences(
  current: SpecialDatesNotificationPreferences,
  patch: Partial<SpecialDatesNotificationPreferences>
): SpecialDatesNotificationPreferences {
  return {
    holidaysEnabled:
      typeof patch.holidaysEnabled === 'boolean' ? patch.holidaysEnabled : current.holidaysEnabled,
    holidaysTime: isValidTimeString(patch.holidaysTime) ? patch.holidaysTime : current.holidaysTime,
    commemorationsEnabled:
      typeof patch.commemorationsEnabled === 'boolean'
        ? patch.commemorationsEnabled
        : current.commemorationsEnabled,
    commemorationsTime: isValidTimeString(patch.commemorationsTime)
      ? patch.commemorationsTime
      : current.commemorationsTime,
  };
}
