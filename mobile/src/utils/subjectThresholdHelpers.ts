/**
 * subjectThresholdHelpers.ts
 *
 * Utilidades visuales para representar el estado académico (riesgo) de una materia.
 * Provee mapeos directos entre los estados calculados (`safe`, `caution`, `risk`)
 * y sus representaciones en UI (colores, iconos, etiquetas).
 */

/** Retorna un color hex semántico basado en el estado de riesgo académico */
export const getStatusColor = (status?: string): string => {
  if (status === 'safe') return '#00C47D'; // green
  if (status === 'caution') return '#FF9F0A'; // amber
  return '#FF3B30'; // red (default/risk)
};

/** Retorna el nombre del ícono (`MaterialCommunityIcons`) asociado al estado de riesgo */
export const getStatusIcon = (status?: string): string => {
  if (status === 'safe') return 'shield-check-outline';
  if (status === 'caution') return 'shield-half-full';
  return 'shield-alert-outline';
};

/** Retorna la etiqueta de texto traducida (i18n) para el estado de riesgo actual */
export const getStatusLabel = (status: string | undefined, t: any): string => {
  if (status === 'safe') return t('subjects.statusSafe') || 'En buen camino';
  if (status === 'caution') return t('subjects.statusCaution') || 'Atención requerida';
  return t('subjects.statusRisk') || 'En riesgo';
};

/**
 * Oscurece un color hexadecimal un porcentaje determinado.
 * Utilizado para generar contrastes accesibles en las tarjetas de materias.
 * @param hex - Color base en formato #RGB o #RRGGBB.
 * @param percent - Porcentaje de oscurecimiento (ej. 35 para 35%).
 */
export const darkenColor = (hex: string, percent: number): string => {
  let color = hex.replace('#', '');
  if (color.length === 3) color = color.split('').map(c => c + c).join('');
  if (color.length !== 6) return hex;
  
  const num = parseInt(color, 16);
  const amt = Math.round(2.55 * percent);
  let r = (num >> 16) - amt;
  let g = ((num >> 8) & 0x00FF) - amt;
  let b = (num & 0x0000FF) - amt;

  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
};

/**
 * Deriva un acento legible y con identidad de hue a partir de un color de materia.
 * La paleta de materias guarda pasteles casi-blancos (saturación ~3%), que al usarse
 * tal cual o al oscurecerse se ven grises e indistinguibles. Este helper fuerza una
 * saturación viva y una luminosidad legible conservando el hue original del color.
 * @param hex - Color base en formato #RGB o #RRGGBB.
 * @returns Acento en #RRGGBB, o un gris neutro si el color no tiene hue distinguible.
 */
export const toVividAccent = (hex: string): string => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return '#666666';
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  if (clean.length !== 6) return hex;

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  if (s < 0.02) return '#666666';

  const targetS = 0.65;
  const targetL = 0.48;
  const chroma = (1 - Math.abs(2 * targetL - 1)) * targetS;
  const x = chroma * (1 - Math.abs((h * 6) % 2 - 1));
  let rr = 0, gg = 0, bb = 0;
  const h2 = h * 6;
  if (h2 < 1) { rr = chroma; gg = x; }
  else if (h2 < 2) { rr = x; gg = chroma; }
  else if (h2 < 3) { gg = chroma; bb = x; }
  else if (h2 < 4) { gg = x; bb = chroma; }
  else if (h2 < 5) { rr = x; bb = chroma; }
  else { rr = chroma; bb = x; }
  const m = targetL - chroma / 2;
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round((v + m) * 255))).toString(16).padStart(2, '0');
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
};
