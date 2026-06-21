/**
 * sessionClearService.ts
 *
 * Limpia TODOS los datos de usuario almacenados localmente cuando se cierra sesión.
 * Garantiza que una cuenta nueva (o diferente) que inicie sesión en el mismo
 * dispositivo NO vea datos residuales de la sesión anterior.
 *
 * Capas limpiadas:
 *  1. MMKV — mazos locales, cartas, reviews pendientes, caché de API
 *  2. AsyncStorage — todas las claves de caché de la app
 *  3. SQLite — ya manejado por databaseService.clearAll()
 *  4. Filesystem — los archivos de audio ya están aislados por userId en subcarpetas
 *     (Threshold/audio/<userId>/), por lo que NO se borran: pertenecen al usuario
 *     y se preservan si vuelve a autenticarse.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Prefijos y claves MMKV que son globales al dispositivo (sin userId)
// y deben borrarse al cambiar de sesión.
const MMKV_KEYS_TO_DELETE = [
  // Mazos importados localmente
  'local:flashcard_decks',
  // Reviews offline pendientes
  'local_pending_reviews',
];

// Prefijos de claves MMKV que usan IDs dinámicos (deckId, subjectId, etc.)
// Se detectan enumerando todas las claves con startsWith.
const MMKV_PREFIXES_TO_DELETE = [
  'cache:',                // Cubre TODA la caché de MMKV (flashcards, settings, IA, chat_history)
  'api_cache_/',           // caché HTTP genérico del cliente
  'app:cache:',            // cachés de predicciones, GPA, etc.
];

// Claves AsyncStorage a borrar en logout (además de las que ya borra signOut)
const ASYNC_STORAGE_KEYS_TO_DELETE = [
  'app:cached_profile',
  'app:cache:predictions',
  'app:cache:semester_summary',
  'app:cache:global_gpa',
  'app:cache:grading_systems',
];

/**
 * Obtiene la instancia MMKV de la app (misma que usa localFlashcardService).
 * Usa require dinámico para evitar problemas de inicialización en tests.
 */
function getMMKV() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-mmkv').createMMKV();
  } catch {
    return null;
  }
}

/**
 * Limpia todos los datos MMKV del usuario actual.
 * Borra claves exactas + cualquier clave que empiece con un prefijo conocido.
 */
function clearMMKVUserData(): void {
  try {
    const mmkv = getMMKV();
    if (!mmkv) return;

    // 1. Borrar claves exactas conocidas
    for (const key of MMKV_KEYS_TO_DELETE) {
      try { mmkv.delete(key); } catch {}
    }

    // 2. Borrar claves dinámicas por prefijo
    const allKeys: string[] = mmkv.getAllKeys?.() ?? [];
    for (const key of allKeys) {
      for (const prefix of MMKV_PREFIXES_TO_DELETE) {
        if (key.startsWith(prefix)) {
          try { mmkv.delete(key); } catch {}
          break;
        }
      }
    }

    console.log('[SessionClear] ✅ MMKV limpiado correctamente');
  } catch (error) {
    console.warn('[SessionClear] Error limpiando MMKV:', error);
  }
}

/**
 * Limpia AsyncStorage: borra claves de caché conocidas.
 * Preserva preferencias de usuario no sensibles (idioma, etc.) que son
 * específicas del dispositivo, no de la cuenta.
 */
async function clearAsyncStorageUserData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(ASYNC_STORAGE_KEYS_TO_DELETE);

    // También borrar cualquier clave de caché de API que quede
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k =>
      k.startsWith('api_cache_/') || k.startsWith('app:cache:')
    );
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }

    console.log('[SessionClear] ✅ AsyncStorage limpiado correctamente');
  } catch (error) {
    console.warn('[SessionClear] Error limpiando AsyncStorage:', error);
  }
}

/**
 * Punto de entrada principal: limpia TODAS las capas de datos locales
 * de usuario. Debe llamarse ANTES de redirigir a /login.
 */
export async function clearAllUserData(): Promise<void> {
  // MMKV es síncrono — ejecutar primero
  clearMMKVUserData();
  // AsyncStorage es async
  await clearAsyncStorageUserData();
  console.log('[SessionClear] ✅ Todos los datos de usuario limpiados del dispositivo');
}
