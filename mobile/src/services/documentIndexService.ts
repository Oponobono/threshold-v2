import type { ExtractedDocument } from '../domain/document/ExtractedDocument';

/**
 * Persiste el texto extraído de un documento en scanned_documents.ocr_text.
 *
 * ocr_text almacena el índice documental del documento. Puede provenir de
 * extracción nativa (PDF, XLSX, PPTX, TXT) o de OCR (imágenes, PDFs escaneados).
 * El nombre se conserva por compatibilidad con versiones anteriores.
 *
 * Solo persiste si:
 *  - documentId existe (modo Biblioteca, no Temporal)
 *  - el texto extraído no está vacío
 *  - ocr_text actual está vacío (no sobreescribe contenido existente)
 */
export async function persistDocumentIndex(
  documentId: string | undefined,
  extracted: ExtractedDocument,
): Promise<void> {
  if (!documentId) return;

  const text = flattenTextBlocks(extracted);
  if (text.length === 0) return;

  try {
    const { documentRepository } = await import('./database/repositories/DocumentRepository');
    const doc = await documentRepository.getById(documentId);
    if (!doc) return;
    if (doc.ocr_text && doc.ocr_text.length > 0) return;

    const { updateScannedDocument } = await import('./api/documents');
    await updateScannedDocument(documentId, { ocr_text: text });
  } catch {}
}

function flattenTextBlocks(extracted: ExtractedDocument): string {
  return extracted.textBlocks
    .map((b) => b.content)
    .filter((c) => c && c.trim().length > 0)
    .join('\n\n');
}
