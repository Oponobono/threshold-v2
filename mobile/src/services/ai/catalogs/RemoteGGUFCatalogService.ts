import { fetchWithFallback } from '../../api/client';

export interface RemoteLocalModel {
  modelId: string;
  familyId: string;
  quantization: string;
  downloadUrl: string;
  capabilities: string[];
}

/**
 * RemoteGGUFCatalogService
 * 
 * Fetches the definition of available GGUF models from a remote JSON catalog.
 * This acts as the source of truth for what models *exist* and *can be downloaded*,
 * not what is currently installed.
 */
export class RemoteGGUFCatalogService {
  /**
   * Obtiene el JSON estático del catálogo GGUF (que podría estar alojado en S3, 
   * GitHub Pages, o nuestro propio backend).
   */
  static async fetchRemoteCatalog(): Promise<RemoteLocalModel[] | null> {
    try {
      // Nota: Asumimos que el backend tiene un endpoint /api/ai/models/gguf_catalog
      // O un archivo estático accesible. Ajustaremos la ruta según el entorno final.
      const response = await fetchWithFallback('/ai/models/gguf_catalog');
      if (!response.ok) {
        throw new Error(`Error fetching GGUF catalog: ${response.status}`);
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
      console.warn('[CatalogService] Failed to fetch remote GGUF catalog.', error);
      return null; // El merge service decidirá si usa el caché anterior
    }
  }
}
