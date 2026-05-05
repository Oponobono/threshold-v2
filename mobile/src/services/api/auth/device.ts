import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { fetchWithFallback, parseJsonSafely } from '../client';

/**
 * Obtiene o crea un identificador único persistente para el dispositivo
 */
export const getDeviceId = async (): Promise<string> => {
  try {
    let storedId: string | null = null;
    if (Platform.OS === 'web') {
      storedId = localStorage.getItem('app_device_id');
    } else {
      storedId = await SecureStore.getItemAsync('app_device_id');
    }

    if (!storedId) {
      const newId = Crypto.randomUUID();
      if (Platform.OS === 'web') {
        localStorage.setItem('app_device_id', newId);
      } else {
        await SecureStore.setItemAsync('app_device_id', newId);
      }
      return newId;
    }
    return storedId;
  } catch (error) {
    console.error('Error accediendo al Device ID:', error);
    return 'unknown-device';
  }
};

/**
 * Rastrea la visita de un usuario invitado
 */
export const trackGuestVisit = async () => {
  try {
    const { DEFAULT_LAN_IP } = require('../client');
    // En dispositivo físico, 127.0.0.1 apunta al propio celular y no al backend de la PC.
    if (Platform.OS !== 'web' && DEFAULT_LAN_IP === '127.0.0.1') {
      return { skipped: true };
    }

    const deviceId = await getDeviceId();

    const response = await fetchWithFallback('/track-guest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_id: deviceId }),
    });

    const data = await parseJsonSafely(response);
    return data;
  } catch (error) {
    return { skipped: true };
  }
};
