/**
 * colombiaCommemorations.ts
 *
 * Catálogo completo de efemérides, menciones honoríficas y conmemoraciones
 * internacionales reconocidas a nivel mundial (ONU, UNESCO, OMS, FAO, UNICEF)
 * junto con conmemoraciones religiosas, cívicas, educativas y culturales de Colombia.
 *
 * Más de 200 fechas conmemorativas curadas con íconos específicos de MaterialCommunityIcons
 * y notas cálidas, concisas y humanas.
 */

import { getEasterSunday, addDaysToDate } from './easter';
import { SpecialDateItem, SpecialDateBasis, SpecialDateCategory } from './types';

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getNthWeekdayOfMonth(
  year: number,
  month: number,
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

export function getLastWeekdayOfMonth(
  year: number,
  month: number,
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

interface CommemDef {
  m: number;
  d: number;
  slug: string;
  name: string;
  category: SpecialDateCategory;
  basis: SpecialDateBasis;
  note: string;
  icon: string;
}

export function generateCommemorations(year: number): SpecialDateItem[] {
  const items: SpecialDateItem[] = [];
  const easter = getEasterSunday(year);

  const makeId = (dateId: string, slug: string) => `commem-${dateId}-${slug}`;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CICLO PASCUAL Y SEMANA SANTA (Religiosas)
  // ─────────────────────────────────────────────────────────────────────────────
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

  const ramosDateId = addDaysToDate(easter.year, easter.month, easter.day, -7);
  items.push({
    id: makeId(ramosDateId, 'domingo-ramos'),
    name: 'Domingo de Ramos',
    category: 'religiosa',
    basis: 'religiosa',
    isHoliday: false,
    note: 'Entrada triunfal de Jesús en Jerusalén y bendición solemne de los ramos.',
    icon: 'palm-tree',
    iconFamily: 'material',
    subItems: [
      { title: 'Conmemoración de la entrada triunfal en Jerusalén' },
      { title: 'Bendición solemne de las palmas y ramos' },
    ],
  });

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

  // Novena de Aguinaldos (16 al 24 de Diciembre)
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
      icon: 'bell-ring-outline',
      iconFamily: 'material',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. CATÁLOGO COMPLETO DE CONMEMORACIONES (INTERNACIONALES, NACIONALES, RELIGIOSAS)
  // ─────────────────────────────────────────────────────────────────────────────
  const catalog: CommemDef[] = [
    // ── ENERO ──
    { m: 1, d: 1, slug: 'paz-mundial', name: 'Día Mundial de la Paz', category: 'internacional', basis: 'onu', note: 'Llamado internacional al diálogo, reconciliación y fraternidad entre los pueblos.', icon: 'peace' },
    { m: 1, d: 4, slug: 'braille', name: 'Día Mundial del Braille', category: 'educacion', basis: 'onu', note: 'Reconocimiento al sistema braille como medio de inclusión e igualdad para personas con discapacidad visual.', icon: 'braille' },
    { m: 1, d: 6, slug: 'epifania-liturgica', name: 'Epifanía del Señor (Día Litúrgico)', category: 'religiosa', basis: 'religiosa', note: 'Conmemoración de la manifestación de Jesús a los sabios de Oriente.', icon: 'crown' },
    { m: 1, d: 14, slug: 'logica', name: 'Día Mundial de la Lógica', category: 'educacion', basis: 'onu', note: 'Fomento a la disciplina del pensamiento racional, la ciencia y la argumentación rigurosa.', icon: 'head-lightbulb' },
    { m: 1, d: 24, slug: 'educacion', name: 'Día Internacional de la Educación', category: 'educacion', basis: 'onu', note: 'Celebración de la educación como derecho humano fundamental y motor del desarrollo sostenible.', icon: 'school' },
    { m: 1, d: 27, slug: 'holocausto', name: 'Día Internacional en Memoria de las Víctimas del Holocausto', category: 'internacional', basis: 'onu', note: 'Homenaje solemne a las víctimas y rechazo universal al antisemitismo y al racismo.', icon: 'candle' },
    { m: 1, d: 28, slug: 'proteccion-datos', name: 'Día de la Protección de Datos Personales', category: 'educacion', basis: 'onu', note: 'Conciencia sobre la privacidad digital y los derechos ciudadanos sobre la información personal.', icon: 'shield-lock-outline' },

    // ── FEBRERO ──
    { m: 2, d: 2, slug: 'humedales', name: 'Día Mundial de los Humedales', category: 'internacional', basis: 'onu', note: 'Sensibilización sobre la vital importancia de los humedales para la biodiversidad y el agua.', icon: 'water-outline' },
    { m: 2, d: 2, slug: 'candelaria', name: 'Virgen de la Candelaria', category: 'religiosa', basis: 'religiosa', note: 'Fiesta de la Presentación del Señor y luz de la fe mariana en Colombia.', icon: 'candle' },
    { m: 2, d: 4, slug: 'cancer', name: 'Día Mundial contra el Cáncer', category: 'internacional', basis: 'onu', note: 'Sensibilización global, detección temprana y apoyo a pacientes y familias.', icon: 'ribbon' },
    { m: 2, d: 9, slug: 'periodista-colombia', name: 'Día del Periodista en Colombia', category: 'nacional', basis: 'tradicion', note: 'Reconocimiento a la libertad de prensa y al periodismo ético y valiente en Colombia.', icon: 'newspaper-variant-outline' },
    { m: 2, d: 10, slug: 'legumbres', name: 'Día Mundial de las Legumbres', category: 'internacional', basis: 'onu', note: 'Valoración de la seguridad alimentaria, nutrición y agricultura sostenible.', icon: 'seed' },
    { m: 2, d: 11, slug: 'mujer-nina-ciencia', name: 'Día Internacional de la Mujer y la Niña en la Ciencia', category: 'educacion', basis: 'onu', note: 'Promoción del acceso pleno y equitativo de mujeres y niñas a las áreas STEM.', icon: 'microscope' },
    { m: 2, d: 13, slug: 'radio', name: 'Día Mundial de la Radio', category: 'educacion', basis: 'onu', note: 'Celebración de la radio como medio cercano, accesible y democrático de información.', icon: 'radio' },
    { m: 2, d: 14, slug: 'san-valentin', name: 'San Valentín (Día Internacional del Afecto)', category: 'internacional', basis: 'tradicion', note: 'Celebración universal del amor, la amistad y los lazos humanos fraternales.', icon: 'heart-outline' },
    { m: 2, d: 15, slug: 'cancer-infantil', name: 'Día Internacional del Cáncer Infantil', category: 'internacional', basis: 'onu', note: 'Solidaridad y compromiso con el acceso a diagnósticos y tratamientos oportunos para niños.', icon: 'hand-heart' },
    { m: 2, d: 20, slug: 'justicia-social', name: 'Día Mundial de la Justicia Social', category: 'internacional', basis: 'onu', note: 'Compromiso con la equidad, el trabajo decente y la eliminación de la pobreza.', icon: 'scale-balance' },
    { m: 2, d: 21, slug: 'lengua-materna', name: 'Día Internacional de la Lengua Materna', category: 'educacion', basis: 'onu', note: 'Preservación de la diversidad lingüística y cultural de los pueblos del mundo.', icon: 'translate' },

    // ── MARZO ──
    { m: 3, d: 1, slug: 'cero-discriminacion', name: 'Día de la Cero Discriminación', category: 'internacional', basis: 'onu', note: 'Defensa del derecho de toda persona a vivir con dignidad y sin discriminación.', icon: 'butterfly' },
    { m: 3, d: 1, slug: 'contador-colombia', name: 'Día del Contador Público en Colombia', category: 'educacion', basis: 'gremial', note: 'Reconocimiento a la fe pública, la transparencia y el rigor de los profesionales contables.', icon: 'calculator' },
    { m: 3, d: 3, slug: 'vida-silvestre', name: 'Día Mundial de la Vida Silvestre', category: 'internacional', basis: 'onu', note: 'Conservación de las especies de fauna y flora silvestres que habitan nuestro planeta.', icon: 'paw' },
    { m: 3, d: 4, slug: 'ingenieria-unesco', name: 'Día Mundial de la Ingeniería para el Desarrollo Sostenible', category: 'educacion', basis: 'onu', note: 'Celebración del ingenio y la tecnología al servicio del desarrollo humano y sostenible.', icon: 'compass' },
    { m: 3, d: 8, slug: 'mujer', name: 'Día Internacional de la Mujer', category: 'internacional', basis: 'onu', note: 'Conmemoración de la lucha histórica por los derechos, igualdad sustantiva y liderazgo femenino.', icon: 'flower-tulip' },
    { m: 3, d: 14, slug: 'matematicas-pi', name: 'Día Internacional de las Matemáticas (Día de Pi)', category: 'educacion', basis: 'onu', note: 'Celebración de la belleza de las matemáticas como lenguaje universal de la ciencia.', icon: 'pi' },
    { m: 3, d: 15, slug: 'derechos-consumidor', name: 'Día Mundial de los Derechos del Consumidor', category: 'internacional', basis: 'onu', note: 'Exigencia de transparencia, calidad y respeto en los mercados para todos los ciudadanos.', icon: 'cart-outline' },
    { m: 3, d: 19, slug: 'hombre-colombia', name: 'Día del Hombre en Colombia', category: 'nacional', basis: 'tradicion', note: 'Homenaje a los hombres colombianos en el marco tradicional de la festividad de San José.', icon: 'gender-male' },
    { m: 3, d: 20, slug: 'felicidad', name: 'Día Internacional de la Felicidad', category: 'internacional', basis: 'onu', note: 'Reconocimiento del bienestar y la felicidad como aspiraciones universales del ser humano.', icon: 'emoticon-happy-outline' },
    { m: 3, d: 21, slug: 'bosques', name: 'Día Internacional de los Bosques', category: 'internacional', basis: 'onu', note: 'Conciencia y compromiso con la conservación de los ecosistemas boscosos y selvas.', icon: 'forest' },
    { m: 3, d: 21, slug: 'poesia', name: 'Día Mundial de la Poesía', category: 'educacion', basis: 'onu', note: 'Celebración de la palabra, la creatividad literaria y la sensibilidad humana.', icon: 'feather' },
    { m: 3, d: 21, slug: 'sindrome-down', name: 'Día Mundial del Síndrome de Down', category: 'internacional', basis: 'onu', note: 'Promoción de la autonomía, inclusión plena y valor de las personas con síndrome de Down.', icon: 'human-handsup' },
    { m: 3, d: 21, slug: 'eliminacion-discriminacion-racial', name: 'Día Internacional de la Eliminación de la Discriminación Racial', category: 'internacional', basis: 'onu', note: 'Jornada global de lucha activa contra el racismo y la intolerancia.', icon: 'account-group' },
    { m: 3, d: 22, slug: 'agua', name: 'Día Mundial del Agua', category: 'internacional', basis: 'onu', note: 'Sensibilización sobre la preservación vital y el acceso universal al agua dulce.', icon: 'water' },
    { m: 3, d: 23, slug: 'meteorologia', name: 'Día Meteorológico Mundial', category: 'educacion', basis: 'onu', note: 'Monitoreo del clima, alerta temprana y protección del planeta y sus comunidades.', icon: 'weather-partly-cloudy' },
    { m: 3, d: 24, slug: 'tuberculosis', name: 'Día Mundial de la Tuberculosis', category: 'internacional', basis: 'onu', note: 'Compromiso mundial por el diagnóstico temprano y la erradicación de la tuberculosis.', icon: 'lungs' },
    { m: 3, d: 26, slug: 'clima', name: 'Día Mundial del Clima', category: 'internacional', basis: 'onu', note: 'Reflexión y acción urgente ante los compromisos para frenar el calentamiento global.', icon: 'thermometer-lines' },
    { m: 3, d: 27, slug: 'teatro', name: 'Día Mundial del Teatro', category: 'educacion', basis: 'onu', note: 'Celebración del arte escénico, la dramaturgia y la fuerza transformadora de la cultura.', icon: 'drama-masks' },

    // ── ABRIL ──
    { m: 4, d: 2, slug: 'autismo', name: 'Día Mundial de Concienciación sobre el Autismo', category: 'internacional', basis: 'onu', note: 'Promoción de la empatía, accesibilidad e inclusión de las personas neurodivergentes.', icon: 'puzzle' },
    { m: 4, d: 2, slug: 'libro-infantil', name: 'Día Internacional del Libro Infantil y Juvenil', category: 'educacion', basis: 'onu', note: 'Inspiración al amor por la lectura y la imaginación en las nuevas generaciones.', icon: 'book-open-page-variant' },
    { m: 4, d: 6, slug: 'deporte-paz', name: 'Día Internacional del Deporte para el Desarrollo y la Paz', category: 'internacional', basis: 'onu', note: 'El deporte como herramienta de salud, disciplina, convivencia pacífica y unión.', icon: 'basketball' },
    { m: 4, d: 7, slug: 'salud-mundial', name: 'Día Mundial de la Salud', category: 'internacional', basis: 'onu', note: 'Conmemoración de la fundación de la OMS y defensa del acceso a salud de calidad.', icon: 'heart-pulse' },
    { m: 4, d: 9, slug: 'victimas-colombia', name: 'Día Nacional de la Memoria y Solidaridad con las Víctimas', category: 'nacional', basis: 'ley', note: 'Homenaje solemne a la dignidad y memoria de las víctimas del conflicto en Colombia.', icon: 'hand-heart' },
    { m: 4, d: 11, slug: 'parkinson', name: 'Día Mundial del Parkinson', category: 'internacional', basis: 'onu', note: 'Visibilidad, investigación científica y empatía con las personas con enfermedad de Parkinson.', icon: 'medical-bag' },
    { m: 4, d: 12, slug: 'vuelos-espaciales', name: 'Día Internacional de los Vuelos Espaciales Tripulados', category: 'educacion', basis: 'onu', note: 'Homenaje a la exploración espacial y a la curiosidad científica de la humanidad.', icon: 'rocket-launch-outline' },
    { m: 4, d: 15, slug: 'arte', name: 'Día Mundial del Arte', category: 'educacion', basis: 'onu', note: 'Celebración de la creatividad y la expresión estética como puentes de entendimiento.', icon: 'palette' },
    { m: 4, d: 16, slug: 'voz', name: 'Día Mundial de la Voz', category: 'educacion', basis: 'onu', note: 'Cuidado de la salud vocal como herramienta primordial de comunicación e identidad.', icon: 'microphone' },
    { m: 4, d: 19, slug: 'bicicleta', name: 'Día Mundial de la Bicicleta', category: 'internacional', basis: 'tradicion', note: 'Promoción del transporte limpio, la movilidad sostenible y la salud física.', icon: 'bicycle' },
    { m: 4, d: 22, slug: 'madre-tierra', name: 'Día Internacional de la Madre Tierra', category: 'internacional', basis: 'onu', note: 'Llamado a la armonía con la naturaleza y la protección ecológica del planeta.', icon: 'earth' },
    { m: 4, d: 23, slug: 'idioma-espanol', name: 'Día del Idioma Español y Día Mundial del Libro', category: 'educacion', basis: 'onu', note: 'Homenaje a Miguel de Cervantes y a la riqueza de la literatura en lengua castellana.', icon: 'book-open-variant' },
    { m: 4, d: 25, slug: 'malaria', name: 'Día Mundial del Paludismo (Malaria)', category: 'internacional', basis: 'onu', note: 'Acción coordinada para prevenir y erradicar la malaria en comunidades vulnerables.', icon: 'needle' },
    { m: 4, d: 26, slug: 'propiedad-intelectual', name: 'Día Mundial de la Propiedad Intelectual', category: 'educacion', basis: 'onu', note: 'Fomento a la innovación, inventos y protección de las obras del intelecto humano.', icon: 'lightbulb-on-outline' },
    { m: 4, d: 28, slug: 'seguridad-trabajo', name: 'Día Mundial de la Seguridad y la Salud en el Trabajo', category: 'educacion', basis: 'onu', note: 'Prevención de accidentes y enfermedades profesionales en todos los sectores.', icon: 'hard-hat' },
    { m: 4, d: 29, slug: 'danza', name: 'Día Internacional de la Danza', category: 'educacion', basis: 'onu', note: 'Homenaje al movimiento corporal, el ritmo y la diversidad de danzas del mundo.', icon: 'shoe-formal' },
    { m: 4, d: 29, slug: 'arbol-colombia', name: 'Día Nacional del Árbol', category: 'nacional', basis: 'ley', note: 'Homenaje a la riqueza forestal y la siembra del Árbol de la Libertad en Colombia.', icon: 'tree' },
    { m: 4, d: 30, slug: 'jazz', name: 'Día Internacional del Jazz', category: 'educacion', basis: 'onu', note: 'Reconocimiento al jazz como fuerza de libertad, improvisación y diálogo intercultural.', icon: 'music-clef-treble' },

    // ── MAYO ──
    { m: 5, d: 2, slug: 'atun', name: 'Día Mundial del Atún', category: 'internacional', basis: 'onu', note: 'Gestión pesquera responsable y preservación de los recursos biológicos marinos.', icon: 'fish' },
    { m: 5, d: 3, slug: 'libertad-prensa', name: 'Día Mundial de la Libertad de Prensa', category: 'educacion', basis: 'onu', note: 'Defensa de los periodistas y del derecho ciudadano a una información veraz.', icon: 'newspaper-variant' },
    { m: 5, d: 8, slug: 'cruz-roja', name: 'Día Mundial de la Cruz Roja y de la Media Luna Roja', category: 'internacional', basis: 'tradicion', note: 'Homenaje a la acción humanitaria imparcial que asiste a las personas en emergencias.', icon: 'crosshairs-gps' },
    { m: 5, d: 12, slug: 'enfermera', name: 'Día Internacional de la Enfermera', category: 'educacion', basis: 'gremial', note: 'Gratitud profunda a la entrega, conocimiento y cuidado compasivo del personal de enfermería.', icon: 'stethoscope' },
    { m: 5, d: 15, slug: 'familias', name: 'Día Internacional de las Familias', category: 'internacional', basis: 'onu', note: 'Reconocimiento del núcleo familiar como espacio de afecto, cuidado y aprendizaje.', icon: 'home-heart' },
    { m: 5, d: 15, slug: 'maestro-colombia', name: 'Día del Maestro en Colombia', category: 'nacional', basis: 'tradicion', note: 'Homenaje y profunda gratitud a los docentes y educadores que forjan el futuro del país.', icon: 'human-male-board' },
    { m: 5, d: 16, slug: 'luz', name: 'Día Internacional de la Luz', category: 'educacion', basis: 'onu', note: 'El papel de la luz y las tecnologías ópticas en la ciencia, energía y salud.', icon: 'lightbulb-outline' },
    { m: 5, d: 16, slug: 'convivencia-paz', name: 'Día Internacional de la Convivencia en Paz', category: 'internacional', basis: 'onu', note: 'Compromiso con el diálogo, la inclusión y la tolerancia mutua en la comunidad.', icon: 'peace' },
    { m: 5, d: 17, slug: 'telecomunicaciones-internet', name: 'Día Mundial de las Telecomunicaciones y la Sociedad de la Información', category: 'educacion', basis: 'onu', note: 'Promoción de la conectividad digital incluyente y el acceso universal a la tecnología.', icon: 'access-point' },
    { m: 5, d: 18, slug: 'museos', name: 'Día Internacional de los Museos', category: 'educacion', basis: 'onu', note: 'Los museos como guardianes del patrimonio histórico, artístico y científico.', icon: 'bank' },
    { m: 5, d: 20, slug: 'abejas', name: 'Día Mundial de las Abejas', category: 'internacional', basis: 'onu', note: 'Protección de los polinizadores indispensables para la agricultura y los ecosistemas.', icon: 'bee' },
    { m: 5, d: 21, slug: 'afrocolombianidad-colombia', name: 'Día Nacional de la Afrocolombianidad', category: 'nacional', basis: 'ley', note: 'Conmemoración de la abolición de la esclavitud y tributo a la herencia afrodescendiente.', icon: 'guitar-acoustic' },
    { m: 5, d: 21, slug: 'diversidad-cultural', name: 'Día Mundial de la Diversidad Cultural para el Diálogo', category: 'internacional', basis: 'onu', note: 'Enriquecimiento de la sociedad a través de la convivencia y el intercambio cultural.', icon: 'account-group' },
    { m: 5, d: 22, slug: 'biodiversidad', name: 'Día Internacional de la Diversidad Biológica', category: 'internacional', basis: 'onu', note: 'Compromiso vital con la preservación del patrimonio biológico y la fauna y flora de Colombia.', icon: 'leaf' },
    { m: 5, d: 25, slug: 'africa', name: 'Día de África', category: 'internacional', basis: 'onu', note: 'Solidaridad y cercanía con los pueblos africanos y la diáspora global.', icon: 'earth' },
    { m: 5, d: 28, slug: 'salud-mujeres', name: 'Día Internacional de Acción por la Salud de las Mujeres', category: 'internacional', basis: 'onu', note: 'Defensa de los derechos reproductivos y la atención médica integral a las mujeres.', icon: 'heart-outline' },
    { m: 5, d: 29, slug: 'cascos-azules', name: 'Día Internacional del Personal de Paz de la ONU', category: 'internacional', basis: 'onu', note: 'Tributo al valor de los contingentes que custodian la paz en zonas de conflicto.', icon: 'shield-half-full' },
    { m: 5, d: 31, slug: 'sin-tabaco', name: 'Día Mundial Sin Tabaco', category: 'internacional', basis: 'onu', note: 'Conciencia sobre los graves riesgos del tabaquismo y protección de la salud pulmonar.', icon: 'smoking-off' },

    // ── JUNIO ──
    { m: 6, d: 1, slug: 'padres-madres', name: 'Día Mundial de las Madres y los Padres', category: 'internacional', basis: 'onu', note: 'Agradecimiento a los progenitores por su amor desinteresado y dedicación familiar.', icon: 'baby-carriage' },
    { m: 6, d: 1, slug: 'leche', name: 'Día Mundial de la Leche', category: 'educacion', basis: 'onu', note: 'Importancia de los productos lácteos en la nutrición y el desarrollo infantil.', icon: 'cup' },
    { m: 6, d: 3, slug: 'bicicleta-onu', name: 'Día Mundial de la Bicicleta (ONU)', category: 'internacional', basis: 'onu', note: 'Reconocimiento oficial de la bicicleta como medio de transporte limpio y accesible.', icon: 'bicycle' },
    { m: 6, d: 5, slug: 'medio-ambiente', name: 'Día Mundial del Medio Ambiente', category: 'internacional', basis: 'onu', note: 'Acción global y comunitaria frente al cambio climático y la pérdida de biodiversidad.', icon: 'sprout' },
    { m: 6, d: 7, slug: 'inocuidad-alimentos', name: 'Día Mundial de la Inocuidad de los Alimentos', category: 'internacional', basis: 'onu', note: 'Garantía de alimentos seguros e higiénicos para prevenir enfermedades.', icon: 'food-variant' },
    { m: 6, d: 8, slug: 'oceanos', name: 'Día Mundial de los Océanos', category: 'internacional', basis: 'onu', note: 'Protección de los mares que regulan el clima y generan la mayor parte del oxígeno.', icon: 'wave' },
    { m: 6, d: 8, slug: 'estudiante-colombia', name: 'Día del Estudiante en Colombia (Estudiante Caído)', category: 'nacional', basis: 'tradicion', note: 'Homenaje a la juventud, al pensamiento crítico y a las luchas del movimiento universitario.', icon: 'school' },
    { m: 6, d: 12, slug: 'trabajo-infantil', name: 'Día Mundial contra el Trabajo Infantil', category: 'internacional', basis: 'onu', note: 'Defensa innegociable de la infancia, la escuela y el juego seguro de los niños.', icon: 'hand-back-left' },
    { m: 6, d: 14, slug: 'donante-sangre', name: 'Día Mundial del Donante de Sangre', category: 'internacional', basis: 'onu', note: 'Agradecimiento a los donantes voluntarios que salvan vidas todos los días.', icon: 'water-plus' },
    { m: 6, d: 15, slug: 'abuso-vejez', name: 'Día Mundial de Toma de Conciencia del Abuso en la Vejez', category: 'internacional', basis: 'onu', note: 'Trato digno, cuidado y respeto irrestricto hacia nuestros adultos mayores.', icon: 'account-clock' },
    { m: 6, d: 17, slug: 'desertificacion', name: 'Día Mundial de Lucha contra la Desertificación y la Sequía', category: 'internacional', basis: 'onu', note: 'Restauración de tierras degradadas y resiliencia comunitaria frente a sequías.', icon: 'cactus' },
    { m: 6, d: 18, slug: 'gastronomia-sostenible', name: 'Día de la Gastronomía Sostenible', category: 'educacion', basis: 'onu', note: 'Fomento a la cocina respetuosa de la biodiversidad y productos locales.', icon: 'silverware-fork-knife' },
    { m: 6, d: 20, slug: 'refugiados', name: 'Día Mundial de los Refugiados', category: 'internacional', basis: 'onu', note: 'Empatía y protección a quienes han tenido que huir de sus hogares por conflictos.', icon: 'human-male-female-child' },
    { m: 6, d: 21, slug: 'yoga', name: 'Día Internacional del Yoga', category: 'internacional', basis: 'onu', note: 'Armonía entre mente, cuerpo y naturaleza mediante la práctica del yoga.', icon: 'meditation' },
    { m: 6, d: 21, slug: 'musica', name: 'Fiesta de la Música', category: 'educacion', basis: 'onu', note: 'Celebración del arte musical y su poder para conectar corazones y culturas.', icon: 'music' },
    { m: 6, d: 22, slug: 'abogado-colombia', name: 'Día del Abogado en Colombia', category: 'educacion', basis: 'gremial', note: 'Reconocimiento a la defensa del Estado de derecho y la justicia imparcial.', icon: 'scale-balance' },
    { m: 6, d: 23, slug: 'administracion-publica', name: 'Día de las Naciones Unidas para la Administración Pública', category: 'educacion', basis: 'onu', note: 'Valoración del servicio público honesto y transparente al servicio ciudadano.', icon: 'office-building' },
    { m: 6, d: 26, slug: 'antidrogas', name: 'Día Internacional de la Lucha contra el Uso Indebido y Tráfico de Drogas', category: 'internacional', basis: 'onu', note: 'Prevención, salud pública y apoyo comunitario a familias afectadas por adicciones.', icon: 'shield-alert-outline' },
    { m: 6, d: 28, slug: 'orgullo', name: 'Día Internacional del Orgullo LGBTIQ+', category: 'internacional', basis: 'tradicion', note: 'Defensa de los derechos humanos, igualdad y no discriminación por orientación o identidad.', icon: 'palette-swatch' },
    { m: 6, d: 30, slug: 'asteroides', name: 'Día Internacional de los Asteroides', category: 'educacion', basis: 'onu', note: 'Educación sobre el sistema solar y la vigilancia astronómica planetaria.', icon: 'orbit' },

    // ── JULIO ──
    { m: 7, d: 3, slug: 'economista-colombia', name: 'Día del Economista en Colombia', category: 'educacion', basis: 'gremial', note: 'Reconocimiento al análisis económico enfocado en el bienestar y desarrollo social.', icon: 'chart-line' },
    { m: 7, d: 7, slug: 'cacao-chocolate', name: 'Día Mundial del Cacao y el Chocolate', category: 'educacion', basis: 'tradicion', note: 'Tributo al grano sagrado de América y a los campesinos cacaoteros de Colombia.', icon: 'cupcake' },
    { m: 7, d: 11, slug: 'poblacion', name: 'Día Mundial de la Población', category: 'internacional', basis: 'onu', note: 'Reflexión sobre los desafíos demográficos, la salud reproductiva y los derechos humanos.', icon: 'account-multiple' },
    { m: 7, d: 15, slug: 'habilidades-juventud', name: 'Día Mundial de las Habilidades de la Juventud', category: 'educacion', basis: 'onu', note: 'Formación técnica y profesional para abrir horizontes dignos a los jóvenes.', icon: 'tools' },
    { m: 7, d: 16, slug: 'virgen-carmen', name: 'Día de la Virgen del Carmen', category: 'religiosa', basis: 'tradicion', note: 'Fiesta tradicional de la patrona de transportadores, conductores y marineros en Colombia.', icon: 'car-estate' },
    { m: 7, d: 17, slug: 'justicia-penal', name: 'Día de la Justicia Penal Internacional', category: 'internacional', basis: 'onu', note: 'Reconocimiento de la lucha contra la impunidad en crímenes de lesa humanidad.', icon: 'gavel' },
    { m: 7, d: 18, slug: 'mandela', name: 'Día Internacional de Nelson Mandela', category: 'internacional', basis: 'onu', note: 'Llamado a la reconciliación, al servicio comunitario y a la lucha por la libertad.', icon: 'peace' },
    { m: 7, d: 22, slug: 'cerebro', name: 'Día Mundial del Cerebro', category: 'educacion', basis: 'onu', note: 'Conciencia sobre la prevención de enfermedades neurodegenerativas y la salud cerebral.', icon: 'brain' },
    { m: 7, d: 25, slug: 'mujeres-afrodescendientes', name: 'Día de las Mujeres Afrodescendientes', category: 'internacional', basis: 'onu', note: 'Reconocimiento a la resistencia y aporte fundamental de las mujeres afro e indígenas.', icon: 'face-woman' },
    { m: 7, d: 28, slug: 'hepatitis', name: 'Día Mundial contra la Hepatitis', category: 'internacional', basis: 'onu', note: 'Promoción del diagnóstico temprano y la vacunación para proteger el hígado.', icon: 'hospital-box' },
    { m: 7, d: 30, slug: 'trata-personas', name: 'Día Mundial contra la Trata de Personas', category: 'internacional', basis: 'onu', note: 'Compromiso frontal contra la explotación y rescate de la dignidad de las víctimas.', icon: 'hand-back-left' },
    { m: 7, d: 30, slug: 'amistad', name: 'Día Internacional de la Amistad', category: 'internacional', basis: 'onu', note: 'La amistad entre personas, países y culturas como semilla de una paz duradera.', icon: 'handshake' },

    // ── AGOSTO ──
    { m: 8, d: 9, slug: 'pueblos-indigenas', name: 'Día Internacional de los Pueblos Indígenas', category: 'internacional', basis: 'onu', note: 'Protección y respeto a las tradiciones, lenguas y saberes de los pueblos originarios.', icon: 'feather' },
    { m: 8, d: 11, slug: 'nutricionista-colombia', name: 'Día del Nutricionista en Colombia', category: 'educacion', basis: 'gremial', note: 'Reconocimiento a los expertos en alimentación equilibrada y bienestar nutricional.', icon: 'food-apple' },
    { m: 8, d: 12, slug: 'juventud', name: 'Día Internacional de la Juventud', category: 'internacional', basis: 'onu', note: 'Celebración del talento, la voz y el liderazgo transformador de los jóvenes.', icon: 'balloon' },
    { m: 8, d: 13, slug: 'humorista-colombia', name: 'Día del Humorista en Colombia', category: 'nacional', basis: 'tradicion', note: 'Homenaje a la alegría, la sátira constructiva y la capacidad de reír de los colombianos.', icon: 'emoticon-wink' },
    { m: 8, d: 17, slug: 'ingeniero-colombia', name: 'Día del Ingeniero en Colombia', category: 'educacion', basis: 'gremial', note: 'Homenaje a la creatividad técnica, la infraestructura y el ingenio que construyen país.', icon: 'compass' },
    { m: 8, d: 19, slug: 'asistencia-humanitaria', name: 'Día Mundial de la Asistencia Humanitaria', category: 'internacional', basis: 'onu', note: 'Reconocimiento al valor de los trabajadores humanitarios que salvan vidas.', icon: 'hand-heart' },
    { m: 8, d: 19, slug: 'fotografia', name: 'Día Mundial de la Fotografía', category: 'educacion', basis: 'tradicion', note: 'El arte de capturar instantes, memorias y realidades a través de la lente.', icon: 'camera' },
    { m: 8, d: 21, slug: 'victimas-terrorismo', name: 'Día Internacional en Homenaje a las Víctimas del Terrorismo', category: 'internacional', basis: 'onu', note: 'Solidaridad y acompañamiento permanente a las víctimas del terrorismo en el mundo.', icon: 'candle' },
    { m: 8, d: 23, slug: 'abolicion-esclavitud', name: 'Día del Recuerdo de la Trata de Esclavos y su Abolición', category: 'internacional', basis: 'onu', note: 'Memoria histórica de la resistencia humana contra la crueldad de la esclavitud.', icon: 'link-off' },
    { m: 8, d: 26, slug: 'dengue', name: 'Día Internacional contra el Dengue', category: 'internacional', basis: 'onu', note: 'Control de vectores, saneamiento y prevención de enfermedades transmitidas por mosquitos.', icon: 'bug-outline' },
    { m: 8, d: 29, slug: 'ensayos-nucleares', name: 'Día Internacional contra los Ensayos Nucleares', category: 'internacional', basis: 'onu', note: 'Exigencia de un mundo libre de detonaciones y de amenazas armamentistas nucleares.', icon: 'radioactive' },
    { m: 8, d: 30, slug: 'desapariciones-forzadas', name: 'Día Internacional de las Víctimas de Desapariciones Forzadas', category: 'internacional', basis: 'onu', note: 'Exigencia de verdad, justicia, búsqueda rigurosa y no repetición.', icon: 'human-male-female-child' },

    // ── SEPTIEMBRE ──
    { m: 9, d: 5, slug: 'beneficencia', name: 'Día Internacional de la Beneficencia', category: 'internacional', basis: 'onu', note: 'Homenaje a la Madre Teresa de Calcuta y fomento de la filantropía y el voluntariado.', icon: 'heart' },
    { m: 9, d: 5, slug: 'mujer-indigena', name: 'Día Internacional de la Mujer Indígena', category: 'internacional', basis: 'onu', note: 'Reconocimiento a las mujeres originarias como protectoras ancestrales de la vida.', icon: 'face-woman' },
    { m: 9, d: 8, slug: 'alfabetizacion', name: 'Día Internacional de la Alfabetización', category: 'educacion', basis: 'onu', note: 'La lectura y la escritura como herramientas habilitadoras de dignidad y libertad.', icon: 'book-open-page-variant' },
    { m: 9, d: 9, slug: 'derechos-humanos-colombia', name: 'Día Nacional de los Derechos Humanos en Colombia', category: 'nacional', basis: 'ley', note: 'Homenaje a San Pedro Claver y compromiso indeclinable con los derechos humanos en el país.', icon: 'scale-balance' },
    { m: 9, d: 10, slug: 'prevencion-suicidio', name: 'Día Mundial para la Prevención del Suicidio', category: 'internacional', basis: 'onu', note: 'Empatía, escucha sin juicio y fortalecimiento de las redes de apoyo emocional.', icon: 'lifebuoy' },
    { m: 9, d: 12, slug: 'cooperacion-sur-sur', name: 'Día de las Naciones Unidas para la Cooperación Sur-Sur', category: 'internacional', basis: 'onu', note: 'Alianzas solidarias y transferencia técnica entre países en desarrollo.', icon: 'handshake-outline' },
    { m: 9, d: 13, slug: 'chocolate', name: 'Día Internacional del Chocolate', category: 'educacion', basis: 'tradicion', note: 'Celebración de uno de los manjares más queridos y compartidos del mundo.', icon: 'food-variant' },
    { m: 9, d: 15, slug: 'democracia', name: 'Día Internacional de la Democracia', category: 'internacional', basis: 'onu', note: 'Defensa de las instituciones democráticas, el voto libre y la participación civil.', icon: 'vote' },
    { m: 9, d: 16, slug: 'ozono', name: 'Día Internacional de la Preservación de la Capa de Ozono', category: 'internacional', basis: 'onu', note: 'Éxito del Protocolo de Montreal y recordatorio del poder de los consensos ecológicos.', icon: 'shield-sun' },
    { m: 9, d: 21, slug: 'paz-internacional', name: 'Día Internacional de la Paz', category: 'internacional', basis: 'onu', note: 'Jornada mundial por la no violencia, el cese de hostilidades y la reconciliación.', icon: 'peace' },
    { m: 9, d: 21, slug: 'alzheimer', name: 'Día Mundial del Alzheimer', category: 'internacional', basis: 'onu', note: 'Apoyo compasivo y comprensión a quienes conviven con el Alzheimer y sus cuidadores.', icon: 'brain' },
    { m: 9, d: 23, slug: 'lenguas-senas', name: 'Día Internacional de las Lenguas de Señas', category: 'educacion', basis: 'onu', note: 'Reconocimiento y valoración de las lenguas de señas como patrimonio de la comunidad sorda.', icon: 'hand-clap' },
    { m: 9, d: 26, slug: 'desarme-nuclear', name: 'Día Internacional para la Eliminación Total de las Armas Nucleares', category: 'internacional', basis: 'onu', note: 'Exigencia de desarme definitivo para garantizar la supervivencia del planeta.', icon: 'nuke' },
    { m: 9, d: 27, slug: 'turismo', name: 'Día Mundial del Turismo', category: 'internacional', basis: 'onu', note: 'El turismo como motor económico, generador de empleo y puente de culturas.', icon: 'airplane' },
    { m: 9, d: 28, slug: 'acceso-informacion', name: 'Día Internacional del Acceso Universal a la Información', category: 'educacion', basis: 'onu', note: 'Transparencia institucional y derecho fundamental a conocer los asuntos públicos.', icon: 'information-variant' },
    { m: 9, d: 29, slug: 'desperdicio-alimentos', name: 'Día Internacional de Concienciación sobre la Pérdida de Alimentos', category: 'internacional', basis: 'onu', note: 'Consumo responsable y optimización de cadenas para evitar que la comida se pierda.', icon: 'food-off' },
    { m: 9, d: 30, slug: 'traduccion', name: 'Día Internacional de la Traducción', category: 'educacion', basis: 'onu', note: 'Homenaje a San Jerónimo y a los traductores que unen pueblos a través de los idiomas.', icon: 'translate' },

    // ── OCTUBRE ──
    { m: 10, d: 1, slug: 'personas-edad', name: 'Día Internacional de las Personas de Edad', category: 'internacional', basis: 'onu', note: 'Gratitud a la sabiduría, experiencia y aporte de nuestros abuelos y adultos mayores.', icon: 'human-cane' },
    { m: 10, d: 1, slug: 'musica-unesco', name: 'Día Internacional de la Música', category: 'educacion', basis: 'onu', note: 'El poder sanador y unificador de la melodía en todas las sociedades.', icon: 'music' },
    { m: 10, d: 2, slug: 'no-violencia', name: 'Día Internacional de la No Violencia (Gandhi)', category: 'internacional', basis: 'onu', note: 'Homenaje al natalicio de Mahatma Gandhi y a la fuerza de la resistencia pacífica.', icon: 'peace' },
    { m: 10, d: 4, slug: 'animales', name: 'Día Mundial de los Animales (San Francisco de Asís)', category: 'internacional', basis: 'tradicion', note: 'Cuidado amoroso, protección y respeto a todas las criaturas sintientes.', icon: 'dog' },
    { m: 10, d: 5, slug: 'docentes-unesco', name: 'Día Mundial de los Docentes', category: 'educacion', basis: 'onu', note: 'Reconocimiento a la labor fundamental de los educadores en la formación de sociedades justas.', icon: 'school' },
    { m: 10, d: 7, slug: 'virgen-rosario', name: 'Día de Nuestra Señora del Rosario', category: 'religiosa', basis: 'religiosa', note: 'Tradición de oración mariana y recogimiento espiritual.', icon: 'hands-pray' },
    { m: 10, d: 9, slug: 'correo', name: 'Día Mundial del Correo', category: 'educacion', basis: 'onu', note: 'Homenaje a los servicios postales que enlazan familias y negocios en todo el globo.', icon: 'email-outline' },
    { m: 10, d: 10, slug: 'salud-mental', name: 'Día Mundial de la Salud Mental', category: 'internacional', basis: 'onu', note: 'Sensibilización sobre el cuidado integral del bienestar psicológico y emocional.', icon: 'brain' },
    { m: 10, d: 11, slug: 'nina', name: 'Día Internacional de la Niña', category: 'internacional', basis: 'onu', note: 'Empoderamiento de las niñas y garantía plena de sus derechos educativos y de vida.', icon: 'face-woman-outline' },
    { m: 10, d: 12, slug: 'virgen-pilar', name: 'Día de la Virgen del Pilar', category: 'religiosa', basis: 'religiosa', note: 'Veneración mariana universal en el mundo hispano y símbolo de fraternidad y devoción.', icon: 'star-four-points' },
    { m: 10, d: 13, slug: 'reduccion-desastres', name: 'Día Internacional para la Reducción del Riesgo de Desastres', category: 'internacional', basis: 'onu', note: 'Prevención comunitaria, resiliencia y mitigación de amenazas climáticas y naturales.', icon: 'shield-alert' },
    { m: 10, d: 15, slug: 'mujeres-rurales', name: 'Día Internacional de las Mujeres Rurales', category: 'internacional', basis: 'onu', note: 'Homenaje a las campesinas que sostienen la seguridad alimentaria de nuestros campos.', icon: 'barley' },
    { m: 10, d: 16, slug: 'alimentacion', name: 'Día Mundial de la Alimentación (FAO)', category: 'internacional', basis: 'onu', note: 'Acción concertada por el derecho universal a una nutrición saludable y contra el hambre.', icon: 'food-apple' },
    { m: 10, d: 17, slug: 'erradicacion-pobreza', name: 'Día Internacional para la Erradicación de la Pobreza', category: 'internacional', basis: 'onu', note: 'Compromiso de justicia social para que ninguna persona quede atrapada en la miseria.', icon: 'hand-heart' },
    { m: 10, d: 19, slug: 'cancer-mama', name: 'Día Mundial contra el Cáncer de Mama', category: 'internacional', basis: 'onu', note: 'Campaña rosa por la autoexploración, diagnóstico a tiempo y acompañamiento a pacientes.', icon: 'ribbon' },
    { m: 10, d: 24, slug: 'naciones-unidas', name: 'Día de las Naciones Unidas', category: 'internacional', basis: 'onu', note: 'Aniversario de la Carta de la ONU: compromiso colectivo por la paz, desarrollo y derechos humanos.', icon: 'earth' },
    { m: 10, d: 27, slug: 'patrimonio-audiovisual', name: 'Día Mundial del Patrimonio Audiovisual', category: 'educacion', basis: 'onu', note: 'Preservación de las películas, grabaciones y testimonios que narran la historia humana.', icon: 'filmstrip' },
    { m: 10, d: 31, slug: 'halloween', name: 'Noche de las Brujitas / Día de los Niños', category: 'nacional', basis: 'tradicion', note: 'Jornada festiva y recreativa de disfraces, juegos y dulces para los niños en Colombia.', icon: 'pumpkin' },

    // ── NOVIEMBRE ──
    { m: 11, d: 2, slug: 'fieles-difuntos', name: 'Conmemoración de los Fieles Difuntos', category: 'religiosa', basis: 'religiosa', note: 'Día solemne de recuerdo, oración y homenaje a los seres queridos que ya partieron.', icon: 'candle' },
    { m: 11, d: 5, slug: 'tsunamis', name: 'Día Mundial de Concienciación sobre los Tsunamis', category: 'internacional', basis: 'onu', note: 'Educación costera y protocolos de evacuación temprana ante emergencias marinas.', icon: 'tsunami' },
    { m: 11, d: 10, slug: 'ciencia-paz', name: 'Día Mundial de la Ciencia para la Paz y el Desarrollo', category: 'educacion', basis: 'onu', note: 'La investigación científica como generadora de conocimiento ético y soluciones para la sociedad.', icon: 'atom' },
    { m: 11, d: 14, slug: 'diabetes', name: 'Día Mundial de la Diabetes', category: 'internacional', basis: 'onu', note: 'Conciencia sobre hábitos saludables, prevención y acceso universal a insulina y controles.', icon: 'needle' },
    { m: 11, d: 16, slug: 'tolerancia', name: 'Día Internacional para la Tolerancia', category: 'internacional', basis: 'onu', note: 'Respeto mutuo y valoración de la rica diversidad de culturas y opiniones en el mundo.', icon: 'handshake' },
    { m: 11, d: 17, slug: 'prematuro', name: 'Día Mundial del Niño Prematuro', category: 'internacional', basis: 'onu', note: 'Cuidado especializado y amor a los recién nacidos que llegan al mundo antes de tiempo.', icon: 'baby' },
    { m: 11, d: 19, slug: 'retrete-saneamiento', name: 'Día Mundial del Retrete (Saneamiento Universal)', category: 'internacional', basis: 'onu', note: 'El saneamiento básico como derecho indispensable para la salud pública y la dignidad.', icon: 'water-pump' },
    { m: 11, d: 19, slug: 'hombre-internacional', name: 'Día Internacional del Hombre', category: 'internacional', basis: 'onu', note: 'Promoción de la salud masculina, el cuidado emocional y los modelos de vida positivos.', icon: 'gender-male' },
    { m: 11, d: 20, slug: 'derechos-nino', name: 'Día Universal de los Derechos del Niño', category: 'internacional', basis: 'onu', note: 'Compromiso mundial irrenunciable con la protección, dignidad y futuro de la niñez.', icon: 'balloon' },
    { m: 11, d: 21, slug: 'television', name: 'Día Mundial de la Televisión', category: 'educacion', basis: 'onu', note: 'La televisión como herramienta clave de información y conexión de la opinión pública.', icon: 'television-classic' },
    { m: 11, d: 22, slug: 'musico-santa-cecilia', name: 'Día del Músico (Santa Cecilia)', category: 'educacion', basis: 'tradicion', note: 'Homenaje a los artistas e intérpretes que llenan de alegría y armonía nuestras vidas.', icon: 'guitar-acoustic' },
    { m: 11, d: 25, slug: 'eliminacion-violencia-mujer', name: 'Día Internacional de la Eliminación de la Violencia contra la Mujer (25N)', category: 'internacional', basis: 'onu', note: 'Jornada mundial para erradicar cualquier manifestación de violencia contra las mujeres.', icon: 'hand-back-left' },
    { m: 11, d: 29, slug: 'pueblo-palestino', name: 'Día Internacional de Solidaridad con el Pueblo Palestino', category: 'internacional', basis: 'onu', note: 'Llamado al respeto por los derechos inalienables y la paz justa en Medio Oriente.', icon: 'dove' },
    { m: 11, d: 30, slug: 'guerra-quimica', name: 'Día de Conmemoración de las Víctimas de la Guerra Química', category: 'internacional', basis: 'onu', note: 'Reafirmación de la prohibición absoluta del uso de armas químicas en el mundo.', icon: 'skull-outline' },

    // ── DICIEMBRE ──
    { m: 12, d: 1, slug: 'sida', name: 'Día Mundial de la Lucha contra el Sida', category: 'internacional', basis: 'onu', note: 'Solidaridad, prevención médica y cero estigma para las personas que conviven con el VIH.', icon: 'ribbon' },
    { m: 12, d: 2, slug: 'abolicion-esclavitud-moderna', name: 'Día Internacional para la Abolición de la Esclavitud', category: 'internacional', basis: 'onu', note: 'Erradicación del trabajo forzoso, la servidumbre y las formas modernas de esclavitud.', icon: 'link-off' },
    { m: 12, d: 3, slug: 'discapacidad', name: 'Día Internacional de las Personas con Discapacidad', category: 'internacional', basis: 'onu', note: 'Promoción activa de la inclusión, la accesibilidad y la igualdad de oportunidades.', icon: 'wheelchair-accessibility' },
    { m: 12, d: 3, slug: 'medico-panamericano', name: 'Día Panamericano del Médico', category: 'educacion', basis: 'tradicion', note: 'Homenaje a la vocación de servicio, la ética y la entrega de los profesionales de la salud.', icon: 'stethoscope' },
    { m: 12, d: 5, slug: 'suelo', name: 'Día Mundial del Suelo', category: 'internacional', basis: 'onu', note: 'Cuidado de la tierra fértil como base viva de la producción de alimentos en el planeta.', icon: 'sprout' },
    { m: 12, d: 5, slug: 'voluntarios', name: 'Día Internacional de los Voluntarios', category: 'internacional', basis: 'onu', note: 'Reconocimiento a quienes entregan generosamente su tiempo y energía al servicio de los demás.', icon: 'hand-heart' },
    { m: 12, d: 7, slug: 'velitas', name: 'Noche de las Velitas', category: 'religiosa', basis: 'tradicion', note: 'Tradición nacional de iluminar calles y hogares en víspera de la Inmaculada Concepción.', icon: 'candle' },
    { m: 12, d: 9, slug: 'anticorrupcion', name: 'Día Internacional contra la Corrupción', category: 'internacional', basis: 'onu', note: 'Fomento de la probidad, la rendición de cuentas y la transparencia en las instituciones.', icon: 'shield-check' },
    { m: 12, d: 10, slug: 'derechos-humanos', name: 'Día de los Derechos Humanos', category: 'internacional', basis: 'onu', note: 'Conmemoración de la Declaración Universal de los Derechos Humanos para todas las personas.', icon: 'scale-balance' },
    { m: 12, d: 11, slug: 'montanas', name: 'Día Internacional de las Montañas', category: 'internacional', basis: 'onu', note: 'Protección de las cordilleras y páramos que abastecen de agua y vida a nuestro territorio.', icon: 'terrain' },
    { m: 12, d: 12, slug: 'virgen-guadalupe', name: 'Día de la Virgen de Guadalupe', category: 'religiosa', basis: 'religiosa', note: 'Celebración mariana de profunda devoción en América Latina y símbolo de esperanza.', icon: 'star-crescent' },
    { m: 12, d: 18, slug: 'migrante', name: 'Día Internacional del Migrante', category: 'internacional', basis: 'onu', note: 'Respeto a la dignidad, derechos y enriquecimiento que aportan los migrantes en todo el mundo.', icon: 'walk' },
    { m: 12, d: 18, slug: 'lengua-arabe', name: 'Día Mundial de la Lengua Árabe', category: 'educacion', basis: 'onu', note: 'Aporte de la lengua árabe al patrimonio cultural, filosófico y científico de la humanidad.', icon: 'translate' },
    { m: 12, d: 20, slug: 'solidaridad-humana', name: 'Día Internacional de la Solidaridad Humana', category: 'internacional', basis: 'onu', note: 'La solidaridad como valor universal para alcanzar los objetivos de desarrollo compartido.', icon: 'account-group' },
    { m: 12, d: 24, slug: 'nochebuena', name: 'Nochebuena', category: 'religiosa', basis: 'tradicion', note: 'Víspera de Navidad y tiempo de paz, perdón y cálida reunión en familia.', icon: 'home-heart' },
    { m: 12, d: 28, slug: 'inocentes', name: 'Día de los Santos Inocentes', category: 'nacional', basis: 'tradicion', note: 'Tradición de humor, bromas sanas y recuerdos compartidos con alegría y cariño.', icon: 'emoticon-wink-outline' },
    { m: 12, d: 31, slug: 'ano-viejo', name: 'Fin de Año / Nochevieja', category: 'nacional', basis: 'tradicion', note: 'Despedida del año y tradiciones de gratitud y esperanza para el año que comienza.', icon: 'clock-outline' },
  ];

  for (const c of catalog) {
    const dId = `${year}-${String(c.m).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`;
    items.push({
      id: makeId(dId, c.slug),
      name: c.name,
      category: c.category,
      basis: c.basis,
      isHoliday: false,
      note: c.note,
      icon: c.icon,
      iconFamily: 'material',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. FECHAS MÓVILES (FAMILIA, NIÑEZ Y GREMIOS EN COLOMBIA)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const ninoDateId = getLastWeekdayOfMonth(year, 4, 6); // Último sábado de abril
    items.push({
      id: makeId(ninoDateId, 'dia-ninez-colombia'),
      name: 'Día de la Niñez y la Recreación en Colombia',
      category: 'nacional',
      basis: 'ley',
      isHoliday: false,
      note: 'Homenaje a los niños de Colombia mediante el juego, el afecto y la recreación.',
      icon: 'balloon',
      iconFamily: 'material',
    });
  } catch {}

  try {
    const madreDateId = getNthWeekdayOfMonth(year, 5, 0, 2); // Segundo domingo de mayo
    items.push({
      id: makeId(madreDateId, 'dia-madre-colombia'),
      name: 'Día de la Madre en Colombia',
      category: 'nacional',
      basis: 'tradicion',
      isHoliday: false,
      note: 'Celebración y profunda gratitud al amor incondicional y entrega de las madres.',
      icon: 'flower-tulip',
      iconFamily: 'material',
    });
  } catch {}

  try {
    const padreDateId = getNthWeekdayOfMonth(year, 6, 0, 3); // Tercer domingo de junio
    items.push({
      id: makeId(padreDateId, 'dia-padre-colombia'),
      name: 'Día del Padre en Colombia',
      category: 'nacional',
      basis: 'tradicion',
      isHoliday: false,
      note: 'Reconocimiento y agradecimiento a la paternidad responsable y afectuosa.',
      icon: 'tie',
      iconFamily: 'material',
    });
  } catch {}

  try {
    const amorDateId = getNthWeekdayOfMonth(year, 9, 6, 3); // Tercer sábado de septiembre
    items.push({
      id: makeId(amorDateId, 'amor-amistad-colombia'),
      name: 'Día del Amor y la Amistad en Colombia',
      category: 'nacional',
      basis: 'tradicion',
      isHoliday: false,
      note: 'Celebración tradicional del cariño, el amigo secreto y la fraternidad en Colombia.',
      icon: 'heart-multiple',
      iconFamily: 'material',
    });
  } catch {}

  // Día del Programador: Día 256 del año (12 de sep en bisiesto, 13 de sep en no bisiesto)
  const leap = isLeapYear(year);
  const progDateId = leap ? `${year}-09-12` : `${year}-09-13`;
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

  return items;
}
