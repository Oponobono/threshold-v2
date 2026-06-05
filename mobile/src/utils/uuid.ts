import * as Crypto from 'expo-crypto';

/**
 * Genera UUID v4 compatible con backend
 * IMPORTANTE: Debe ser EXACTAMENTE IGUAL al backend (uuidv4() de npm uuid)
 */
export const uuidv4 = (): string => Crypto.randomUUID();

/**
 * Valida que un string sea un UUID v4 válido
 * Formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * Donde y es [8, 9, a, b]
 */
export function isValidUUID(id: string): boolean {
  if (typeof id !== 'string') return false;
  
  // Regex para UUID v4
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return UUID_V4_REGEX.test(id);
}

/**
 * Valida que un ID sea válido (UUID o null/undefined)
 * Usado antes de encolamiento de sincronización
 */
export function validateEntityId(id: string | undefined | null): boolean {
  if (!id) return true; // IDs opcionales son válidos
  return isValidUUID(id);
}

/**
 * Genera UUID o usa el proporcionado si es válido
 */
export function generateOrValidateUUID(maybeUUID?: string): string {
  if (maybeUUID) {
    if (isValidUUID(maybeUUID)) {
      return maybeUUID;
    }
    console.warn(`[UUID] UUID inválido proporcionado: ${maybeUUID}, generando nuevo`);
  }
  return uuidv4();
}

