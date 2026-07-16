import { createMMKV, type MMKV } from 'react-native-mmkv';
import * as FileSystem from 'expo-file-system/legacy';

export type VisualRepresentationStatus = 'NONE' | 'PENDING' | 'AVAILABLE' | 'FAILED';

// ── MMKV store (lazy) ─────────────────────────────────────────────────────────
let _store: MMKV | null = null;
function getStore(): MMKV {
  if (!_store) _store = createMMKV({ id: 'visual-representation-cache' });
  return _store;
}

const VISUAL_CACHE_DIR = () => `${FileSystem.documentDirectory}Threshold/visual-cache/`;

// ── VisualCacheManager ────────────────────────────────────────────────────────

/**
 * VisualCacheManager
 *
 * Gestiona el ciclo de vida de representaciones visuales (PDF) para documentos
 * cuyo formato nativo requiere conversión en el backend (PPTX, DOCX, ODT, etc.).
 *
 * Es deliberadamente genérico: no conoce el tipo de documento subyacente,
 * solo gestiona el par (documentId → status + localPdfUri).
 *
 * Concepto documentado en: docs/architecture/DocumentWorkspace.md § 2.3
 */
export const VisualCacheManager = {
  // ── Status ──────────────────────────────────────────────────────────────────

  getStatus(documentId: string): VisualRepresentationStatus {
    const raw = getStore().getString(statusKey(documentId));
    if (!raw) return 'NONE';
    return raw as VisualRepresentationStatus;
  },

  setStatus(documentId: string, status: VisualRepresentationStatus): void {
    getStore().set(statusKey(documentId), status);
  },

  // ── PDF URI ─────────────────────────────────────────────────────────────────

  getCachedPdfUri(documentId: string): string | null {
    return getStore().getString(uriKey(documentId)) ?? null;
  },

  // ── Storage ─────────────────────────────────────────────────────────────────

  /**
   * Almacena el PDF binario en disco, registra su ruta en MMKV y marca
   * el estado como AVAILABLE.
   */
  async storePdf(documentId: string, pdfData: ArrayBuffer): Promise<string> {
    const dir = VISUAL_CACHE_DIR();
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    // Nombre de archivo único derivado del documentId (sin caracteres problemáticos)
    const safeId = documentId.replace(/[^a-zA-Z0-9]/g, '_').slice(-80);
    const pdfPath = `${dir}${safeId}.pdf`;

    // Convertir ArrayBuffer → Base64 para escribir con expo-file-system
    const base64 = arrayBufferToBase64(pdfData);
    await FileSystem.writeAsStringAsync(pdfPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    getStore().set(uriKey(documentId), pdfPath);
    getStore().set(statusKey(documentId), 'AVAILABLE' satisfies VisualRepresentationStatus);

    return pdfPath;
  },

  // ── Invalidation ────────────────────────────────────────────────────────────

  invalidate(documentId: string): void {
    getStore().delete(statusKey(documentId));
    getStore().delete(uriKey(documentId));
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusKey(id: string) { return `vcm:status:${id}`; }
function uriKey(id: string) { return `vcm:uri:${id}`; }

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
