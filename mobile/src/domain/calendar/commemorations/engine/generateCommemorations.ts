/**
 * generateCommemorations.ts
 *
 * Composición del año: catálogo + motor de reglas + observancias procedimentales.
 * El orden es parte del contrato: primero todas las definiciones declarativas y
 * al final las observancias procedimentales (Novena de Aguinaldos).
 */

import { getEasterSunday } from '../../easter';
import type { CommemorationDefinition, SpecialDateItem } from '../../types';
import { generateNovenaDeAguinaldos } from './proceduralObservances';
import { resolveDefinition } from './resolver';

/**
 * Genera el conjunto completo de conmemoraciones y efemérides para el año dado.
 */
export function buildCommemorationsForYear(
  year: number,
  definitions: readonly CommemorationDefinition[]
): SpecialDateItem[] {
  const items: SpecialDateItem[] = [];
  const easter = getEasterSunday(year);

  // 1. Resolver todas las definiciones declarativas
  for (const def of definitions) {
    const resolved = resolveDefinition(def, year, easter);
    items.push(...resolved);
  }

  // 2. Novena de Aguinaldos en Colombia (16 al 24 de Diciembre)
  items.push(...generateNovenaDeAguinaldos(year));

  return items;
}
