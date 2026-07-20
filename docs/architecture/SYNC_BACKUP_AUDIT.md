# Cloud Persistence Audit
**Cobertura del Sync Protocol y Backup**

Este documento audita todas las entidades persistidas por Threshold y verifica que cada una tenga una estrategia de persistencia en la nube. El objetivo es garantizar que ningún dato de dominio pueda perderse ante cambio de dispositivo, reinstalación o restauración.

---

## Estado Actual del Protocolo

- **Arquitectura:** Congelada ✅
- **Implementación:** Completa ✅
- **Verificación E2E:** Pendiente ⏳
- **Certificación Sync Protocol v1.0:** Pendiente ⏳

---

## Principios de Persistencia

- Toda entidad de dominio debe tener al menos una estrategia de persistencia.
- Los datos JSON viajan preferentemente mediante Sync Protocol.
- Los archivos binarios viajan mediante Backup.
- Las entidades críticas pueden tener doble cobertura (Sync + Backup).
- Las tablas de infraestructura no forman parte de la auditoría.
- Ninguna nueva entidad puede añadirse al dominio sin actualizar este documento.

---

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Cubierto correctamente |
| ⚠️ | Cobertura parcial / condicionada |
| ❌ | Sin cobertura |
| 🚫 | Excluido intencionalmente |

**Niveles de protección:**
- 🟢 **Doble cobertura**: Protegido tanto en Sync Protocol como en Backup.
- 🟢 **Sync**: Cobertura nativa en tiempo real vía Sync Protocol.
- 🟡 **Parcial**: Persistencia asegurada en archivo, pero no viaja de manera dinámica.
- 🔴 **Sin protección**: Entidad expuesta a pérdida total.
- ⚪ **Legacy / Pendiente**: Excluido intencionalmente o pendiente de rediseño.

---

## Matriz de Cobertura

| Entidad | Sync Push | Sync Pull | Backup Upload | Backup Download | Nivel de protección | Observaciones |
|---|---|---|---|---|---|---|
| `users` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | Solo metadatos de perfil. No necesita archivo. |
| `subjects` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. |
| `courses` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. |
| `assessments` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. |
| `assessment_categories`| ✅ | ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. |
| `schedules` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. Horarios incluidos. |
| `calendar_events` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. |
| `grading_periods` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. |
| `lms_accounts` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. |
| `subject_threshold_overrides`| ✅| ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. |
| `study_sessions` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. |
| `flashcard_decks` | ✅ | ✅ | ✅ | ✅ | 🟢 Doble | Sync + Backup JSON. |
| `flashcards` | ✅ | ✅ | ✅ | ✅ | 🟢 Doble | Sync + Backup JSON. |
| `ai_chats` | ✅ | ✅ | ✅ | ✅ | 🟢 Doble | Backup agrupa 200 msgs por chunk. |
| `youtube_videos` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | Metadatos sincronizables (transcripciones separadas). |
| `assessment_files` | ✅ | ✅ | ✅ | ✅ | 🟢 Doble | Sincronización + Binario. |
| `photos` | ✅ | ✅ | ✅ | ✅ | 🟢 Doble | Sincronización + Binario. |
| `audio_recordings` | ✅ | ✅ | ✅ | ✅ | 🟢 Doble | Sincronización + Binario. |
| `scanned_documents` | ✅ | ✅ | ✅ | ✅ | 🟢 Doble | Sincronización + Binario. |
| `audio_transcripts` | ✅ | ✅ | ✅ | ✅ | 🟢 Doble | Respaldo físico asegurado. Sincronización en tiempo real vía Sync Protocol. |
| `youtube_transcripts` | ✅ | ✅ | ✅ | ✅ | 🟢 Doble | Respaldo físico asegurado. Sincronización en tiempo real vía Sync Protocol. |
| `study_notes` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. |
| `document_highlights` | ✅ | ✅ | ❌ | ❌ | 🟢 Sync | JSON puro. |
| `user_preferences` | ❌ | ❌ | ✅ | ✅ | ⚪ Legacy | Backup y Restore por JSON. Pendiente rediseño. |
| `grade_history` | ❌ | ❌ | ❌ | ❌ | ⚪ Excluido | Auditoría histórica por diseño (análogo a `card_logs`). |
| `card_logs` | ⚠️ | ❌ | ❌ | ❌ | ⚪ Excluido | Auditoría histórica por diseño (ver AGENTS.md). |

---

## Tablas de Infraestructura (Excluidas intencionalmente)

| Tabla | Razón de exclusión |
|---|---|
| `sync_queue` | Infraestructura del protocolo. No es data de dominio. |
| `sync_deletions` | Infraestructura del protocolo. |
| `sync_journal` | Infraestructura del protocolo. |
| `sync_debug_logs` | Infraestructura del protocolo. |

---

## Hoja de Ruta de Resolución

### ✅ Sprint A (Cerrar conocimiento - Prioridad Crítica)
- ✅ Implementar `StudyNoteSynchronizer`.
- ✅ Implementar `DocumentHighlightSynchronizer`.
*(Completado: Integrados en queue events en app y endpionts en backend)*

### ✅ Sprint B (Consistencia Arquitectónica)
- ✅ Implementar `AudioTranscriptSynchronizer`.
- ✅ Implementar `YouTubeTranscriptSynchronizer`.
*(Completado: Las transcripciones viajan por Sync Protocol y Backup).*

### ✅ Sprint C (Decisiones Técnicas)
- ✅ Decidir el destino de `grade_history`: Oficialmente catalogada como tabla de auditoría, excluida intencionalmente del protocolo, idéntica a `card_logs`.

---

## Historial de Decisiones

- ✓ AI Chats migrados a backup por chunks (Sin límite, JSON 200 msgs).
- ✓ User Preferences restaurables (Upload y Download en chunks).
- ✓ Tablas `study_notes` y `document_highlights` añadidas al backend para soportar Sync Protocol.
- ✓ Sprints A, B, C implementados. Implementación arquitectónica de persistencia finalizada.

---

## Garantías del Sync Protocol v1.0

Una vez aprobados los criterios de aceptación, el protocolo garantiza:

- **Convergencia entre dispositivos:** Todos los clientes con conexión estable alcanzarán el mismo estado.
- **Idempotencia:** Sincronizaciones repetidas sin cambios locales no alteran el estado ni duplican datos.
- **Recuperación completa tras reinstalación:** Restauración íntegra desde cero (Cold Recovery).
- **Preservación del conocimiento generado por el usuario:** Protección sin excepciones de datos de dominio.
- **Integridad referencial durante sincronización:** Manejo topológico correcto incluso ante orden caótico del servidor.
- **Recuperación consistente de activos binarios y metadatos:** Sincronización transparente de assets y metadatos JSON.

---

## Criterios de Aceptación del Protocolo v1.0

Para declarar formalmente cerrado el Sync Protocol v1.0, las siguientes pruebas end-to-end deben ejecutarse exitosamente:

1. **Escenario 1 (Create Sync):**
   Dispositivo A crea entidad → Sync → Dispositivo B hace pull → Entidad aparece idéntica.
2. **Escenario 2 (Update Sync):**
   Dispositivo A edita entidad → Sync → Dispositivo B hace pull → Edición se aplica sin corrupción.
3. **Escenario 3 (Delete Sync):**
   Dispositivo A elimina entidad → Sync → Dispositivo B hace pull → Entidad desaparece.
4. **Escenario 4 (Conflicto de Edición):**
   Dispositivo A y Dispositivo B modifican el mismo registro offline → Ambos sincronizan → Reducer aplica estrategia de resolución (ej. LWW) → Ambos alcanzan estado convergente.
5. **Escenario 5 (Ciclo Asset Pipeline):**
   `AssessmentFile` (o similar binario) creado en local → Sync metadata + Upload binario → Nuevo dispositivo hace pull metadata → Download binario → Reconstrucción local perfecta. (Verificar también flujo `PDF` → `Highlight` → `Sync`).
6. **Escenario 6 (Cold Device Recovery Test):**
   Usuario A con uso del 100% (cursos, materias, horarios, PDFs, fotos, audio, chats, flashcards, highlights, notas, preferencias) → Backup → Desinstala la app → Instala desde cero → Login → Restore → Todo aparece idéntico.
7. **Escenario 7 (Idempotencia Completa):**
   Mismo cliente sincroniza consecutivamente sin mutaciones intermedias (Sync → Sync → Sync) → El resultado final es exactamente el mismo, garantizando 0 duplicados y convergencia estable.
8. **Escenario 8 (Reordenamiento de Eventos):**
   Backend entrega entidades en orden caótico (ej: primero `Course`, luego `Subject` dueño de ese curso) → El `DependencyResolver` ordena correctamente el árbol y reconstruye el estado sin violar restricciones de Foreign Key.

*(Nota: Las pruebas se ejecutan y documentan mediante el [Sync Verification Framework](./SYNC_VERIFICATION_FRAMEWORK.md), el cual define la estructura de las suites, runner, métricas, y generación de reportes).*
