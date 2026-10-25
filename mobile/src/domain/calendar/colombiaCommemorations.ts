/**
 * colombiaCommemorations.ts
 *
 * Fachada pública del catálogo de conmemoraciones colombianas, internacionales y
 * de salud. La implementación vive en `./commemorations/`:
 *
 * - `catalog/` — datos declarativos por ámbito (internacional, salud, Colombia, religiosa).
 * - `engine/calendarRules.ts` — aritmética pura de calendario.
 * - `engine/resolver.ts` — interpretación de una definición para un año.
 * - `engine/proceduralObservances.ts` — observancias día a día (Novena de Aguinaldos).
 * - `engine/generateCommemorations.ts` — composición anual.
 * - `index.ts` — punto único de composición y orden del catálogo.
 *
 * Se conservan aquí los seis símbolos históricos para no obligar a los
 * consumidores a conocer la estructura interna.
 */

export {
  isLeapYear,
  getNthWeekdayOfMonth,
  getLastWeekdayOfMonth,
  COMMEMORATION_DEFINITIONS,
  resolveDefinition,
  generateCommemorations,
} from './commemorations';
