# Field Test Plan — Validación de Campo

> **Propósito**: Fatigar el sistema en condiciones reales antes de declarar el Protocolo v1.0 estable.
> **Regla**: No corregir un bug hasta poder reproducirlo de forma consistente o tener suficiente evidencia (logs, métricas, estado del sistema) para explicar por qué ocurrió.

---

## Escenarios Obligatorios

### CRUD Base

- [ ] **Subjects** — crear, editar, eliminar 10 subjects. Verificar que desaparecen de UI y no reaparecen.
- [ ] **Courses** — crear, editar, eliminar 10 courses asociados a subjects. Verificar cascade.
- [ ] **Assessments** — crear, editar, eliminar 20 assessments con distintas calificaciones.
- [ ] **Flashcards** — crear 50 flashcards en 5 decks. Eliminar decks con tarjetas. Verificar que tarjetas no quedan huérfanas.
- [ ] **Audio** — grabar 10 audios, transcribir 5, eliminar 3. Verificar que transcripción de audio eliminado falla.
- [ ] **Fotos** — tomar 20 fotos, hacer OCR en 5, eliminar 5. Verificar OCR en foto eliminada falla.
- [ ] **Documentos** — escanear 10 documentos, extraer texto de 5, eliminar 3.
- [ ] **Horarios** — crear 10 horarios en distintos subjects. Eliminar subject y verificar que horarios asociados se comportan correctamente.
- [ ] **Eventos de calendario** — crear 15 eventos, editar 5, eliminar 5.

### Offline

- [ ] **Offline 24 horas** — crear 100 registros sin conexión. Reconectar y verificar convergencia total.
- [ ] **Offline + DELETE** — crear offline, eliminar offline antes de sincronizar. Verificar que nunca llega al servidor (0 ops en cola).
- [ ] **Offline + UPDATE** — crear offline, actualizar varias veces. Verificar que se sincroniza una sola operación (CREATE final).

### Estrés de Red

- [ ] **Kill during sync** — matar la app mientras sincroniza. Reabrir y verificar que no hay duplicados ni pérdida.
- [ ] **Kill during push** — matar la app mientras envía operaciones. Verificar que la cola retiene las ops no enviadas.
- [ ] **WiFi → Datos → WiFi** — cambiar de red durante una sincronización. Verificar que se recupera sin duplicar.
- [ ] **Latencia alta** — simular 500ms+ de latencia. Verificar que la UI no se bloquea (optimistic updates).
- [ ] **Servidor caído** — desconectar backend, seguir usando la app 2 horas. Reconectar y verificar sync completo.

### Volumen

- [ ] **500 registros** — crear 500 entidades distribuidas (subjects, courses, assessments, flashcards, audio, fotos, documentos). Sincronizar todo.
- [ ] **200 eliminaciones** — eliminar 200 registros aleatorios. Verificar que desaparecen y que sync_deletions las registra correctamente.
- [ ] **Conflicto masivo** — editar las mismas 50 entidades desde dos dispositivos simultáneamente. Verificar que ConflictResolver elige ganador sin pérdida.

### Backup/Restore

- [ ] **Backup completo** — ejecutar backup con 500+ registros. Verificar progreso y finalización.
- [ ] **Restore parcial** — restore en dispositivo nuevo. Verificar que todas las entidades aparecen.
- [ ] **Restore con conflictos** — restore sobre dispositivo con datos locales. Verificar que upsertFromCloud no revive entidades eliminadas localmente.

### Sincronización

- [ ] **Initial Sync** — borrar SQLite local, reconectar. Verificar que todas las entidades del servidor se descargan.
- [ ] **Delta Sync** — hacer cambios en dispositivo A, sync en B. Verificar convergencia en <5s.
- [ ] **Sync simultáneo** — ambos dispositivos haciendo push+pull al mismo tiempo. Verificar que no hay colisiones.

### Consistencia

- [ ] **Consistency Report** — ejecutar después de cada sesión de pruebas. Verificar 0 errores.
- [ ] **Convergence Score** — ejecutar Stress Suite regression (1000 ops × 3 devices). Score ≥ 99%.

---

## Escenarios Específicos por Invariante de Dominio

- [ ] **Subject eliminado → crear examen** — debe fallar con error "has been deleted".
- [ ] **Subject eliminado → crear horario** — debe fallar.
- [ ] **Subject eliminado → crear foto** — debe fallar.
- [ ] **Subject eliminado → crear audio** — debe fallar.
- [ ] **Subject eliminado → crear documento** — debe fallar.
- [ ] **Deck eliminado → crear tarjeta** — debe fallar.
- [ ] **Deck eliminado → crear evaluation item** — debe fallar.
- [ ] **Audio eliminado → transcribir** — debe fallar.
- [ ] **Foto eliminada → OCR** — debe fallar.
- [ ] **Documento eliminado → update** — debe fallar.

---

## Findings

| # | Escenario | Dispositivo | Resultado | Severidad | Causa Raíz | Solución |
|---|-----------|-------------|-----------|-----------|------------|----------|
|   |           |             |           |           |            |          |
|   |           |             |           |           |            |          |
|   |           |             |           |           |            |          |

### Leyenda de Severidad

| Severidad | Definición |
|-----------|-----------|
| **CRITICAL** | Pérdida de datos, no convergencia, crash |
| **HIGH** | Operación de dominio incorrecta, violación de invariante |
| **MEDIUM** | UX degradada, error recuperable, sync lento |
| **LOW** | Cosmético, log ruidoso, mensaje de error poco claro |

---

## Checklist por Sesión

Cada sesión de pruebas debe comenzar con:

- [ ] **SyncMetrics** capturados antes de empezar
- [ ] **Consistency Report** ejecutado (0 errores esperados)
- [ ] **Cola de sync** vacía
- [ ] **Backend** accesible y versión correcta
- [ ] **Stress Suite smoke** (100 ops × 2 devices) — PASS

Y terminar con:

- [ ] **SyncMetrics** capturados al final
- [ ] **Consistency Report** ejecutado (documentar diferencias)
- [ ] **Findings** registrados en la tabla
- [ ] **Backup** ejecutado si hubo cambios importantes
