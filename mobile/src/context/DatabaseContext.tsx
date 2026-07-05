import React, { createContext, useEffect, useState, useContext } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { initializeDatabase } from '../services/database/appInit';

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

const BOOTSTRAP_TIMEOUT_MS = 10000;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
});

function LoadingScreen({ phase }: { phase: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90D9" />
      <Text style={styles.text}>Inicializando... {phase}</Text>
    </View>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.errorTitle}>Error de inicialización</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <Text style={styles.text}>Reinicia la aplicación para intentarlo de nuevo</Text>
    </View>
  );
}

/**
 * DatabaseProvider - Gates app rendering until SQLite is initialized
 * Prevents race condition where components mount before db.open() completes
 * Shows a loading screen instead of null to prevent white screen
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  console.log('[BOOT 01a] DatabaseProvider mounted');
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function bootstrap() {
      try {
        console.log('[BOOT 02] DatabaseProvider: calling initializeDatabase()...');
        setCurrentPhase('Base de datos');

        // Timeout to prevent infinite hang
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Bootstrap timed out after ${BOOTSTRAP_TIMEOUT_MS}ms`));
          }, BOOTSTRAP_TIMEOUT_MS);
        });

        await Promise.race([
          initializeDatabase(),
          timeoutPromise,
        ]);

        if (timeoutId) clearTimeout(timeoutId);
        if (cancelled) return;

        console.log('[DatabaseProvider] BD lista ✅');
        setCurrentPhase('');
        setIsReady(true);
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        if (cancelled) return;

        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[DatabaseProvider] Error inicializando BD:', error.message);
        setError(error);

        // Reintentar después de 2 segundos, máx 3 intentos
        if (retryCount < 3) {
          setTimeout(() => {
            console.log(`[DatabaseProvider] Reintentando (${retryCount + 1}/3)...`);
            setCurrentPhase(`Reintento ${retryCount + 1}/3`);
            setRetryCount(prev => prev + 1);
          }, 2000);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [retryCount]);

  // Failed after retries — show error screen instead of loading forever
  if (!isReady && error && retryCount >= 3) {
    return <ErrorScreen message={error.message} />;
  }

  // Show loading screen instead of null to prevent white screen
  if (!isReady) {
    return <LoadingScreen phase={currentPhase} />;
  }

  return (
    <DatabaseContext.Provider value={{ isReady, error }}>
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * Hook para verificar si la BD está lista
 */
export function useDatabaseReady() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabaseReady debe usarse dentro de DatabaseProvider');
  }
  return context;
}
