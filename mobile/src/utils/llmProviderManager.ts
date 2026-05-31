/**
 * llmProviderManager.ts
 *
 * Gestor de preferencias del proveedor de LLM (Groq, Gemini o Local).
 * Almacena y recupera la preferencia del usuario. Respeta forceOfflineMode.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalAIStore } from '../store/useLocalAIStore';

export type LLMProvider = 'groq' | 'gemini' | 'local';

const STORAGE_KEY = '@threshold_llm_provider';
const DEFAULT_PROVIDER: LLMProvider = 'groq';

/**
 * Obtiene el proveedor de LLM preferido del usuario
 */
export async function getPreferredLLMProvider(): Promise<LLMProvider> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === 'groq' || stored === 'gemini') {
      return stored;
    }
    return DEFAULT_PROVIDER;
  } catch (error) {
    console.warn('Error al obtener preferencia LLM:', error);
    return DEFAULT_PROVIDER;
  }
}

/**
 * Guarda la preferencia del proveedor de LLM
 */
export async function setPreferredLLMProvider(provider: LLMProvider): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, provider);
  } catch (error) {
    console.error('Error al guardar preferencia LLM:', error);
    throw error;
  }
}

/**
 * Resuelve el proveedor actual respetando forceOfflineMode.
 * Si el modo offline forzado está activo, retorna siempre 'local'.
 * De lo contrario, retorna la preferencia guardada o el default.
 */
export async function resolveProvider(): Promise<LLMProvider> {
  const offline = useLocalAIStore.getState().forceOfflineMode;
  if (offline) return 'local';
  return getPreferredLLMProvider();
}

export const LLM_PROVIDERS: Record<LLMProvider, {
  label: string;
  description: string;
  icon: string;
  advantages: string[];
  limits: string;
}> = {
  groq: {
    label: 'Groq',
    description: 'Mayor velocidad de respuesta',
    icon: '⚡',
    advantages: ['Respuestas más rápidas', 'Bajo costo', 'Ideal para chat rápido'],
    limits: 'Límite de 6000 TPM',
  },
  gemini: {
    label: 'Google Gemini',
    description: 'Mayor capacidad de procesamiento',
    icon: '🧠',
    advantages: ['Mayor capacidad de contexto', 'Mejor comprensión', 'Análisis más profundos'],
    limits: 'Límite según plan de Google',
  },
  local: {
    label: 'Local (on-device)',
    description: 'Sin conexión a internet',
    icon: '📱',
    advantages: ['Funciona sin internet', 'Privacidad total', 'Sin límites de uso'],
    limits: 'Requiere descarga de modelo (~2-3GB)',
  },
};

/**
 * Obtiene la URL del endpoint de chat basada en el proveedor
 */
export function getChatEndpoint(provider: LLMProvider): string {
  return `/ai/chat?provider=${provider}`;
}
