const PRODUCTION_CATALOG_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/ai/models/gguf_catalog`
  : 'https://threshold-v2-d7vs.onrender.com/api/ai/models/gguf_catalog';

const FETCH_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 4_000;
const MAX_RETRIES = 1;

export interface RemoteLocalModel {
  modelId: string;
  familyId: string;
  quantization: string;
  downloadUrl: string;
  capabilities: string[];
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: no response in ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}

async function fetchCatalogRaw(): Promise<Response> {
  if (!__DEV__) {
    return fetchWithTimeout(PRODUCTION_CATALOG_URL, FETCH_TIMEOUT_MS);
  }
  // En dev: importamos dinámicamente para evitar dependencia circular en módulos
  const { fetchWithFallback } = await import('../../api/client');
  return fetchWithFallback('/ai/models/gguf_catalog');
}

/**
 * RemoteGGUFCatalogService
 *
 * Obtiene el catálogo de modelos GGUF disponibles para descarga on-device.
 * El endpoint `/api/ai/models/gguf_catalog` es público (sin JWT) y está montado
 * antes del middleware de auth en el backend.
 *
 * En producción usa URL directa al backend de Render con timeout y un retry,
 * siguiendo el mismo patrón que OnlineModelCatalogService.
 */
export class RemoteGGUFCatalogService {
  static async fetchRemoteCatalog(): Promise<RemoteLocalModel[] | null> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }

      try {
        const response = await fetchCatalogRaw();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data || !Array.isArray(data.data)) {
          throw new Error('Invalid GGUF catalog format');
        }

        const models: RemoteLocalModel[] = data.data.map((item: any) => ({
          modelId: item.modelId,
          familyId: item.familyId,
          quantization: item.quantization,
          downloadUrl: item.downloadUrl,
          capabilities: item.capabilities || ['text'],
        }));

        return models;
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[CatalogService] GGUF catalog attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${msg}`);
      }
    }

    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    console.warn(`[CatalogService] Could not fetch GGUF catalog after ${MAX_RETRIES + 1} attempt(s). Cause: ${msg}`);
    return null;
  }
}
