/**
 * commemorations/index.ts
 *
 * Único punto de composición del catálogo. Los catálogos declaran datos, el
 * motor interpreta reglas y aquí se decide el orden en que ambos se combinan.
 *
 * Orden de composición: internacional → salud → Colombia → religiosa.
 * No aporta semántica propia; solo determina el orden secundario dentro de un
 * mismo día cuando dos observancias coinciden (el festivo y las campañas
 * multidiía conservan su precedencia en specialDatesEngine).
 */

import type { CommemorationDefinition, SpecialDateItem } from '../types';
import { colombiaDefinitions } from './catalog/colombia';
import { healthDefinitions } from './catalog/health';
import { internationalDefinitions } from './catalog/international';
import { religiousDefinitions } from './catalog/religious';
import { buildCommemorationsForYear } from './engine/generateCommemorations';

export { isLeapYear, getNthWeekdayOfMonth, getLastWeekdayOfMonth } from './engine/calendarRules';
export { resolveDefinition } from './engine/resolver';

/**
 * Catálogo completo de definiciones declarativas.
 */
export const COMMEMORATION_DEFINITIONS: readonly CommemorationDefinition[] = [
  ...internationalDefinitions,
  ...healthDefinitions,
  ...colombiaDefinitions,
  ...religiousDefinitions,
];

/**
 * Genera el conjunto completo de conmemoraciones y efemérides para el año dado.
 */
export function generateCommemorations(year: number): SpecialDateItem[] {
  return buildCommemorationsForYear(year, COMMEMORATION_DEFINITIONS);
}
