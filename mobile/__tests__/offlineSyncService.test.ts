import { offlineSyncService } from '../src/services/offlineSyncService';
import * as client from '../src/services/api/client';

// Create a mock storage instance
const mockStorage = {
  getString: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

// Mock dependencies
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn(),
  createMMKV: jest.fn(() => mockStorage),
}));

jest.mock('../src/store/useDataStore', () => ({
  storage: mockStorage,
}));

jest.mock('../src/services/api/client', () => ({
  fetchWithFallback: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/documents/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, isDirectory: false, size: 0 }),
}));

describe('offlineSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    offlineSyncService.clearQueue(); // Ensure in-memory state is cleared
  });

  it('debería procesar la cola secuencialmente y mapear IDs (Scenario: Integridad de Relación)', async () => {
    // 1. Configurar cola inicial con 2 operaciones: Crear Mazo y Crear Tarjeta Hija
    const mockQueue = [
      {
        id: 'op1',
        method: 'POST',
        endpoint: '/flashcard-decks',
        entityType: 'flashcard_deck',
        payload: { id: 'temp_deck_1', title: 'Test Deck' },
        timestamp: Date.now(),
      },
      {
        id: 'op2',
        method: 'POST',
        endpoint: '/flashcard-decks/temp_deck_1/cards', // Usa el ID temporal en la URL
        entityType: 'flashcard',
        payload: { deck_id: 'temp_deck_1', front: 'Q1', back: 'A1' },
        timestamp: Date.now() + 1000,
      }
    ];

    (mockStorage.getString as jest.Mock).mockReturnValue(JSON.stringify(mockQueue));

    // 2. Configurar mock de fetchWithFallback para simular respuestas del backend
    (client.fetchWithFallback as jest.Mock).mockImplementation(async (url, options) => {
      if (url.includes('/flashcard-decks') && !url.includes('/cards')) {
        // Respuesta al crear el mazo (devuelve ID real: 999)
        return {
          ok: true,
          json: async () => ({ id: 999, message: 'Deck created' }),
        };
      }
      if (url.includes('/cards')) {
        // Respuesta al crear tarjeta
        return {
          ok: true,
          json: async () => ({ id: 1000, message: 'Card created' }),
        };
      }
      return { ok: false };
    });

    // 3. Ejecutar sincronización
    await offlineSyncService.syncPendingOperations(client.fetchWithFallback as any);

    // 4. Validar el mapeo
    expect(client.fetchWithFallback).toHaveBeenCalledTimes(2);

    // Primera llamada: Creación del mazo
    const firstCallArgs = (client.fetchWithFallback as jest.Mock).mock.calls[0];
    expect(firstCallArgs[0]).toBe('/flashcard-decks');

    // Segunda llamada: Creación de la tarjeta con URL actualizada
    const secondCallArgs = (client.fetchWithFallback as jest.Mock).mock.calls[1];
    expect(secondCallArgs[0]).toBe('/flashcard-decks/999/cards'); // ¡temp_deck_1 se reemplazó por 999!
    
    // Verificar que el payload de la segunda llamada también se haya actualizado
    const secondCallPayload = JSON.parse(secondCallArgs[1].body);
    expect(secondCallPayload.deck_id).toBe(999);
  });

  it('debería ser resiliente a fallas en medio de la sincronización (Scenario: Kill Switch)', async () => {
    const mockQueue = [
      { id: 'op1', method: 'POST', endpoint: '/test1', entityType: 'test', payload: {}, timestamp: 1 },
      { id: 'op2', method: 'POST', endpoint: '/test2', entityType: 'test', payload: {}, timestamp: 2 },
      { id: 'op3', method: 'POST', endpoint: '/test3', entityType: 'test', payload: {}, timestamp: 3 },
    ];

    (mockStorage.getString as jest.Mock).mockReturnValue(JSON.stringify(mockQueue));

    // Simular que la segunda operación falla simulando una caída de red o Kill Switch
    let callCount = 0;
    (client.fetchWithFallback as jest.Mock).mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Kill Switch - Simulación de cierre inesperado o pérdida de red');
      }
      return { ok: true, json: async () => ({ id: callCount * 100 }) };
    });

    // Ejecutar sincronización (debería fallar silenciosamente o registrar el error, deteniendo el procesamiento)
    try {
      await offlineSyncService.syncPendingOperations(client.fetchWithFallback as any);
    } catch (e) {
      // Ignorar
    }

    // El proceso debió llamarse 2 veces (la segunda falló)
    expect(client.fetchWithFallback).toHaveBeenCalledTimes(2);

    // Validar que el MMKV .set se llamó justo después de la primera operación para persistir la cola reducida atómicamente
    expect(mockStorage.set).toHaveBeenCalled();
    const setCalls = (mockStorage.set as jest.Mock).mock.calls;
    
    // La primera vez que se llamó a storage.set, debió guardar la cola SIN 'op1' pero CON 'op2' y 'op3'
    const savedQueueAfterOp1 = JSON.parse(setCalls[setCalls.length - 1][1]);
    expect(savedQueueAfterOp1.length).toBe(2);
    expect(savedQueueAfterOp1[0].id).toBe('op2'); // La siguiente en la cola es op2
  });
});
