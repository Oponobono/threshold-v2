import { type AIModelPreference } from '../../../store/useAISettingsStore';
import { useAICatalogsStore, type LocalModelCatalogEntry } from '../../../store/useAICatalogsStore';
import { RuntimeCompatibilityService } from './RuntimeCompatibilityService';
import { type ResolvedModelState, type ResolutionReason } from './types';

export class LocalModelResolver {
  /**
   * Resuelve qué modelo GGUF utilizar basado en la preferencia del usuario,
   * el catálogo local, las capabilities solicitadas y la memoria del dispositivo.
   */
  static async resolveModel(
    preference: AIModelPreference,
    requiredCapability: string = 'text'
  ): Promise<ResolvedModelState> {
    const store = useAICatalogsStore.getState();
    const catalog = store.localCatalog;
    
    const requestedModelId = preference.mode === 'manual' ? preference.modelId : null;

    // Step 1: Si hay requestedModelId explícito, validarlo primero.
    if (requestedModelId) {
      const candidate = catalog.find(m => m.modelId === requestedModelId);
      
      if (!candidate || !candidate.isInstalled) {
        return this.findFallback(catalog, requestedModelId, 'model_unavailable', requiredCapability);
      }

      if (!candidate.capabilities.includes(requiredCapability)) {
        return this.findFallback(catalog, requestedModelId, 'capability_mismatch', requiredCapability);
      }

      const isCompatible = await RuntimeCompatibilityService.isModelCompatible(candidate);
      if (!isCompatible) {
        return this.findFallback(catalog, requestedModelId, 'runtime_incompatible', requiredCapability);
      }

      return {
        requestedModelId,
        resolvedModelId: requestedModelId,
        wasFallback: false,
        reason: 'requested'
      };
    }

    // Step 2: Modo Auto
    // Modo auto no tiene un "requestedModelId". Tratamos de encontrar el primer modelo elegible.
    return this.findFallback(catalog, null, 'requested', requiredCapability);
  }

  /**
   * Encuentra el primer modelo elegible en el catálogo.
   * "Elegible" = está instalado + cumple capability + es runtime compatible.
   */
  private static async findFallback(
    catalog: LocalModelCatalogEntry[],
    requestedModelId: string | null,
    reason: ResolutionReason,
    requiredCapability: string
  ): Promise<ResolvedModelState> {
    // Buscar iterativamente el primero elegible.
    for (const model of catalog) {
      if (!model.isInstalled) continue;
      if (!model.capabilities.includes(requiredCapability)) continue;
      
      const isCompatible = await RuntimeCompatibilityService.isModelCompatible(model);
      if (isCompatible) {
        return {
          requestedModelId,
          resolvedModelId: model.modelId,
          wasFallback: requestedModelId !== null, // Es fallback solo si pidieron manual y falló
          reason: requestedModelId !== null ? reason : 'requested'
        };
      }
    }

    // Si llegamos aquí, no hay ningún modelo elegible instalado.
    // Retornamos un estado con 'model_unavailable' para que la capa superior (UI/Interceptor)
    // lance un error amigable pidiendo que el usuario descargue un modelo.
    return {
      requestedModelId,
      resolvedModelId: '', // Vacío indicando fallo total local
      wasFallback: requestedModelId !== null,
      reason: 'model_unavailable'
    };
  }
}
