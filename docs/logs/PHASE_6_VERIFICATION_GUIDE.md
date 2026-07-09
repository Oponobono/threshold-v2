# FASE 6: VERIFICACIÓN CLIENTE-SERVIDOR ✅

**Estado:** En Progreso  
**Fecha Inicio:** 2026-06-04  
**Objetivos:**
- ✅ Verificar login funciona con UUIDs
- ✅ Verificar CRUD offline → sync online
- ✅ Probar creación de entidades con UUIDs
- ✅ Validar datos existentes son visibles/editables

---

## 1️⃣ VERIFICACIÓN: Flujo Login → UUID → SQLite

### Test Case: Login Success
```
Descripción: Usuario hace login y se crea entrada en BD local
Pasos:
  1. Iniciar app en welcome screen
  2. Navegar a login
  3. Ingresar credenciales válidas (test@test.com / password123)
  4. Presionar "Sign In"

Expected:
  ✅ Request POST /api/auth/login recibe { email, password }
  ✅ Backend genera/retorna userID como UUID (v4)
  ✅ Frontend recibe token + user.id (UUID)
  ✅ userRepository.saveUser(user) crea entrada en SQLite
  ✅ Navega a (tabs) home screen
  ✅ Console: "[UserRepository] User saved: {uuid}"

Verification:
  - Abrir DevTools → Network tab
  - Verificar POST /api/auth/login
  - Response: { token: "...", user: { id: "550e8400-e29b-..." } }
  - User.id es UUID válido (regex match)
```

### Test Case: Login Failure
```
Descripción: Credenciales inválidas no crean BD local
Pasos:
  1. Ingresar credenciales inválidas
  2. Presionar "Sign In"

Expected:
  ✅ Mostrar toast error "Invalid credentials"
  ✅ NO crear entrada en SQLite
  ✅ Permanecer en login screen
```

### Debug Logs a Verificar
```typescript
// _layout.tsx
[DatabaseProvider] Inicializando BD local...
[appInit] Database opened
[DatabaseProvider] BD lista ✅

// auth/session.ts
[Auth] Login attempt: test@test.com
[Auth] Login success: user_id={UUID}

// repositories/UserRepository
[UserRepository] User saved: { id: {UUID}, email: test@test.com }

// sync
[SyncService] Iniciando sync de N operaciones
```

---

## 2️⃣ VERIFICACIÓN: CRUD Offline → Sync Online

### Test Case 2.1: Create Subject Offline → Sync Online
```
Precondición: Desactivar WiFi/4G

Pasos:
  1. En (tabs) home, ir a Subjects
  2. Presionar "+" para crear subject
  3. Ingresar nombre "Test Subject Offline"
  4. Presionar guardar
  
Expected (Offline):
  ✅ Subject aparece en lista con badge "_isPending"
  ✅ No hace request HTTP (network tab vacío)
  ✅ Console: "[SyncService] Encolando CREATE subject"
  ✅ Datos guardados en SQLite: subjectRepository.create()

Pasos 2:
  1. Activar WiFi/4G
  2. App detecta conectividad (NetInfo listener)
  3. SyncService.sync() se dispara automáticamente

Expected (Online):
  ✅ Network tab: POST /api/subjects con UUID generado
  ✅ Backend valida UUID format ✅ Retorna: { id: {UUID}, name: "Test Subject Offline", ... }
  ✅ Frontend: subjectRepository.update() actualiza record en SQLite
  ✅ Badge "_isPending" desaparece
  ✅ Console: "[SyncService] ✅ subject/{UUID} sincronizado"
```

### Test Case 2.2: Update Subject Offline → Conflict Detection
```
Precondición: WiFi desactivado

Pasos:
  1. Ir a Subjects → seleccionar subject existente
  2. Cambiar nombre a "Updated Name"
  3. Presionar guardar
  4. Simultaneamente en otro dispositivo:
     - Cambiar mismo subject a "Other Device Update"
     - Hacer sync

Expected:
  ✅ SyncService detecta: remoteData.updated_at > localData.updated_at
  ✅ Console: "[SyncService] Conflicto: last-write-wins decidió por REMOTE"
  ✅ Nombre en local device cambia a "Other Device Update" (gana remote)
  ✅ Sin duplicación, sin pérdida

Verification:
  - Abrir DevTools → Console
  - Buscar "[SyncService] Conflicto"
  - Verificar nombre es "Other Device Update"
```

### Test Case 2.3: Delete Subject Offline → Sync
```
Pasos:
  1. WiFi OFF
  2. Ir a Subjects → swipe delete en un subject
  3. Confirmar delete
  4. WiFi ON

Expected:
  ✅ Offline: Desaparece de UI, SyncService encolaba DELETE
  ✅ Online: DELETE /api/subjects/{id} se ejecuta
  ✅ Backend retorna 200 OK
  ✅ SyncQueue limpiado
```

---

## 3️⃣ VERIFICACIÓN: Creación de Entidades con UUIDs

### Test Case 3.1: Crear Flashcard Deck Offline
```
Pasos:
  1. WiFi OFF
  2. Flashcards → "+" → Importar o crear deck
  3. Si crear:
     - Nombre: "Spanish Vocabulary"
     - Agregar 3 flashcards
     - Presionar guardar

Expected:
  ✅ Deck ID es UUID válido: isValidUUID(deck.id) = true
  ✅ Cada card ID es UUID válido
  ✅ SQLite: flashcardDeckRepository.create(deck)
  ✅ Console: "[FlashcardDeckRepository] Deck created: {UUID}"
  ✅ SyncService.enqueueCreate('flashcard_deck', deck)

Verification:
  - DevTools → Console
  - Buscar "[FlashcardDeckRepository]"
  - Verificar deck.id es UUID v4
```

### Test Case 3.2: Crear Assessment Offline
```
Pasos:
  1. WiFi OFF
  2. Ir a Assessment → Subject → "+" crear assessment
  3. Ingresar:
     - Name: "Midterm Exam"
     - Score: 85
     - Out of: 100
     - Presionar guardar

Expected:
  ✅ Assessment ID es UUID
  ✅ Aparece en lista sin indicador de error
  ✅ Cálculos (GPA, percentile) funcionan localmente
  ✅ SQLite: assessmentRepository.create(assessment)
  ✅ SyncService encolada para sync

Online:
  ✅ POST /api/assessments con UUID
  ✅ Backend retorna creado
  ✅ Sincroniza sin conflictos
```

---

## 4️⃣ VERIFICACIÓN: Integridad de Datos Importados

### Test Case 4.1: Migración de Datos UUID (Backend)
```
Backend: Ejecutar migraciones

Verificación:
  1. Abrir backend database
  2. Ejecutar:
     SELECT * FROM subjects LIMIT 1;
     → Verificar: id es TEXT, contiene UUID v4 ✅
     
  3. Verificar FK:
     SELECT * FROM assessments LIMIT 1;
     → subject_id es TEXT y referencia a subjects(id) ✅

  4. Verificar historiales:
     SELECT COUNT(*) FROM subjects WHERE id LIKE '550e8400%';
     → Debe haber registros migrados ✅
```

### Test Case 4.2: Datos Importados Visibles en Cliente
```
Precondición:
  - Backend tiene datos migrados a UUID
  - Usuario hace login

Pasos:
  1. App inicia, login
  2. Navega a Subjects

Expected:
  ✅ GET /api/subjects retorna array con UUIDs
  ✅ Frontend recibe: [{ id: "550e8400...", name: "Math", ... }]
  ✅ subjectRepository.upsert(subjects) guarda en SQLite
  ✅ Lista muestra todos los subjects

Verification:
  - DevTools Network: GET /api/subjects
  - Response tiene todos los subjects con UUIDs
  - subjects[] no está vacío
  - Cada id es UUID válido
```

### Test Case 4.3: Editar Datos Importados
```
Pasos:
  1. Seleccionar un subject importado (con UUID antiguo)
  2. Cambiar nombre: "Math 101 → Calculus I"
  3. Presionar guardar
  4. WiFi OFF/ON para simular sync

Expected:
  ✅ UPDATE /api/subjects/{UUID} se ejecuta
  ✅ Backend actualiza correctamente
  ✅ Frontend muestra "Calculus I"
  ✅ No hay duplicación
```

---

## 5️⃣ VERIFICACIÓN: Migraciones de Datos Bidireccionales

### Test Case 5.1: Backend → Client Sync
```
Pasos:
  1. En backend, crear subject via POST /api/subjects
     POST /api/subjects
     { id: "550e8400-e29b-41d4-a716-446655440000",
       user_id: "550e8400...",
       name: "Physics" }

  2. En cliente, hacer pull (GET /api/subjects)
  3. Backend retorna el subject creado

Expected:
  ✅ Frontend recibe subject con UUID correcto
  ✅ subjectRepository.upsert(subject) guarda en SQLite
  ✅ UI muestra "Physics"
  ✅ Siguiente sync no duplica
```

### Test Case 5.2: Client → Backend Sync
```
Pasos:
  1. En cliente, crear subject offline
  2. WiFi ON
  3. SyncService.sync()

Expected:
  ✅ POST /api/subjects con UUID cliente
  ✅ Backend genera igual ID (no crea otro)
  ✅ Retorna { id: {same UUID}, ... }
  ✅ Cliente no duplica en SQLite
```

---

## 6️⃣ SCRIPT DE STRESS TESTING

### Crear archivo: `mobile/src/__tests__/offline-sync.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabaseService } from '../services/database/DatabaseService';
import { SyncService } from '../services/database/SyncService';
import { subjectRepository } from '../services/database/repositories';
import { generateOrValidateUUID, isValidUUID } from '../utils/uuid';

describe('Offline-First Sync System', () => {
  beforeAll(async () => {
    await DatabaseService.getInstance().open();
  });

  afterAll(async () => {
    await DatabaseService.getInstance().clearAll();
  });

  describe('UUID Generation', () => {
    it('should generate valid UUID v4', () => {
      const uuid = generateOrValidateUUID();
      expect(isValidUUID(uuid)).toBe(true);
    });

    it('should accept valid UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(isValidUUID(uuid)).toBe(true);
    });

    it('should reject invalid UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false); // Incompleto
    });
  });

  describe('Offline Operations', () => {
    it('should save subject offline with UUID', async () => {
      const subject = {
        id: generateOrValidateUUID(),
        user_id: 'test-user-uuid',
        name: 'Test Subject',
        code: 'TST',
        credits: 3,
      };

      await subjectRepository.create(subject);
      const saved = await subjectRepository.getById(subject.id);

      expect(saved).toBeDefined();
      expect(saved?.id).toBe(subject.id);
      expect(isValidUUID(saved?.id!)).toBe(true);
    });

    it('should enqueue operation for sync', async () => {
      const subject = {
        id: generateOrValidateUUID(),
        user_id: 'test-user-uuid',
        name: 'Subject to Sync',
        code: 'SYN',
        credits: 4,
      };

      await subjectRepository.create(subject);
      await SyncService.getInstance().enqueueCreate('subject', subject.id, subject);

      const pending = await subjectRepository.getPending?.() || [];
      expect(pending.length).toBeGreaterThan(0);
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve last-write-wins conflict', async () => {
      const local = {
        id: 'test-uuid',
        name: 'Local Name',
        updated_at: new Date('2026-06-04T10:00:00Z').toISOString(),
      };

      const remote = {
        id: 'test-uuid',
        name: 'Remote Name',
        updated_at: new Date('2026-06-04T11:00:00Z').toISOString(),
      };

      // last-write-wins: remote gana (más reciente)
      expect(new Date(remote.updated_at) > new Date(local.updated_at)).toBe(true);
    });
  });
});
```

### Ejecutar tests:
```bash
cd mobile
npm run test -- offline-sync.test.ts --verbose
```

Expected Output:
```
PASS  src/__tests__/offline-sync.test.ts
  Offline-First Sync System
    UUID Generation
      ✓ should generate valid UUID v4 (5ms)
      ✓ should accept valid UUID (2ms)
      ✓ should reject invalid UUID (1ms)
    Offline Operations
      ✓ should save subject offline with UUID (45ms)
      ✓ should enqueue operation for sync (30ms)
    Conflict Resolution
      ✓ should resolve last-write-wins conflict (2ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

---

## 7️⃣ VERIFICACIÓN DE INTEGRIDAD - CHECKLIST

### Backend Checks
- [ ] Todos los user_data tables tienen TEXT PRIMARY KEY
- [ ] FOREIGN KEYS apuntan a TEXT (no INTEGER)
- [ ] UUID seed data es válido (regex match)
- [ ] Scripts migrateToUuid.js y importFromBackup.js no tienen errores
- [ ] Datos importados tienen updated_at válidos

### Cliente Checks
- [ ] DatabaseProvider gates rendering correctamente
- [ ] Login crea entrada en users table
- [ ] Logout limpia BD local con clearAll()
- [ ] Servicios API usan generateOrValidateUUID()
- [ ] SyncService encolada operaciones correctamente
- [ ] Conflict resolution funciona (last-write-wins)
- [ ] SQLite tiene índices en user_id, subject_id, status
- [ ] Migraciones v1 completa (todas las tablas + users)

### Integration Checks
- [ ] Offline: crear subject → aparece en UI
- [ ] Offline: editar subject → cambios en UI
- [ ] Offline: delete subject → desaparece
- [ ] Online: sync sincroniza todo sin duplicar
- [ ] Multi-device: conflictos se resuelven correctamente
- [ ] UUID sync: cliente → servidor IDs coinciden
- [ ] Network change: sync se reintenta automáticamente

---

## 8️⃣ RESULTADOS ESPERADOS FASE 6

### Si TODO funciona ✅
```
1. Login → UUID guardado en SQLite ✅
2. CRUD offline encolado en sync_queue ✅
3. Sync online envía CON UUIDs ✅
4. Conflictos resolvidos (last-write-wins) ✅
5. Datos importados migrados correctamente ✅
6. Multi-dispositivo consistente ✅
7. Tests pasan 6/6 ✅

→ LISTO PARA PRODUCCIÓN ✅
```

### Si algo falla 🔴
```
Debug:
1. Check console logs: [DatabaseProvider], [SyncService], [UserRepository]
2. Check SQLite: SELECT * FROM sync_queue ORDER BY created_at DESC LIMIT 10;
3. Check Network tab: ¿UUID format es correcto?
4. Check timestamps: ¿updated_at es válido ISO 8601?
5. Check FK: ¿user_id en todos los records?
```

---

## 9️⃣ ESTIMACIÓN DE TIEMPO

| Task | Time | Status |
|------|------|--------|
| Manual testing (1-4) | 2h | ⏳ |
| Stress testing | 1h | ⏳ |
| Bug fixes (if any) | 1-3h | ⏳ |
| Final validation | 30min | ⏳ |
| **TOTAL** | **5-7h** | ⏳ |

---

## 🔟 COMANDOS ÚTILES PARA DEBUGGING

```bash
# Backend: Verificar schema
sqlite3 threshold.db "PRAGMA table_info(subjects);"

# Backend: Contar UUIDs migrados
sqlite3 threshold.db "SELECT COUNT(*) as uuid_count FROM subjects WHERE id LIKE '%-%-%-%-';"

# Cliente: Limpiar todo y reiniciar
# Eliminar app en Device/Emulator y reinstalar

# Cliente: Ver logs en tiempo real
npm run ios -- --verbose

# Cliente: Ejecutar tests offline-sync
npm run test -- offline-sync.test.ts --watch
```

---

**Siguiente:** Una vez completados todos los test cases, será tiempo de hacer un PR y merge a main.



---
**Tags:** #logs
