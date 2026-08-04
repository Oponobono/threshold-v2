/**
 * GenerateFlashcardsRequest
 * Contrato de entrada a la Capability de Flashcards.
 */
class GenerateFlashcardsRequest {
  constructor({ mode = 'mixed', count = 10, title, subjectId, userId, provider = 'groq', items = [] }) {
    this.mode = mode; // 'flashcard', 'multiple_choice', 'boolean', 'mixed'
    this.count = Math.min(Math.max(count, 5), 20);
    this.title = title;
    this.subjectId = subjectId;
    this.userId = userId;
    this.provider = provider; // Preferencia de proveedor
    this.items = items; // Fuentes de conocimiento (documentos, imágenes, etc.)
  }

  isValid() {
    return !!this.title && !!this.subjectId && !!this.userId;
  }
}

module.exports = GenerateFlashcardsRequest;
