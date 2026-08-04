const { db } = require('../../../db');
const fs = require('fs').promises;
const KnowledgeModel = require('../models/KnowledgeModel');

/**
 * KnowledgeEngine
 * Motor de adquisición de conocimiento.
 * Consolida múltiples fuentes heterogéneas (fotos, audios, videos, documentos)
 * en un KnowledgeModel estructurado con trazabilidad de fuentes.
 */
class KnowledgeEngine {

  /**
   * Consolida las fuentes de conocimiento en un KnowledgeModel enriquecido.
   * @param {Array<{id, type, label, ocr_text?, extracted_text?}>} items
   * @returns {Promise<KnowledgeModel>}
   */
  static async consolidate(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new KnowledgeModel('', [], {});
    }

    try {
      const contextPromises = items.map(item => this._extractFromItem(item));
      const results = await Promise.all(contextPromises);

      const validResults = results.filter(r => r !== null && r.text.trim().length > 0);

      const parts = validResults.map(r => r.text);
      const fullContext = parts.join('\n\n---\n\n');

      const sources = validResults.map((r, idx) => ({
        id: r.id,
        type: r.type,
        label: r.label,
        charCount: r.text.length,
        startOffset: parts.slice(0, idx).join('\n\n---\n\n').length,
      }));

      return new KnowledgeModel(fullContext, sources, {
        itemsRequested: items.length,
        itemsWithContent: validResults.length,
        itemsWithoutContent: items.length - validResults.length,
      });

    } catch (err) {
      console.error('[KnowledgeEngine] Error consolidando conocimiento:', err);
      throw new Error('No se pudo consolidar el conocimiento base para la IA.');
    }
  }

  /**
   * Extrae el texto de un item individual según su tipo.
   * @returns {Promise<{id, type, label, text}|null>}
   */
  static async _extractFromItem(item) {
    try {
      let text = '';

      if (item.type === 'photo') {
        if (item.ocr_text) {
          text = `[FOTO: ${item.label}]\n${item.ocr_text}`;
        } else {
          const photo = await this._queryDB('SELECT ocr_text FROM photos WHERE id = ?', [item.id]);
          if (photo?.ocr_text) text = `[FOTO: ${item.label}]\n${photo.ocr_text}`;
        }
      }
      else if (item.type === 'recording') {
        const transcript = await this._queryDB(
          'SELECT transcript_text, transcript_uri FROM audio_transcripts WHERE recording_id = ?',
          [item.id]
        );
        if (transcript?.transcript_text) {
          text = `[AUDIO: ${item.label}]\n${transcript.transcript_text}`;
        } else if (transcript?.transcript_uri) {
          const fileContent = await fs.readFile(transcript.transcript_uri, 'utf8').catch(() => null);
          if (fileContent) text = `[AUDIO: ${item.label}]\n${fileContent}`;
        }
      }
      else if (item.type === 'video') {
        const ytTranscript = await this._queryDB(
          'SELECT transcript_text FROM youtube_transcripts WHERE video_id = ?',
          [item.id]
        );
        if (ytTranscript?.transcript_text) {
          text = `[VIDEO: ${item.label}]\n${ytTranscript.transcript_text}`;
        }
      }
      else if (item.type === 'document') {
        if (item.extracted_text) {
          text = `[DOCUMENTO: ${item.label}]\n${item.extracted_text}`;
        } else {
          const doc = await this._queryDB(
            'SELECT extracted_text FROM assessment_files WHERE id = ? LIMIT 1',
            [item.id]
          ).catch(() => null);
          if (doc?.extracted_text) text = `[DOCUMENTO: ${item.label}]\n${doc.extracted_text}`;
        }
      }

      if (!text.trim()) {
        console.warn(`[KnowledgeEngine] Sin contenido para item ${item.id} (${item.type})`);
        return null;
      }

      return { id: item.id, type: item.type, label: item.label, text };

    } catch (err) {
      console.warn(`[KnowledgeEngine] Error procesando item ${item.id}:`, err.message);
      return null;
    }
  }

  static _queryDB(sql, params) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
  }
}

module.exports = KnowledgeEngine;
