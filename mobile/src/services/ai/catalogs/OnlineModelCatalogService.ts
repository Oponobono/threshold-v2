import { fetchWithFallback } from '../../api/client';
import { useAICatalogsStore, type OnlineModel } from '../../../store/useAICatalogsStore';

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
    store.setFetchingOnline(true);
    
    try {
      // Llamada al nuevo endpoint del backend que provee la lista consolidada
      const response = await fetchWithFallback('/ai/models/online');
      if (!response.ok) {
        throw new Error(`Error fetching online models: ${response.status}`);
      }

      const data = await response.json();
      
      // Expected backend response format: { data: [{ provider, modelId, capabilities, isAvailable }, ...] }
      if (!data || !Array.isArray(data.data)) {
        throw new Error('Invalid catalog format from backend');
      }

      const models: OnlineModel[] = data.data.map((item: any) => ({
        provider: item.provider,
        modelId: item.modelId,
        capabilities: item.capabilities || ['text'],
        isAvailable: Boolean(item.isAvailable), // Means discovery availability, NOT feature eligibility
      }));

      // Actualizamos el store (se persiste automáticamente para offline-first)
      store.setOnlineCatalog(models);
      console.log(`[CatalogService] Online catalog fetched: ${models.length} models`);
      
      return models;
    } catch (error) {
      console.warn('[CatalogService] Failed to fetch online catalog. Retaining previous state if available.', error);
      return null;
    } finally {
      store.setFetchingOnline(false);
    }
  }
}
