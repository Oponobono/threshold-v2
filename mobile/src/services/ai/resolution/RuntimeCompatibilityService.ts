import { getDeviceCapabilities } from '../../../utils/deviceCapabilities';
import { type LocalModelCatalogEntry } from '../../../store/useAICatalogsStore';

/**
 * RuntimeCompatibilityService
 * 
 * Evalúa si un modelo GGUF específico puede ejecutarse en el dispositivo
 * en función de las capacidades físicas (RAM, Tier) del equipo.
 */
export class RuntimeCompatibilityService {
  /**
   * Determina si un modelo del catálogo local es compatible con el dispositivo.
   */
  static async isModelCompatible(model: LocalModelCatalogEntry): Promise<boolean> {
    const caps = await getDeviceCapabilities();
    if (!caps) return false;

    // TODO: En el futuro, el catálogo remoto podría enviar el requerimiento de memoria exacta.
    // Por ahora, integramos la validación con la lógica existente basada en el tier o familia.
    
    // Regla temporal de heurística si el catálogo remoto no especifica RAM:
    const totalRamGB = caps.totalRamGB;

    // Si el nombre del modelo contiene tamaños conocidos, aplicar restricciones:
    if (model.modelId.toLowerCase().includes('8b')) {
      return totalRamGB > 6;
    }
    if (model.modelId.toLowerCase().includes('3b')) {
      return totalRamGB >= 4;
    }
    if (model.modelId.toLowerCase().includes('1.5b') || model.modelId.toLowerCase().includes('2b')) {
      return totalRamGB >= 3;
    }

    // Fallback: usar la lista legada para retrocompatibilidad
    // (cast as any to bypass strict type checking against legacy model keys)
    if (caps.compatibleModels.includes(model.modelId as any)) {
      return true;
    }

    // Por defecto, permitimos modelos desconocidos pequeños si la RAM es >= 4GB
    return totalRamGB >= 4;
  }
}
