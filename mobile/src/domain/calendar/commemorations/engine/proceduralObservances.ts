/**
 * proceduralObservances.ts
 *
 * Observancias que no se pueden expresar como una sola regla declarativa del
 * catálogo porque se repiten día a día con identidad propia. Aquí vive la
 * Novena de Aguinaldos: nueve ocurrencias consecutivas (16–24 de diciembre),
 * cada una con ID estable y la misma procedencia declarada una sola vez.
 */

import type { SpecialDateItem } from '../../types';

/** Primer día de la Novena de Aguinaldos (16 de diciembre). */
export const NOVENA_FIRST_DAY = 16;

/** Último día de la Novena de Aguinaldos (24 de diciembre). */
export const NOVENA_LAST_DAY = 24;

/** Identidad y procedencia compartidas por las nueve ocurrencias. */
export const NOVENA_DE_AGUINALDOS = {
  slug: 'novena-dia',
  namePrefix: 'Novena de Aguinaldos — Día',
  category: 'religiosa',
  basis: 'tradicion',
  authority: 'Tradición cultural y familiar colombiana',
  status: 'verified',
  note: 'Tradición navideña de villancicos, oración y encuentro familiar en Colombia.',
  icon: 'bell-ring-outline',
  iconFamily: 'material',
} as const;

/**
 * Genera las nueve ocurrencias de la Novena de Aguinaldos para el año dado.
 * IDs: `commem-<YYYY-MM-DD>-novena-dia-<1..9>`.
 */
export function generateNovenaDeAguinaldos(year: number): SpecialDateItem[] {
  const items: SpecialDateItem[] = [];

  for (let day = NOVENA_FIRST_DAY; day <= NOVENA_LAST_DAY; day++) {
    const dId = `${year}-12-${String(day).padStart(2, '0')}`;
    const novenaDay = day - (NOVENA_FIRST_DAY - 1);
    items.push({
      id: `commem-${dId}-${NOVENA_DE_AGUINALDOS.slug}-${novenaDay}`,
      name: `${NOVENA_DE_AGUINALDOS.namePrefix} ${novenaDay}`,
      category: NOVENA_DE_AGUINALDOS.category,
      basis: NOVENA_DE_AGUINALDOS.basis,
      isHoliday: false,
      authority: NOVENA_DE_AGUINALDOS.authority,
      status: NOVENA_DE_AGUINALDOS.status,
      note: NOVENA_DE_AGUINALDOS.note,
      icon: NOVENA_DE_AGUINALDOS.icon,
      iconFamily: NOVENA_DE_AGUINALDOS.iconFamily,
    });
  }

  return items;
}
