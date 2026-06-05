import React, { createContext, useEffect, useState, useContext } from 'react';
import { initializeDatabase } from '../services/database/appInit';

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

/**
 * DatabaseProvider - Gates app rendering until SQLite is initialized
 * Prevents race condition where components mount before db.open() completes
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    async function bootstrap() {
      try {
        console.log('[DatabaseProvider] Inicializando BD local...');
        await initializeDatabase();
        console.log('[DatabaseProvider] BD lista ✅');
        setIsReady(true);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[DatabaseProvider] Error inicializando BD:', error.message);
        setError(error);
        
        // Reintentar después de 2 segundos, máx 3 intentos
        if (retryCount < 3) {
          setTimeout(() => {
            console.log(`[DatabaseProvider] Reintentando (${retryCount + 1}/3)...`);
            setRetryCount(prev => prev + 1);
          }, 2000);
        }
      }
    }

    bootstrap();
  }, [retryCount]);

  // Gate rendering until database is ready
  if (!isReady) return null;

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
