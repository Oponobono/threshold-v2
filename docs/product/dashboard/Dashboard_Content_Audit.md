# Dashboard Content Audit
> Documento normativo de producto — v1.0
> Define los criterios de admisión, permanencia y evolución de cualquier bloque del Dashboard.
> Última revisión: 2026-07-09

---

## Por qué existe este documento

> **El Dashboard no compite por atención; la administra.**

El Dashboard de Threshold no es una colección de widgets. Es una conversación orquestada con el estudiante. Cada bloque ocupa espacio cognitivo limitado del usuario — ese espacio es un recurso escaso que debe justificarse con rigor.

Este documento define los criterios para admitir cards nuevos, eliminar los existentes y gobernar su evolución. Un card que no supere la auditoría no llega a producción.

---

## Dashboard Budget

Cada nuevo card consume recursos escasos e irrecuperables:

| Recurso | Descripción |
|---|---|
| **Espacio vertical** | Desplaza otros bloques hacia abajo o los saca del viewport |
| **Atención** | El usuario tiene un presupuesto limitado de foco por sesión |
| **Memoria de trabajo** | Cada elemento nuevo que el cerebro debe procesar ocupa RAM cognitiva |
| **Tiempo de lectura** | Cada segundo extra antes del primer CTA es fricción |

Añadir un card no es gratis. La pregunta correcta nunca es *"¿cabe?"*, sino **"¿vale el coste?"**

Estos recursos son finitos. El Dashboard no puede optimizar simultáneamente todos los objetivos: **toda incorporación implica un coste de oportunidad**. Agregar un nuevo bloque requiere justificar por qué merece reemplazar atención que actualmente recibe otro bloque. En caso de duda, la decisión por defecto es no añadirlo.

---

## Los 7 Criterios de Admisión

Para cada bloque o card propuesto, se evalúan los siguientes criterios:

| # | Criterio | Descripción |
|---|---|---|
| 1 | **Pregunta única** | ¿Responde exactamente UNA pregunta del usuario? Si responde más de una, está haciendo demasiado. |
| 2 | **Habilita una decisión** | ¿El usuario puede tomar una decisión después de leerlo? Información ≠ decisión. |
| 3 | **Conduce a una acción** | ¿El usuario puede hacer algo desde aquí, o solo puede leer? |
| 4 | **Valor de anticipación** | ¿Ayuda al usuario **antes** de que ocurra un problema? Un copiloto anticipa, nunca reacciona. |
| 5 | **No duplica** | ¿Otro card ya cubre esta información? Si es así, el nuevo card no aporta valor marginal. |
| 6 | **Frecuencia de cambio** | ¿El dato es suficientemente dinámico para vivir en el dashboard? Un dato semestral no pertenece a una pantalla diaria. |
| 7 | **Coste cognitivo bajo** | ¿El usuario entiende el mensaje en segundos sin interpretar múltiples métricas? El dashboard es una pantalla de orientación, no de análisis. |

> **Aclaración sobre el criterio 7:** Dos cards pueden responder la misma pregunta con coste cognitivo muy distinto. `"Memoria: 82%, Confianza: 74%, Retención: 85%"` y `"Tu memoria está sana. Solo necesitas un repaso corto."` informan lo mismo — pero el segundo requiere una fracción del esfuerzo mental. En un dashboard de orientación, siempre se prefiere el segundo.

> **Regla de oro:** Si un card falla en 3 o más criterios, no merece ocupar espacio en el dashboard. Si falla en "Duplica" + "Habilita una decisión", es candidato inmediato a eliminación.

---

## Invariantes de Diseño (No Negociables)

Además de los criterios de admisión, estos invariantes rigen para todos los bloques existentes y futuros:

1. **KnowledgeHealth NO debe tener CTA.** Su naturaleza es de diagnóstico puro. Añadirle un botón rompe la separación entre Diagnóstico (¿cómo estoy?) y Acción (¿qué hago?). Si un usuario necesita actuar, DailyReview es el siguiente bloque.

2. **DailyReview es el único punto de entrada a los repasos.** No puede existir un segundo botón, link o ActionCircle en el dashboard que abra FlashcardsModal. Un único CTA dominante.

3. **"Lo Siguiente" responde urgencia temporal, no igualdad de peso.** En el futuro, este bloque debe priorizar dinámicamente (una clase en 10 min pesa más que un examen en 3 semanas). Hoy muestra los dos; mañana debe ordenarlos por urgencia.

4. **Las Herramientas responden "¿Qué herramienta necesito?", no "¿Cómo estudio?".** Pomodoro, Audio y Scanner son auxiliares de captura y concentración — no métodos de estudio. Esa distinción importa porque define qué herramientas pueden vivir aquí y cuáles no.

---

## Estado Actual de los Bloques

### ✅ KnowledgeHealthCard — Mantener

| Criterio | Estado | Nota |
|---|---|---|
| Pregunta única | ✅ | "¿Cómo está mi aprendizaje general?" |
| Habilita decisión | ✅ | "Hoy debería estudiar / mi álgebra está en riesgo" |
| Conduce a acción | ❌ | Intencional. Es diagnóstico puro. **No debe tener CTA.** |
| Valor de anticipación | ✅ | Avisa antes del olvido |
| No duplica | ✅ | — |
| Frecuencia de cambio | ✅ | Diaria (cambia con cada repaso completado) |

**Oportunidad:** El score puede ser difícil de interpretar para usuarios nuevos. Considerar una línea contextual breve ("Tu memoria está en buen estado") sin añadir un CTA.

---

### ✅ DailyReviewCard — Mantener

| Criterio | Estado | Nota |
|---|---|---|
| Pregunta única | ✅ | "¿Qué debo hacer ahora?" |
| Habilita decisión | ✅ | "Empiezo la sesión de repaso" |
| Conduce a acción | ✅ | Botón "Comenzar" → FlashcardsModal |
| Valor de anticipación | ✅ | Estudias antes de olvidar |
| No duplica | ✅ | — |
| Frecuencia de cambio | ✅ | Por sesión (cambia al completar repasos) |

**Nota de diseño:** El footer motivacional ("Esta sesión reducirá el riesgo de olvido en Álgebra") responde implícitamente "¿Por qué debería hacerlo?". Mantenerlo: un CTA sin motivo genera menos adherencia.

---

### ✅ "Lo Siguiente" (Clase + Examen, grid 2 columnas) — Mantener

| Criterio | Estado | Nota |
|---|---|---|
| Pregunta única | ✅ | "¿Qué se aproxima en mi agenda académica?" |
| Habilita decisión | ✅ | "Prepárate para este examen" / "Tienes clase en 30 min" |
| Conduce a acción | ✅ | Tap Clase → `/subjects/:id`. Tap Examen → modal de detalle |
| Valor de anticipación | ✅ | Te prepara antes del evento |
| No duplica | ✅ | — |
| Frecuencia de cambio | ✅ | Por hora (clase) / por día (examen) |

**Evolución futura:** Hoy los dos MetricCards tienen el mismo peso visual. En el futuro este bloque debe ser un **orquestador temporal**: una clase en 10 min pesa más que un examen en 3 semanas. El bloque debería cambiar su presentación según la urgencia relativa. No implementar aún; dejar que el diseño actual madure primero.

**Mejora pendiente (P3):** Añadir tiempo relativo al subtext de Próxima Clase cuando es hoy. `"9:00 - 10:30 · en 45 min"` convierte un dato absoluto en urgencia relativa accionable.

---

### ❌ "Resumen" (todaySchedules.length) — ELIMINADO

| Criterio | Estado | Nota |
|---|---|---|
| Pregunta única | ❌ | "¿Cuántas clases tengo hoy?" no es una pregunta de alta incertidumbre |
| Habilita decisión | ❌ | Un número de clases no habilita ninguna decisión |
| Conduce a acción | ⚠️ | Débil. Solo abre SchedulePlannerModal |
| Valor de anticipación | ❌ | No evita nada |
| No duplica | ❌ | "Lo Siguiente" ya cubre la clase próxima |
| Frecuencia de cambio | ❌ | Semestral. Dato prácticamente estático |

**Falla 4 de 6 criterios. Eliminado.**

Nadie abre la aplicación pensando "¿cuántas clases tengo hoy?". El usuario abre la aplicación pensando "¿qué hago?", "¿tengo algo urgente?", "¿voy bien?". El Resumen responde una pregunta de baja incertidumbre que no pertenece al dashboard.

El acceso al SchedulePlanner se mueve al FAB o al header del Ecosistema.

---

### ✅ Ecosistema de Cursos y Materias — Mantener

| Criterio | Estado | Nota |
|---|---|---|
| Pregunta única | ✅ | "¿Dónde quiero entrar a estudiar?" |
| Habilita decisión | ✅ | "Abro Física" / "Reviso mi curso de Udemy" |
| Conduce a acción | ✅ | Tap HeroCard → filtra materias. Tap SubjectTile → navega |
| Valor de anticipación | ⚠️ | Neutro (es exploración, no anticipación) |
| No duplica | ✅ | — |
| Frecuencia de cambio | ⚠️ | Semestral, pero su rol es de biblioteca contextual |

**Nota:** La frecuencia baja es aceptable aquí porque es el bloque de Exploración, no de Diagnóstico. Un usuario no necesita que la biblioteca cambie cada día.

**Oportunidad:** El tracker `completed_classes/total_classes` está enterrado en scroll. Evaluar si pertenece a la vista de cada materia.

---

### ⚠️ Herramientas de Estudio — Mejorar

| Criterio | Estado | Nota |
|---|---|---|
| Pregunta única | ✅ | "¿Qué herramienta necesito?" |
| Habilita decisión | ✅ | "Inicio un pomodoro" / "Grabo una nota de voz" |
| Conduce a acción | ✅ | Cada tool tiene acción directa |
| Valor de anticipación | ⚠️ | Neutro (son herramientas auxiliares) |
| No duplica | ⚠️ | **ActionCircle de Flashcards duplica DailyReview** |
| Frecuencia de cambio | N/A | Herramientas, no datos |

**Cambio requerido (P2):** Eliminar el ActionCircle de Flashcards. El único punto de entrada a los repasos es DailyReview. Audio Recorder y Document Scanner son herramientas de *captura*, no de repaso, y sí pertenecen aquí.

---

### ⚠️ GroupPerformanceLeaderboard — Condicional

| Criterio | Estado | Nota |
|---|---|---|
| Pregunta única | ✅ | "¿Cómo voy en relación a mis compañeros?" |
| Habilita decisión | ⚠️ | Motivación social, no decisión de estudio directa |
| Conduce a acción | ❌ | Solo lectura |
| Valor de anticipación | ❌ | Retrospectivo |
| No duplica | ✅ | — |
| Frecuencia de cambio | ✅ | Diaria/semanal |

**Mantener condicional** (solo visible si el usuario pertenece a un grupo). Para la mayoría de usuarios no existe, por lo que es inocuo. Para usuarios con grupos, puede ser motivador.

Evaluar a futuro si pertenece a una pestaña de "Comunidad" en lugar del dashboard principal.

---

## Jerarquía Temporal del Dashboard

> La posición vertical de un bloque está fuertemente correlacionada con la velocidad a la que cambia el contexto que representa.

El Dashboard prioriza lo más dinámico. Esta jerarquía explica el layout completo — no por importancia, sino por frecuencia de cambio:

| Nivel | Temporalidad | Frecuencia | Bloques actuales |
|---|---|---|---|
| **1 — Inmediato** | Minutos / horas | Cambia durante la sesión | Lo Siguiente (clase en 15 min, examen hoy), DailyReview |
| **2 — Diario** | Una vez al día | Cambia con cada repaso completado | KnowledgeHealth, Leaderboard |
| **3 — Permanente** | Semestral / sin cambio | Prácticamente estático | Ecosistema de Cursos y Materias, Herramientas |

> Un dato permanente en la parte superior del dashboard es casi siempre una señal de diseño incorrecto. Lo permanente pertenece al fondo o a otra pantalla.

---

## Matriz de Decisión Consolidada

| Bloque | Pregunta | Decisión | Acción | Anticipa | No Duplica | Temporalidad | Impacto | Veredicto |
|---|:---:|:---:|:---:|:---:|:---:|---|---|---|
| KnowledgeHealth | ✅ | ✅ | ❌* | ✅ | ✅ | Diaria | **Muy Alto** | ✅ Mantener |
| DailyReview | ✅ | ✅ | ✅ | ✅ | ✅ | Por sesión | **Muy Alto** | ✅ Mantener |
| Lo Siguiente | ✅ | ✅ | ✅ | ✅ | ✅ | Por hora/día | **Alto** | ✅ Mantener |
| ~~Resumen~~ | ❌ | ❌ | ⚠️ | ❌ | ❌ | Semestral | **Ninguno** | ❌ **Eliminado** |
| Cursos + Materias | ✅ | ✅ | ✅ | ⚠️ | ✅ | Semestral | **Medio** | ✅ Mantener |
| Herramientas | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | N/A | **Bajo** | ⚠️ Mejorar |
| Leaderboard | ✅ | ⚠️ | ❌ | ❌ | ✅ | Diaria | **Muy Bajo** | ⚠️ Condicional |

*KnowledgeHealth: la ausencia de CTA es intencional e invariante.

**Definición de niveles de Impacto:**

| Impacto | Definición |
|---|---|
| **Muy Alto** | Sin este bloque el Dashboard pierde su misión principal. |
| **Alto** | Reduce significativamente la incertidumbre diaria. |
| **Medio** | Facilita la exploración o navegación hacia contenido relevante. |
| **Bajo** | Mejora la experiencia pero no cambia decisiones de estudio. |
| **Muy Bajo** | Valor opcional o contextual para un subconjunto de usuarios. |

> **Uso de la columna Impacto:** En caso de restricción de espacio (pantallas pequeñas, modo compacto), los bloques de menor impacto desaparecen primero. El orden de eliminación sería: Leaderboard → Herramientas → Cursos+Materias → Lo Siguiente → KnowledgeHealth → DailyReview.

---

## Cómo usar este documento para cards futuros

Antes de implementar cualquier nuevo card (ej. `WeeklyProgressCard`, `LearningInsightsCard`, `GradeTrackerCard`), completar esta ficha:

```
## Propuesta: [NombreDelCard]

**Pregunta que responde:**
**Decisión que habilita:**
**Acción que produce:**
**Valor de anticipación:**
**¿Duplica algún bloque existente?**
**Frecuencia de cambio del dato:**
**Temporalidad:** Inmediata / Diaria / Permanente
**Impacto estimado:** Muy Alto / Alto / Medio / Bajo / Muy Bajo

| Criterio | Estado | Nota |
|---|---|---|
| Pregunta única | ✅/❌ | |
| Habilita decisión | ✅/❌ | |
| Conduce a acción | ✅/❌ | |
| Valor de anticipación | ✅/❌ | |
| No duplica | ✅/❌ | |
| Frecuencia de cambio | ✅/❌ | |
| Coste cognitivo bajo | ✅/❌ | |

**Veredicto propuesto:** ✅ Implementar / ⚠️ Revisar / ❌ Rechazar
**Justificación:**
```

> Si el veredicto es ❌, la funcionalidad puede existir en otra pantalla (vista de materia, configuración, perfil), pero no en el dashboard.

---

## Principio de Sustracción

> Todo nuevo card debe demostrar por qué merece existir.

El objetivo del Dashboard no es crecer indefinidamente, sino mantenerse claro. Si un nuevo bloque no aporta más valor que el coste cognitivo y espacial que introduce, debe vivir en otra pantalla.

En caso de duda, **la decisión por defecto es no añadirlo**.

Este principio es el antídoto contra el feature creep. Un dashboard que crece sin criterio deja de ser una conversación y se convierte en una colección de widgets sin narrativa. El Dashboard de Threshold no es un lugar donde "caben más cosas" — es un espacio cuidadosamente curado para guiar al estudiante con la mínima carga cognitiva posible.

---

## Nota para v1.1 — Principio de Evidencia (pendiente)

> Ningún nuevo card se incorpora únicamente porque "parece útil".

Toda incorporación al Dashboard debe estar respaldada por al menos una de las siguientes fuentes:

- **Investigación con usuarios** — observación directa de comportamiento real.
- **Benchmark de productos relevantes** — evidencia de que soluciones similares funcionan en contextos comparables.
- **Literatura científica o principios consolidados de UX** — psicología cognitiva, spaced repetition, carga mental.
- **Métricas de uso del propio producto** — datos que demuestren una necesidad no cubierta.

Este principio protege contra dos enemigos distintos: el feature creep (ya cubierto por la Sustracción) y la **intuición del equipo**. Una idea puede parecer brillante internamente y resultar innecesaria en el uso real. El Principio de Evidencia obliga a validar antes de implementar, no después.

*Este principio se elevará a criterio formal en v1.1 una vez que el producto tenga suficientes usuarios para producir métricas de uso propias.*



---
**Tags:** #dashboard
