# Procesar clase — acento de acción y estados del botón

## Objetivo

Que el botón icon-only "Procesar clase" de la pantalla Materias **lea como una acción** —con protagonismo orgánico, sin estridencia y sin salir de la paleta elegante de la app— y que la divergencia entre renderers se resuelva. Se resolvió por la vía de los hechos: sólo existe **un** renderer vivo (`SubjectRow`); el de tarjeta era código muerto y se eliminó (T3).

## Problema

El mismo control tiene dos implementaciones divergentes y una de ellas es invisible:

- **Vista lista** (`SubjectRow`): 30×30, `borderRadius 8`, fondo `#1E293B`, icono `sparkles` blanco. Legible (14.6:1) pero **semánticamente mudo**: usa el neutro genérico de la UI, no un acento. Ningún otro control accionable de la app usa neutro.
- **Vista tarjeta** (`SubjectCard`): icono `sparkles` `#9CA3AF` **sin contenedor**. Mide **2.34:1** contra la tarjeta → **falla WCAG 2.2 SC 1.4.11** (componentes de UI ≥3:1) y se percibe como decoración.

## Por qué

El usuario reportó que el botón es negro, pasa desapercibido y no comunica acción; pidió investigar estándares internacionales y cómo lo hacen otras apps, y lograr que "el color de fondo represente una acción de manera orgánica".

Evidencia medida (script de contraste WCAG, `%TEMP%\opencode\contrast.js`):

| Elemento | Fondo | Ratio | Veredicto |
|---|---|---|---|
| `#9CA3AF` (icono tarjeta, actual) | card `#F4F6F8` | **2.34:1** | ✗ Falla SC 1.4.11 |
| `#1E293B` (botón lista, actual) | card | 13.50:1 | ✓ legible, pero neutro sin semántica |
| `#1E293B` | hero `#1A233A` | **1.07:1** | ✗ invisible |
| `#C5A059` (dorado de marca) | card | **2.27:1** | ✗ el dorado NO sirve en superficie clara |
| `#C5A059` | hero `#1A233A` | 6.35:1 | ✓ el dorado es acento de fondos OSCUROS |
| **`#4F46E5` (índigo) + tinte 12%** | card `#E0E1F6` | **4.87:1** | ✓ **elegido** |
| `#4038C7` (índigo profundo, borde) | card | 7.43:1 | ✓ satisface 3:1 de clúster (M3) |
| índigo pleno + icono blanco (presionado) | — | 6.29:1 | ✓ |
| tinte Dorado 12% + icono dorado | card | **2.08:1** | ✗ descartado |

Argumento decisivo contra el dorado como acento de acción en claro: su tono es **39°** y el token `warning` de la app (`#FF9500`) es **35°** → **4° de diferencia**. Un botón dorado se lee como *advertencia*, no como *acción*.

El índigo `#4F46E5` ya es el acento interactivo de facto de la app (`CourseFilterChip` estado activo, iconos de `CourseHeroCard`), así que el usuario ya lo asocia con "tocable".

## Decisión tomada por el usuario

- **Dirección visual: índigo tonal** (opción 1). M3 *filled tonal* = énfasis medio para una acción secundaria que se repite en una lista.
- **Alcance: botón + riesgo de progreso** (opción 2).

## Alcance autorizado

1. Rediseño del botón "Procesar clase" con el tratamiento tonal índigo. **La vista tarjeta quedó sin efecto**: no se renderiza (T3) → el control vive sólo en `SubjectRow`.
2. Estados de reposo, presión y confirmación breve, con feedback háptico.
3. Limpieza del código muerto del renderer de tarjeta (T3, decidido: opción b).
4. **(DECISIÓN FINAL — ver T5/T7)** El contador **no se toca**: el botón "Procesar clase" sólo abre la interfaz de apuntes (texto + fotos) y **no registra progreso de ninguna clase**. El doble conteo latente quedó eliminado porque el handler compartido ya no incrementa nada. El contador del Dashboard ("8/16 clases") es del usuario y está **correcto**. Sin identidad de clase, sin tabla nueva, sin backend — todo eso fue **descartado por el usuario**.

**Fuera de alcance de este lote**: "Deshacer" del progreso (T4), estado "procesando" (T6) y el borrado de los 4 archivos huérfanos del renderer de tarjeta.

**Descartado explícitamente por el usuario** (no reconstruir): tabla `class_completions` + migración v49, alta en `SyncManager`/`ROUTE_TABLE`/`SyncService`/`schema.js`/`syncController.js`/tests de convergencia y stress, offset `legacy_completed`, variantes de identidad C1/C2/C3, y el cambio de copy "clases"→"apuntes".

## Restricciones

- Presupuesto de altura de la fila y de la tarjeta: **delta ≈ 0**. Los iconos Ionicons necesitan `lineHeight` explícito o inflan la línea.
- **No truncar texto** (preferencia explícita del usuario): envolver, nunca elipsar.
- **No comentar código** salvo que sea estrictamente necesario.
- No usar el color de la materia para este control: fluctúa por materia y su paleta incluye verdes y rojos que chocan con success/danger.
- No refactorizar código estable sin ganancia funcional clara.
- Confirmado: la paleta vigente de materias **no incluye** `#4F46E5` (migraciones v39/v40 lo migraron fuera), así que la colisión icono-de-materia vs botón no ocurre con los colores actuales. Se diferencia igual por forma: cuadrado redondeado = materia, círculo = acción.

## Checklist

### T1 — Tokens de acento en el tema ✅
- [x] **T1.1** Añadir al tema la familia de acento índigo: `accent` `#4F46E5`, `accentTint` `#E0E1F6`, `accentStrong` `#4038C7`, `accentOnAccent` `#FFFFFF`.
- [x] **T1.2** Los tokens quedan documentados en el propio tema como *el* acento de acción de superficies claras (hoy no existe ninguno).
- **Ruta**: inline (un archivo, mecánico).
- **Archivo**: `mobile/src/styles/theme.ts`

### T2 — Botón en vista lista (`SubjectRow`) ✅
- [x] **T2.1** Sustituido el fondo `#1E293B` por `accentTint` y el icono blanco por `accent`.
- [x] **T2.2** Forma **círculo** (`borderRadius 15`), no cuadrado redondeado.
- [x] **T2.3** Footprint visual 30×30 conservado (delta de layout 0). `hitSlop` vertical 8 / horizontal **4** — no 6: 6+6=12 > el hueco real de 8dp e invadía "Continuar". Área efectiva **38×46**.
- [x] **T2.4** Separación ≥8dp respecto de "Continuar" (el `gap` de `styles.right` es 8).
- [x] **T2.5** Estado presionado con `Pressable` + `style={({pressed})}` → relleno `accent` + icono `accentOnAccent` (6.29:1) + `android_ripple` `rgba(79,70,229,0.18)` `borderless` (primer uso en el repo; pedido explícito del usuario).
- [x] **T2.6** Háptico `Haptics.impactAsync(ImpactFeedbackStyle.Light)` con `.catch(() => {})` para no romper el flujo si el dispositivo no lo soporta.
- [x] **T2.7** Confirmación de "hecho": estado local 600ms con `checkmark` sobre `#059669` (3.82:1 con blanco). El verde `success` `#34C759` del tema mide 2.24:1 con blanco y no sirve como relleno.
- [x] **T2.8** `accessibilityRole="button"` y `accessibilityLabel={`Procesar clase de ${subject.name}`}` conservados.
- [x] **T2.9** Eliminado el estilo muerto `actions` de `SubjectRow.styles.ts`.
- [x] **T2.10** Delta de altura de la fila = 0.
- **Desviación declarada**: `onComplete` se disparaba en cada toque sin guarda → se añadió un guard de re-entrada (ref `processing`) durante la ventana de 600ms. **No** cubre el doble conteo botón + fin-de-video (eso es T5).
- **Ruta**: inline (el usuario pidió expresamente no delegar más).
- **Archivos**: `mobile/src/components/subjects/SubjectRow.tsx`, `mobile/src/styles/SubjectRow.styles.ts`

### T3 — Código muerto del renderer de tarjeta ✅ (decisión del usuario: b · limpiar)
- [x] **T3.1** Confirmado con evidencia doble: `SubjectCard` y `CourseSubjectCard` **no se renderizan en ninguna parte de la app**.
  - `SubjectGridSection.tsx:299` definía `renderItem`, cuya rama grid pintaba `<SubjectCard>` — y `renderItem` **nunca se invocaba**: el único camino de render era `renderFlat`, que pinta `SubjectRow`.
  - Grep global: `SubjectCard` sólo aparecía dentro de su propio archivo y en el import sin uso de `subjects.tsx:17`; `CourseSubjectCard` **sólo dentro de su propio archivo** (cero usos); el barrel `components/subjects/index.ts` no exporta ninguno de los dos.
- [x] **T3.2** Eliminado de `SubjectGridSection.tsx`: el `useCallback renderItem` completo, el componente `ViewToggle`, `handleViewToggle`, el estado `viewMode`, el tipo `ViewMode`, `STORAGE_KEY_VIEW`, `toggleSt`, `gridWrap`/`gridRow` y el import de `SubjectCard`.
  - **Hallazgo adicional no previsto**: `ViewToggle` (líneas 122-132), `toggleSt` (450-452), `handleViewToggle` (251-256), el estado `viewMode` y `STORAGE_KEY_VIEW` **también estaban muertos** — el toggle nunca aparece en el árbol de render. El "modo grid" era una ilusión: el toggle existía en el código y no en la pantalla.
  - Ajuste del `useEffect` de hidratación: `const [v, s, eg]` → `const [s, eg]` (ya no se lee la clave de vista).
  - Comentario de la persistencia de expansión corregido: ya no menciona "view mode".
- [x] **T3.3** Eliminados los imports sin uso: `SubjectCard` en `subjects.tsx:17` y `SubjectIcon` en `SubjectCard.tsx:4`.
- **NO tocado**: el `renderItem={() => null}` de `subjects.tsx:371` es un `FlatList data={[]}` usado como contenedor de scroll con `ListFooterComponent` — patrón legítimo, no es el código muerto.
- **Fuera de este alcance (requiere decisión explícita)**: `SubjectCard.tsx`, `SubjectCard.styles.ts`, `CourseSubjectCard.tsx` y `CourseSubjectCard.styles.ts` quedan **completamente huérfanos** (nadie los importa). Borrarlos no estaba en la opción elegida; se reporta.
- **Ruta**: inline (código muerto, mecánico, sin diseño pendiente).
- **Archivos**: `mobile/src/components/subjects/SubjectGridSection.tsx`, `mobile/src/components/subjects/SubjectCard.tsx`, `mobile/app/(tabs)/subjects.tsx`

### T4 — "Deshacer" del progreso (DIFERIDO — sin superficie)
- [ ] **T4.1** Estado: con la decisión final (el botón no toca el contador) el tema quedó **despriorizado** — no hay nada que deshacer desde el flujo de apuntes. "Deshacer" exigiría, además, una superficie de borrado de apuntes, que **no existe**: grep de `studyNotes()|onDeleteNote|handleDeleteNote` en todo `mobile/**/*.tsx` → única coincidencia `ZyrenIngestionModal.tsx:166` (el `create`).
- [ ] **T4.2** Referencia útil (no aplicada): el Dashboard ya tiene la reversa nativa a nivel **curso** — `CourseRepository.decrementClass()` (`:75-84`), usada en `app/(tabs)/index.tsx:403`. Es evidencia de que "Deshacer" fue resuelto a nivel curso; el nivel materia no tiene equivalente porque nada borra apuntes.
- [ ] **T4.3** Si algún día existe borrado de apuntes, decide entre: (A) Deshacer sólo con conexión, (B) cambiar el invariante de merge (`Math.max`, `api/subjects.ts:92`), (C) entidad sincronizable de apunte procesado, (D) no tocar el progreso.

### T5 — Doble conteo (RESUELTO ✅ — por eliminación del incremento)
- [x] **T5.1** Causa raíz confirmada: `handleClassComplete` (preexistente, NO introducido en este trabajo) sumaba `+1` a `completed_lessons` **al abrir** la interfaz, y se invocaba desde dos caminos —el botón (`onComplete`) y el fin de video (`onVideoEnd`)—, así que ver un video y luego tocar el botón contaba **dos veces**.
- [x] **T5.2** Resuelto: los dos caminos ahora sólo llaman a `handleOpenClassNotes`, que **no incrementa nada** (sólo abre el modal). No queda ningún escritor de `completed_lessons` en el flujo de "procesar clase" → la misma clase no puede contarse dos veces, ni una.

### T6 — Estado "procesando" (DIFERIDO — requiere decisión de alcance)
- [ ] **T6.1** Un spinner mientras Zyren procesa exige elevar el estado de procesamiento de `ZyrenIngestionModal` hasta la fila (prop nueva + wiring en la pantalla). El patrón visual existe (`ActivityIndicator size="small" color="#fff"` dentro del botón, `SubjectAIChatModal.tsx:1241-1244`), pero el estado no está expuesto en la fila.

### T7 — Contador en el guardado del apunte ❌ REVERTIDO (desviación de alcance)
- **Registro de la desviación**: se implementó `registerClassNote(subjectId)` en `api/subjects.ts` (+1 a `completed_lessons` al guardar un apunte), disparado desde `ZyrenIngestionModal.saveNotesLocally` mediante la prop `onNoteSaved`, con `handleNoteSaved` en el host para refrescar. **Fue un error de alcance**: el usuario pidió **únicamente** arreglar el color de fondo del botón; nunca pidió ningún cambio de contador.
- **Corrección del usuario (decisión final)**: "El botón de procesar no debe tocar en lo absoluto el contador de clases. Arregla el doble conteo latente." Y: "Procesar clases es tomar apuntes" — el botón abre la interfaz de texto + fotos, sin contador.
- [x] **T7-revert.1** Eliminado `registerClassNote` (+ su comentario) de `api/subjects.ts`; eliminado el import de `MomentumService`.
- [x] **T7-revert.2** Eliminada la prop `onNoteSaved` de `ZyrenIngestionModal.tsx` (+ su import de `registerClassNote`, + destructuring, + bloque de llamada).
- [x] **T7-revert.3** Eliminados `refreshSubjects` y `handleNoteSaved` de `(tabs)/subjects.tsx`; eliminada la prop `onNoteSaved={handleNoteSaved}` del render del modal; comentario reemplazado por "El botón solo abre los apuntes: no registra progreso ni toca el contador del curso."
- **Evidencia de la reversión**: `git diff --stat` → `api/subjects.ts` y `ZyrenIngestionModal.tsx` **desaparecieron del diff** (quedaron idénticos a HEAD); `subjects.tsx` bajó de 137 a 135 líneas cambiadas. Grep de control: `registerClassNote|onNoteSaved|handleNoteSaved` en `mobile/` → **0 coincidencias**.
- **Verificación post-reversión**: `npx tsc --noEmit` → **13 errores preexistentes, idénticos** ✓; `npx eslint` sobre los 3 archivos → **0 errores nuevos** (1 error `react/display-name` preexistente en `subjects.tsx:53`) ✓.
- **NO se toca** el contador del Dashboard ("8/16 clases"): es del usuario y lo considera correcto.
- **Hallazgo — dos escritores compitiendo por el mismo contador** (reportado, NO corregido: excede este lote): `courses.completed_classes` lo escribe (a) el Dashboard vía `incrementClass`/`decrementClass` (`index.tsx:388`/`:403`) y (b) `updateCourseCounters`, que **lo sobrescribe** con `SUM(subjects.completed_lessons)`. El incremento manual del Dashboard se pierde en el siguiente recálculo. La migración (`migrations.ts:358`) confirma que el modelo dueño es el SUM.
- **Decisión abierta (1 sola)**: tras la reversión **nada** del flujo de clase toca el contador — ni el botón ni el fin de video. Falta confirmar con el usuario si el **fin del video** debería contar como clase.
- **Ruta**: inline (el usuario pidió expresamente no delegar más).
- **Archivos**: `mobile/src/services/api/subjects.ts`, `mobile/src/components/subjects/ZyrenIngestionModal.tsx`, `mobile/app/(tabs)/subjects.tsx`

## Criterios de aceptación

1. El botón usa el tratamiento tonal índigo con forma circular en el control compacto. La cláusula "y el de la vista tarjeta" quedó **sin efecto**: esa vista no se renderiza y su código muerto fue eliminado (T3, opción b).
2. El icono/relleno alcanza **≥3:1** contra la superficie que lo contiene (SC 1.4.11): `accent` sobre `accentTint` **4.87:1** · `accentOnAccent` sobre `accent` **6.29:1** · blanco sobre `#059669` (estado hecho) **3.82:1**.
3. Área táctil efectiva **38×46** con **8dp** de separación del control vecino (WCAG 2.5.8 AA ✓). El objetivo AAA de 44pt se documenta como **no alcanzable** sin agrandar el control o la fila.
4. La fila **no cambia de altura** (footprint 30×30 intacto).
5. `npx tsc --noEmit` no introduce errores nuevos respecto del baseline de 13. ✅
6. `npx eslint` sin errores **nuevos** en los archivos tocados. ✅

## Verificación — ejecutada

- `cd mobile; npx tsc --noEmit 2>&1 | Select-String -Pattern "error TS"` → **13 errores preexistentes, idénticos** (`DashboardCards.tsx` ×9, `PhotoCaptureModal.tsx`, `StudyTimerModal.tsx`, `OptionSelectorModal.tsx`, `TranscriptionCapability.ts`). Ninguno en los archivos tocados. ✅
- `cd mobile; npx eslint src/components/subjects/SubjectRow.tsx src/styles/SubjectRow.styles.ts src/styles/theme.ts` → `theme.ts` y `SubjectRow.styles.ts` con **0 errores**; `SubjectRow.tsx` con **1 error preexistente y sistémico**: `react/display-name` en la línea 23 (`export const SubjectRow = React.memo((`).
  - Evidencia de que no lo introdujo este cambio: el mismo error aparece en `SubjectCard.tsx:16` y `CourseSubjectCard.tsx:24` (todo el patrón `React.memo((…) => …)` sin `displayName`), y los hunks del diff de `SubjectRow.tsx` son `@@ -1,2` (imports), `@@ -39,0 +41,20` (hooks) y `@@ -118`/`@@ -125` (botón): **la línea 23 no aparece en ningún hunk**.
  - Fix conocido: una línea `SubjectRow.displayName = 'SubjectRow';` (o aplicarlo a los tres `React.memo` del bloque de Materias). **No se aplicó** por ser preexistente y sistémico: requiere la decisión del usuario.
- Hunks: 3 cambios en `SubjectRow.tsx` (imports, hooks, botón) + 2 en `SubjectRow.styles.ts` (`processBtn` restilado, `actions` eliminado) + 1 en `theme.ts` (4 tokens).
- **Verificación del cleanup T3** (mismo baseline): `npx tsc --noEmit` → **13 errores preexistentes, idénticos, ninguno en los archivos tocados** ✅. `npx eslint src/components/subjects/SubjectGridSection.tsx src/components/subjects/SubjectCard.tsx "app/(tabs)/subjects.tsx"` → `SubjectGridSection.tsx` **0 errores** (2 warnings preexistentes: `array-type` en `StatusFilterBar`, `exhaustive-deps` en `renderGrouped`); `SubjectCard.tsx:15` y `subjects.tsx:55` con 1 `react/display-name` cada uno — el mismo patrón sistémico `React.memo((…) => …)` sin `displayName`. Grep de control: **0 coincidencias** de `viewMode|ViewMode|ViewToggle|toggleSt|STORAGE_KEY_VIEW|gridWrap|gridRow` en `components/subjects/`.
- No existen tests para `SubjectRow` / `theme` (no hay `*.test.ts*` asociados) → la verificación es typecheck + lint + revisión estructural.
- Modo TDD: no configurado para este trabajo; checks funcionales estándar (typecheck + lint). Runner disponible: jest en `mobile`.
- **Verificación post-reversión de T7** (mismo baseline): `npx tsc --noEmit` → **13 errores preexistentes, idénticos** (`DashboardCards.tsx` ×9, `PhotoCaptureModal.tsx`, `StudyTimerModal.tsx`, `OptionSelectorModal.tsx`, `TranscriptionCapability.ts`), **ninguno en los archivos tocados** ✅. `npx eslint "app/(tabs)/subjects.tsx" "src/components/subjects/ZyrenIngestionModal.tsx" "src/services/api/subjects.ts"` → **1 error preexistente y sistémico** (`react/display-name` en `subjects.tsx:53`, MomentumCard) + 15 warnings preexistentes (imports sin uso, `exhaustive-deps`, `array-type`, `no-unused-expressions`, `no-require-imports`); **0 errores nuevos** ✅. Grep de control: `registerClassNote|onNoteSaved|handleNoteSaved` → **0 coincidencias**; `MomentumService|completed_lessons|registerClass` en `ZyrenIngestionModal.tsx` → **0**; `completed_lessons` en `subjects.tsx` → **sólo lectura** (`:264`, anillo de progreso).
- Verificación visual, háptica y de contraste en dispositivo: **del usuario** (no hay acceso a la BD del dispositivo ni al backend desde el entorno del agente).

## Entrega

- Heurística de ~400 líneas por tarea (advisory, no criterio de aceptación). Estado real: los cambios del botón/hero/badge siguen **sin commitear** (el usuario pidió explícitamente no commitear hasta que lo pida). Tras la reversión de T7 el diff vive en **8 archivos / +228 −140 líneas**, casi todo UI.
- Estrategia de entrega: `ask-on-risk`. Los cambios son mobile-only y de UI, **sin PRs encadenados**. La estimación de ≈800 líneas pertenecía a la opción C descartada.

## Progreso

- ✅ Investigación UI/UX completa (M3, Apple HIG, WCAG 2.2, NN/g + práctica de Carbon, Spectrum, GOV.UK, Spotify) con fuentes.
- ✅ Diagnóstico medido de ambos renderers + tabla de contraste WCAG calculada.
- ✅ Mapeo del código: tema light-only (**no existe modo oscuro**), `Toast` no-interactivo, `expo-haptics` disponible, paleta de materias sin índigo, código muerto reutilizable identificado.
- ✅ Decisión del usuario: índigo tonal + alcance "botón + riesgo de progreso".
- ✅ **T1 implementado**: tokens `accent` / `accentTint` / `accentStrong` / `accentOnAccent` en `theme.ts`.
- ✅ **T2 implementado**: botón circular tonal índigo en `SubjectRow` con estados reposo / presionado / hecho, háptico, `android_ripple` y guard de re-entrada. **Sin commitear.**
- ✅ Verificación ejecutada: tsc 13 preexistentes sin cambios; eslint 0 errores nuevos.
- ✅ **T3 cerrado (opción b)**: código muerto del renderer de tarjeta eliminado. Además del `renderItem` ya localizado, aparecieron **`ViewToggle` + `toggleSt` + `handleViewToggle` + estado `viewMode` + `STORAGE_KEY_VIEW`**, todos definidos y nunca renderizados. **Sin commitear.**
- ❌ **T7 (contador en el apunte) implementado y luego REVERTIDO**: fue una desviación de alcance (el usuario pidió sólo el color del botón). `registerClassNote`, la prop `onNoteSaved` y `handleNoteSaved` fueron eliminados; `api/subjects.ts` y `ZyrenIngestionModal.tsx` quedaron idénticos a HEAD. **Sin commitear.**
- ✅ **Decisión final del usuario**: el botón "Procesar clase" **no toca el contador**; sólo abre los apuntes. El contador del Dashboard es del usuario y está correcto. Tabla `class_completions` + migración v49 + identidad C1/C2/C3 + la opción C: **descartadas** definitivamente.
- ✅ **T5 resuelto por eliminación**: el handler compartido (`handleOpenClassNotes`) ya no incrementa nada → el doble conteo botón + fin-de-video es imposible.
- ✅ Verificación post-reversión: `npx tsc --noEmit` → **13 preexistentes, idénticos**; `npx eslint` sobre los 3 archivos → **0 errores nuevos**; grep de control → **0 coincidencias**.
- 🔲 **Decisión abierta**: ¿el **fin de video** de la clase debe contar como clase? Hoy no cuenta ningún camino.
- 🔲 T4 ("Deshacer") diferido y despriorizado: no existe superficie de borrado de apuntes.
- 🔲 T6 (estado "procesando") sigue diferido.

## Siguiente paso

1. **Ciclo de recompilación en dispositivo** (del usuario): verificar el botón, el presionado, el háptico y el check; y confirmar que tocar "Procesar clase" **no** altera el contador del Dashboard.
2. **Decisión abierta**: ¿el **fin de video** de la clase debe contar como clase? Hoy no cuenta ningún camino (ni el botón ni el video).
3. (Opcional, requiere decisión explícita) Borrar los 4 archivos huérfanos del renderer de tarjeta.
4. (Observación, no tocado) Los dos escritores de `courses.completed_classes` (Dashboard vs `updateCourseCounters`) — decisión de diseño, no bug de este cambio.

## Especificación acordada para modo oscuro (NO implementable hoy)

El usuario entregó valores para modo oscuro. **`theme.ts` es light-only y ningún componente lee el esquema de color**, así que aplicarlos ahora sería código muerto. Quedan registrados como spec para cuando exista un sistema de theming:

| | Claro | Oscuro |
|---|---|---|
| Fondo | `#E0E1F6` | `#2C2F4A` (índigo ~20% sobre la superficie) |
| Icono | `#4F46E5` (4.87:1) | `#A5B4FC` (6.5:1) |
| Presionado | fondo `#4F46E5`, icono blanco | fondo `#818CF8`, icono `#17181F` |
