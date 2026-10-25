/**
 * presentationPriority.ts
 *
 * Política de presentación del calendario: decide qué efeméride encabeza el día.
 * Es una función pura sobre los ítems ya resueltos para una fecha; no conoce
 * SQLite, notificaciones, React ni el catálogo completo.
 *
 * Jerarquía (de mayor a menor prioridad):
 *   0. Festivo oficial colombiano. Encabeza siempre el día, sin excepciones.
 *      Incluye el ancla litúrgica de un festivo trasladado por la Ley Emiliani
 *      (`category: 'festivo'` con `isHoliday: false`, ej. San José el 19 de marzo
 *      cuando el día libre se corre al lunes): pertenece a la familia del festivo,
 *      no a la observancia suelta.
 *   1. Liturgia móvil (regla `easter-offset`: Miércoles de Ceniza, Semana Santa,
 *      Pentecostés). Son las únicas conmemoraciones religiosas que lideran el día
 *      en la referencia histórica del producto.
 *   2. Efeméride nacional colombiana (`category: 'nacional'`). El calendario es
 *      colombiano: una fecha propia precede a la internacional cuando coinciden.
 *   3. Observancia de un solo día.
 *   4. Campaña que abarca varios días (`dateRange`, ej. semanas internacionales).
 *
 * Desempate: cuando dos ítems comparten nivel, se resuelven los empates heredados
 * declarados abajo; el resto conserva el orden de declaración del catálogo
 * compuesto (ver commemorations/index.ts), que es explícito y estable — la lista
 * se ordena con un sort estable, así que "orden de declaración" nunca depende del
 * orden de imports ni del orden de llegada de los datos.
 *
 * Los empates heredados son DECISIONES DE PRODUCTO revisables, no coincidencias
 * accidentales: cada entrada declara el criterio que la sostiene. Si el criterio
 * deja de aplicar, se elimina la entrada y la prueba de
 * `presentationPriority.test.ts` que la cubre debe actualizarse junto con ella.
 *
 * Cambios deliberados respecto de la referencia previa (refactor del catálogo):
 *   29-abr  Día Internacional de la Danza            -> Día Nacional del Árbol
 *   15-may  Día Internacional de las Familias        -> Día del Maestro en Colombia
 *   08-jun  Día Mundial de los Océanos               -> Día del Estudiante en Colombia
 * Son consecuencia directa del nivel 2 (una efeméride nacional colombiana
 * encabeza sobre una internacional), no del reordenamiento de archivos.
 */

import type { SpecialDateItem } from '../../types';

/** Niveles de la jerarquía de presentación, de mayor a menor prioridad. */
export const PRESENTATION_PRIORITY = {
  /** Festivo oficial colombiano: prioridad absoluta. */
  officialHoliday: 0,
  /** Liturgia móvil reconocida en el catálogo (`easter-offset`). */
  movableLiturgy: 1,
  /** Efeméride nacional colombiana. */
  colombianCommemoration: 2,
  /** Observancia de un solo día. */
  singleDayObservance: 3,
  /** Campaña multidiía. */
  multiDayCampaign: 4,
} as const;

/**
 * Empates del mismo nivel cuyo titular se conserva por decisión de producto.
 * Cualquier otro empate sigue el orden de declaración del catálogo.
 *
 * `secondary` se declara antes que `primary` en el catálogo compuesto; sin esta
 * entrada, el desempate por orden declarado entregaría el titular al secundario.
 * Eso es lo que las pruebas de `presentationPriority.test.ts` verifican: si el
 * catálogo se reordena y una entrada deja de ser determinante, la prueba falla y
 * obliga a revisar (y retirar) la excepción.
 */
export interface LegacyTieBreak {
  /** Slug (id sin el prefijo `commem-YYYY-MM-DD-`) que encabeza el día. */
  readonly primary: string;
  /** Slug que cede el titular. */
  readonly secondary: string;
  /** Criterio de producto que sostiene la excepción. */
  readonly reason: string;
}

/** Excepciones de desempate revisables (ver `LegacyTieBreak`). */
export const LEGACY_TIE_BREAKS: readonly LegacyTieBreak[] = [
  {
    primary: 'autismo',
    secondary: 'libro-infantil',
    reason: 'Respaldo de la Asamblea General (A/RES/62/139) sobre una celebración sectorial del IBBY.',
  },
  {
    primary: 'prevencion-ahogamientos-onu',
    secondary: 'mujeres-afrodescendientes',
    reason: 'Observancia mundial ONU/OMS sobre un encuentro regional.',
  },
  {
    primary: 'quimico-farmaceutico-colombia',
    secondary: 'desarme-nuclear',
    reason: 'Fecha propia del gremio profesional colombiano sobre la efeméride internacional del mismo ámbito.',
  },
  {
    primary: 'rabia-oms',
    secondary: 'acceso-informacion',
    reason: 'Observancia mundial de salud (OMS/GARC) sobre la efeméride UNESCO.',
  },
];

/** Extrae el slug estable de un ítem (`commem-YYYY-MM-DD-<slug>` -> `<slug>`). */
export function itemSlug(item: Pick<SpecialDateItem, 'id'>): string {
  return item.id.replace(/^commem-\d{4}-\d{2}-\d{2}-/, '');
}

const LEGACY_PRIMARY_BY_PAIR = new Map<string, string>();
for (const entry of LEGACY_TIE_BREAKS) {
  LEGACY_PRIMARY_BY_PAIR.set(`${entry.primary}|${entry.secondary}`, entry.primary);
  LEGACY_PRIMARY_BY_PAIR.set(`${entry.secondary}|${entry.primary}`, entry.primary);
}

/** true si el ítem es una liturgia móvil (su fecha se mueve con Pascua). */
export function isMovableLiturgy(item: SpecialDateItem): boolean {
  return item.dateRule?.type === 'easter-offset';
}

/**
 * Nivel de prioridad de presentación de un ítem.
 * Menor número = encabeza antes.
 */
export function getPresentationPriority(item: SpecialDateItem): number {
  if (item.isHoliday || item.category === 'festivo') return PRESENTATION_PRIORITY.officialHoliday;
  if (isMovableLiturgy(item)) return PRESENTATION_PRIORITY.movableLiturgy;
  if (item.category === 'nacional') return PRESENTATION_PRIORITY.colombianCommemoration;
  if (item.dateRange) return PRESENTATION_PRIORITY.multiDayCampaign;
  return PRESENTATION_PRIORITY.singleDayObservance;
}

/**
 * Comparador de presentación para los ítems de un mismo día.
 * Devuelve 0 cuando el empate no está fijado: el llamador conserva el orden
 * declarado (sort estable).
 */
export function compareDayItems(a: SpecialDateItem, b: SpecialDateItem): number {
  const delta = getPresentationPriority(a) - getPresentationPriority(b);
  if (delta !== 0) return delta;

  const legacyPrimary = LEGACY_PRIMARY_BY_PAIR.get(`${itemSlug(a)}|${itemSlug(b)}`);
  if (!legacyPrimary) return 0;

  return itemSlug(a) === legacyPrimary ? -1 : 1;
}

/** true si `candidate` debe encabezar el día por encima de `current`. */
function outranks(candidate: SpecialDateItem, current: SpecialDateItem): boolean {
  const delta = getPresentationPriority(candidate) - getPresentationPriority(current);
  if (delta !== 0) return delta < 0;

  const legacyPrimary = LEGACY_PRIMARY_BY_PAIR.get(`${itemSlug(candidate)}|${itemSlug(current)}`);
  return legacyPrimary === itemSlug(candidate);
}

/**
 * Efeméride que encabeza el día entre las conmemoraciones (ignora festivos).
 * Única fuente de verdad para el titular de la tarjeta y para el cuerpo de la
 * notificación diaria de conmemoraciones.
 */
export function selectPrimaryCommemoration(
  items: readonly SpecialDateItem[]
): SpecialDateItem | null {
  let primary: SpecialDateItem | null = null;

  for (const item of items) {
    if (item.isHoliday) continue;
    if (!primary || outranks(item, primary)) primary = item;
  }

  return primary;
}

/**
 * Titular del día completo: el festivo oficial si existe (prioridad absoluta),
 * y en su defecto la conmemoración que gane la jerarquía.
 */
export function selectDayHeadline(items: readonly SpecialDateItem[]): SpecialDateItem | null {
  const holiday = items.find((item) => item.isHoliday);
  return holiday ?? selectPrimaryCommemoration(items);
}
