/**
 * mmkvStorage.ts
 *
 * Motor de almacenamiento ultra rápido basado en react-native-mmkv (C++ / JSI).
 * Reemplaza AsyncStorage para operaciones síncronas que se completan en < 0.1ms,
 * eliminando el tiempo de espera del "puente" nativo en cada lectura de datos locales.
 *
 * Exporta:
 *  - `zustandMMKVStorage` → Adaptador compatible con el middleware `persist` de Zustand.
 *  - `appStorage`         → API genérica para el resto de la app (servicios, hooks, etc.).
 */

import { MMKV } from 'react-native-mmkv';

// Instancia única compartida por toda la app
const storage = new MMKV({ id: 'threshold-core-storage' });

// ─────────────────────────────────────────────────────────────────────────────
// Adaptador para Zustand Persist
// Compatible con la interfaz StateStorage de zustand/middleware
// ─────────────────────────────────────────────────────────────────────────────
export const zustandMMKVStorage = {
  setItem: (name: string, value: string): void => {
    storage.set(name, value);
  },
  getItem: (name: string): string | null => {
    return storage.getString(name) ?? null;
  },
  removeItem: (name: string): void => {
    storage.delete(name);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// API genérica para el resto de la app
// ─────────────────────────────────────────────────────────────────────────────
export const appStorage = {
  /** Guarda un string */
  set: (key: string, value: string): void => {
    storage.set(key, value);
  },

  /** Lee un string, o null si no existe */
  get: (key: string): string | null => {
    return storage.getString(key) ?? null;
  },

  /** Guarda cualquier objeto serializable como JSON */
  setObject: <T>(key: string, value: T): void => {
    storage.set(key, JSON.stringify(value));
  },

  /** Lee y deserializa un objeto, o null si no existe */
  getObject: <T>(key: string): T | null => {
    const raw = storage.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  /** Guarda un booleano */
  setBoolean: (key: string, value: boolean): void => {
    storage.set(key, value);
  },

  /** Lee un booleano, o null si no existe */
  getBoolean: (key: string): boolean | null => {
    return storage.getBoolean(key) ?? null;
  },

  /** Elimina una clave */
  delete: (key: string): void => {
    storage.delete(key);
  },

  /** Comprueba si una clave existe */
  contains: (key: string): boolean => {
    return storage.contains(key);
  },

  /** Limpia todo el almacenamiento (usar con precaución) */
  clearAll: (): void => {
    storage.clearAll();
  },
};
