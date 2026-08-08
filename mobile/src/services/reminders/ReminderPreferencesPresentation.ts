// ── ReminderPreferencesPresentation (proyección UI del contrato) ──────────
// Módulo puro: transforma el contrato ReminderPreferences en lo que la UI
// necesita renderizar (etiquetas de categorías en lenguaje de producto,
// offsets legibles, resumen). No importa infraestructura — solo el contrato.
//
// La UI es una PROYECCIÓN del contrato: no existe capa de traducción de
// perfiles (minimal/standard/persistent/custom quedan internos al engine).
// El mapping de nombre técnico → presentación vive aquí para que sea
// testeable sin React ni MMKV.

import { CATEGORY_NAMES, getCategoryOffsets } from './ReminderPreferences';
import type { OffsetCategoryName, ReminderCategoryName, ReminderPreferences } from './ReminderPreferences';

export interface TranslateOptions {
  readonly count?: number;
  readonly defaultValue?: string;
  // Índice abierto: permite extras como `total` y satisface el tipo de
  // options de i18next (TOptionsBase & $Dictionary, requiere index signature).
  readonly [key: string]: unknown;
}

export type TranslateFn = (key: string, options?: TranslateOptions) => string;

/** Anticipaciones expuestas en la UI (minutos antes del evento). Incluye 0
 *  ("en el momento"), permitido por el contrato (isOffset admite >= 0). */
export const OFFSET_PRESETS: readonly number[] = [0, 5, 15, 30, 60, 120, 1440];

export interface CategoryPresentation {
  readonly name: ReminderCategoryName;
  readonly labelKey: string;
  readonly icon: string;
}

/** Orden de presentación + lenguaje de producto (clave i18n). El nombre
 *  técnico del contrato se conserva internamente; la UI no lo muestra. */
export const CATEGORY_PRESENTATION: readonly CategoryPresentation[] = [
  { name: 'schedule', labelKey: 'reminders.category.schedule', icon: 'time-outline' },
  { name: 'assessment', labelKey: 'reminders.category.assessment', icon: 'calendar-check-outline' },
  { name: 'calendar_event', labelKey: 'reminders.category.calendar_event', icon: 'calendar-outline' },
  { name: 'flashcard_deck', labelKey: 'reminders.category.flashcard_deck', icon: 'layers-outline' },
];

export function formatOffsetLabel(minutes: number, translate: TranslateFn): string {
  if (minutes === 0) {
    return translate('reminders.offsetNow', { defaultValue: 'En el momento' });
  }
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1
      ? translate('reminders.offsetDay', { defaultValue: '1 día antes' })
      : translate('reminders.offsetDays', { count: days, defaultValue: '{{count}} días antes' });
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1
      ? translate('reminders.offsetHour', { defaultValue: '1 h antes' })
      : translate('reminders.offsetHours', { count: hours, defaultValue: '{{count}} h antes' });
  }
  return translate('reminders.offsetMinutes', { count: minutes, defaultValue: '{{count}} min antes' });
}

export function formatOffsetsLabel(minutesArray: number[], translate: TranslateFn): string {
  if (minutesArray.length === 0) return '';
  if (minutesArray.length === 1) return formatOffsetLabel(minutesArray[0], translate);
  // Sort ascendente por defecto
  const sorted = [...minutesArray].sort((a, b) => a - b);
  const labels = sorted.map(m => formatOffsetLabel(m, translate).replace(/ antes$/i, '').trim());
  const last = labels.pop();
  return `${labels.join(', ')} y ${last} antes`;
}

/** Offsets efectivos de una categoría de offset: category.offsets ?? [defaultOffset].
 *  flashcard_deck no participa: usa checkTime, no offsets. */
export function effectiveCategoryOffsets(prefs: ReminderPreferences, category: OffsetCategoryName): number[] {
  return getCategoryOffsets(prefs, category);
}

/** true si la categoría tiene offsets propios (no hereda [defaultOffset]). */
export function categoryHasCustomOffsets(prefs: ReminderPreferences, category: OffsetCategoryName): boolean {
  return prefs.categories[category].offsets != null;
}

export function enabledCategoryCount(prefs: ReminderPreferences): number {
  return CATEGORY_NAMES.filter((name) => prefs.categories[name].enabled).length;
}

export function categoryCount(): number {
  return CATEGORY_NAMES.length;
}
