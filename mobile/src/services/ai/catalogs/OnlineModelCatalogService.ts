import { fetchWithFallback } from '../../api/client';
import { useAICatalogsStore, type OnlineModel } from '../../../store/useAICatalogsStore';

// URL directa al backend de producción para el catálogo de modelos.
// Este endpoint es público (sin auth) y siempre debe apuntar a la nube.
// En dev, usamos fetchWithFallback para poder probar con el servidor local.
const PRODUCTION_CATALOG_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/ai/models/online`
  : 'https://threshold-v2-d7vs.onrender.com/api/ai/models/online';

async function fetchCatalogRaw(): Promise<Response> {
  if (!__DEV__) {
    // En producción: llamada directa a la URL de Render, sin depender del
    // cliente API que puede estar en proceso de detección del backend local.
    return fetch(PRODUCTION_CATALOG_URL);
  }
  return fetchWithFallback('/ai/models/online');
}

/**
 * OnlineModelCatalogService
 * 
 * Fetches the online catalog (Groq and Gemini) from the backend.
 * Parses the response and updates the store with the latest OnlineModel list.
 * Fails gracefully: if offline, the store's previous catalog remains intact.
 */
export class OnlineModelCatalogService {
  /**
   * Fetches the online models catalog from the backend.
   * Does NOT make eligibility or fallback decisions.
   */
  static async fetchOnlineCatalog(): Promise<OnlineModel[] | null> {
    const store = useAICatalogsStore.getState();
    store.setOnlineRefreshStatus('refreshing');
    
    try {
      const response = await fetchCatalogRaw();
      if (!response.ok) {
        throw new Error(`Error fetching online models: ${response.status}`);
      }

      const data = await response.json();
      
      // Backend response format: { groq: [...], gemini: [...], lastUpdated }
      // Each item: { id, object, created, owned_by } (Groq) or { name, ... } (Gemini)
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

      // Actualizar el store (se persiste automáticamente para offline-first)
      // setOnlineCatalog ya setea onlineRefreshStatus a 'idle'
      store.setOnlineCatalog(models);
      console.log(`[CatalogService] Online catalog fetched: ${models.length} models (${data.groq?.length ?? 0} groq, ${data.gemini?.length ?? 0} gemini)`);
      
      return models;
    } catch (error) {
      console.warn('[CatalogService] Failed to fetch online catalog. Retaining previous state if available.', error);
      store.setOnlineRefreshStatus('error');
      return null;
    }
  }
}
