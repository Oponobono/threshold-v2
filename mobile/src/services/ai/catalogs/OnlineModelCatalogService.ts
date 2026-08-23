import { fetchWithFallback } from '../../api/client';
import { useAICatalogsStore, type OnlineModel } from '../../../store/useAICatalogsStore';

// URL directa al backend de producción para el catálogo de modelos.
// Este endpoint es público (sin auth) y siempre debe apuntar a la nube.
// En dev, usamos fetchWithFallback para poder probar con el servidor local.
const PRODUCTION_CATALOG_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/ai/models/online`
  : 'https://threshold-v2-d7vs.onrender.com/api/ai/models/online';

// Timeout por intento en producción.
// Nota: AbortController + signal no es confiable en React Native Hermes release builds.
// Usamos Promise.race() que funciona en cualquier entorno JS.
const FETCH_TIMEOUT_MS = 12_000;

// Si la primera llamada falla, reintentamos una vez tras RETRY_DELAY_MS.
// Cubre el caso de cold start de Render: el primer request lo despierta;
// el segundo (unos segundos después) suele llegar cuando ya está respondiendo.
const RETRY_DELAY_MS = 4_000;
const MAX_RETRIES = 1;

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: el servidor no respondió en ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}

async function fetchCatalogRaw(): Promise<Response> {
  if (!__DEV__) {
    // En producción: llamada directa a la URL de Render con timeout controlado.
    return fetchWithTimeout(PRODUCTION_CATALOG_URL, FETCH_TIMEOUT_MS);
  }
  return fetchWithFallback('/ai/models/online');
}

function parseModels(data: any): OnlineModel[] {
  const models: OnlineModel[] = [];

  if (Array.isArray(data.groq)) {
    for (const m of data.groq) {
      const modelId = m.id ?? m.name ?? String(m);
      models.push({
        provider: 'groq',
        modelId,
        capabilities: (m.capabilities as string[]) || ['text'],
        isAvailable: true,
      });
    }
  }

  if (Array.isArray(data.gemini)) {
    for (const m of data.gemini) {
      const modelId = m.id ?? m.name ?? String(m);
      models.push({
        provider: 'gemini',
        modelId,
        capabilities: (m.capabilities as string[]) || ['text'],
        isAvailable: true,
      });
    }
  }

  if (models.length === 0 && !Array.isArray(data.groq) && !Array.isArray(data.gemini)) {
    throw new Error('Invalid catalog format from backend');
  }

  return models;
}

/**
 * OnlineModelCatalogService
 *
 * Fetches the online catalog (Groq and Gemini) from the backend.
 * Parses the response and updates the store with the latest OnlineModel list.
 * Fails gracefully: if offline or Render is hibernating, the store's previous
 * catalog remains intact.
 *
 * Retry strategy: intenta hasta MAX_RETRIES+1 veces con RETRY_DELAY_MS de espera
 * entre intentos. Cubre el cold start de Render (~30-50s): el primer request lo
 * despierta; el segundo suele llegar cuando ya está respondiendo.
 */
export class OnlineModelCatalogService {
  /**
   * Fetches the online models catalog from the backend.
   * Does NOT make eligibility or fallback decisions.
   */
  static async fetchOnlineCatalog(): Promise<OnlineModel[] | null> {
    const store = useAICatalogsStore.getState();
    store.setOnlineRefreshStatus('refreshing');

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        console.log(`[CatalogService] Reintentando en ${RETRY_DELAY_MS / 1000}s (intento ${attempt + 1}/${MAX_RETRIES + 1})...`);
        await new Promise<void>(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }

      try {
        const response = await fetchCatalogRaw();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const models = parseModels(data);

        // Actualizar el store (se persiste automáticamente para offline-first).
        // setOnlineCatalog ya setea onlineRefreshStatus a 'idle'.
        store.setOnlineCatalog(models);
        console.log(`[CatalogService] Catálogo online: ${models.length} modelos (${data.groq?.length ?? 0} groq, ${data.gemini?.length ?? 0} gemini) — fuente: ${data.source ?? 'unknown'}`);

        return models;
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[CatalogService] Intento ${attempt + 1}/${MAX_RETRIES + 1} fallido: ${msg}`);
      }
    }

    // Todos los intentos agotados — mantener el catálogo cacheado intacto
    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    console.warn(`[CatalogService] No se pudo obtener el catálogo tras ${MAX_RETRIES + 1} intento(s). Causa: ${msg}`);
    store.setOnlineRefreshStatus('error');
    return null;
  }
}
