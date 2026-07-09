# 🚀 FASE 6: QUICK START GUIDE

**Estado:** Listos para comenzar verificaciones  
**Fecha:** 2026-06-04  
**Tiempo Estimado:** 4-6 horas de testing

---

## 📋 PRE-FLIGHT CHECK (5 minutos)

### 1. Ejecutar verification script
```bash
cd /path/to/Threshold
node scripts/phase6-verify.js
```

**Expected Output:**
```
✅ [1] DatabaseContext.tsx exists
✅ [2] DatabaseContext exports DatabaseProvider
✅ [3] DatabaseContext prevents render until DB ready
✅ [4] UserRepository.ts exists
✅ [5] UserRepository has methods: getCurrentUser, updateToken, saveUser, clearUser
...
✨ ALL CHECKS PASSED! (20/20)
You are ready for Phase 6 testing!
```

### 2. Instalar dependencias (si necesario)
```bash
cd mobile
npm install
# o
yarn install
```

### 3. Limpiar caché y reiniciar
```bash
# React Native
npm run ios -- --clean   # o --android para Android
# O desde XCode/Android Studio: Run → Clean Build Folder
```

---

## 🧪 PHASE 6: TEST PLAN (por orden)

### TIER 1️⃣: Authentication Flow (30 min)
**Objetivo:** Verificar que login crea UUID en SQLite

#### Test 1.1: Successful Login
```bash
1. Abre app
2. Welcome → Login button
3. Email: test@test.com
4. Password: password123
5. Presiona "Sign In"

VERIFY:
✅ No errors en console
✅ Navega a (tabs) screen
✅ Network tab: POST /api/auth/login → 200 OK
✅ Response contiene: { token: "...", user: { id: "550e8400-..." } }
✅ User.id es UUID válido (regex: 550e8400-e29b-41d4)
✅ Console log: "[UserRepository] User saved: {UUID}"
```

#### Test 1.2: Failed Login (wrong password)
```bash
1. Email: test@test.com
2. Password: wrongpass
3. Presiona "Sign In"

VERIFY:
✅ Toast error: "Invalid credentials"
✅ No BD insert (UserRepository NOT called)
✅ Permanece en login screen
```

#### Test 1.3: Login Logs
```bash
1. Abre DevTools (React Native Debugger / Expo Go)
2. Durante login, observa console

EXPECTED LOGS:
[DatabaseProvider] Inicializando BD local...
[appInit] Database opened
[DatabaseProvider] BD lista ✅
[Auth] Login attempt: test@test.com
[Auth] Login success: user_id=550e8400-...
[UserRepository] User saved: { id: 550e8400..., email: test@test.com }
[SyncService] Iniciando sync de 0 operaciones  (primera vez)
```

---

### TIER 2️⃣: Offline CRUD Operations (1.5 hours)
**Objetivo:** Verificar CREATE/UPDATE/DELETE offline → SQL local

#### Test 2.1: Create Subject Offline
```bash
SETUP:
1. Login exitosamente
2. Settings → Airplane Mode ON (o desactivar WiFi)
3. Abrir DevTools console

STEPS:
1. Home → Subjects tab
2. Presiona "+" button
3. Ingresa:
   - Name: "Spanish 101"
   - Code: "SPN101"
   - Credits: 4
4. Presiona "Save"

VERIFY OFFLINE:
✅ Subject aparece en lista inmediatamente
✅ Badge "_isPending" o ícono offline visible
✅ Network tab está vacío (NO request)
✅ Console: "[SyncService] Encolando CREATE subject"
✅ SQLite:
   - Row insertado en subjects table
   - ID es UUID válido
   - user_id = logged in user UUID

STEPS (Turn on WiFi):
5. Settings → Airplane Mode OFF (o reactivar WiFi)
6. Espera 2-3 segundos (network listener dispara sync)

VERIFY ONLINE:
✅ Network tab: POST /api/subjects
  - Headers: Authorization: Bearer {token}
  - Body: { id: {UUID}, user_id: {UUID}, name: "Spanish 101", ... }
✅ Response 201 Created: { id: {same UUID}, name: "Spanish 101", ... }
✅ Badge desaparece (operación completó)
✅ Console: "[SyncService] ✅ subject/{UUID} sincronizado"
✅ Refresh browser → Subject persiste en servidor
```

#### Test 2.2: Update Subject Offline → Conflict Resolution
```bash
PRECONDICIÓN:
1. Dos dispositivos con mismo usuario logado
2. Ambos offline

DEVICE A - STEPS:
1. Ir a Subjects → Spanish 101
2. Editar nombre a "Spanish 201"
3. Presionar guardar
4. Airplane Mode ON (mantener offline)

DEVICE B - SIMULTÁNEAMENTE:
1. Ir a Subjects → Spanish 101
2. Editar nombre a "Spanish Advanced"
3. Presionar guardar
4. WiFi ON → Sync

DEVICE A - LUEGO:
5. WiFi ON → Sync

VERIFY:
✅ Device B: POST /api/subjects/... → 200 OK
  - updated_at = T2 (Device B time)
✅ Device A: PUT /api/subjects/... → 200 OK
  - Server retorna: { name: "Spanish Advanced", updated_at: T2 }
✅ Device A Console: "[SyncService] Conflicto: last-write-wins decidió por REMOTE"
✅ Device A ahora muestra: "Spanish Advanced" (gana Device B)
✅ No duplicación, sin pérdida de datos

CRITICAL CHECK:
- Ambos dispositivos muestran "Spanish Advanced" después de sync
- No hay conflicto visible para usuario
- Base de datos tiene UN SOLO record
```

#### Test 2.3: Delete Subject Offline
```bash
1. Airplane Mode ON
2. Subjects → swipe left/long-press Spanish 101
3. Presionar "Delete"
4. Confirm delete

VERIFY OFFLINE:
✅ Subject desaparece de lista
✅ No request HTTP
✅ SQLite: Row deletado de subjects table
✅ Console: "[SyncService] Encolando DELETE subject"

STEPS:
5. Airplane Mode OFF

VERIFY ONLINE:
✅ DELETE /api/subjects/{UUID} → 200 OK
✅ Refresh cliente → Subject no existe
✅ Backend verificar: SELECT * FROM subjects WHERE id = {UUID} → empty
```

---

### TIER 3️⃣: Create with UUID Validation (45 min)
**Objetivo:** Verificar todos los entity types generan UUIDs válidos

#### Test 3.1: Create Flashcard Deck
```bash
1. Airplane Mode ON
2. Flashcards → "+" → "Create New Deck"
3. Nombre: "IELTS Vocabulary"
4. Agregar 3 flashcards:
   - Front: "Serendipity" → Back: "Happy accident"
   - Front: "Ubiquitous" → Back: "Present everywhere"
   - Front: "Ephemeral" → Back: "Lasting short time"
5. Presionar "Save"

VERIFY:
✅ Deck ID = UUID válido
✅ Card IDs = UUIDs válidos
✅ Console: "[FlashcardDeckRepository] Deck created: {UUID}"
✅ Each card: "[FlashcardRepository] Card created: {UUID}"
✅ SQLite: rows en flashcard_decks y flashcards tables

ONLINE:
✅ Airplane Mode OFF
✅ POST /api/flashcard_decks + POST /api/flashcards/{deck_id}/cards
✅ Server retorna con mismos UUIDs
```

#### Test 3.2: Create Assessment
```bash
1. Airplane Mode ON
2. Assessments → Subject → "+" 
3. Ingresa:
   - Name: "Quiz 1"
   - Score: 45
   - Out of: 50
   - Weight: 20
4. Presionar "Save"

VERIFY:
✅ Assessment ID = UUID
✅ GPA calculado localmente (sin API)
✅ Percentile mostrado
✅ SQLite: row en assessments table
✅ Console: "[AssessmentRepository] Assessment created: {UUID}"

ONLINE:
✅ POST /api/assessments
✅ Backend retorna assessment con mismo UUID
```

#### Test 3.3: Create Calendar Event
```bash
1. Airplane Mode ON
2. Calendar → "+" → New Event
3. Ingresa:
   - Title: "Math Final Exam"
   - Date: Tomorrow
   - Time: 14:00
4. Presionar "Save"

VERIFY:
✅ Event ID = UUID
✅ SQLite: row en calendar_events table
✅ Evento visible en calendar view

ONLINE:
✅ POST /api/calendar
✅ Sincroniza sin duplicar
```

---

### TIER 4️⃣: Data Import Integrity (1 hour)
**Objetivo:** Verificar datos del servidor se cargan y se pueden editar

#### Test 4.1: Login & Load Imported Data
```bash
SETUP:
- Backend tiene datos migrados (run scripts/migrateToUuid.js)

STEPS:
1. App inicia
2. Login → completa
3. Home → Subjects tab

VERIFY:
✅ GET /api/subjects retorna array
✅ Cada subject tiene:
   - id = UUID válido
   - user_id = logged in user UUID
   - Otros campos (name, code, etc.)
✅ SubjectRepository.upsert(subjects) popula SQLite
✅ Lista muestra todos los subjects
✅ No hay errores en console

CRITICAL:
- Si subjects = [], hay problema con GET /api/subjects
- Check backend: SELECT COUNT(*) FROM subjects WHERE user_id = {UUID};
```

#### Test 4.2: Edit Imported Subject
```bash
1. Selecciona subject existente (del servidor)
2. Editar nombre: "Math → Advanced Calculus"
3. Presionar "Save"

VERIFY:
✅ UPDATE /api/subjects/{UUID}
✅ Backend retorna updated subject
✅ Frontend muestra "Advanced Calculus"
✅ Siguiente GET /api/subjects retorna cambio
✅ Sin duplicación
```

#### Test 4.3: Delete Imported Assessment
```bash
1. Ir a Subject → Assessments
2. Seleccionar assessment del servidor
3. Swipe delete o presionar trash icon
4. Confirm delete

VERIFY:
✅ DELETE /api/assessments/{UUID}
✅ Backend retorna 200 OK
✅ Assessment desaparece de UI
✅ Backend verificar: SELECT * FROM assessments WHERE id = {UUID} → empty
```

---

### TIER 5️⃣: Edge Cases & Error Handling (30 min)
**Objetivo:** Verificar que app maneja errores gracefully

#### Test 5.1: Network Interruption During Sync
```bash
1. Create subject offline (Airplane Mode ON)
2. Airplane Mode OFF
3. INMEDIATAMENTE: Airplane Mode ON de nuevo (interrumpir mid-sync)

VERIFY:
✅ No crash
✅ Operation sigue en sync_queue (estado: pending)
✅ No duplicación cuando se reintenta
✅ Console muestra retry attempt
```

#### Test 5.2: Server Error (500)
```bash
MOCKING: Modificar servidor para retornar error 500
- En backend, POST /api/subjects: res.status(500).send(...)

STEPS:
1. Create subject offline
2. Airplane Mode OFF
3. Sync intenta sincronizar

VERIFY:
✅ No crash
✅ Operation marca como "failed" en sync_queue
✅ Error message logged en console
✅ User ve toast o notification
✅ Operation permanece en queue para retry
```

#### Test 5.3: Large Batch Sync (10+ pending operations)
```bash
1. Airplane Mode ON
2. Create 15 subjects rapidly
3. Create 10 assessments rapidly
4. Airplane Mode OFF

VERIFY:
✅ Sync procesa todas 25 operaciones
✅ No crash o memory issues
✅ Console: "[SyncService] Iniciando sync de 25 operaciones"
✅ Cada una marcada como "completed"
✅ Performance acceptable (< 30 sec total)
```

---

## ✅ CHECKLIST FINAL

### Backend Verification
```
□ UUID generation: todas las IDs son válidas v4
□ Schema: todos los TEXT PRIMARY KEY
□ FKs: apuntan a TEXT correctamente
□ Datos migrados: SELECT COUNT(*) > 0 para cada tabla
□ Timestamps: updated_at es ISO 8601 válido
□ Endpoints: POST/GET/PUT/DELETE funcionan con UUIDs
```

### Cliente Verification
```
□ DatabaseProvider gates rendering
□ Login crea user en SQLite
□ Logout limpia BD (userRepository.clearUser())
□ Offline: crea operaciones en sync_queue
□ Online: sincroniza sin duplicar
□ UUIDs: isValidUUID() retorna true para todos
□ Conflictos: resueltos correctamente (last-write-wins)
□ Tests: npm run test -- offline-sync.test.ts → all pass
```

### Integration
```
□ UUID client == UUID server en sync
□ Datos importados cargados correctamente
□ Multi-dispositivo consistente
□ Sincronización bidireccional funciona
□ No hay errores en console durante operaciones
□ Performance: sync < 1 seg por 10 operaciones
```

---

## 🐛 DEBUGGING COMMANDS

### Verificar SQLite (Cliente)
```bash
# En React Native Debugger / Expo:
# Abrir DevTools → Storage → SQLite

# Query directa (si tienes adb):
adb shell
run-as com.threshold.app
sqlite3 /data/data/com.threshold.app/databases/threshold.db

# Dentro de SQLite:
SELECT * FROM users LIMIT 1;
SELECT COUNT(*) FROM sync_queue WHERE status='pending';
SELECT * FROM subjects ORDER BY created_at DESC LIMIT 1;
```

### Verificar Backend
```bash
# PostgreSQL / SQLite backend
\c threshold_db  -- connect to DB

SELECT * FROM users LIMIT 1;
-- Verificar: id es TEXT, contiene UUID

SELECT COUNT(*) FROM subjects WHERE id LIKE '%-%-%-%-';
-- Verificar: UUIDs migrados

SELECT * FROM sync_queue ORDER BY created_at DESC LIMIT 5;
-- Verificar: no hay items stuck en processing
```

### Console Logs a Buscar
```
[DatabaseProvider]    → BD initialization
[UserRepository]      → User save/load
[SubjectRepository]   → Subject CRUD
[SyncService]         → Sync operations
[Conflicto]           → Conflict detection
[MarkedProcessing]    → Sync state transitions
```

---

## 📞 HELP & ESCALATION

**Si encuentras errores:**

1. **App Crashes:**
   - Check console: "[DatabaseProvider] Error:"
   - Reinicia: `npm run ios -- --clean`
   - Verifica: node scripts/phase6-verify.js

2. **UUID Validation Fails:**
   - Check: isValidUUID(id) en console
   - Regex test: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab]/i`

3. **Sync Stuck:**
   - Verifica sync_queue: SELECT * FROM sync_queue WHERE status='processing';
   - Marca como pending: UPDATE sync_queue SET status='pending' WHERE status='processing';

4. **Conflicto Multidevice:**
   - Verifica timestamps: SELECT id, name, updated_at FROM subjects ORDER BY updated_at DESC;
   - Remote debe ganar si su updated_at > local

---

## 🎯 SUCCESS CRITERIA

**Fase 6 completada cuando:**

✅ Todos los test cases en TIER 1-5 pasan  
✅ No hay crashes en console  
✅ Verificación script retorna "ALL CHECKS PASSED"  
✅ SQLite tiene datos con UUIDs válidos  
✅ Backend y cliente sincronizados  
✅ Multi-dispositivo sin conflictos  
✅ Tests: `npm run test -- offline-sync.test.ts` → 20/20 pass

**Una vez completado:**
→ Crear PR con cambios
→ Review & merge a main
→ Deploy backend
→ Anunciar Fase 6 completada ✨

---

**Ahora está listo. ¡A testear!** 🚀



---
**Tags:** #logs
