# ⚡ PLAN DE ACCIÓN INMEDIATO - PRÓXIMAS 24 HORAS

**Objetivo:** Arreglar los 3 bloqueos críticos para permitir Fase 6  
**Prioridad:** P0 (BLOCKER)  
**Tiempo estimado:** 4-6 horas

---

## TAREA 1️⃣: Sincronizar UUID Generation (1 hora)

### El Problema
```
❌ Backend genera UUID con uuidv4()
❌ Cliente genera UUID con expo-crypto.randomUUID() (puede ser UUID1)
→ IDs no coinciden después de POST
```

### Solución A: Usar misma librería en ambos lados

**Backend `backend/database/postgres.js`:**
```javascript
const { v4: uuidv4 } = require('uuid');

async function insertUser(userData) {
  const userId = userData.id || uuidv4();
  // ...
}
```

**Backend `backend/database/sqlite.js`:**
```javascript
const { v4: uuidv4 } = require('uuid');

function seedUser(db, userData) {
  const userId = userData.id || uuidv4();
  // ...
}
```

**Cliente `mobile/src/utils/uuid.ts` - CREAR NUEVO ARCHIVO:**
```typescript
import { v4 as uuidv4 } from 'uuid';

/**
 * Genera UUID v4 compatible con backend
 * IMPORTANTE: Debe ser EXACTAMENTE IGUAL a uuidv4() del backend
 */
export function generateUUID(): string {
  return uuidv4();
}

export function isValidUUID(id: string): boolean {
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return UUID_V4_REGEX.test(id);
}
```

**Actualizar migraciones en cliente `mobile/src/services/database/migrations.ts`:**
```typescript
import { generateUUID } from '../../utils/uuid';

const migrations: Migration[] = [
  {
    version: 1,
    up: [
      // ... tablas ...
      // En lugar de generar IDs al insertar, el cliente
      // debe RECIBIR IDs del servidor en GET requests
      // Los IDs locales solo se generan en CREATE offline
    ]
  }
];
```

**Actualizar servicios API - VERIFICAR:**
```typescript
// mobile/src/services/api/subjects.ts
import { generateUUID, isValidUUID } from '../../utils/uuid';

export async function createSubject(subject: SubjectInput): Promise<Subject> {
  // Generar ID si no existe
  const id = subject.id || generateUUID();
  
  // Validar
  if (!isValidUUID(id)) {
    throw new Error(`Invalid UUID: ${id}`);
  }
  
  const payload = { ...subject, id };
  
  try {
    const response = await fetchWithFallback('/api/subjects', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return response.json();
  } catch (error) {
    // Offline: guardar en repositorio + encolar
    await subjectRepository.create(payload);
    await syncService.enqueueCreate('subject', payload);
    return payload;
  }
}
```

### ✅ Verificación
```bash
# Terminal Backend
node -e "const {v4} = require('uuid'); console.log(v4());"
# Output: 550e8400-e29b-41d4-a716-446655440000

# Terminal Metro (cliente)
npm run test:uuid
# Output: Debe ser formato igual
```

---

## TAREA 2️⃣: Fix Race Condition appInit (1.5 horas)

### El Problema
```
Timeline:
T0: App inicia _layout.tsx
T1: useEffect llama appInit.ts
T2: appInit() abre DatabaseService (async)
T3: ANTES de que T2 complete...
T4: Componente monta y llama useDataStore
T5: useDataStore intenta leer SQLite pero DB no está abierto
→ CRASH
```

### Solución: Agregar Loading Gate

**Crear: `mobile/src/context/DatabaseContext.tsx` - NUEVO**
```typescript
import React, { createContext, useEffect, useState } from 'react';
import { appInit } from '../services/database/appInit';

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
}

export const DatabaseContext = createContext<DatabaseContextType>({
  isReady: false,
  error: null,
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        console.log('[DatabaseProvider] Inicializando BD local...');
        await appInit();
        console.log('[DatabaseProvider] BD lista ✅');
        setIsReady(true);
      } catch (err) {
        console.error('[DatabaseProvider] Error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        // Retry después de 2 segundos
        setTimeout(() => bootstrap(), 2000);
      }
    }

    bootstrap();
  }, []);

  return (
    <DatabaseContext.Provider value={{ isReady, error }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabaseReady() {
  const context = React.useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabaseReady debe usarse dentro de DatabaseProvider');
  }
  return context;
}
```

**Actualizar: `mobile/app/_layout.tsx`**
```typescript
import { DatabaseProvider, useDatabaseReady } from '../src/context/DatabaseContext';
import * as SplashScreen from 'expo-splash-screen';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <RootNavigator />
    </DatabaseProvider>
  );
}

function RootNavigator() {
  const { isReady, error } = useDatabaseReady();

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return <SplashScreen />; // Mantener splash hasta que BD esté lista
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error inicializando base de datos</Text>
        <Text>{error.message}</Text>
      </View>
    );
  }

  return <NavigationStack />;
}
```

**Actualizar: `mobile/src/services/database/appInit.ts`**
```typescript
export async function appInit() {
  try {
    const db = DatabaseService.getInstance();
    
    // 1. Abrir BD
    await db.open();
    console.log('[appInit] Database opened');
    
    // 2. Registrar handler de sincronización
    const syncService = SyncService.getInstance();
    syncService.onSync(async (operations) => {
      for (const op of operations) {
        try {
          await fetchWithFallback(
            `/api/${op.entity_type}`,
            {
              method: op.operation.toUpperCase(),
              body: JSON.stringify(op.payload)
            }
          );
        } catch (error) {
          console.warn(`[appInit] Sync failed for ${op.entity_type}:`, error);
        }
      }
    });
    
    // 3. Hacer primer sync (no bloquea, se hace en background)
    syncService.sync().catch(err => 
      console.warn('[appInit] Initial sync failed:', err)
    );
    
  } catch (error) {
    console.error('[appInit] Fatal error:', error);
    throw error;
  }
}
```

### ✅ Verificación
```typescript
// Debería ver logs en orden:
// [DatabaseProvider] Inicializando BD local...
// [appInit] Database opened
// [DatabaseProvider] BD lista ✅
```

---

## TAREA 3️⃣: Agregar Conflict Resolution a SyncService (1.5 horas)

### El Problema
```
Escenario multi-dispositivo:
Device A:     Device B:
Login         Login
Create X      Create X (mismo nombre, distinto UUID)
   ↓             ↓
  Sync        Sync
   ↓             ↓
  Backend ← ¿Quién gana?
```

### Solución: Last-Write-Wins Strategy

**Actualizar: `mobile/src/services/database/SyncService.ts`**
```typescript
import { SyncQueueRepository } from './repositories/SyncQueueRepository';

type ConflictStrategy = 'last-write-wins' | 'client-wins' | 'server-wins';

export class SyncService {
  private static instance: SyncService;
  private isSyncing = false;
  private syncHandlers: Array<(ops: any[]) => Promise<void>> = [];
  private conflictStrategy: ConflictStrategy = 'last-write-wins';

  private constructor() {}

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  onSync(handler: (ops: any[]) => Promise<void>) {
    this.syncHandlers.push(handler);
  }

  async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const syncQueueRepo = new SyncQueueRepository();
      const pending = await syncQueueRepo.getPending();

      if (pending.length === 0) {
        return;
      }

      await syncQueueRepo.markProcessing(pending.map(p => p.id));

      for (const operation of pending) {
        try {
          await this.processOperation(operation);
          await syncQueueRepo.markCompleted(operation.id);
        } catch (error) {
          console.error(`[SyncService] Error syncing ${operation.id}:`, error);
          await syncQueueRepo.markFailed(operation.id, String(error));
          
          // Re-throw para trigger retry lógic
          throw error;
        }
      }

      // Notificar handlers
      await Promise.all(
        this.syncHandlers.map(handler => handler(pending))
      );
    } finally {
      this.isSyncing = false;
    }
  }

  private async processOperation(operation: any) {
    const { entity_type, entity_id, operation: op, payload } = operation;

    switch (op.toUpperCase()) {
      case 'CREATE':
        return this.handleCreate(entity_type, payload);
      case 'UPDATE':
        return this.handleUpdate(entity_type, entity_id, payload);
      case 'DELETE':
        return this.handleDelete(entity_type, entity_id);
      default:
        throw new Error(`Unknown operation: ${op}`);
    }
  }

  private async handleCreate(entityType: string, payload: any) {
    const response = await fetchWithFallback(`/api/${entityType}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Creation failed');
    }

    return response.json();
  }

  private async handleUpdate(entityType: string, entityId: string, payload: any) {
    // ← AQUÍ AGREGAR CONFLICT DETECTION
    const response = await fetchWithFallback(`/api/${entityType}/${entityId}`, {
      method: 'GET'
    });

    const remoteData = await response.json();
    
    // Detectar conflicto: si updated_at remoto es más reciente
    if (remoteData.updated_at > payload.updated_at) {
      console.warn(
        `[SyncService] Conflict detected for ${entityType}/${entityId}`,
        `Remote: ${remoteData.updated_at} > Local: ${payload.updated_at}`
      );

      // Aplicar estrategia
      const resolved = this.resolveConflict(
        payload,
        remoteData,
        this.conflictStrategy
      );

      if (resolved === remoteData) {
        console.warn('[SyncService] Keeping remote data (newer)');
        return remoteData; // No hacer UPDATE
      }
    }

    // Si no hay conflicto, hacer UPDATE normal
    const updateResponse = await fetchWithFallback(`/api/${entityType}/${entityId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (!updateResponse.ok) {
      throw new Error('Update failed');
    }

    return updateResponse.json();
  }

  private async handleDelete(entityType: string, entityId: string) {
    const response = await fetchWithFallback(`/api/${entityType}/${entityId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Delete failed');
    }

    return response.json();
  }

  private resolveConflict(
    local: any,
    remote: any,
    strategy: ConflictStrategy
  ): any {
    switch (strategy) {
      case 'last-write-wins': {
        const localTime = new Date(local.updated_at || 0).getTime();
        const remoteTime = new Date(remote.updated_at || 0).getTime();
        return remoteTime > localTime ? remote : local;
      }
      case 'client-wins':
        return local;
      case 'server-wins':
        return remote;
      default:
        return remote; // Default
    }
  }

  enqueueCreate(entityType: string, payload: any) {
    const syncQueueRepo = new SyncQueueRepository();
    return syncQueueRepo.enqueue({
      entity_type: entityType,
      entity_id: payload.id,
      operation: 'CREATE',
      payload,
      status: 'pending'
    });
  }

  enqueueUpdate(entityType: string, entityId: string, payload: any) {
    const syncQueueRepo = new SyncQueueRepository();
    return syncQueueRepo.enqueue({
      entity_type: entityType,
      entity_id: entityId,
      operation: 'UPDATE',
      payload,
      status: 'pending'
    });
  }

  enqueueDelete(entityType: string, entityId: string) {
    const syncQueueRepo = new SyncQueueRepository();
    return syncQueueRepo.enqueue({
      entity_type: entityType,
      entity_id: entityId,
      operation: 'DELETE',
      payload: { id: entityId },
      status: 'pending'
    });
  }
}
```

### ✅ Verificación
```bash
# Crear 2 subjects con mismo nombre simultáneamente
# El que tenga updated_at más reciente debe ganar
# Verificar en console logs: "Conflict detected"
```

---

## TAREA 4️⃣: Completar UserRepository (30 min)

**Crear: `mobile/src/services/database/repositories/UserRepository.ts`**
```typescript
import { BaseRepository } from '../BaseRepository';
import { DatabaseService } from '../DatabaseService';

interface User {
  id: string; // UUID
  email: string;
  name?: string;
  token: string;
  refreshToken?: string;
  profile_image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users', DatabaseService.getInstance());
  }

  async getCurrentUser(): Promise<User | undefined> {
    // En contexto real, obtener de auth context
    return this.getAll().then(users => users[0]); // Por simplicidad
  }

  async updateToken(userId: string, token: string, refreshToken: string) {
    return this.update(userId, { token, refreshToken });
  }
}
```

**Crear tabla en migraciones `mobile/src/services/database/migrations.ts`:**
```typescript
`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  token TEXT NOT NULL,
  refresh_token TEXT,
  profile_image_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`,
```

---

## ⏱️ TIMELINE

| Hora | Tarea | Status |
|------|-------|--------|
| 0:00 | UUID Generation sync | START |
| 1:00 | Race Condition Fix | START |
| 2:30 | Conflict Resolution | START |
| 4:00 | UserRepository | START |
| 4:30 | Testing & Verification | START |
| 5:00 | ✅ DONE |

---

## ✅ CHECKLIST FINAL

- [ ] UUID generation es idéntico backend/cliente
- [ ] DatabaseProvider previene race conditions
- [ ] SyncService tiene conflict resolution
- [ ] UserRepository creado
- [ ] Pruebas:
  - [ ] Login genera UUID correcto
  - [ ] Offline sync no crashea
  - [ ] Conflictos se resuelven (last-write-wins)
  - [ ] Multi-dispositivo mantiene consistencia

---

**Una vez completado → Proceder a Fase 6 (Verificación Cliente-Servidor)**



---
**Tags:** #logs
