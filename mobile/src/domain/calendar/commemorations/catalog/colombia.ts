/**
 * colombia.ts
 *
 * Catálogo de fechas cívicas, patrias, de memoria, profesionales/gremiales y
 * tradiciones populares propias de Colombia.
 *
 * Criterio de pertenencia: categoría 'nacional', o norma/gremio/tradición colombiana
 * (leyes y decretos de la República, colegios y asociaciones profesionales del país,
 * tradiciones culturales y familiares colombianas).
 *
 * Solo datos declarativos: no contiene lógica de cálculo ni conoce el motor de fechas.
 */

import type { CommemorationDefinition } from '../../types';

export const colombiaDefinitions: readonly CommemorationDefinition[] = [
  {
    id: 'dia-ninez-colombia',
    name: 'Día de la Niñez y la Recreación en Colombia',
    category: 'nacional',
    basis: 'ley',
    authority: 'Ley 724 de 2001 de la República de Colombia',
    status: 'verified',
    dateRule: { type: 'last-weekday', month: 4, weekday: 6 }, // Último sábado de abril
    note: 'Homenaje a los niños de Colombia mediante el juego, el afecto y la recreación (Ley 724 de 2001).',
    icon: 'balloon',
  },

  {
    id: 'dia-madre-colombia',
    name: 'Día de la Madre en Colombia',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Tradición cultural colombiana',
    status: 'verified',
    dateRule: { type: 'nth-weekday', month: 5, weekday: 0, occurrence: 2 }, // Segundo domingo de mayo
    note: 'Celebración y profunda gratitud al amor incondicional y entrega de las madres.',
    icon: 'flower-tulip',
  },

  {
    id: 'dia-padre-colombia',
    name: 'Día del Padre en Colombia',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Tradición cultural colombiana',
    status: 'verified',
    dateRule: { type: 'nth-weekday', month: 6, weekday: 0, occurrence: 3 }, // Tercer domingo de junio
    note: 'Reconocimiento y agradecimiento a la paternidad responsable y afectuosa.',
    icon: 'tie',
  },

  {
    id: 'amor-amistad-colombia',
    name: 'Día del Amor y la Amistad en Colombia',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Tradición comercial y cultural colombiana',
    status: 'verified',
    dateRule: { type: 'nth-weekday', month: 9, weekday: 6, occurrence: 3 }, // Tercer sábado de septiembre
    note: 'Celebración tradicional del cariño, el amigo secreto y la fraternidad en Colombia.',
    icon: 'heart-multiple',
  },

  // ── FEBRERO ──

  {
    id: 'periodista-colombia',
    name: 'Día del Periodista en Colombia',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Tradición Histórica (Papel Periódico de Santafé de Bogotá, 1791)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 2, day: 9 },
    note: 'Reconocimiento a la libertad de prensa y al periodismo ético y valiente en Colombia.',
    icon: 'newspaper-variant-outline',
  },

  // ── MARZO ──

  {
    id: 'contador-colombia',
    name: 'Día del Contador Público en Colombia',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Gremio Contable / Ley 145 de 1960',
    status: 'verified',
    dateRule: { type: 'fixed', month: 3, day: 1 },
    note: 'Reconocimiento a la fe pública, la transparencia y el rigor de los profesionales contables.',
    icon: 'calculator',
  },

  {
    id: 'victimas-crimenes-estado-colombia',
    name: 'Día por la Dignidad de las Víctimas de Crímenes de Estado',
    category: 'nacional',
    basis: 'ley',
    authority: 'Movimiento de Víctimas (MOVICE) / Centro Nacional de Memoria Histórica',
    sourceUrl: 'https://www.centrodememoriahistorica.gov.co/efemerides/',
    status: 'verified',
    dateRule: { type: 'fixed', month: 3, day: 6 },
    note: 'Homenaje a la memoria, dignidad y lucha contra la impunidad de las víctimas del conflicto en Colombia.',
    icon: 'candle',
  },

  {
    id: 'hombre-colombia',
    name: 'Día del Hombre en Colombia',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Tradición cultural en conmemoración de San José',
    status: 'verified',
    dateRule: { type: 'fixed', month: 3, day: 19 },
    note: 'Homenaje a los hombres colombianos en el marco tradicional de la festividad de San José.',
    icon: 'gender-male',
  },

  // ── ABRIL ──

  {
    id: 'victimas-colombia',
    name: 'Día Nacional de la Memoria y Solidaridad con las Víctimas',
    category: 'nacional',
    basis: 'ley',
    authority: 'Ley 1448 de 2011 de la República de Colombia',
    status: 'verified',
    dateRule: { type: 'fixed', month: 4, day: 9 },
    note: 'Homenaje solemne a la dignidad y memoria de las víctimas del conflicto armado en Colombia.',
    icon: 'hand-heart',
  },

  {
    id: 'secretaria-colombia',
    name: 'Día de la Secretaria y del Asistente Administrativo',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Asociaciones gremiales y corporativas de Colombia',
    status: 'verified',
    dateRule: { type: 'fixed', month: 4, day: 26 },
    note: 'Reconocimiento al profesionalismo, discreción y eficiencia del personal administrativo.',
    icon: 'card-account-details-outline',
  },

  {
    id: 'arbol-colombia',
    name: 'Día Nacional del Árbol',
    category: 'nacional',
    basis: 'ley',
    authority: 'Decreto 1333 de 1942 de la República de Colombia',
    status: 'verified',
    dateRule: { type: 'fixed', month: 4, day: 29 },
    note: 'Homenaje a la riqueza forestal y la siembra del Árbol de la Libertad en Colombia.',
    icon: 'tree',
  },

  // ── MAYO ──

  {
    id: 'maestro-colombia',
    name: 'Día del Maestro en Colombia',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Decreto de 1950 en honor a San Juan Bautista de La Salle',
    status: 'verified',
    dateRule: { type: 'fixed', month: 5, day: 15 },
    note: 'Homenaje y profunda gratitud a los docentes y educadores que forjan el futuro del país.',
    icon: 'human-male-board',
  },

  {
    id: 'afrocolombianidad-colombia',
    name: 'Día Nacional de la Afrocolombianidad',
    category: 'nacional',
    basis: 'ley',
    authority: 'Ley 725 de 2001 (Abolición legal de la esclavitud en 1851)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 5, day: 21 },
    note: 'Conmemoración de la abolición de la esclavitud y tributo a la herencia afrodescendiente.',
    icon: 'guitar-acoustic',
  },

  // ── JUNIO ──

  {
    id: 'estudiante-colombia',
    name: 'Día del Estudiante en Colombia (Estudiante Caído)',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Tradición estudiantil universitaria en memoria de Gonzalo Bravo Pérez y Uriel Gutiérrez',
    status: 'verified',
    dateRule: { type: 'fixed', month: 6, day: 8 },
    note: 'Homenaje a la juventud, al pensamiento crítico y a las luchas del movimiento universitario.',
    icon: 'school',
  },

  {
    id: 'abogado-colombia',
    name: 'Día del Abogado en Colombia',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Gremio de la Abogacía (Natalicio de Cristóbal Hurtado de Mendoza)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 6, day: 22 },
    note: 'Reconocimiento a la defensa del Estado de derecho y la justicia imparcial.',
    icon: 'scale-balance',
  },

  {
    id: 'servidor-publico-colombia',
    name: 'Día Nacional del Servidor Público',
    category: 'nacional',
    basis: 'ley',
    authority: 'Decreto 1083 de 2015 (Art. 2.2.15.1) / Función Pública',
    sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=62866',
    status: 'verified',
    verifiedAt: '2026-10-25',
    dateRule: { type: 'fixed', month: 6, day: 27 },
    note: 'Establecido en el Decreto 1083 de 2015 (Art. 2.2.15.1) en homenaje a los servidores del Estado; la norma precisa que no constituye día de vacancia laboral.',
    icon: 'badge-account-horizontal-outline',
  },

  // ── JULIO ──

  {
    id: 'economista-colombia',
    name: 'Día del Economista en Colombia',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Colegio Colombiano de Economistas / Ley 41 de 1969',
    status: 'verified',
    dateRule: { type: 'fixed', month: 7, day: 3 },
    note: 'Reconocimiento al análisis económico enfocado en el bienestar y desarrollo social.',
    icon: 'chart-line',
  },

  {
    id: 'cacao-chocolate',
    name: 'Día Mundial del Cacao y el Chocolate',
    category: 'educacion',
    basis: 'tradicion',
    authority: 'Tradición agropecuaria y cacaotera de Colombia',
    status: 'verified',
    dateRule: { type: 'fixed', month: 7, day: 7 },
    note: 'Tributo al grano sagrado de América y a los campesinos cacaoteros de Colombia.',
    icon: 'cupcake',
  },

  {
    id: 'conductor-virgen-carmen-colombia',
    name: 'Día del Conductor y de la Virgen del Carmen',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Gremio de Transportadores de Colombia / Tradición Popular',
    status: 'verified',
    dateRule: { type: 'fixed', month: 7, day: 16 },
    note: 'Homenaje a los conductores y transportadores en el día de su santa patrona, la Virgen del Carmen.',
    icon: 'car-estate',
  },

  // ── AGOSTO ──

  {
    id: 'nutricionista-colombia',
    name: 'Día del Nutricionista en Colombia',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Asociación Colombiana de Dietistas y Nutricionistas (ACODIN)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 8, day: 11 },
    note: 'Reconocimiento a los expertos en alimentación equilibrada y bienestar nutricional.',
    icon: 'food-apple',
  },

  {
    id: 'humorista-colombia',
    name: 'Día del Humorista en Colombia',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Tradición cultural en memoria de Jaime Garzón',
    status: 'verified',
    dateRule: { type: 'fixed', month: 8, day: 13 },
    note: 'Homenaje a la alegría, la sátira constructiva y la capacidad de reír de los colombianos.',
    icon: 'emoticon-wink',
  },

  {
    id: 'ingeniero-colombia',
    name: 'Día del Ingeniero en Colombia',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Gremio de Ingeniería / Reglamentación Profesional',
    status: 'verified',
    dateRule: { type: 'fixed', month: 8, day: 17 },
    note: 'Homenaje a la creatividad técnica, la infraestructura y el ingenio que construyen país.',
    icon: 'compass',
  },

  // ── SEPTIEMBRE ──

  {
    id: 'fonoaudiologo-colombia',
    name: 'Día del Fonoaudiólogo en Colombia',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Colegio Colombiano de Fonoaudiólogos (ASOFONO)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 9, day: 6 },
    note: 'Homenaje a los especialistas en comunicación humana, deglución, habla y audición.',
    icon: 'ear-hearing',
  },

  {
    id: 'fisioterapeuta-colombia',
    name: 'Día del Fisioterapeuta en Colombia',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Asociación Colombiana de Fisioterapia (ASCOFI) / WCPT',
    status: 'verified',
    dateRule: { type: 'fixed', month: 9, day: 8 },
    note: 'Homenaje a los profesionales que restauran la movilidad, funcionalidad y calidad de vida.',
    icon: 'walk',
  },

  {
    id: 'derechos-humanos-colombia',
    name: 'Día Nacional de los Derechos Humanos en Colombia',
    category: 'nacional',
    basis: 'ley',
    authority: 'Ley 95 de 1985 en honor a San Pedro Claver',
    status: 'verified',
    dateRule: { type: 'fixed', month: 9, day: 9 },
    note: 'Homenaje a San Pedro Claver y compromiso indeclinable con los derechos humanos en el país.',
    icon: 'scale-balance',
  },

  {
    id: 'quimico-farmaceutico-colombia',
    name: 'Día del Químico Farmacéutico en Colombia',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Colegio Nacional de Químicos Farmacéuticos de Colombia',
    status: 'verified',
    dateRule: { type: 'fixed', month: 9, day: 26 },
    note: 'Reconocimiento al rigor científico en el desarrollo, calidad y dispensación de medicamentos.',
    icon: 'pill',
  },

  // ── OCTUBRE ──

  {
    id: 'cafe-internacional-colombia',
    name: 'Día Internacional del Café',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Organización Internacional del Café (OIC) / Federación de Cafeteros',
    sourceUrl: 'https://www.icocoffee.org',
    status: 'verified',
    dateRule: { type: 'fixed', month: 10, day: 1 },
    note: 'Homenaje al grano insignia de Colombia y a las familias campesinas y recolectoras del café.',
    icon: 'coffee',
  },

  {
    id: 'odontologo-colombia',
    name: 'Día del Odontólogo',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Federación Odontológica Latinoamericana (FOLA) / Colombia',
    status: 'verified',
    dateRule: { type: 'fixed', month: 10, day: 3 },
    note: 'Homenaje a los odontólogos que cuidan la salud oral y la sonrisa de la comunidad.',
    icon: 'tooth-outline',
  },

  {
    id: 'archivista-colombia',
    name: 'Día del Archivista en Colombia',
    category: 'educacion',
    basis: 'ley',
    authority: 'Ley 1409 de 2010 de la República de Colombia',
    sourceUrl: 'https://www.archivogeneral.gov.co',
    status: 'verified',
    dateRule: { type: 'fixed', month: 10, day: 9 },
    note: 'Homenaje a los custodios de la memoria institucional y del patrimonio documental del país.',
    icon: 'archive-outline',
  },

  {
    id: 'trabajador-social-colombia',
    name: 'Día del Trabajador Social en Colombia',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Consejo Nacional de Trabajo Social (CONETS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 10, day: 22 },
    note: 'Reconocimiento a quienes dedican su vida al fortalecimiento comunitario, la justicia y los derechos.',
    icon: 'account-group-outline',
  },

  {
    id: 'instrumentador-quirurgico-colombia',
    name: 'Día del Instrumentador Quirúrgico en Colombia',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Asociación Colombiana de Instrumentación Quirúrgica / Ley 784 de 2002',
    status: 'verified',
    dateRule: { type: 'fixed', month: 10, day: 25 },
    note: 'Homenaje a la precisión, asepsia y acompañamiento vital en el quirófano.',
    icon: 'scissors-cutting',
  },

  {
    id: 'halloween',
    name: 'Noche de las Brujitas / Día de los Niños',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Tradición cultural y recreativa colombiana',
    status: 'verified',
    dateRule: { type: 'fixed', month: 10, day: 31 },
    note: 'Jornada festiva y recreativa de disfraces, juegos y dulces para los niños en Colombia.',
    icon: 'pumpkin',
  },

  // ── NOVIEMBRE ──

  {
    id: 'administrador-empresas-colombia',
    name: 'Día del Administrador de Empresas en Colombia',
    category: 'educacion',
    basis: 'ley',
    authority: 'Ley 60 de 1981 / ASCOLFA',
    status: 'verified',
    dateRule: { type: 'fixed', month: 11, day: 4 },
    note: 'Homenaje a los profesionales que lideran la gestión ética y sostenible de organizaciones.',
    icon: 'briefcase-account-outline',
  },

  {
    id: 'psicologo-colombia',
    name: 'Día del Psicólogo en Colombia',
    category: 'educacion',
    basis: 'ley',
    authority: 'Ley 1090 de 2006 / Colegio Colombiano de Psicólogos (COLPSIC)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 11, day: 20 },
    note: 'Homenaje a la fundación del Instituto de Psicología de la UNAL (1947) y a los profesionales del bienestar mental.',
    icon: 'head-heart-outline',
  },

  {
    id: 'agronomo-colombia',
    name: 'Día del Agrónomo en Colombia',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Sociedad Colombiana de Ingenieros Agrónomos (ASIA)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 11, day: 24 },
    note: 'Reconocimiento al ingenio agronómico que tecnifica el campo y asegura la producción de alimentos.',
    icon: 'sprout-outline',
  },

  // ── DICIEMBRE ──

  {
    id: 'medico-panamericano-colombia',
    name: 'Día Panamericano y Nacional del Médico',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Congreso Panamericano de Medicina / MinSalud Colombia / Colegios Médicos',
    status: 'verified',
    dateRule: { type: 'fixed', month: 12, day: 3 },
    note: 'Homenaje a Carlos Finlay y a la vocación de servicio, ética y entrega de los profesionales de la salud.',
    icon: 'stethoscope',
  },

  {
    id: 'inocentes',
    name: 'Día de los Santos Inocentes',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Tradición popular y familiar en Colombia',
    status: 'verified',
    dateRule: { type: 'fixed', month: 12, day: 28 },
    note: 'Tradición de humor, bromas sanas y recuerdos compartidos con alegría y cariño.',
    icon: 'emoticon-wink-outline',
  },

  {
    id: 'ano-viejo',
    name: 'Fin de Año / Nochevieja',
    category: 'nacional',
    basis: 'tradicion',
    authority: 'Tradición cultural y familiar en Colombia',
    status: 'verified',
    dateRule: { type: 'fixed', month: 12, day: 31 },
    note: 'Despedida del año y tradiciones de gratitud y esperanza para el año que comienza.',
    icon: 'clock-outline',
  },
];
