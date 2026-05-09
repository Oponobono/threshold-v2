import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Servicio Centralizado de Almacenamiento (Fase 5 de Seguridad)
 * 
 * Abstrae la complejidad de decidir qué capa de almacenamiento usar.
 * - SecureStore: Para datos sensibles (Tokens, Contraseñas) [Cifrado por Hardware/Keychain]
 * - AsyncStorage: Para datos NO sensibles (Preferencias, Tema, Caché) [Texto Plano]
 */
export const storageService = {
  // ==========================================
  // 🛡️ ALMACENAMIENTO SEGURO (SecureStore)
  // ==========================================

  saveSecure: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`[SecureStore] Error guardando ${key}:`, error);
    }
  },

  getSecure: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`[SecureStore] Error leyendo ${key}:`, error);
      return null;
    }
  },

  removeSecure: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`[SecureStore] Error eliminando ${key}:`, error);
    }
  },

  // ==========================================
  // 📁 ALMACENAMIENTO LOCAL (AsyncStorage)
  // ==========================================

  saveLocal: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`[AsyncStorage] Error guardando ${key}:`, error);
    }
  },

  getLocal: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`[AsyncStorage] Error leyendo ${key}:`, error);
      return null;
    }
  },

  removeLocal: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`[AsyncStorage] Error eliminando ${key}:`, error);
    }
  }
};
