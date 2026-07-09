# User Journeys — Recorridos Completos del Usuario

> No es suficiente que una operación exista. El usuario debe poder **completar el objetivo**.
> Cada journey tiene un entry point, pasos intermedios, y un final state alcanzable.

---

## 🔴 Leyenda de Brechas

| Símbolo | Significado |
|---------|-------------|
| ❌ | Paso imposible — no existe operación |
| ⚠️ | Paso incompleto — existe pero no cierra el ciclo |
| 🔶 | No verificado |
| ✅ | El paso existe y funciona |

---

## Journey A: Administrar una Materia

**Entry point**: Pantalla de materias → botón "+"

```
1. ✅ Crear materia
2. ✅ Editar nombre/color/icono
3. ✅ Crear curso dentro de la materia
4. ✅ Crear examen (assessment) dentro de la materia
5. ✅ Tomar foto y asignarla a la materia
6. ✅ Grabar audio y asignarlo a la materia
7. ✅ Escanear documento y asignarlo a la materia
8. ✅ Vincular video de YouTube a la materia
9. ❌ Mover curso a otra materia
10. ✅ Eliminar curso
11. ❌ Eliminar materia y decidir qué pasa con sus hijos:
      ❌ Cursos → ¿CASCADE? ¿MOVE? ¿ASK?
      ❌ Exámenes → ¿CASCADE? ¿MOVE?
      ❌ Fotos → ¿CASCADE? ¿SET NULL?
      ❌ Audios → ¿CASCADE? ¿SET NULL?
      ❌ Documentos → ¿CASCADE? ¿SET NULL?
      ❌ Videos → ¿CASCADE? ¿SET NULL?
      ❌ Mazos → ¿CASCADE? ¿MOVE?
      ❌ Horarios → ¿CASCADE? ¿DELETE?
      ❌ Eventos de calendario → ¿CASCADE? ¿SET NULL?
12. ❌ Archivar materia (ocultar de vista principal)
13. ❌ Desarchivar materia
14. ❌ Restaurar materia eliminada
15. ❌ Eliminar materia definitivamente (vaciar papelera)
```

✅ **Completado**: 8 / 15 pasos ❌ **Brechas**: 7

---

## Journey B: Preparar un Examen

**Entry point**: Pantalla de exámenes o desde materia → botón "+"

```
1. ✅ Crear examen (título, fecha, materia, ponderación)
2. ✅ Crear mazo de flashcards
3. ✅ Vincular examen al mazo
4. ✅ Agregar tarjetas manualmente
5. ✅ Importar tarjetas desde JSON/CSV
6. ⚠️ Importar desde PDF (OCR híbrido — depende de calidad)
7. ✅ Extraer texto de imágenes (OCR) para crear tarjetas
8. ✅ Generar tarjetas con IA desde texto
9. ✅ Estudiar con el mazo (sesión SRS)
10. ✅ Ver estadísticas de estudio
11. ❌ Generar plan de estudio automático desde el examen
12. ⚠️ Re-planificar schedule existente
13. ✅ Desvincular examen del mazo
14. ❌ Reemplazar examen (vincular a otro examen)
15. ✅ Editar examen
16. ✅ Eliminar examen
      ❌ ¿Qué pasa con el mazo vinculado? → linked_event_id = SET NULL
      ✅ Mazo sobrevive (desvinculado)
      ❌ ¿Qué pasa con las tarjetas? → sobreviven (solo se desvincula)
```

✅ **Completado**: 12 / 16 pasos ❌ **Brechas**: 4

---

## Journey C: Clase Grabada (Audio)

**Entry point**: Pantalla de grabaciones → botón "Grabar"

```
1. ✅ Iniciar grabación
2. ✅ Detener grabación
3. ✅ Renombrar grabación
4. ✅ Asignar / cambiar materia
5. ⚠️ Transcribir audio
      ⚠️ No hay estado "transcribiendo" visible
      ❌ No hay indicador de progreso
      ❌ No se puede cancelar la transcripción
      ❌ No se puede re-transcribir si el resultado es malo
6. ✅ Ver transcripción generada
7. ❌ Editar/corregir transcripción
8. ❌ Generar resumen desde la transcripción (existe backend, falta UI)
9. ✅ Eliminar grabación
      ✅ Transcripción se elimina en cascada (CASCADE)
      ❌ No hay confirmación de que también se elimina la transcripción
10. ✅ Sincronizar entre dispositivos
```

✅ **Completado**: 7 / 10 pasos ❌ **Brechas**: 3

---

## Journey D: Documento Escaneado

**Entry point**: Pantalla de documentos → botón "Escanear"

```
1. ✅ Escanear documento (cámara)
2. ✅ Importar PDF
3. ✅ Renombrar
4. ✅ Asignar / cambiar materia
5. ✅ OCR (extraer texto)
6. ✅ Ver texto extraído
7. ❌ Re-escanear (volver a capturar si salió mal)
8. ❌ Re-OCR si el resultado es malo
9. ❌ Compartir documento (fuera de la app)
10. ✅ Eliminar documento
11. ✅ Sync
```

✅ **Completado**: 7 / 11 pasos ❌ **Brechas**: 4

---

## Journey E: Video de YouTube

**Entry point**: Pantalla de videos → botón "+" → pegar URL

```
1. ✅ Agregar video (pegar URL de YouTube)
2. ✅ Ver metadata (título, canal, duración)
3. ✅ Asignar / cambiar materia
4. ⚠️ Transcribir video
      ⚠️ Depende de backend
      ❌ No hay estado visible
      ❌ No se puede re-transcribir
5. ❌ Generar resumen desde la transcripción (backend lo soporta, falta UI)
6. ✅ Ver transcripción
7. ❌ Marcar video como visto / pendiente
8. ✅ Eliminar video
      ✅ Transcripción se elimina en cascada
9. ✅ Sync
```

✅ **Completado**: 5 / 9 pasos ❌ **Brechas**: 4

---

## Journey F: Ciclo de Vida de una Flashcard

**Entry point**: Mazo → botón "+" → nueva tarjeta

```
1. ✅ Crear tarjeta (front + back)
2. ✅ Editar tarjeta
3. ❌ Duplicar tarjeta
4. ❌ Mover tarjeta a otro mazo
5. ✅ Estudiar tarjeta (SRS)
      ✅ Responder (again/hard/good/easy)
      ✅ Snooze
      ✅ Unsnooze
6. ❌ Re-corregir respuesta (cambiar rating si me equivoqué)
7. ❌ Resetear estadísticas de la tarjeta
8. ✅ Eliminar tarjeta
      ❌ ¿Qué pasa con los review logs? → quedan huérfanos
9. ✅ Sync
```

✅ **Completado**: 5 / 9 pasos ❌ **Brechas**: 4

---

## Journey G: Mazo Compartido

**Entry point**: Mazo → menú → "Compartir"

```
1. ✅ Crear mazo
2. ✅ Compartir mazo (PIN o grupo)
3. ✅ Ver mazos compartidos por otros
4. ❌ Aceptar / rechazar mazo compartido
5. ❌ Dejar de compartir mazo
6. ❌ Ver quién tiene acceso al mazo
7. ❌ Transferir propiedad del mazo
8. ✅ Eliminar mazo propio
      ❌ ¿Qué pasa con copias compartidas? → huérfanas
9. ✅ Sync
```

✅ **Completado**: 4 / 9 pasos ❌ **Brechas**: 5

---

## Journey H: Gestión de Calendario

**Entry point**: Pantalla de calendario

```
1. ✅ Crear evento (examen, tarea, otro)
2. ✅ Editar evento
3. ✅ Vincular evento a un mazo
4. ✅ Desvincular evento del mazo
5. ✅ Cambiar materia del evento
6. ❌ Crear evento recurrente (semanal, mensual)
7. ❌ Completar evento manualmente (marcar como "rendido")
8. ❌ Ver historial de eventos pasados
9. ✅ Eliminar evento
      ❌ ¿Qué pasa con el mazo vinculado? → linked_event_id = SET NULL
10. ✅ Sync
```

✅ **Completado**: 6 / 10 pasos ❌ **Brechas**: 4

---

## Journey I: Gestión de LMS (Sistema de Notas)

**Entry point**: Configuración → LMS

```
1. ✅ Vincular cuenta LMS
2. ⚠️ Desvincular cuenta LMS
      ⚠️ Existe en API pero UI no es clara
3. ❌ Re-sincronizar notas desde LMS
4. ❌ Ver historial de sincronización LMS
5. ❌ Configurar período académico activo
6. ✅ Ver notas importadas
```

✅ **Completado**: 3 / 6 pasos ❌ **Brechas**: 3

---

## Journey J: Sesión de Estudio Completa

**Entry point**: Mazo → "Estudiar"

```
1. ✅ Iniciar sesión de estudio
2. ✅ Responder tarjetas (SRS)
3. ✅ Ver progreso en tiempo real
4. ❌ Pausar sesión y reanudar después
5. ❌ Cancelar sesión (descartar progreso del día)
6. ❌ Exportar reporte de la sesión
7. ✅ Finalizar sesión
8. ✅ Ver estadísticas acumuladas
9. ✅ Sync
```

✅ **Completado**: 5 / 9 pasos ❌ **Brechas**: 4

---

## Journey K: Copia de Seguridad y Restauración

**Entry point**: Configuración → Backup

```
1. ✅ Configurar preferencias de backup (auto upload, include photos/docs)
2. ✅ Backup manual
3. ⚠️ Restaurar desde backup
      ⚠️ No hay vista previa del backup
      ❌ No se puede elegir qué restaurar
      ❌ No se puede restaurar en otro dispositivo
4. ✅ Ver estado del backup (última sincronización)
5. ✅ Ver progreso de subida de assets
```

✅ **Completado**: 4 / 5 pasos ❌ **Brechas**: 1

---

## Journey L: Offline First — Ciclo Completo

**Entry point**: App offline (sin conexión)

```
1. ✅ Ver datos cacheados (materias, mazos, tarjetas, etc.)
2. ✅ Crear materia offline (encola)
3. ✅ Crear mazo offline (MMKV local + encola)
4. ✅ Crear tarjeta offline (MMKV local + encola)
5. ✅ Editar offline (encola)
6. ✅ Eliminar offline (encola)
7. ❌ Tomar foto offline → ¿se guarda el metadata? ¿el archivo?
8. ❌ Grabar audio offline → ¿se guarda el metadata? ¿el archivo?
9. ❌ Escanear documento offline → ¿se guarda?
10. ✅ Sincronizar cuando vuelve la conexión
11. ✅ Resolver conflictos de sync automáticamente
```

✅ **Completado**: 7 / 11 pasos ❌ **Brechas**: 4

---

## Resumen de Journeys

| Journey | Pasos Completos | Brechas | % Completitud |
|---------|----------------|---------|---------------|
| A. Administrar materia | 8 / 15 | 7 | 53% |
| B. Preparar examen | 12 / 16 | 4 | 75% |
| C. Clase grabada | 7 / 10 | 3 | 70% |
| D. Documento escaneado | 7 / 11 | 4 | 64% |
| E. Video YouTube | 5 / 9 | 4 | 56% |
| F. Ciclo flashcard | 5 / 9 | 4 | 56% |
| G. Mazo compartido | 4 / 9 | 5 | 44% |
| H. Gestión calendario | 6 / 10 | 4 | 60% |
| I. Gestión LMS | 3 / 6 | 3 | 50% |
| J. Sesión de estudio | 5 / 9 | 4 | 56% |
| K. Backup/Restore | 4 / 5 | 1 | 80% |
| L. Offline first | 7 / 11 | 4 | 64% |
| **Total** | **73 / 120** | **47** | **61%** |

---

## Top 5 Brechas por Impacto en el Usuario

| # | Brecha | Journey | Impacto |
|---|--------|---------|---------|
| 1 | ❌ Eliminar materia no ofrece opciones de cascade | A | El usuario pierde datos sin control |
| 2 | ❌ No se puede duplicar mazo | B, F | El usuario debe recrear manualmente |
| 3 | ❌ No se puede re-transcribir | C, E | Transcripciones erroneas son permanentes |
| 4 | ❌ No se puede mover tarjeta entre mazos | F | Atascada en un mazo equivocado |
| 5 | ❌ No se puede compartir photo/audio/document | D, C | Contenido no exportable |

---

*Generado: 2026-07-02. Cada journey debe auditarse antes de cerrar un sprint.*


---
**Tags:** #product
