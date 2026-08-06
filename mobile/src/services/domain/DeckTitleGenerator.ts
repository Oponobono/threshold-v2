/**
 * DeckTitleGenerator
 *
 * Única fuente de verdad para el nombramiento de mazos.
 *
 * Los motores de generación (IA remota, IA local, ingesta de apuntes, OCR)
 * producen información SEMÁNTICA (topic) y nunca deciden el título final.
 * Este generador materializa el título de forma determinista e independiente
 * del proveedor de IA: dados los mismos inputs, cualquier motor produce el
 * mismo título. Cambiar la política de nombramiento aquí no vuelve a invocar
 * a ningún LLM.
 *
 * Formato actual: `[Tema — ]Fuente`
 * Ejemplo: "Expo en React — Programación I"
 *
 * - topic: tema semántico detectado. Omitido si es nulo, vacío o 'Zyren'.
 * - source: nombre de la materia, grabación o video.
 *
 * La unicidad (ej. añadir "(2)") se gestiona aparte vía DeckUniquenessService,
 * porque depende del estado de la BD (consulta de títulos existentes).
 */
export class DeckTitleGenerator {
  static buildTitle(params: {
    topic?: string | null;
    source: string;
  }): string {
    const { topic, source } = params;

    const cleanTopic = topic && topic.trim() !== '' && topic.trim().toLowerCase() !== 'zyren'
      ? topic.trim()
      : null;

    const topicPrefix = cleanTopic ? `${cleanTopic} — ` : '';
    return `${topicPrefix}${source}`;
  }

  /**
   * Trunca el título del video o texto fuente para que no supere maxLength caracteres.
   */
  static truncateSource(title: string, maxLength = 50): string {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 1).trimEnd() + '…';
  }
}
