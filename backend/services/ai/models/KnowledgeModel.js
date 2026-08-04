/**
 * KnowledgeModel
 * Value Object que representa el conocimiento consolidado de una sesión.
 *
 * Diseñado para crecer: hoy almacena texto y trazabilidad de fuentes.
 * Mañana puede enriquecer con embeddings, fragmentos indexados, grafos de conceptos.
 *
 * INVARIANTE: KnowledgeModel es inmutable. nadie lo muta después de construido.
 */
class KnowledgeModel {
  /**
   * @param {string} text - Texto consolidado de todas las fuentes
   * @param {KnowledgeSource[]} sources - Fuentes originales con trazabilidad
   * @param {KnowledgeMetadata} metadata - Estadísticas y metadatos del modelo
   */
  constructor(text = '', sources = [], metadata = {}) {
    this._text = text;
    this._sources = sources;
    this._metadata = {
      sourceCount: sources.length,
      totalCharacters: text.length,
      isEmpty: text.trim().length === 0,
      buildTimestamp: Date.now(),
      ...metadata,
    };
    Object.freeze(this._metadata);
    Object.freeze(this);
  }

  /** Texto unificado listo para inyectar en el LLM */
  get Text() {
    return this._text;
  }

  /**
   * Fuentes originales del conocimiento.
   * Permite trazabilidad futura: saber de qué foto, minuto o documento vino un concepto.
   * @returns {KnowledgeSource[]}
   */
  get Sources() {
    return this._sources;
  }

  /**
   * Metadatos estadísticos del modelo de conocimiento.
   * @returns {KnowledgeMetadata}
   */
  get Metadata() {
    return this._metadata;
  }

  /** True si el modelo no tiene contenido aprovechable */
  get IsEmpty() {
    return this._metadata.isEmpty;
  }

  /** Texto truncado al máximo de tokens útiles para el LLM */
  truncate(maxChars = 8000) {
    if (this._text.length <= maxChars) return this._text;
    return this._text.substring(0, maxChars) + '\n[...contenido truncado]';
  }
}

module.exports = KnowledgeModel;

/**
 * @typedef {Object} KnowledgeSource
 * @property {string} id - ID original del item
 * @property {string} type - 'photo' | 'recording' | 'video' | 'document'
 * @property {string} label - Nombre legible de la fuente
 * @property {number} charCount - Caracteres que aportó al texto total
 * @property {string} [startOffset] - Índice de inicio en el texto consolidado (para trazabilidad futura)
 */

/**
 * @typedef {Object} KnowledgeMetadata
 * @property {number} sourceCount - Número de fuentes consolidadas
 * @property {number} totalCharacters - Total de caracteres del texto
 * @property {boolean} isEmpty - True si el modelo está vacío
 * @property {number} buildTimestamp - Timestamp de construcción
 */
