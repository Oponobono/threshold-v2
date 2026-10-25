/**
 * religious.ts
 *
 * Catálogo de observancias religiosas: ciclo litúrgico católico (fechas móviles por
 * Pascua y fechas fijas) y devociones/tradiciones de fe arraigadas en Colombia y
 * América Latina.
 *
 * Criterio de pertenencia: categoría 'religiosa'.
 *
 * Solo datos declarativos: no contiene lógica de cálculo ni conoce el motor de fechas.
 */

import type { CommemorationDefinition } from '../../types';

export const religiousDefinitions: readonly CommemorationDefinition[] = [
  {
    id: 'ceniza',
    name: 'Miércoles de Ceniza',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'easter-offset', days: -46 },
    note: 'Inicio del tiempo litúrgico de Cuaresma y llamado a la reflexión espiritual.',
    icon: 'fire',
  },

  {
    id: 'domingo-ramos',
    name: 'Domingo de Ramos',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'easter-offset', days: -7 },
    note: 'Entrada triunfal de Jesús en Jerusalén y bendición solemne de los ramos.',
    icon: 'palm-tree',
    subItems: [
      { title: 'Conmemoración de la entrada triunfal en Jerusalén' },
      { title: 'Bendición solemne de las palmas y ramos' },
    ],
  },

  {
    id: 'lunes-santo',
    name: 'Lunes Santo',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'easter-offset', days: -6 },
    note: 'Semana Santa: Unción en Betania y expulsión de los mercaderes del Templo.',
    icon: 'water',
  },

  {
    id: 'martes-santo',
    name: 'Martes Santo',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'easter-offset', days: -5 },
    note: 'Semana Santa: Anuncio de la traición de Judas y negaciones de Pedro.',
    icon: 'script-text-outline',
  },

  {
    id: 'miercoles-santo',
    name: 'Miércoles Santo',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'easter-offset', days: -4 },
    note: 'Semana Santa: Conspiración y entrega de Jesús ante el Sanedrín.',
    icon: 'hand-coin',
  },

  {
    id: 'jueves-santo-liturgia',
    name: 'Jueves Santo',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'easter-offset', days: -3 },
    note: 'Institución de la Eucaristía, el Lavatorio de pies y la Oración en Getsemaní.',
    icon: 'cup',
    subItems: [
      { title: 'Misa de la Cena del Señor (Institución de la Eucaristía y Sacerdocio)' },
      { title: 'Lavatorio de los pies (mandamiento del amor fraterno)' },
      { title: 'Oración solemne en el Huerto de Getsemaní' },
    ],
  },

  {
    id: 'viernes-santo-liturgia',
    name: 'Viernes Santo',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'easter-offset', days: -2 },
    note: 'Conmemoración solemne de la Pasión, Viacrucis y Muerte de Jesús en la Cruz.',
    icon: 'cross',
    subItems: [
      { title: 'Santo Viacrucis solemne' },
      { title: 'Liturgia de la Pasión y Adoración de la Santa Cruz' },
      { title: 'Sermón de las Siete Palabras y Procesión del Santo Sepulcro' },
    ],
  },

  {
    id: 'sabado-santo',
    name: 'Sábado Santo (Vigilia Pascual)',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'easter-offset', days: -1 },
    note: 'Día de silencio litúrgico y Solemne Vigilia Pascual en la noche.',
    icon: 'candle',
    subItems: [
      { title: 'Silencio y recogimiento ante el sepulcro del Señor' },
      { title: 'Bendición del Fuego y Solemne Vigilia Pascual en la noche' },
    ],
  },

  {
    id: 'domingo-resurreccion',
    name: 'Domingo de Pascua de Resurrección',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'easter-offset', days: 0 },
    note: 'Fiesta central de la Pascua cristiana: triunfo de la vida sobre la muerte.',
    icon: 'white-balance-sunny',
  },

  {
    id: 'pentecostes',
    name: 'Pentecostés',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'easter-offset', days: 49 },
    note: 'Conmemoración de la venida del Espíritu Santo y cierre del tiempo pascual.',
    icon: 'fire',
  },

  // ── ENERO ──

  {
    id: 'epifania-liturgica',
    name: 'Epifanía del Señor (Día Litúrgico)',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'fixed', month: 1, day: 6 },
    note: 'Conmemoración de la manifestación de Jesús a los sabios de Oriente.',
    icon: 'crown',
  },

  // ── FEBRERO ──

  {
    id: 'candelaria',
    name: 'Virgen de la Candelaria',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Tradición Litúrgica Católica en Colombia',
    status: 'verified',
    dateRule: { type: 'fixed', month: 2, day: 2 },
    note: 'Fiesta de la Presentación del Señor y luz de la fe mariana en Colombia.',
    icon: 'candle',
  },

  // ── OCTUBRE ──

  {
    id: 'virgen-rosario',
    name: 'Día de Nuestra Señora del Rosario',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'fixed', month: 10, day: 7 },
    note: 'Tradición de oración mariana y recogimiento espiritual.',
    icon: 'hands-pray',
  },

  {
    id: 'virgen-pilar',
    name: 'Día de la Virgen del Pilar',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Tradición Litúrgica Católica Hispana',
    status: 'verified',
    dateRule: { type: 'fixed', month: 10, day: 12 },
    note: 'Veneración mariana universal en el mundo hispano y símbolo de fraternidad y devoción.',
    icon: 'star-four-points',
  },

  // ── NOVIEMBRE ──

  {
    id: 'fieles-difuntos',
    name: 'Conmemoración de los Fieles Difuntos',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico',
    status: 'verified',
    dateRule: { type: 'fixed', month: 11, day: 2 },
    note: 'Día solemne de recuerdo, oración y homenaje a los seres queridos que ya partieron.',
    icon: 'candle',
  },

  // ── DICIEMBRE ──

  {
    id: 'velitas',
    name: 'Noche de las Velitas',
    category: 'religiosa',
    basis: 'tradicion',
    authority: 'Tradición cultural y familiar colombiana',
    status: 'verified',
    dateRule: { type: 'fixed', month: 12, day: 7 },
    note: 'Tradición nacional de iluminar calles y hogares en víspera de la Inmaculada Concepción.',
    icon: 'candle',
  },

  {
    id: 'virgen-guadalupe',
    name: 'Día de la Virgen de Guadalupe',
    category: 'religiosa',
    basis: 'religiosa',
    authority: 'Calendario Litúrgico Católico en América Latina',
    status: 'verified',
    dateRule: { type: 'fixed', month: 12, day: 12 },
    note: 'Celebración mariana de profunda devoción en América Latina y símbolo de esperanza.',
    icon: 'star-crescent',
  },

  {
    id: 'nochebuena',
    name: 'Nochebuena',
    category: 'religiosa',
    basis: 'tradicion',
    authority: 'Tradición espiritual y familiar universal',
    status: 'verified',
    dateRule: { type: 'fixed', month: 12, day: 24 },
    note: 'Víspera de Navidad y tiempo de paz, perdón y cálida reunión en familia.',
    icon: 'home-heart',
  },
];
