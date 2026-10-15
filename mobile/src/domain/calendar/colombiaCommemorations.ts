/**
 * colombiaCommemorations.ts
 *
 * Catálogo completo de efemérides, menciones honoríficas y conmemoraciones
 * reconocidas en Colombia (religiosas, cívicas, educativas, profesionales e internacionales).
 *
 * Cada fecha incluye una explicación concisa y humana de su motivo (sin textos legales),
 * su categoría, base y su ícono representativo específico.
 */

import { getEasterSunday, addDaysToDate } from './easter';
import { SpecialDateItem } from './types';

/**
 * Retorna si un año es bisiesto.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Encuentra el n-ésimo día de la semana en un mes dado (UTC puro).
 * @param targetWeekday 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
 * @param n 1 = primer, 2 = segundo, 3 = tercer, etc.
 */
export function getNthWeekdayOfMonth(
  year: number,
  month: number, // 1-12
  targetWeekday: number,
  n: number
): string {
  let count = 0;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday === targetWeekday) {
      count++;
      if (count === n) {
        const mStr = String(month).padStart(2, '0');
        const dStr = String(day).padStart(2, '0');
        return `${year}-${mStr}-${dStr}`;
      }
    }
  }

  throw new Error(`No se encontró el ${n}-ésimo día ${targetWeekday} en ${year}-${month}`);
}

/**
 * Encuentra el último día de la semana en un mes dado (UTC puro).
 */
export function getLastWeekdayOfMonth(
  year: number,
  month: number, // 1-12
  targetWeekday: number
): string {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let day = daysInMonth; day >= 1; day--) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday === targetWeekday) {
      const mStr = String(month).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      return `${year}-${mStr}-${dStr}`;
    }
  }

  throw new Error(`No se encontró el último día ${targetWeekday} en ${year}-${month}`);
}

/**
 * Genera el catálogo completo de conmemoraciones para un año determinado.
 */
export function generateCommemorations(year: number): SpecialDateItem[] {
  const items: SpecialDateItem[] = [];
  const easter = getEasterSunday(year);

  const makeId = (dateId: string, slug: string) => `commem-${dateId}-${slug}`;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CICLO PASCUAL Y SEMANA SANTA (Religiosas)
  // ─────────────────────────────────────────────────────────────────────────────
  // Miércoles de Ceniza: Pascua - 46 días
  const cenizaDateId = addDaysToDate(easter.year, easter.month, easter.day, -46);
  items.push({
    id: makeId(cenizaDateId, 'ceniza'),
    name: 'Miércoles de Ceniza',
    category: 'religiosa',
    basis: 'religiosa',
    isHoliday: false,
    note: 'Inicio del tiempo litúrgico de Cuaresma y llamado a la reflexión espiritual.',
    icon: 'fire',
    iconFamily: 'material',
  });

  // Domingo de Ramos: Pascua - 7 días
  const ramosDateId = addDaysToDate(easter.year, easter.month, easter.day, -7);
  items.push({
    id: makeId(ramosDateId, 'domingo-ramos'),
    name: 'Domingo de Ramos',
    category: 'religiosa',
    basis: 'religiosa',
    isHoliday: false,
    note: 'Entrada triunfal de Jesús en Jerusalén y bendición de los ramos.',
    icon: 'palm-tree',
    iconFamily: 'material',
    subItems: [
      { title: 'Conmemoración de la entrada triunfal en Jerusalén' },
      { title: 'Bendición solemne de las palmas y ramos' },
    ],
  });

  // Lunes Santo: Pascua - 6 días
  const lunesSantoDateId = addDaysToDate(easter.year, easter.month, easter.day, -6);
  items.push({
    id: makeId(lunesSantoDateId, 'lunes-santo'),
    name: 'Lunes Santo',
    category: 'religiosa',
    basis: 'religiosa',
    isHoliday: false,
    note: 'Semana Santa: Unción en Betania y expulsión de los mercaderes del Templo.',
    icon: 'water',
    iconFamily: 'material',
  });

  // Martes Santo: Pascua - 5 días
  const martesSantoDateId = addDaysToDate(easter.year, easter.month, easter.day, -5);
  items.push({
    id: makeId(martesSantoDateId, 'martes-santo'),
    name: 'Martes Santo',
    category: 'religiosa',
    basis: 'religiosa',
    isHoliday: false,
    note: 'Semana Santa: Anuncio de la traición de Judas y negaciones de Pedro.',
    icon: 'script-text-outline',
    iconFamily: 'material',
  });

  // Miércoles Santo: Pascua - 4 días
  const miercolesSantoDateId = addDaysToDate(easter.year, easter.month, easter.day, -4);
  items.push({
    id: makeId(miercolesSantoDateId, 'miercoles-santo'),
    name: 'Miércoles Santo',
    category: 'religiosa',
    basis: 'religiosa',
    isHoliday: false,
    note: 'Semana Santa: Conspiración y entrega de Jesús ante el Sanedrín.',
    icon: 'hand-coin',
    iconFamily: 'material',
  });

  // Jueves Santo: Pascua - 3 días (Liturgia enriquecida)
  const juevesSantoDateId = addDaysToDate(easter.year, easter.month, easter.day, -3);
  items.push({
    id: makeId(juevesSantoDateId, 'jueves-santo-liturgia'),
    name: 'Jueves Santo',
    category: 'religiosa',
    basis: 'religiosa',
    isHoliday: true,
    note: 'Institución de la Eucaristía, el Lavatorio de pies y la Oración en Getsemaní.',
    icon: 'cup',
    iconFamily: 'material',
    subItems: [
      { title: 'Misa de la Cena del Señor (Institución de la Eucaristía y Sacerdocio)' },
      { title: 'Lavatorio de los pies (mandamiento del amor fraterno)' },
      { title: 'Oración solemne en el Huerto de Getsemaní' },
    ],
  });

  // Viernes Santo: Pascua - 2 días (Liturgia enriquecida)
  const viernesSantoDateId = addDaysToDate(easter.year, easter.month, easter.day, -2);
  items.push({
    id: makeId(viernesSantoDateId, 'viernes-santo-liturgia'),
    name: 'Viernes Santo',
    category: 'religiosa',
    basis: 'religiosa',
    isHoliday: true,
    note: 'Conmemoración solemne de la Pasión, Viacrucis y Muerte de Jesús en la Cruz.',
    icon: 'cross',
    iconFamily: 'material',
    subItems: [
      { title: 'Santo Viacrucis solemne' },
      { title: 'Liturgia de la Pasión y Adoración de la Santa Cruz' },
      { title: 'Sermón de las Siete Palabras y Procesión del Santo Sepulcro' },
    ],
  });

  // Sábado Santo: Pascua - 1 día
  const sabadoSantoDateId = addDaysToDate(easter.year, easter.month, easter.day, -1);
  items.push({
    id: makeId(sabadoSantoDateId, 'sabado-santo'),
    name: 'Sábado Santo (Vigilia Pascual)',
    category: 'religiosa',
    basis: 'religiosa',
    isHoliday: false,
    note: 'Día de silencio litúrgico y Solemne Vigilia Pascual en la noche.',
    icon: 'candle',
    iconFamily: 'material',
    subItems: [
      { title: 'Silencio y recogimiento ante el sepulcro del Señor' },
      { title: 'Bendición del Fuego y Solemne Vigilia Pascual en la noche' },
    ],
  });

  // Domingo de Resurrección: Pascua
  items.push({
    id: makeId(easter.dateId, 'domingo-resurreccion'),
    name: 'Domingo de Pascua de Resurrección',
    category: 'religiosa',
    basis: 'religiosa',
    isHoliday: false,
    note: 'Fiesta central de la Pascua cristiana: triunfo de la vida sobre la muerte.',
    icon: 'white-balance-sunny',
    iconFamily: 'material',
  });

  // Pentecostés: Pascua + 49 días (Domingo)
  const pentecostesDateId = addDaysToDate(easter.year, easter.month, easter.day, 49);
  items.push({
    id: makeId(pentecostesDateId, 'pentecostes'),
    name: 'Pentecostés',
    category: 'religiosa',
    basis: 'religiosa',
    isHoliday: false,
    note: 'Conmemoración de la venida del Espíritu Santo y cierre del tiempo pascual.',
    icon: 'fire',
    iconFamily: 'material',
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. OTRAS FECHAS RELIGIOSAS (Católicas, con fuerte arraigo en Colombia)
  // ─────────────────────────────────────────────────────────────────────────────
  const relDates = [
    { m: 1, d: 6, slug: 'epifania', name: 'Epifanía del Señor (Día Litúrgico)', note: 'Conmemoración de la manifestación de Jesús a los Reyes Magos.', icon: 'crown' },
    { m: 2, d: 2, slug: 'candelaria', name: 'Virgen de la Candelaria', note: 'Celebración de la Presentación de Jesús en el Templo y purificación mariana.', icon: 'candle' },
    { m: 7, d: 9, slug: 'chiquinquira', name: 'Virgen de Chiquinquirá', note: 'Homenaje a la patrona espiritual de la República de Colombia.', icon: 'heart' },
    { m: 7, d: 16, slug: 'carmen', name: 'Virgen del Carmen', note: 'Tradición y patrona de los conductores, transportadores y navegantes en Colombia.', icon: 'steering' },
    { m: 11, d: 2, slug: 'fieles-difuntos', name: 'Conmemoración de los Fieles Difuntos', note: 'Día de recuerdo, oración y homenaje a los seres queridos fallecidos.', icon: 'flower-tulip' },
    { m: 12, d: 7, slug: 'velitas', name: 'Noche de las Velitas', note: 'Tradición nacional de iluminar calles y hogares en víspera de la Inmaculada Concepción.', icon: 'candle' },
    { m: 12, d: 24, slug: 'nochebuena', name: 'Nochebuena', note: 'Víspera de Navidad y tiempo de reunión familiar.', icon: 'home-heart' },
    { m: 12, d: 31, slug: 'ano-viejo', name: 'Fin de Año / Año Viejo', note: 'Despedida del año y tradiciones de gratitud y esperanza en Colombia.', icon: 'clock-outline' },
  ];

  for (const r of relDates) {
    const dId = `${year}-${String(r.m).padStart(2, '0')}-${String(r.d).padStart(2, '0')}`;
    items.push({
      id: makeId(dId, r.slug),
      name: r.name,
      category: 'religiosa',
      basis: r.m === 12 && (r.d === 7 || r.d === 24 || r.d === 31) ? 'tradicion' : 'religiosa',
      isHoliday: false,
      note: r.note,
      icon: r.icon,
      iconFamily: 'material',
    });
  }

  // Novena de Aguinaldos (16 al 24 de Diciembre) - Tradición comunitaria colombiana
  for (let day = 16; day <= 24; day++) {
    const dId = `${year}-12-${String(day).padStart(2, '0')}`;
    const novenaDay = day - 15;
    items.push({
      id: makeId(dId, `novena-dia-${novenaDay}`),
      name: `Novena de Aguinaldos — Día ${novenaDay}`,
      category: 'religiosa',
      basis: 'tradicion',
      isHoliday: false,
      note: 'Tradición navideña de villancicos, oración y encuentro familiar en Colombia.',
      icon: 'music-clef-treble',
      iconFamily: 'material',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. NACIONALES, CÍVICAS, CULTURALES Y FAMILIARES DE COLOMBIA
  // ─────────────────────────────────────────────────────────────────────────────
  const fixNac = [
    {
      m: 2, d: 9, slug: 'periodista', name: 'Día del Periodista en Colombia', basis: 'tradicion' as const,
      note: 'Reconocimiento a la libertad de prensa y la labor informativa en el país.',
      icon: 'typewriter',
    },
    {
      m: 2, d: 14, slug: 'san-valentin', name: 'San Valentín (Fecha secundaria)', basis: 'tradicion' as const,
      note: 'Celebración del afecto y la amistad (la fiesta central en Colombia es en septiembre).',
      icon: 'heart-outline',
    },
    {
      m: 3, d: 8, slug: 'mujer', name: 'Día Internacional de la Mujer', basis: 'onu' as const,
      note: 'Conmemoración de la lucha histórica por los derechos y la igualdad de las mujeres.',
      icon: 'flower-tulip',
    },
    {
      m: 3, d: 19, slug: 'hombre-colombia', name: 'Día del Hombre en Colombia', basis: 'tradicion' as const,
      note: 'Homenaje tradicional a los hombres colombianos en el marco de la festividad de San José.',
      icon: 'gender-male',
    },
    {
      m: 4, d: 9, slug: 'victimas', name: 'Día Nacional de la Memoria y Solidaridad con las Víctimas', basis: 'ley' as const,
      note: 'Homenaje a la memoria, dignidad y solidaridad con las víctimas del conflicto en Colombia.',
      icon: 'hand-heart',
    },
    {
      m: 4, d: 23, slug: 'idioma-libro', name: 'Día del Idioma y Día del Libro', basis: 'onu' as const,
      note: 'Homenaje a la lengua española, la literatura universal y el fomento de la lectura.',
      icon: 'book-open-page-variant',
    },
    {
      m: 4, d: 29, slug: 'arbol-nacional', name: 'Día Nacional del Árbol', basis: 'ley' as const,
      note: 'Homenaje a la riqueza forestal y la siembra del Árbol de la Libertad en Colombia.',
      icon: 'tree',
    },
    {
      m: 5, d: 15, slug: 'maestro-familia', name: 'Día del Maestro y de la Familia', basis: 'tradicion' as const,
      note: 'Homenaje y gratitud a la vocación de los educadores y al valor fundamental de la familia.',
      icon: 'human-male-board',
    },
    {
      m: 5, d: 21, slug: 'afrocolombianidad', name: 'Día Nacional de la Afrocolombianidad', basis: 'ley' as const,
      note: 'Celebración de la abolición de la esclavitud y el valioso legado de las comunidades afrocolombianas.',
      icon: 'guitar-acoustic',
    },
    {
      m: 6, d: 8, slug: 'estudiante-1', name: 'Día del Estudiante (Estudiante Caído)', basis: 'tradicion' as const,
      note: 'Homenaje a la juventud, al pensamiento crítico y a las luchas del movimiento estudiantil.',
      icon: 'school',
    },
    {
      m: 6, d: 9, slug: 'estudiante-2', name: 'Día del Estudiante (Segunda Jornada)', basis: 'tradicion' as const,
      note: 'Homenaje continuo a la juventud y a la comunidad universitaria de Colombia.',
      icon: 'book-open-variant',
    },
    {
      m: 10, d: 31, slug: 'halloween', name: 'Día de los Niños / Halloween', basis: 'tradicion' as const,
      note: 'Jornada festiva y recreativa de disfraces, juegos y dulces para los niños.',
      icon: 'pumpkin',
    },
    {
      m: 11, d: 19, slug: 'hombre-internacional', name: 'Día Internacional del Hombre', basis: 'onu' as const,
      note: 'Promoción de la salud masculina, el cuidado emocional y los modelos positivos.',
      icon: 'gender-male',
    },
    {
      m: 12, d: 28, slug: 'inocentes', name: 'Día de los Santos Inocentes', basis: 'tradicion' as const,
      note: 'Tradición de humor, bromas sanas y recuerdos compartidos con alegría.',
      icon: 'emoticon-happy',
    },
  ];

  for (const n of fixNac) {
    const dId = `${year}-${String(n.m).padStart(2, '0')}-${String(n.d).padStart(2, '0')}`;
    items.push({
      id: makeId(dId, n.slug),
      name: n.name,
      category: 'nacional',
      basis: n.basis,
      isHoliday: false,
      note: n.note,
      icon: n.icon,
      iconFamily: 'material',
    });
  }

  // Fechas móviles con reglas de semana de Colombia:
  // Día de la Niñez: Último sábado de abril
  const ninaDateId = getLastWeekdayOfMonth(year, 4, 6); // 6 = Sábado
  items.push({
    id: makeId(ninaDateId, 'dia-ninez'),
    name: 'Día de la Niñez y la Recreación',
    category: 'nacional',
    basis: 'ley',
    isHoliday: false,
    note: 'Jornada nacional de promoción del juego, el bienestar y los derechos de la infancia.',
    icon: 'kite',
    iconFamily: 'material',
  });

  // Día de la Madre: Segundo domingo de mayo en Colombia
  const madreDateId = getNthWeekdayOfMonth(year, 5, 0, 2); // 0 = Domingo, 2º
  items.push({
    id: makeId(madreDateId, 'dia-madre'),
    name: 'Día de la Madre en Colombia',
    category: 'nacional',
    basis: 'tradicion',
    isHoliday: false,
    note: 'Homenaje y gratitud al amor incondicional, la dedicación y el valor de las madres.',
    icon: 'hand-heart',
    iconFamily: 'material',
  });

  // Día del Padre: Tercer domingo de junio en Colombia
  const padreDateId = getNthWeekdayOfMonth(year, 6, 0, 3); // 0 = Domingo, 3º
  items.push({
    id: makeId(padreDateId, 'dia-padre'),
    name: 'Día del Padre en Colombia',
    category: 'nacional',
    basis: 'tradicion',
    isHoliday: false,
    note: 'Reconocimiento y gratitud al ejemplo, la orientación y la entrega de los padres.',
    icon: 'tie',
    iconFamily: 'material',
  });

  // Día del Amor y la Amistad: Tercer sábado de septiembre en Colombia
  const amorDateId = getNthWeekdayOfMonth(year, 9, 6, 3); // 6 = Sábado, 3º
  items.push({
    id: makeId(amorDateId, 'amor-amistad'),
    name: 'Día del Amor y la Amistad en Colombia',
    category: 'nacional',
    basis: 'tradicion',
    isHoliday: false,
    note: 'Celebración principal en Colombia para compartir el cariño entre amigos y parejas.',
    icon: 'heart-multiple',
    iconFamily: 'material',
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. EDUCACIÓN, CIENCIA Y PROFESIONES (Especialmente útiles para app académica)
  // ─────────────────────────────────────────────────────────────────────────────
  const progDay = isLeapYear(year) ? 12 : 13;
  const progDateId = `${year}-09-${String(progDay).padStart(2, '0')}`;

  const eduDates = [
    {
      m: 1, d: 24, slug: 'educacion', name: 'Día Internacional de la Educación', basis: 'onu' as const,
      note: 'Reconocimiento a la educación como derecho humano fundamental para la paz y el progreso.',
      icon: 'school',
    },
    {
      m: 3, d: 4, slug: 'ingenieria-desarrollo', name: 'Día Mundial de la Ingeniería para el Desarrollo Sostenible', basis: 'onu' as const,
      note: 'Reconocimiento al rol de la ingeniería para crear soluciones sostenibles e innovadoras.',
      icon: 'solar-power',
    },
    {
      m: 3, d: 14, slug: 'matematicas', name: 'Día Internacional de las Matemáticas', basis: 'onu' as const,
      note: 'Celebración de la belleza, la lógica y el impacto esencial de las matemáticas en el mundo.',
      icon: 'pi',
    },
    {
      m: 8, d: 17, slug: 'ingeniero-colombia', name: 'Día del Ingeniero en Colombia', basis: 'gremial' as const,
      note: 'Homenaje al ingenio, la innovación y el desarrollo técnico y constructivo del país.',
      icon: 'compass-outline',
    },
    {
      m: 10, d: 5, slug: 'docentes', name: 'Día Mundial de los Docentes', basis: 'onu' as const,
      note: 'Reconocimiento global a la labor formativa de los profesores y docentes del mundo.',
      icon: 'human-male-board',
    },
    {
      m: 11, d: 10, slug: 'ciencia', name: 'Día Mundial de la Ciencia', basis: 'onu' as const,
      note: 'Fomento a la investigación científica y al conocimiento al servicio de la sociedad.',
      icon: 'atom',
    },
    {
      m: 12, d: 3, slug: 'medico', name: 'Día Panamericano del Médico', basis: 'tradicion' as const,
      note: 'Homenaje a la vocación de servicio, la ética y la entrega de los profesionales de la salud.',
      icon: 'stethoscope',
    },
  ];

  for (const e of eduDates) {
    const dId = `${year}-${String(e.m).padStart(2, '0')}-${String(e.d).padStart(2, '0')}`;
    items.push({
      id: makeId(dId, e.slug),
      name: e.name,
      category: 'educacion',
      basis: e.basis,
      isHoliday: false,
      note: e.note,
      icon: e.icon,
      iconFamily: 'material',
    });
  }

  items.push({
    id: makeId(progDateId, 'programador'),
    name: 'Día del Programador (Día 256)',
    category: 'educacion',
    basis: 'gremial',
    isHoliday: false,
    note: 'Celebrado en el día 256 del año (2^8 valores en un byte) en homenaje a los creadores de software.',
    icon: 'laptop',
    iconFamily: 'material',
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. INTERNACIONALES CON PRESENCIA ACTIVA EN COLOMBIA
  // ─────────────────────────────────────────────────────────────────────────────
  const intDates = [
    { m: 3, d: 21, slug: 'bosques', name: 'Día Internacional de los Bosques', note: 'Conciencia y compromiso con la conservación de los ecosistemas boscosos y selvas.', icon: 'forest' },
    { m: 3, d: 22, slug: 'agua', name: 'Día Mundial del Agua', note: 'Sensibilización sobre la preservación vital y el acceso universal al agua dulce.', icon: 'water' },
    { m: 4, d: 22, slug: 'tierra', name: 'Día Internacional de la Madre Tierra', note: 'Llamado a la armonía con la naturaleza y la protección ecológica del planeta.', icon: 'earth' },
    { m: 6, d: 5, slug: 'medio-ambiente', name: 'Día Mundial del Medio Ambiente', note: 'Acción global y comunitaria frente al cambio climático y la pérdida de biodiversidad.', icon: 'sprout' },
    { m: 8, d: 9, slug: 'pueblos-indigenas', name: 'Día Internacional de los Pueblos Indígenas', note: 'Protección y respeto a las tradiciones, lenguas y saberes de los pueblos originarios.', icon: 'feather' },
    { m: 8, d: 12, slug: 'juventud', name: 'Día Internacional de la Juventud', note: 'Celebración del talento, la voz y el liderazgo transformador de los jóvenes.', icon: 'balloon' },
    { m: 9, d: 21, slug: 'paz', name: 'Día Internacional de la Paz', note: 'Jornada mundial por la no violencia, el cese de hostilidades y la reconciliación.', icon: 'peace' },
    { m: 10, d: 10, slug: 'salud-mental', name: 'Día Mundial de la Salud Mental', note: 'Sensibilización sobre el cuidado integral del bienestar psicológico y emocional.', icon: 'brain' },
    { m: 11, d: 20, slug: 'derechos-nino', name: 'Día Universal de los Derechos del Niño', note: 'Compromiso internacional con la protección, dignidad y derechos de cada niño y niña.', icon: 'balloon' },
    { m: 11, d: 25, slug: 'eliminacion-violencia-mujer', name: 'Día de la Eliminación de la Violencia contra la Mujer', note: 'Jornada 25N para erradicar cualquier manifestación de violencia contra las mujeres.', icon: 'hand-back-left' },
    { m: 12, d: 1, slug: 'sida', name: 'Día Mundial de la Lucha contra el Sida', note: 'Solidaridad, prevención, educación y apoyo a personas que conviven con el VIH.', icon: 'ribbon' },
    { m: 12, d: 3, slug: 'discapacidad', name: 'Día Internacional de las Personas con Discapacidad', note: 'Promoción activa de la inclusión, la accesibilidad y la igualdad de oportunidades.', icon: 'wheelchair-accessibility' },
    { m: 12, d: 10, slug: 'derechos-humanos', name: 'Día de los Derechos Humanos', note: 'Conmemoración de la Declaración Universal de los Derechos Humanos para todas las personas.', icon: 'scale-balance' },
  ];

  for (const i of intDates) {
    const dId = `${year}-${String(i.m).padStart(2, '0')}-${String(i.d).padStart(2, '0')}`;
    items.push({
      id: makeId(dId, i.slug),
      name: i.name,
      category: 'internacional',
      basis: 'onu',
      isHoliday: false,
      note: i.note,
      icon: i.icon,
      iconFamily: 'material',
    });
  }

  return items;
}
