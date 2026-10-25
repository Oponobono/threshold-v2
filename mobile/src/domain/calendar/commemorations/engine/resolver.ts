/**
 * resolver.ts
 *
 * Interpreta UNA definición conmemorativa para un año concreto aplicando su
 * regla de calendario. No conoce el catálogo completo ni compone observancias
 * procedimentales: esa responsabilidad vive en generateCommemorations.ts.
 */

import { addDaysToDate } from '../../easter';
import type { CommemorationDefinition, SpecialDateItem } from '../../types';
import {
  getLastWeekdayOfMonth,
  getNthWeekdayOfMonth,
  isLeapYear,
} from './calendarRules';

/**
 * Resuelve una definición conmemorativa para un año determinado,
 * aplicando su regla de calendario.
 */
export function resolveDefinition(
  def: CommemorationDefinition,
  year: number,
  easter: { year: number; month: number; day: number; dateId: string }
): SpecialDateItem[] {
  // 1. Filtrado por vigencia temporal institucional
  if (def.validFromYear !== undefined && year < def.validFromYear) {
    return [];
  }
  if (def.validUntilYear !== undefined && year > def.validUntilYear) {
    return [];
  }

  const makeId = (dateId: string, slug: string) => `commem-${dateId}-${slug}`;
  const rule = def.dateRule;

  switch (rule.type) {
    case 'fixed': {
      const dId = `${year}-${String(rule.month).padStart(2, '0')}-${String(rule.day).padStart(2, '0')}`;
      return [
        {
          id: makeId(dId, def.id),
          name: def.name,
          category: def.category,
          basis: def.basis,
          dateRule: def.dateRule,
          isHoliday: false,
          note: def.note,
          icon: def.icon,
          iconFamily: def.iconFamily || 'material',
          subItems: def.subItems,
          authority: def.authority,
          sourceUrl: def.sourceUrl,
          sourceId: def.sourceId,
          status: def.status || 'verified',
          verifiedAt: def.verifiedAt,
          validFromYear: def.validFromYear,
          validUntilYear: def.validUntilYear,
        },
      ];
    }

    case 'nth-weekday': {
      try {
        const dId = getNthWeekdayOfMonth(year, rule.month, rule.weekday, rule.occurrence);
        return [
          {
            id: makeId(dId, def.id),
            name: def.name,
            category: def.category,
            basis: def.basis,
            dateRule: def.dateRule,
            isHoliday: false,
            note: def.note,
            icon: def.icon,
            iconFamily: def.iconFamily || 'material',
            subItems: def.subItems,
            authority: def.authority,
            sourceUrl: def.sourceUrl,
            sourceId: def.sourceId,
            status: def.status || 'verified',
            verifiedAt: def.verifiedAt,
            validFromYear: def.validFromYear,
            validUntilYear: def.validUntilYear,
          },
        ];
      } catch {
        return [];
      }
    }

    case 'last-weekday': {
      try {
        const dId = getLastWeekdayOfMonth(year, rule.month, rule.weekday);
        return [
          {
            id: makeId(dId, def.id),
            name: def.name,
            category: def.category,
            basis: def.basis,
            dateRule: def.dateRule,
            isHoliday: false,
            note: def.note,
            icon: def.icon,
            iconFamily: def.iconFamily || 'material',
            subItems: def.subItems,
            authority: def.authority,
            sourceUrl: def.sourceUrl,
            sourceId: def.sourceId,
            status: def.status || 'verified',
            verifiedAt: def.verifiedAt,
            validFromYear: def.validFromYear,
            validUntilYear: def.validUntilYear,
          },
        ];
      } catch {
        return [];
      }
    }

    case 'easter-offset': {
      const dId = addDaysToDate(easter.year, easter.month, easter.day, rule.days);
      const isHolyThursdayOrFriday = def.id.includes('jueves-santo') || def.id.includes('viernes-santo');
      return [
        {
          id: makeId(dId, def.id),
          name: def.name,
          category: def.category,
          basis: def.basis,
          dateRule: def.dateRule,
          isHoliday: isHolyThursdayOrFriday,
          note: def.note,
          icon: def.icon,
          iconFamily: def.iconFamily || 'material',
          subItems: def.subItems,
          authority: def.authority,
          sourceUrl: def.sourceUrl,
          sourceId: def.sourceId,
          status: def.status || 'verified',
          verifiedAt: def.verifiedAt,
          validFromYear: def.validFromYear,
          validUntilYear: def.validUntilYear,
        },
      ];
    }

    case 'day-of-year': {
      const leap = isLeapYear(year);
      let dId: string;
      if (rule.day === 256) {
        dId = leap ? `${year}-09-12` : `${year}-09-13`;
      } else {
        const d = new Date(Date.UTC(year, 0, 1));
        d.setUTCDate(rule.day);
        dId = d.toISOString().slice(0, 10);
      }
      return [
        {
          id: makeId(dId, def.id),
          name: def.name,
          category: def.category,
          basis: def.basis,
          dateRule: def.dateRule,
          isHoliday: false,
          note: def.note,
          icon: def.icon,
          iconFamily: def.iconFamily || 'material',
          subItems: def.subItems,
          authority: def.authority,
          sourceUrl: def.sourceUrl,
          sourceId: def.sourceId,
          status: def.status || 'verified',
          verifiedAt: def.verifiedAt,
          validFromYear: def.validFromYear,
          validUntilYear: def.validUntilYear,
        },
      ];
    }

    case 'date-range': {
      const isCrossYear = rule.endMonth < rule.startMonth;
      const endYear = isCrossYear ? year + 1 : year;
      const start = new Date(Date.UTC(year, rule.startMonth - 1, rule.startDay));
      const end = new Date(Date.UTC(endYear, rule.endMonth - 1, rule.endDay));
      const startStr = `${year}-${String(rule.startMonth).padStart(2, '0')}-${String(rule.startDay).padStart(2, '0')}`;
      const endStr = `${endYear}-${String(rule.endMonth).padStart(2, '0')}-${String(rule.endDay).padStart(2, '0')}`;
      const items: SpecialDateItem[] = [];

      for (let cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
        if (cur.getUTCFullYear() === year) {
          const curM = String(cur.getUTCMonth() + 1).padStart(2, '0');
          const curD = String(cur.getUTCDate()).padStart(2, '0');
          const dId = `${year}-${curM}-${curD}`;
          items.push({
            id: makeId(dId, def.id),
            name: def.name,
            category: def.category,
            basis: def.basis,
            dateRule: def.dateRule,
            isHoliday: false,
            note: def.note,
            icon: def.icon,
            iconFamily: def.iconFamily || 'material',
            subItems: def.subItems,
            authority: def.authority,
            sourceUrl: def.sourceUrl,
            sourceId: def.sourceId,
            status: def.status || 'verified',
            verifiedAt: def.verifiedAt,
            validFromYear: def.validFromYear,
            validUntilYear: def.validUntilYear,
            dateRange: { start: startStr, end: endStr },
          });
        }
      }

      // Soporte para cola de rango que inició en diciembre del año anterior
      if (isCrossYear) {
        const startPrev = new Date(Date.UTC(year - 1, rule.startMonth - 1, rule.startDay));
        const endPrev = new Date(Date.UTC(year, rule.endMonth - 1, rule.endDay));
        const startPrevStr = `${year - 1}-${String(rule.startMonth).padStart(2, '0')}-${String(rule.startDay).padStart(2, '0')}`;
        const endPrevStr = `${year}-${String(rule.endMonth).padStart(2, '0')}-${String(rule.endDay).padStart(2, '0')}`;
        for (let cur = new Date(startPrev); cur <= endPrev; cur.setUTCDate(cur.getUTCDate() + 1)) {
          if (cur.getUTCFullYear() === year) {
            const curM = String(cur.getUTCMonth() + 1).padStart(2, '0');
            const curD = String(cur.getUTCDate()).padStart(2, '0');
            const dId = `${year}-${curM}-${curD}`;
            items.push({
              id: makeId(dId, def.id),
              name: def.name,
              category: def.category,
              basis: def.basis,
              dateRule: def.dateRule,
              isHoliday: false,
              note: def.note,
              icon: def.icon,
              iconFamily: def.iconFamily || 'material',
              subItems: def.subItems,
              authority: def.authority,
              sourceUrl: def.sourceUrl,
              sourceId: def.sourceId,
              status: def.status || 'verified',
              verifiedAt: def.verifiedAt,
              validFromYear: def.validFromYear,
              validUntilYear: def.validUntilYear,
              dateRange: { start: startPrevStr, end: endPrevStr },
            });
          }
        }
      }

      return items;
    }

    default:
      return [];
  }
}
