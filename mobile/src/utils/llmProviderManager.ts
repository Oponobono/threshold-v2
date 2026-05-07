/**
 * llmProviderManager.ts
 *
 * Gestor de preferencias del proveedor de LLM (Groq o Gemini).
 * Almacena y recupera la preferencia del usuario.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LLMProvider = 'groq' | 'gemini';

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
 * Obtiene información descriptiva sobre cada proveedor
 */
export const LLM_PROVIDERS = {
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
};

/**
 * Obtiene la URL del endpoint de chat basada en el proveedor
 */
export function getChatEndpoint(provider: LLMProvider): string {
  return `/ai/chat?provider=${provider}`;
}
