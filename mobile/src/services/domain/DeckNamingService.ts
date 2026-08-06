export class DeckNamingService {
  /**
   * Genera un título base descriptivo para mazos creados por Zyren.
   *
   * Formato: `[Tema — ]Fuente`
   * Ejemplo: "Lógica de Programación — Programación I"
   *
   * - topic: Tema extraído por IA (máx. 3-4 palabras). Omitido si es nulo, vacío o 'Zyren'.
   * - source: Nombre de la materia, grabación o video.
   * 
   * Nota: Este es el título base. La unicidad (ej. añadir "(2)") se gestiona
   * en el dominio a través del DeckUniquenessService.
   */
  static buildBaseDeckTitle(params: {
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
