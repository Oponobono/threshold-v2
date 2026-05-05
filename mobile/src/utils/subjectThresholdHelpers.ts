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
