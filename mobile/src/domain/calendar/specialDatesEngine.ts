/**
 * specialDatesEngine.ts
 *
 * Motor unificado de fechas especiales y festivos de Colombia.
 * Combina la Ley Emiliani (18 festivos oficiales) con el catálogo de conmemoraciones,
 * soporte de preferencias por categoría y overrides locales/remotos.
 *
 * Aritmética de calendario pura e indexación por DateId 'YYYY-MM-DD'.
 */

import { generateHolidaySpecialItems } from './colombiaHolidays';
import { generateCommemorations } from './colombiaCommemorations';
import {
  SpecialDateItem,
  SpecialDayRecord,
  SpecialDatesPreferences,
  SpecialDateOverride,
  DEFAULT_SPECIAL_DATES_PREFERENCES,
} from './types';

// Cache en memoria por año y clave de configuración
const _yearCache = new Map<string, Map<string, SpecialDayRecord>>();

function buildCacheKey(
  year: number,
  prefs: SpecialDatesPreferences = DEFAULT_SPECIAL_DATES_PREFERENCES,
  overrides: readonly SpecialDateOverride[] = []
): string {
  const showH = (prefs.showHolidays ?? true) ? 1 : 0;
  const showS = (prefs.showSpecialDates ?? true) ? 1 : 0;
  const cats = prefs.enabledCategories;
  const pKey = `${showH}${showS}${cats?.religiosa ? 1 : 0}${cats?.nacional ? 1 : 0}${cats?.educacion ? 1 : 0}${cats?.internacional ? 1 : 0}`;
  const oKey = overrides.length > 0 ? overrides.map(o => `${o.id}:${o.action}`).join('|') : 'no-overrides';
  return `${year}_${pKey}_${oKey}`;
}

/**
 * Deduplica y fusiona elementos del mismo día para no repetir títulos cuando
 * el festivo oficial y la celebración religiosa/cívica coinciden (ej. Jueves y Viernes Santo).
 */
function mergeDayItems(items: SpecialDateItem[]): SpecialDateItem[] {
  const mergedMap = new Map<string, SpecialDateItem>();

  for (const item of items) {
    // Si es Jueves Santo o Viernes Santo, consolidar en una sola entrada enriquecida con los subItems litúrgicos
    const isJuevesSanto = item.id.includes('Jueves Santo') || item.id.includes('jueves-santo');
    const isViernesSanto = item.id.includes('Viernes Santo') || item.id.includes('viernes-santo');

    if (isJuevesSanto || isViernesSanto) {
      const key = isJuevesSanto ? 'jueves-santo-consolidado' : 'viernes-santo-consolidado';
      const cleanName = isJuevesSanto ? 'Jueves Santo' : 'Viernes Santo';
      const existing = mergedMap.get(key);
      if (existing) {
        mergedMap.set(key, {
          ...existing,
          name: cleanName,
          isHoliday: true,
          subItems: item.subItems || existing.subItems,
          note: item.note || existing.note,
          icon: item.icon || existing.icon,
        });
      } else {
        mergedMap.set(key, {
          ...item,
          name: cleanName,
          isHoliday: true,
        });
      }
      continue;
    }

    // Para cualquier otro item, usar su id único
    mergedMap.set(item.id, item);
  }

  return Array.from(mergedMap.values());
}

/**
 * Aplica overrides (decretos presidenciales, días cívicos o modificaciones de ley).
 */
function applyOverrides(
  itemsByDate: Map<string, SpecialDateItem[]>,
  overrides: readonly SpecialDateOverride[]
) {
  for (const override of overrides) {
    const list = itemsByDate.get(override.date) || [];

    if (override.action === 'add') {
      list.push({
        id: `override-${override.id}`,
        name: override.name,
        category: override.category,
        basis: override.basis,
        isHoliday: Boolean(override.isHoliday),
        note: override.description,
      });
      itemsByDate.set(override.date, list);
    } else if (override.action === 'remove') {
      const filtered = list.filter(item => item.id !== override.id && !item.name.includes(override.name));
      itemsByDate.set(override.date, filtered);
    } else if (override.action === 'rename') {
      const renamed = list.map(item => {
        if (item.id === override.id || item.name.includes(override.name)) {
          return {
            ...item,
            name: override.name,
            note: override.description || item.note,
          };
        }
        return item;
      });
      itemsByDate.set(override.date, renamed);
    }
  }
}

/**
 * Genera e indexa todos los días especiales y festivos del año en un Map<DateId, SpecialDayRecord>.
 * El resultado está memoizado por año y configuración.
 */
export function getSpecialDaysForYear(
  year: number,
  options: {
    preferences?: SpecialDatesPreferences;
    overrides?: readonly SpecialDateOverride[];
  } = {}
): Map<string, SpecialDayRecord> {
  const prefs = options.preferences || DEFAULT_SPECIAL_DATES_PREFERENCES;
  const overrides = options.overrides || [];
  const cacheKey = buildCacheKey(year, prefs, overrides);

  if (_yearCache.has(cacheKey)) {
    return _yearCache.get(cacheKey)!;
  }

  const showHolidays = prefs.showHolidays ?? true;
  const showSpecialDates = prefs.showSpecialDates ?? true;

  // 1. Obtener festivos oficiales (Ley Emiliani)
  const holidayItems = showHolidays ? generateHolidaySpecialItems(year) : [];

  // 2. Obtener conmemoraciones y efemérides
  const commemItems = showSpecialDates ? generateCommemorations(year) : [];

  // 3. Filtrar según categorías permitidas en preferencias
  const allItems = [...holidayItems, ...commemItems].filter(item => {
    if (item.category === 'festivo') return true;
    if (!prefs.enabledCategories) return true;
    if (item.category === 'religiosa') return prefs.enabledCategories.religiosa;
    if (item.category === 'nacional') return prefs.enabledCategories.nacional;
    if (item.category === 'educacion') return prefs.enabledCategories.educacion;
    if (item.category === 'internacional') return prefs.enabledCategories.internacional;
    return true;
  });

  // 4. Agrupar por DateId
  const rawGrouped = new Map<string, SpecialDateItem[]>();
  for (const item of allItems) {
    // Si fue trasladado, la conmemoración va en originalDateId o en observedDateId
    const targetDate = item.isObservanceMoved ? item.originalDateId! : (item.observedDateId || item.id.split('-').slice(1, 4).join('-'));
    const current = rawGrouped.get(targetDate) || [];
    current.push(item);
    rawGrouped.set(targetDate, current);
  }

  // 5. Aplicar overrides
  applyOverrides(rawGrouped, overrides);

  // 6. Construir SpecialDayRecord final
  const recordsMap = new Map<string, SpecialDayRecord>();
  for (const [dateId, dayItems] of rawGrouped.entries()) {
    const merged = mergeDayItems(dayItems);
    const holidayItem = merged.find(i => i.isHoliday);

    // Si hay un festivo oficial de Colombia, siempre es el elemento principal (items[0])
    // de la tarjeta. Las demás efemérides (ej. Virgen del Pilar) se desplegarán en el acordeón.
    merged.sort((a, b) => {
      if (a.isHoliday && !b.isHoliday) return -1;
      if (!a.isHoliday && b.isHoliday) return 1;
      return 0;
    });

    recordsMap.set(dateId, {
      dateId,
      isHoliday: Boolean(holidayItem),
      holidayName: holidayItem ? holidayItem.name.replace(/^Festivo:\s*/i, '') : undefined,
      items: merged,
    });
  }

  _yearCache.set(cacheKey, recordsMap);
  return recordsMap;
}

/**
 * Consulta en O(1) si una fecha específica (YYYY-MM-DD) es festivo oficial en Colombia.
 * Resuelve automáticamente el cruce de años adyacentes (ej. diciembre/enero en la cuadrícula).
 */
export function isColombianHoliday(
  dateId: string,
  options?: {
    preferences?: SpecialDatesPreferences;
    overrides?: readonly SpecialDateOverride[];
  }
): boolean {
  if (!dateId || !/^\d{4}-\d{2}-\d{2}$/.test(dateId)) return false;
  const year = Number(dateId.slice(0, 4));
  const yearIndex = getSpecialDaysForYear(year, options);
  const record = yearIndex.get(dateId);
  return Boolean(record?.isHoliday);
}

/**
 * Consulta en O(1) el registro de festivos y conmemoraciones para un día específico (YYYY-MM-DD).
 */
export function getSpecialDayRecord(
  dateId: string,
  options?: {
    preferences?: SpecialDatesPreferences;
    overrides?: readonly SpecialDateOverride[];
  }
): SpecialDayRecord | null {
  if (!dateId || !/^\d{4}-\d{2}-\d{2}$/.test(dateId)) return null;
  const year = Number(dateId.slice(0, 4));
  const yearIndex = getSpecialDaysForYear(year, options);
  return yearIndex.get(dateId) || null;
}

/**
 * Retorna un conjunto (Set<number>) de los días del mes dado (1-31) que son festivos oficiales.
 * Ideal para pasarlo a CalendarGrid y evaluar cada celda en O(1).
 */
export function getMonthHolidayDaysSet(
  year: number,
  month: number, // 0-11 (como Date.getMonth())
  options?: {
    preferences?: SpecialDatesPreferences;
    overrides?: readonly SpecialDateOverride[];
  }
): Set<number> {
  const yearIndex = getSpecialDaysForYear(year, options);
  const mStr = String(month + 1).padStart(2, '0');
  const holidayDays = new Set<number>();

  for (let day = 1; day <= 31; day++) {
    const dStr = String(day).padStart(2, '0');
    const dateId = `${year}-${mStr}-${dStr}`;
    const record = yearIndex.get(dateId);
    if (record?.isHoliday) {
      holidayDays.add(day);
    }
  }

  return holidayDays;
}

/**
 * Limpia el cache en memoria (útil en tests o al cambiar overrides).
 */
export function clearSpecialDatesCache(): void {
  _yearCache.clear();
}
