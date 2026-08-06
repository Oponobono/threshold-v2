import { flashcardDeckRepository } from '../database/repositories/FlashcardDeckRepository';

export class DeckUniquenessService {
  /**
   * Garantiza que el título base sea único para el usuario.
   * Si ya existe "Lógica", retorna "Lógica (2)".
   * Si ya existen "Lógica", "Lógica (2)" y "Lógica (5)", retorna "Lógica (6)".
   */
  static async ensureUniqueTitle(userId: string, baseTitle: string): Promise<string> {
    const existingTitles = await flashcardDeckRepository.findConflictingTitles(userId, baseTitle);

    if (existingTitles.length === 0) {
      return baseTitle;
    }

    // Comprobar si existe el título exacto
    const exactMatch = existingTitles.find(t => t === baseTitle);
    if (!exactMatch) {
      // El prefix coincidió (ej. Lógica de Programación), pero no exactamente con Lógica
      return baseTitle;
    }

    let maxSuffix = 1;
    
    // Regex para buscar "Base Title (numero)" al final del string
    // El sufijo opcional debe estar separado por un espacio y entre paréntesis
    // Hacemos escape del baseTitle por si tiene caracteres especiales
    const escapedBaseTitle = baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suffixRegex = new RegExp(`^${escapedBaseTitle} \\((\\d+)\\)$`);

    for (const title of existingTitles) {
      const match = title.match(suffixRegex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSuffix) {
          maxSuffix = num;
        }
      } else if (title === baseTitle) {
        if (1 > maxSuffix) maxSuffix = 1;
      }
    }

    return `${baseTitle} (${maxSuffix + 1})`;
  }
}
