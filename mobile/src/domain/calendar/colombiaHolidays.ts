/**
 * colombiaHolidays.ts
 *
 * Motor de los 19 festivos oficiales de la República de Colombia
 * (Ley 51 de 1983 - Ley Emiliani y Ley 2578 del 1 de junio de 2026).
 *
 * Características:
 * 1. Calcula exactamente los 19 festivos oficiales del año (100% determinista).
 * 2. Distingue la FECHA DE OBSERVANCIA (festivo no laborable que pinta la celda)
 *    de la FECHA CONMEMORADA (fecha original de la celebración).
 * 3. Provee una explicación concisa del motivo de la conmemoración (sin textos legales repetitivos)
 *    y asigna íconos específicos y representativos a cada festividad.
 * 4. Si la fecha ya cae en lunes (ej. 20 de julio, 12 de octubre o 29 de junio en 2026),
 *    no se traslada y se festeja en ese mismo lunes.
 */

import { getEasterSunday, addDaysToDate, moveToNextMondayIfApplicable } from './easter';
import { SpecialDateItem } from './types';

export interface HolidayEntry {
  /** Nombre oficial del festivo */
  readonly name: string;
  /** Identificador de la fecha en que se observa (el día festivo libre) */
  readonly observedDateId: string;
  /** Identificador de la fecha conmemorativa original */
  readonly originalDateId: string;
  /** true si el festivo fue trasladado al lunes siguiente */
  readonly isMoved: boolean;
  /** Sub-nombre o título para la conmemoración */
  readonly commemorationName: string;
  /** Breve explicación de por qué es especial o qué se conmemora ese día */
  readonly meaning: string;
  /** Ícono representativo (MaterialCommunityIcons) */
  readonly icon: string;
  /** Familia de ícono ('material' | 'ionicons') */
  readonly iconFamily?: 'material' | 'ionicons';
}

const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function formatSpanishDate(dateId: string): string {
  const [, m, d] = dateId.split('-').map(Number);
  const monthName = MONTH_NAMES_ES[m - 1];
  return `${d} de ${monthName}`;
}

/**
 * Obtiene los 19 festivos oficiales de Colombia para el año dado con sus fechas observadas.
 */
export function getColombiaHolidays(year: number): readonly HolidayEntry[] {
  const easter = getEasterSunday(year);

  // 1. Festivos Fijos (Inamovibles)
  const fixedHolidays: HolidayEntry[] = [
    {
      name: 'Año Nuevo',
      month: 1,
      day: 1,
      meaning: 'Celebración del inicio de un nuevo año y encuentro familiar.',
      icon: 'party-popper',
    },
    {
      name: 'Día del Trabajo',
      month: 5,
      day: 1,
      meaning: 'Homenaje internacional a las luchas y derechos de los trabajadores.',
      icon: 'hammer-wrench',
    },
    {
      name: 'Día de la Independencia',
      month: 7,
      day: 20,
      meaning: 'Conmemoración del Grito de Independencia de Colombia en 1810.',
      icon: 'flag-variant',
    },
    {
      name: 'Batalla de Boyacá',
      month: 8,
      day: 7,
      meaning: 'Conmemoración de la victoria militar de 1819 que consolidó la libertad de la nación.',
      icon: 'shield-crown',
    },
    {
      name: 'Inmaculada Concepción',
      month: 12,
      day: 8,
      meaning: 'Celebración mariana en honor a la concepción de la Virgen María.',
      icon: 'star-four-points',
    },
    {
      name: 'Navidad',
      month: 12,
      day: 25,
      meaning: 'Celebración cristiana del nacimiento de Jesús, armonía y encuentro familiar.',
      icon: 'pine-tree',
    },
  ].map(h => {
    const mStr = String(h.month).padStart(2, '0');
    const dStr = String(h.day).padStart(2, '0');
    const dateId = `${year}-${mStr}-${dStr}`;
    return {
      name: h.name,
      observedDateId: dateId,
      originalDateId: dateId,
      isMoved: false,
      commemorationName: h.name,
      meaning: h.meaning,
      icon: h.icon,
      iconFamily: 'material' as const,
    };
  });

  // 2. Festivos con traslado Ley Emiliani (al siguiente lunes si no es lunes)
  const emilianiHolidays: HolidayEntry[] = [
    {
      name: 'Reyes Magos (Epifanía)',
      month: 1,
      day: 6,
      commemorationName: 'Epifanía del Señor (Reyes Magos)',
      meaning: 'Homenaje a la adoración de los Reyes Magos al Niño Jesús.',
      icon: 'crown',
    },
    {
      name: 'San José',
      month: 3,
      day: 19,
      commemorationName: 'Día de San José',
      meaning: 'Conmemoración a San José, patrono de los trabajadores y protector de la familia.',
      icon: 'hammer',
    },
    {
      name: 'San Pedro y San Pablo',
      month: 6,
      day: 29,
      commemorationName: 'San Pedro y San Pablo',
      meaning: 'Homenaje a los apóstoles Simón Pedro y Pablo de Tarso, pilares del cristianismo.',
      icon: 'key-variant',
    },
    {
      name: 'Virgen de Chiquinquirá',
      month: 7,
      day: 9,
      commemorationName: 'Día de la Virgen de Chiquinquirá (Patrona de Colombia)',
      meaning: 'Homenaje a la patrona y reina de Colombia, fiesta de identidad espiritual y cultural nacional (Ley 2578 del 1 de junio de 2026).',
      icon: 'crown',
    },
    {
      name: 'Asunción de la Virgen',
      month: 8,
      day: 15,
      commemorationName: 'Asunción de la Virgen',
      meaning: 'Celebración cristiana de la asunción de la Virgen María en cuerpo y alma al cielo.',
      icon: 'white-balance-sunny',
    },
    {
      name: 'Día de la Raza',
      month: 10,
      day: 12,
      commemorationName: 'Día de la Raza (Diversidad Étnica y Cultural)',
      meaning: 'Conmemoración del encuentro de culturas y la diversidad étnica de nuestra nación.',
      icon: 'sail-boat',
    },
    {
      name: 'Todos los Santos',
      month: 11,
      day: 1,
      commemorationName: 'Día de Todos los Santos',
      meaning: 'Homenaje a todos los santos, bienaventurados y testigos de fe.',
      icon: 'hands-pray',
    },
    {
      name: 'Independencia de Cartagena',
      month: 11,
      day: 11,
      commemorationName: 'Independencia de Cartagena',
      meaning: 'Homenaje a la primera ciudad de Colombia en proclamar su independencia absoluta en 1811.',
      icon: 'castle',
    },
  ].map(h => {
    const origMStr = String(h.month).padStart(2, '0');
    const origDStr = String(h.day).padStart(2, '0');
    const originalDateId = `${year}-${origMStr}-${origDStr}`;

    const { observedDateId, isMoved } = moveToNextMondayIfApplicable(year, h.month, h.day);

    return {
      name: h.name,
      observedDateId,
      originalDateId,
      isMoved,
      commemorationName: h.commemorationName,
      meaning: h.meaning,
      icon: h.icon,
      iconFamily: 'material' as const,
    };
  });

  // 3. Festivos Pascuales
  const juevesSantoDateId = addDaysToDate(easter.year, easter.month, easter.day, -3);
  const viernesSantoDateId = addDaysToDate(easter.year, easter.month, easter.day, -2);
  const ascensionDateId = addDaysToDate(easter.year, easter.month, easter.day, 43);
  const corpusDateId = addDaysToDate(easter.year, easter.month, easter.day, 64);
  const sagradoCorazonDateId = addDaysToDate(easter.year, easter.month, easter.day, 71);

  const easterHolidays: HolidayEntry[] = [
    {
      name: 'Jueves Santo',
      observedDateId: juevesSantoDateId,
      originalDateId: juevesSantoDateId,
      isMoved: false,
      commemorationName: 'Jueves Santo',
      meaning: 'Conmemoración de la Última Cena, la institución de la Eucaristía y el Lavatorio de pies.',
      icon: 'cup',
      iconFamily: 'material' as const,
    },
    {
      name: 'Viernes Santo',
      observedDateId: viernesSantoDateId,
      originalDateId: viernesSantoDateId,
      isMoved: false,
      commemorationName: 'Viernes Santo',
      meaning: 'Conmemoración solemne de la Pasión, Viacrucis y Muerte de Jesús en la Cruz.',
      icon: 'cross',
      iconFamily: 'material' as const,
    },
    {
      name: 'Ascensión del Señor',
      observedDateId: ascensionDateId,
      originalDateId: addDaysToDate(easter.year, easter.month, easter.day, 39),
      isMoved: true,
      commemorationName: 'Ascensión del Señor',
      meaning: 'Celebración de la ascensión de Jesucristo al cielo ante sus apóstoles.',
      icon: 'weather-sunset-up',
      iconFamily: 'material' as const,
    },
    {
      name: 'Corpus Christi',
      observedDateId: corpusDateId,
      originalDateId: addDaysToDate(easter.year, easter.month, easter.day, 60),
      isMoved: true,
      commemorationName: 'Corpus Christi',
      meaning: 'Solemne celebración de la presencia viva de Cristo en la Sagrada Eucaristía.',
      icon: 'church',
      iconFamily: 'material' as const,
    },
    {
      name: 'Sagrado Corazón de Jesús',
      observedDateId: sagradoCorazonDateId,
      originalDateId: addDaysToDate(easter.year, easter.month, easter.day, 68),
      isMoved: true,
      commemorationName: 'Sagrado Corazón de Jesús',
      meaning: 'Veneración al amor misericordioso e infinito del Corazón de Jesús.',
      icon: 'heart-flash',
      iconFamily: 'material' as const,
    },
  ];

  const all = [...fixedHolidays, ...emilianiHolidays, ...easterHolidays];

  // Ordenar cronológicamente por fecha observada
  return all.sort((a, b) => a.observedDateId.localeCompare(b.observedDateId));
}

/**
 * Genera los elementos SpecialDateItem para el calendario, tanto para el día de observancia
 * como para el día conmemorativo si fue trasladado.
 */
export function generateHolidaySpecialItems(year: number): SpecialDateItem[] {
  const holidays = getColombiaHolidays(year);
  const items: SpecialDateItem[] = [];

  for (const h of holidays) {
    const iconFamily = h.iconFamily ?? 'material';
    if (h.isMoved) {
      // 1. En la fecha original conmemorativa (día ordinario de celebración):
      items.push({
        id: `commemoration-${h.originalDateId}-${h.name}`,
        name: h.commemorationName,
        category: 'festivo',
        basis: 'ley',
        isHoliday: false,
        isObservanceMoved: true,
        observedDateId: h.observedDateId,
        originalDateId: h.originalDateId,
        note: `Celebración tradicional. El festivo oficial se traslada al lunes ${formatSpanishDate(h.observedDateId)}.`,
        icon: h.icon,
        iconFamily,
      });

      // 2. En la fecha observada (el día festivo libre):
      items.push({
        id: `holiday-${h.observedDateId}-${h.name}`,
        name: h.name,
        category: 'festivo',
        basis: 'ley',
        isHoliday: true,
        isObservanceMoved: false,
        observedDateId: h.observedDateId,
        originalDateId: h.originalDateId,
        note: h.meaning,
        icon: h.icon,
        iconFamily,
      });
    } else {
      // Coincide el festivo con la fecha conmemorativa (inamovibles o que ya caen en lunes):
      items.push({
        id: `holiday-${h.observedDateId}-${h.name}`,
        name: h.name,
        category: 'festivo',
        basis: 'ley',
        isHoliday: true,
        isObservanceMoved: false,
        observedDateId: h.observedDateId,
        originalDateId: h.originalDateId,
        note: h.meaning,
        icon: h.icon,
        iconFamily,
      });
    }
  }

  return items;
}
