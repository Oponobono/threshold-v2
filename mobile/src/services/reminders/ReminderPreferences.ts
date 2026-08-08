// ── ReminderPreferences (configuración de usuario) ───────────────────────
//
// CONTRATO v1.1 (Ago 2026):
//   Configuración de usuario de los recordatorios. Device-local (MMKV), nunca
//   pasa por backend, nunca está en la ruta crítica del arranque.
//
//   Semánticas decididas:
//   - Uno o más offsets por categoría: category.offsets ?? [defaultOffset]
//     (categorías con offset: assessment | schedule | calendar_event).
//   - flashcard_deck NO tiene offset: genera EXACTAMENTE un recordatorio
//     diario a la hora checkTime (FSRS agregado diario). checkTime: string | null
//     (HH:MM); null = hereda CHECK_TIME_DEFAULT (19:00). 19:00 es solo un
//     default configurable, nunca un valor impuesto por el engine.
//   - AcademicPeriod (grading_period) quedó FUERA del Reminder Engine v1.1.
//   - Máximo un reminder por evento lógico.
//   - Los perfiles minimal/standard/persistent/custom quedan INTERNOS al
//     engine (ReminderProfile). No se exponen en preferencias.
//   - notificationsEnabled = false  →  no se genera plan.
//   - categoría enabled = false     →  no genera reminders de esa categoría.
//   - Quiet hours → OMIT, no defer.
//   - Categorías de dominio = exactamente las 4 entidades del engine:
//     assessment | schedule | calendar_event | flashcard_deck.
//   - "Tareas" NO es una categoría de dominio hasta resolver su correspondencia
//     con assessment. No se inventa una entidad solo para la UI.
//
//   Validación (fallback por campo):
//   - Valor ausente o imposible → default de ese campo.
//   - Semántica de offset por categoría:
//       category.offsets != null  →  usa el array de offsets específicos
//       category.offsets === null →  hereda defaultOffset global como [defaultOffset]
//     `parseReminderPreferences` PRESERVA `null`; un offset ausente o inválido
//     se normaliza a `null` (cae al global), NO a un default de categoría.
//     `getCategoryOffsets(prefs, category)` = category.offsets ?? [defaultOffset].
//     El array de offsets se normaliza siempre en enteros únicos, orden canónico (ascendente).
//     Si se intenta guardar un array vacío `[]`, la categoría se desactiva (`enabled=false`).
//   - Semántica de checkTime (flashcard_deck):
//       category.checkTime = 'HH:MM' → hora diaria explícita
//       category.checkTime === null  → hereda CHECK_TIME_DEFAULT ('19:00')
//     `parseReminderPreferences` PRESERVA `null`; un checkTime ausente o
//     inválido (incluido el schema viejo con `offset`) se normaliza a `null`.
//     Un schema v1 persistido (con grading_period y flashcard_deck.offset) se
//     migra sin error: las claves desconocidas se ignoran y los campos viejos
//     caen al default.
//   - Claves desconocidas (p.ej. un schema viejo) se ignoran.
//   - parseReminderPreferences NUNCA lanza y es puro (testeable sin infra).

export type OffsetCategoryName = 'assessment' | 'schedule' | 'calendar_event';
export type ReminderCategoryName = OffsetCategoryName | 'flashcard_deck';

export const CATEGORY_NAMES: readonly ReminderCategoryName[] = [
  'assessment',
  'schedule',
  'calendar_event',
  'flashcard_deck',
];

export interface OffsetCategoryPreferences {
  readonly enabled: boolean;
  /** null = "usar predeterminado" (hereda [defaultOffset] global). Arreglo = offsets explícitos. */
  readonly offsets: number[] | null;
}

export interface CheckTimeCategoryPreferences {
  readonly enabled: boolean;
  /** 'HH:MM' — hora del recordatorio diario de repaso. null = hereda CHECK_TIME_DEFAULT (19:00). */
  readonly checkTime: string | null;
}

export type ReminderCategoryPreferences = OffsetCategoryPreferences | CheckTimeCategoryPreferences;

/** Mapa de categorías tipado por clave: las 3 categorías de offset y la de
 *  hora (flashcard_deck) preservan su tipo al indexar por nombre literal. */
export interface ReminderCategoryPreferencesMap {
  assessment: OffsetCategoryPreferences;
  schedule: OffsetCategoryPreferences;
  calendar_event: OffsetCategoryPreferences;
  flashcard_deck: CheckTimeCategoryPreferences;
}

/** Hora por defecto del recordatorio diario de repaso (configurable por el usuario). */
export const CHECK_TIME_DEFAULT = '19:00';

export interface QuietHoursPreferences {
  readonly enabled: boolean;
  readonly start: string;
  readonly end: string;
}

export interface ReminderPreferences {
  readonly notificationsEnabled: boolean;
  readonly defaultOffset: number;
  readonly categories: ReminderCategoryPreferencesMap;
  readonly quietHours: QuietHoursPreferences;
}

/** Patch de actualización parcial. `offset: null` pone la categoría en "predeterminado"
 *  (hereda defaultOffset global); `checkTime: null` hace lo propio en flashcard_deck
 *  (hereda CHECK_TIME_DEFAULT). Un nombre de categoría fuera de ReminderCategoryName
 *  no es representable → imposible inventar "task" por la UI. */
export type ReminderPreferencesPatch = {
  readonly notificationsEnabled?: boolean;
  readonly defaultOffset?: number;
  readonly categories?: Partial<
    Record<ReminderCategoryName, { readonly enabled?: boolean; readonly offsets?: number[] | null; readonly checkTime?: string | null }>
  >;
  readonly quietHours?: { readonly enabled?: boolean; readonly start?: string; readonly end?: string };
};

export interface TimeOfDay {
  readonly hours: number;
  readonly minutes: number;
}

const MAX_OFFSET_MINUTES = 10080; // 7 días
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_PREFERENCES: ReminderPreferences = Object.freeze({
  notificationsEnabled: true,
  defaultOffset: 15,
  categories: Object.freeze({
    schedule: Object.freeze({ enabled: true, offsets: null }),
    assessment: Object.freeze({ enabled: true, offsets: null }),
    calendar_event: Object.freeze({ enabled: true, offsets: null }),
    flashcard_deck: Object.freeze({ enabled: true, checkTime: null }),
  }),
  quietHours: Object.freeze({ enabled: false, start: '22:30', end: '07:00' }),
});

function isOffset(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_OFFSET_MINUTES;
}

function isHHMM(v: unknown): v is string {
  return typeof v === 'string' && HHMM_RE.test(v);
}

function asObject(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normalizeOffsets(raw: unknown): number[] | null {
  if (raw === null || raw === undefined) return null;
  if (isOffset(raw)) return [raw]; // Migración simple de config antigua
  if (Array.isArray(raw)) {
    const valid = raw.filter(isOffset);
    if (valid.length === 0) return null;
    return Array.from(new Set(valid)).sort((a, b) => a - b);
  }
  return null;
}

function parseCategory(name: ReminderCategoryName, raw: unknown): ReminderCategoryPreferences {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_PREFERENCES.categories[name] };
  }
  const obj = raw as Record<string, unknown>;
  const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_PREFERENCES.categories[name].enabled;
  if (name === 'flashcard_deck') {
    const checkTime = isHHMM(obj.checkTime) ? obj.checkTime : null;
    return { enabled, checkTime };
  }
  const offsets = normalizeOffsets(obj.offsets !== undefined ? obj.offsets : obj.offset);
  // Si explícitamente era un array vacío, lo forzamos a apagado
  if (Array.isArray(obj.offsets) && obj.offsets.length === 0) {
    return { enabled: false, offsets: null };
  }
  return { enabled, offsets };
}

export function parseReminderPreferences(raw: unknown): ReminderPreferences {
  const obj = asObject(raw);
  if (Object.keys(obj).length === 0) {
    return parseReminderPreferences(DEFAULT_PREFERENCES);
  }
  const notificationsEnabled =
    typeof obj.notificationsEnabled === 'boolean' ? obj.notificationsEnabled : DEFAULT_PREFERENCES.notificationsEnabled;
  const defaultOffset = isOffset(obj.defaultOffset) ? obj.defaultOffset : DEFAULT_PREFERENCES.defaultOffset;

  const categoriesRaw = asObject(obj.categories);
  const categories = {} as ReminderCategoryPreferencesMap;
  for (const name of CATEGORY_NAMES) {
    const value = parseCategory(name, categoriesRaw[name]);
    if (name === 'flashcard_deck') {
      categories.flashcard_deck = value as CheckTimeCategoryPreferences;
    } else {
      categories[name] = value as OffsetCategoryPreferences;
    }
  }

  const qh = asObject(obj.quietHours);
  const quietHours: QuietHoursPreferences = {
    enabled: typeof qh.enabled === 'boolean' ? qh.enabled : DEFAULT_PREFERENCES.quietHours.enabled,
    start: isHHMM(qh.start) ? qh.start : DEFAULT_PREFERENCES.quietHours.start,
    end: isHHMM(qh.end) ? qh.end : DEFAULT_PREFERENCES.quietHours.end,
  };

  return { notificationsEnabled, defaultOffset, categories, quietHours };
}

export function mergePreferences(current: ReminderPreferences, patch: ReminderPreferencesPatch): ReminderPreferences {
  const categories = {} as ReminderCategoryPreferencesMap;
  for (const name of CATEGORY_NAMES) {
    const base = current.categories[name];
    const patched = patch.categories?.[name];
    const enabled = patched?.enabled ?? base.enabled;
    if (name === 'flashcard_deck') {
      const baseCt = base as CheckTimeCategoryPreferences;
      const checkTime =
        patched && 'checkTime' in patched ? (patched.checkTime === undefined ? null : patched.checkTime) : baseCt.checkTime;
      categories[name] = { enabled, checkTime };
    } else {
      const baseOff = base as OffsetCategoryPreferences;
      let offsets = baseOff.offsets;
      let finalEnabled = enabled;
      
      if (patched && 'offsets' in patched) {
        if (Array.isArray(patched.offsets) && patched.offsets.length === 0) {
          // Vacío = deshabilitar categoría y borrar custom offsets
          finalEnabled = false;
          offsets = null;
        } else {
          offsets = normalizeOffsets(patched.offsets);
        }
      }
      
      categories[name] = { enabled: finalEnabled, offsets };
    }
  }

  return {
    notificationsEnabled: patch.notificationsEnabled ?? current.notificationsEnabled,
    defaultOffset: patch.defaultOffset ?? current.defaultOffset,
    categories,
    quietHours: {
      enabled: patch.quietHours?.enabled ?? current.quietHours.enabled,
      start: patch.quietHours?.start ?? current.quietHours.start,
      end: patch.quietHours?.end ?? current.quietHours.end,
    },
  };
}

export function getCategoryOffsets(prefs: ReminderPreferences, category: OffsetCategoryName): number[] {
  return prefs.categories[category].offsets ?? [prefs.defaultOffset];
}

/** Hora diaria del recordatorio de repaso (flashcard_deck). Nunca null: null hereda CHECK_TIME_DEFAULT. */
export function getCategoryCheckTime(prefs: ReminderPreferences): string {
  return prefs.categories.flashcard_deck.checkTime ?? CHECK_TIME_DEFAULT;
}

export function isCheckTimeCategory(name: ReminderCategoryName): name is 'flashcard_deck' {
  return name === 'flashcard_deck';
}

export function isCategoryEnabled(prefs: ReminderPreferences, category: ReminderCategoryName): boolean {
  return prefs.categories[category].enabled;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function isInQuietHours(prefs: ReminderPreferences, time: TimeOfDay): boolean {
  if (!prefs.quietHours.enabled) return false;
  const nowMin = time.hours * 60 + time.minutes;
  const startMin = toMinutes(prefs.quietHours.start);
  const endMin = toMinutes(prefs.quietHours.end);
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
}
