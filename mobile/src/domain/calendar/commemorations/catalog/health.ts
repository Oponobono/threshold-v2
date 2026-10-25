/**
 * health.ts
 *
 * Catálogo de días mundiales de salud y campañas sanitarias multidía declaradas por
 * la OMS/OPS y por federaciones internacionales de salud (cáncer, tuberculosis,
 * salud mental, prematurez, cobertura sanitaria universal, etc.).
 *
 * Criterio de pertenencia: autoridad sanitaria internacional (OMS/OPS, UICC, IASP,
 * WFN, IFOS, EFCNI, WABA, ONUSIDA) o día mundial de una condición de salud.
 *
 * Solo datos declarativos: no contiene lógica de cálculo ni conoce el motor de fechas.
 */

import type { CommemorationDefinition } from '../../types';

export const healthDefinitions: readonly CommemorationDefinition[] = [
  {
    id: 'semana-inmunizacion',
    name: 'Semana Mundial de la Inmunización',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS)',
    sourceUrl: 'https://www.who.int/campaigns/world-immunization-week',
    status: 'verified',
    dateRule: { type: 'date-range', startMonth: 4, startDay: 24, endMonth: 4, endDay: 30 },
    note: 'Campaña global de la OMS para promover la vacunación como escudo protector indispensable en todas las edades.',
    icon: 'needle',
  },

  {
    id: 'semana-lactancia',
    name: 'Semana Mundial de la Lactancia Materna',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS) / UNICEF / WABA',
    sourceUrl: 'https://www.who.int/campaigns/world-breastfeeding-week',
    status: 'verified',
    dateRule: { type: 'date-range', startMonth: 8, startDay: 1, endMonth: 8, endDay: 7 },
    note: 'Promoción del amamantamiento como cimiento primordial de la nutrición, salud y desarrollo en la primera infancia.',
    icon: 'baby-bottle-outline',
  },

  {
    id: 'semana-resistencia-antimicrobiana',
    name: 'Semana Mundial de Concienciación sobre la Resistencia a los Antimicrobianos',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS) / OPS',
    sourceUrl: 'https://www.who.int/campaigns/world-antimicrobial-awareness-week',
    status: 'verified',
    dateRule: { type: 'date-range', startMonth: 11, startDay: 18, endMonth: 11, endDay: 24 },
    note: 'Campaña sanitaria global para el uso prudente de antibióticos y evitar microorganismos resistentes a fármacos.',
    icon: 'pill',
  },

  // ── ENERO ──

  {
    id: 'enfermedades-tropicales-desatendidas',
    name: 'Día Mundial de las Enfermedades Tropicales Desatendidas',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (WHA74.18)',
    sourceUrl: 'https://www.who.int/campaigns/world-ntd-day',
    status: 'verified',
    dateRule: { type: 'fixed', month: 1, day: 30 },
    note: 'Sensibilización sobre enfermedades que afectan a más de 1.000 millones de personas en zonas vulnerables.',
    icon: 'virus-outline',
  },

  // ── FEBRERO ──

  {
    id: 'cancer',
    name: 'Día Mundial contra el Cáncer',
    category: 'internacional',
    basis: 'onu',
    authority: 'UICC / Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 2, day: 4 },
    note: 'Sensibilización global, detección temprana y apoyo a pacientes y familias.',
    icon: 'ribbon',
  },

  {
    id: 'cancer-infantil',
    name: 'Día Internacional del Cáncer Infantil',
    category: 'internacional',
    basis: 'onu',
    authority: 'CCI / Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 2, day: 15 },
    note: 'Solidaridad y compromiso con el acceso a diagnósticos y tratamientos oportunos para niños.',
    icon: 'hand-heart',
  },

  // ── MARZO ──

  {
    id: 'audicion-oms',
    name: 'Día Mundial de la Audición',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS)',
    sourceUrl: 'https://www.who.int/campaigns/world-hearing-day',
    status: 'verified',
    dateRule: { type: 'fixed', month: 3, day: 3 },
    note: 'Conciencia sobre la prevención de la sordera y el cuidado universal de la salud auditiva.',
    icon: 'ear-hearing',
  },

  {
    id: 'sindrome-down',
    name: 'Día Mundial del Síndrome de Down',
    category: 'internacional',
    basis: 'onu',
    authority: 'Naciones Unidas (A/RES/66/149)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 3, day: 21 },
    note: 'Promoción de la autonomía, inclusión plena y valor de las personas con síndrome de Down.',
    icon: 'human-handsup',
  },

  {
    id: 'tuberculosis',
    name: 'Día Mundial de la Tuberculosis',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 3, day: 24 },
    note: 'Compromiso mundial por el diagnóstico temprano y la erradicación de la tuberculosis.',
    icon: 'lungs',
  },

  // ── ABRIL ──

  {
    id: 'autismo',
    name: 'Día Mundial de Concienciación sobre el Autismo',
    category: 'internacional',
    basis: 'onu',
    authority: 'Naciones Unidas (A/RES/62/139)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 4, day: 2 },
    note: 'Promoción de la empatía, accesibilidad e inclusión de las personas neurodivergentes.',
    icon: 'puzzle',
  },

  {
    id: 'salud-mundial',
    name: 'Día Mundial de la Salud',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 4, day: 7 },
    note: 'Conmemoración de la fundación de la OMS en 1948 y defensa del acceso a salud de calidad.',
    icon: 'heart-pulse',
  },

  {
    id: 'parkinson',
    name: 'Día Mundial del Parkinson',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 4, day: 11 },
    note: 'Visibilidad, investigación científica y empatía con las personas con enfermedad de Parkinson.',
    icon: 'medical-bag',
  },

  {
    id: 'chagas-oms',
    name: 'Día Mundial de la Enfermedad de Chagas',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (WHA72.13)',
    sourceUrl: 'https://www.who.int/campaigns/world-chagas-disease-day',
    status: 'verified',
    dateRule: { type: 'fixed', month: 4, day: 14 },
    note: 'Diagnóstico precoz y tratamiento oportuno de la tripanosomiasis americana que afecta a comunidades rurales.',
    icon: 'bug-outline',
  },

  {
    id: 'voz',
    name: 'Día Mundial de la Voz',
    category: 'educacion',
    basis: 'onu',
    authority: 'Federación Internacional de Sociedades de Otorrinolaringología (IFOS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 4, day: 16 },
    note: 'Cuidado de la salud vocal como herramienta primordial de comunicación e identidad.',
    icon: 'microphone',
  },

  {
    id: 'malaria',
    name: 'Día Mundial del Paludismo (Malaria)',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 4, day: 25 },
    note: 'Acción coordinada para prevenir y erradicar la malaria en comunidades vulnerables.',
    icon: 'needle',
  },

  // ── MAYO ──

  {
    id: 'higiene-manos-oms',
    name: 'Día Mundial de la Higiene de Manos',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS)',
    sourceUrl: 'https://www.who.int/campaigns/world-hand-hygiene-day',
    status: 'verified',
    dateRule: { type: 'fixed', month: 5, day: 5 },
    note: 'Medida vital de bioseguridad y salud pública para prevenir infecciones y salvar vidas.',
    icon: 'hand-wash',
  },

  {
    id: 'enfermera',
    name: 'Día Internacional de la Enfermera',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Consejo Internacional de Enfermeras (CIE) / OMS',
    status: 'verified',
    dateRule: { type: 'fixed', month: 5, day: 12 },
    note: 'Gratitud profunda a la entrega, conocimiento y cuidado compasivo del personal de enfermería.',
    icon: 'stethoscope',
  },

  {
    id: 'salud-mujeres',
    name: 'Día Internacional de Acción por la Salud de las Mujeres',
    category: 'internacional',
    basis: 'onu',
    authority: 'Red Mundial de Mujeres / OMS',
    status: 'verified',
    dateRule: { type: 'fixed', month: 5, day: 28 },
    note: 'Defensa de los derechos reproductivos y la atención médica integral a las mujeres.',
    icon: 'heart-outline',
  },

  {
    id: 'sin-tabaco',
    name: 'Día Mundial Sin Tabaco',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (WHA42.19)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 5, day: 31 },
    note: 'Conciencia sobre los graves riesgos del tabaquismo y protección de la salud pulmonar.',
    icon: 'smoking-off',
  },

  // ── JUNIO ──

  {
    id: 'inocuidad-alimentos',
    name: 'Día Mundial de la Inocuidad de los Alimentos',
    category: 'internacional',
    basis: 'onu',
    authority: 'Naciones Unidas (A/RES/73/250) / FAO / OMS',
    status: 'verified',
    dateRule: { type: 'fixed', month: 6, day: 7 },
    note: 'Garantía de alimentos seguros e higiénicos para prevenir enfermedades transmitidas por alimentos.',
    icon: 'food-variant',
  },

  {
    id: 'donante-sangre',
    name: 'Día Mundial del Donante de Sangre',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 6, day: 14 },
    note: 'Agradecimiento a los donantes voluntarios que salvan vidas todos los días.',
    icon: 'water-plus',
  },

  // ── JULIO ──

  {
    id: 'cerebro',
    name: 'Día Mundial del Cerebro',
    category: 'educacion',
    basis: 'onu',
    authority: 'Federación Mundial de Neurología (WFN) / OMS',
    status: 'verified',
    dateRule: { type: 'fixed', month: 7, day: 22 },
    note: 'Conciencia sobre la prevención de enfermedades neurodegenerativas y la salud cerebral.',
    icon: 'brain',
  },

  {
    id: 'prevencion-ahogamientos-onu',
    name: 'Día Mundial para la Prevención de los Ahogamientos',
    category: 'internacional',
    basis: 'onu',
    authority: 'Naciones Unidas (A/RES/75/273) / OMS',
    sourceUrl: 'https://www.who.int/campaigns/world-drowning-prevention-day',
    status: 'verified',
    dateRule: { type: 'fixed', month: 7, day: 25 },
    note: 'Medidas de seguridad acuática, vigilancia y prevención de ahogamientos en ríos y piscinas.',
    icon: 'lifebuoy',
  },

  {
    id: 'hepatitis',
    name: 'Día Mundial contra la Hepatitis',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (WHA63.18)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 7, day: 28 },
    note: 'Promoción del diagnóstico temprano y la vacunación para proteger el hígado.',
    icon: 'hospital-box',
  },

  // ── AGOSTO ──

  {
    id: 'dengue',
    name: 'Día Internacional contra el Dengue',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 8, day: 26 },
    note: 'Control de vectores, saneamiento y prevención de enfermedades transmitidas por mosquitos.',
    icon: 'bug-outline',
  },

  // ── SEPTIEMBRE ──

  {
    id: 'prevencion-suicidio',
    name: 'Día Mundial para la Prevención del Suicidio',
    category: 'internacional',
    basis: 'onu',
    authority: 'IASP / Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 9, day: 10 },
    note: 'Empatía, escucha sin juicio y fortalecimiento de las redes de apoyo emocional.',
    icon: 'lifebuoy',
  },

  {
    id: 'seguridad-paciente-oms',
    name: 'Día Mundial de la Seguridad del Paciente',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (WHA72.6)',
    sourceUrl: 'https://www.who.int/campaigns/world-patient-safety-day',
    status: 'verified',
    dateRule: { type: 'fixed', month: 9, day: 17 },
    note: 'Promoción de la atención médica sin daño, diagnósticos seguros y reducción de riesgos hospitalarios.',
    icon: 'shield-cross',
  },

  {
    id: 'alzheimer',
    name: 'Día Mundial del Alzheimer',
    category: 'internacional',
    basis: 'onu',
    authority: 'ADI / Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 9, day: 21 },
    note: 'Apoyo compasivo y comprensión a quienes conviven con el Alzheimer y sus cuidadores.',
    icon: 'brain',
  },

  {
    id: 'rabia-oms',
    name: 'Día Mundial contra la Rabia',
    category: 'internacional',
    basis: 'onu',
    authority: 'GARC / Organización Mundial de la Salud (OMS)',
    sourceUrl: 'https://www.who.int/campaigns/world-rabies-day',
    status: 'verified',
    dateRule: { type: 'fixed', month: 9, day: 28 },
    note: 'Homenaje a Louis Pasteur y promoción de la vacunación de animales para erradicar la rabia humana.',
    icon: 'dog',
  },

  // ── OCTUBRE ──

  {
    id: 'salud-mental',
    name: 'Día Mundial de la Salud Mental',
    category: 'internacional',
    basis: 'onu',
    authority: 'Federación Mundial de la Salud Mental / OMS',
    status: 'verified',
    dateRule: { type: 'fixed', month: 10, day: 10 },
    note: 'Sensibilización sobre el cuidado integral del bienestar psicológico y emocional.',
    icon: 'brain',
  },

  {
    id: 'cancer-mama',
    name: 'Día Mundial contra el Cáncer de Mama',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 10, day: 19 },
    note: 'Campaña rosa por la autoexploración, diagnóstico a tiempo y acompañamiento a pacientes.',
    icon: 'ribbon',
  },

  // ── NOVIEMBRE ──

  {
    id: 'radiologia-mundial',
    name: 'Día Mundial de la Radiología',
    category: 'educacion',
    basis: 'gremial',
    authority: 'Sociedad Europea de Radiología (ESR) / RSNA',
    status: 'verified',
    dateRule: { type: 'fixed', month: 11, day: 8 },
    note: 'Homenaje al descubrimiento de los rayos X en 1895 y al papel del radiodiagnóstico en salvar vidas.',
    icon: 'radiology-box',
  },

  {
    id: 'diabetes',
    name: 'Día Mundial de la Diabetes',
    category: 'internacional',
    basis: 'onu',
    authority: 'Naciones Unidas (A/RES/61/225) / FID / OMS',
    status: 'verified',
    dateRule: { type: 'fixed', month: 11, day: 14 },
    note: 'Conciencia sobre hábitos saludables, prevención y acceso universal a insulina y controles.',
    icon: 'needle',
  },

  {
    id: 'cancer-cuello-uterino-oms',
    name: 'Día Mundial de la Eliminación del Cáncer de Cuello Uterino',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS)',
    sourceUrl: 'https://www.who.int/campaigns/cervical-cancer-elimination-day-of-action',
    status: 'verified',
    dateRule: { type: 'fixed', month: 11, day: 17 },
    note: 'Campaña OMS por la vacunación contra el VPH, tamizaje periódico y tratamiento integral.',
    icon: 'ribbon',
  },

  {
    // Observancia histórica oficial OMS/EFCNI hasta 2024 inclusive.
    id: 'prematuro',
    name: 'Día Mundial del Niño Prematuro',
    category: 'internacional',
    basis: 'onu',
    authority: 'EFCNI / OMS — Observancia histórica 2008–2024',
    sourceUrl: 'https://www.who.int/campaigns/world-prematurity-day',
    status: 'historical',
    verifiedAt: '2026-10-25',
    validUntilYear: 2024,
    dateRule: { type: 'fixed', month: 11, day: 17 },
    note: 'Fecha histórica oficial de la OMS/EFCNI hasta 2024. La OMS trasladó la observancia al 15 de noviembre a partir de 2025.',
    icon: 'baby',
  },

  {
    // Desde 2025, algunas organizaciones socias siguen conmemorando el 17 de noviembre
    // como fecha tradicional, aunque la OMS ya adoptó el 15 de noviembre como fecha oficial.
    id: 'prematuro-organizaciones',
    name: 'Día Mundial del Niño Prematuro (Organizaciones Asociadas)',
    category: 'internacional',
    basis: 'onu',
    authority: 'EFCNI y organizaciones socias — Fecha tradicional mantenida por algunas entidades desde 2025',
    sourceUrl: 'https://www.who.int/campaigns/world-prematurity-day',
    status: 'needs-review',
    verifiedAt: '2026-10-25',
    validFromYear: 2025,
    dateRule: { type: 'fixed', month: 11, day: 17 },
    note: 'Observancia mantenida el 17 de noviembre por algunas organizaciones socias a partir de 2025, aunque la fecha oficial de la OMS es el 15 de noviembre desde ese año.',
    icon: 'baby',
  },

  {
    // Fecha oficial OMS desde la campaña 2025 (who.int ya identifica el 15 de noviembre).
    id: 'prematuro',
    name: 'Día Mundial del Niño Prematuro',
    category: 'internacional',
    basis: 'onu',
    authority: 'Organización Mundial de la Salud (OMS) / UNICEF',
    sourceUrl: 'https://www.who.int/campaigns/world-prematurity-day',
    status: 'verified',
    verifiedAt: '2026-10-25',
    validFromYear: 2025,
    dateRule: { type: 'fixed', month: 11, day: 15 },
    note: 'Fecha oficial de la OMS desde 2025 para visibilizar el cuidado especializado y la prevención de complicaciones en recién nacidos prematuros.',
    icon: 'baby',
  },

  // ── DICIEMBRE ──

  {
    id: 'sida',
    name: 'Día Mundial de la Lucha contra el Sida',
    category: 'internacional',
    basis: 'onu',
    authority: 'ONUSIDA / Organización Mundial de la Salud (OMS)',
    status: 'verified',
    dateRule: { type: 'fixed', month: 12, day: 1 },
    note: 'Solidaridad, prevención médica y cero estigma para las personas que conviven con el VIH.',
    icon: 'ribbon',
  },

  {
    id: 'cobertura-sanitaria-universal-onu',
    name: 'Día Internacional de la Cobertura Sanitaria Universal',
    category: 'internacional',
    basis: 'onu',
    authority: 'Naciones Unidas (A/RES/72/138) / OMS',
    sourceUrl: 'https://www.who.int/campaigns/universal-health-coverage-day',
    status: 'verified',
    dateRule: { type: 'fixed', month: 12, day: 12 },
    note: 'Exigencia de acceso a servicios de salud de calidad sin que ello implique dificultades financieras.',
    icon: 'hospital-building',
  },
];
