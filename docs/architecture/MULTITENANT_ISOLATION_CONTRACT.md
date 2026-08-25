# Multi-Tenant Local Isolation — Contrato Arquitectónico v1

> **Estado**: FROZEN — este contrato no se modifica sin incidencia formal.
> **Fecha de congelamiento**: 2026-08-25
> **Fase de seguridad**: Multi-Tenant Local Isolation v1 — CLOSED

---

## Contexto

Threshold es una plataforma local-first donde múltiples cuentas pueden operar sobre el mismo dispositivo físico. SQLite es compartida entre sesiones; el aislamiento multi-tenant no es opcional — es un invariante de seguridad de datos del usuario.

El incidente que motivó este contrato fue la ausencia de predicados de ownership en los repositorios de dominio, lo que permitía que datos de un usuario fueran visibles para otro usuario que iniciara sesión en el mismo dispositivo.

---

## Perímetro de seguridad (stack completo)

```
Auth Session (JWT/MMKV)
     ↓
SessionIdentity.startSession(userId)
     ↓
SessionGeneration (UUID por lifecycle de autenticación)
     ↓
SessionBoundContext { userId, sessionGeneration }
     ↓
RepositoryFactory.subject() → SessionBoundRepository(ctx)
     ↓
BaseRepository: requireValidSession() + buildOwnershipWhereClause()
     ↓
SQLite: WHERE user_id = ? | WHERE EXISTS (... AND user_id = ?)
```

Adicional para respuestas async:

```
Async response (network, sync)
     ↓
sessionIdentity.getBoundContext() — re-evaluated at write time
     ↓
Generation G_N === generation at call time?
     ├── YES → persist to SQLite
     └── NO  → SESSION_CONTEXT_INVALID → DISCARD
```

---

## Invariantes (I1–I13)

### I1 — Toda operación de dominio requiere `SessionBoundContext`
Ningún repositorio de dominio opera sin un `SessionBoundContext` válido.
`requireValidSession()` se llama ANTES de cualquier efecto de escritura o lectura.

**Evidencia**: `SessionBoundRepository.requireValidSession()` — lanzada en `getAll`, `getById`, `create`, `update`, `delete`, `hardDelete`, `count`, `upsert`, `getByField`.

---

### I2 — `userId` nunca proviene de un payload de usuario
El `userId` del `SessionBoundContext` proviene exclusivamente de `sessionIdentity`, que lo toma del token JWT autenticado.
Ningún caller puede forzar un `user_id` diferente en `create` o `update`.

**Evidencia**: `enforceCreateOwnership()` — si `data.user_id !== this.context.userId`, lanza `ILLEGAL_CREATE`.

---

### I3 — `sessionGeneration` identifica el lifecycle de autenticación
Cada `startSession()` genera un UUID nuevo. Este UUID es el token de validez de todos los repositorios creados en esa sesión.

**Evidencia**: `SessionIdentity.startSession()` → `uuidv4()` → inmutable en el `SessionBoundContext` freezeado.

---

### I4 — Un repositorio de una anterior generación no puede operar
Si la `sessionGeneration` del contexto del repo difiere de la `sessionGeneration` actual de `sessionIdentity`, todas las operaciones lanzan `SESSION_CONTEXT_INVALID`.

**Evidencia**: Test C y Test B del suite `MultiTenantIsolation.test.ts` — 14/14 PASS.

---

### I5 — Todo READ está tenant-scoped
`getAll`, `getById`, `getByField`, `count` usan `buildOwnershipWhereClause()` para limitar resultados al `userId` de la sesión activa.

---

### I6 — Todo UPDATE está tenant-scoped
`UPDATE ... SET ... WHERE id = ? AND user_id = ?` — si el `user_id` no coincide, la fila no se modifica (no-op silencioso en SQLite).

---

### I7 — Todo DELETE (soft) está tenant-scoped
`UPDATE ... SET deleted_at = ? WHERE id = ? AND user_id = ?`

---

### I8 — Todo UPSERT está tenant-scoped
`upsert()` llama a `getByIdIncludingDeleted()` que incluye ownership. Si no encuentra la fila, intenta `create()` que fallará en UNIQUE constraint o en `enforceCreateOwnership()`.

---

### I9 — Entidades indirectas validan ownership mediante su raíz
Para entidades sin `user_id` directo (e.g., `assessment_files` → `assessments` → `subjects.user_id`):
- READ: `EXISTS (SELECT 1 FROM subjects WHERE subjects.id = t.subject_id AND subjects.user_id = ?)`
- CREATE: verifica que la entidad raíz pertenezca al usuario antes de insertar

**Evidencia**: Test F del suite `MultiTenantIsolation.test.ts`.

---

### I10 — SQLite residual no implica exposición cross-user
Aunque SQLite contenga físicamente datos de usuario A, un usuario B autenticado no puede verlos porque todos los queries incluyen `WHERE user_id = ?` con el `userId` de B.

**Evidencia**: Test A del suite `MultiTenantIsolation.test.ts`.

---

### I11 — Respuestas async de generaciones anteriores nunca persisten
Toda operación async re-evalúa el `SessionBoundContext` antes de cualquier escritura.
Si la generación cambió durante el await, la operación lanza `SESSION_CONTEXT_INVALID` y no toca SQLite ni DataStore.

**Evidencia**: Test B (In-flight Race) del suite `MultiTenantIsolation.test.ts`.

---

### I12 — Backup/export está tenant-scoped
`backupService.ts` obtiene el `userId` autenticado al inicio de cada operación y lo aplica como predicado en todas las queries de lectura y escritura.

---

### I13 — UI/DataStore no acceden directamente a SQLite
La capa UI no importa directamente de `DatabaseService` ni instancia repositorios. El flujo es:

```
UI → RepositoryFactory → SessionBoundRepository → DatabaseService → SQLite
```

---

## Estado de la suite de tests

| Suite | Tests | Estado | Notas |
|---|---|---|---|
| `MultiTenantIsolation.test.ts` | 14/14 | ✅ PASS | Tests A, B, C, D, E, F, G |
| `BaseRepository.test.ts` | PASS | ✅ | Contrato base de ownership |
| `ReminderCoordinator.test.ts` | — | ⚠️ INFRA DEBT | Expo native bridge no disponible en Jest |

**Clasificación deuda de infraestructura**: Los 10 suites que fallan no son de seguridad. Fallan porque `expo-sqlite` requiere el bridge nativo de Expo que no existe en Node.

---

## Validación E2E pendiente (manual — en dispositivo)

### Test 1 — A → B (escenario original del incidente)
1. Login cuenta A
2. Crear: cursos, materias, grades, decks, eventos, notas, fotos/documentos
3. Logout A
4. Login cuenta B
**Resultado obligatorio:** 0 elementos en todas las vistas. Developer Console debe mostrar `userId` de B.

### Test 2 — Residuo físico deliberado
1. Login A → crear datos → logout A
2. **NO ejecutar** `clearAll()`
3. Login B → completar bootstrap → initial sync
**Resultado obligatorio:** B ve 0 elementos de A. Developer Console -> Database -> 0 filas de A bajo B.

### Test 3 — Race real (respuesta async tardía)
1. Login A
2. Iniciar sync manual o una operación larga
3. Logout A → login B ANTES de que termine
**Resultado obligatorio:** La respuesta de A es descartada (log `SESSION_CONTEXT_INVALID`), B no ve nada de A.

### Test 4 — B → A → B (lifecycle completo)
1. Login A → crear datos A → logout A
2. Login B → crear datos B → logout B
3. Login A → verificar A exclusivo
4. Logout A → login B → verificar B exclusivo
**Resultado obligatorio:** G3(A) y G4(B) solo ven sus datos respectivos.

---

## Regla de modificación

Este contrato solo puede modificarse mediante:
1. Incidencia formal documentada con vector de ataque demostrable
2. Aprobación explícita antes de cualquier cambio de código
3. Actualización de `MultiTenantIsolation.test.ts`
4. Re-ejecución de la suite completa

**Prohibido**: modificar `SessionBoundRepository`, `SessionIdentity`, `RepositoryFactory` o `BaseRepository` sin revisar este contrato.
