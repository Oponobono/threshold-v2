# Dashboard Validation Plan
> Fase 2: Validación y Métricas
> Estado: Draft inicial (Sprint 2)

---

## El Objetivo de la Validación

Durante la Fase 1, el Dashboard fue transformado de un layout basado en componentes (Cursos, Materias, Clases) a un **proceso de decisión** basado en estados mentales (Orientación, Foco, Exploración). 

La Fase 2 abandona el diseño estructural y se centra estrictamente en la medición. El objetivo ya no es responder *"¿cuál es el mejor diseño?"*, sino *"¿cómo interactúa la realidad con nuestro modelo?"*.

Las decisiones futuras sobre el Dashboard se tomarán basándose en los resultados de este documento (Principio de Evidencia), no en intuición ni debate.

---

## Matriz de Hipótesis

Para cada cambio estructural introducido en la Fase 1, establecemos una hipótesis, una métrica para medirla y un criterio claro de éxito.

| Hipótesis | Métrica Principal | Criterio de Éxito | Método de Validación |
|---|---|---|---|
| **1. Orientación Rápida**<br>El Knowledge Health y el Daily Review se entienden de un vistazo sin esfuerzo cognitivo. | Tiempo hasta la primera acción significativa tras abrir la app. | **< 3 segundos** en el 80% de las sesiones. | Telemetría / Test de usabilidad. |
| **2. Foco Único**<br>Daily Review es reconocido instantáneamente como el único CTA dominante para estudiar. | CTR (Click-Through Rate) del botón "Comenzar" en sesiones con repasos pendientes. | **> 75%** de las sesiones inician aquí. | Analytics de eventos. |
| **3. Anticipación Temporal**<br>El "Tiempo Relativo" (ej. *En 42 min*) reduce la fricción y mejora la puntualidad percibida. | Interacción con la tarjeta "Próxima Clase" vs "Resumen" anterior. | Disminución de llegadas tarde auto-reportadas / feedback positivo. | Entrevistas / Feedback in-app. |
| **4. Jerarquía Vertical**<br>El Ecosistema (Cursos/Materias) se usa para exploración, no interfiere con la orientación inicial. | Profundidad de scroll (Scroll Depth) en los primeros 10 segundos. | El **90%** de las sesiones iniciales ocurren "Above the Fold". | Mapas de calor / Telemetría. |
| **5. Utilidad de Herramientas**<br>Las herramientas de captura (Scanner/Audio) son útiles pero secundarias. | Frecuencia de uso por sesión de estudio. | Uso sostenido (>10% de sesiones) sin eclipsar el repaso FSRS. | Analytics de eventos. |

---

## Ciclo de Aprendizaje (El Proceso)

1. **Investigación & Definición** (Completado en Fase 1)
2. **Especificación & Desarrollo** (Completado en Fase 1)
3. **Observación Silenciosa** (Actual - Fase 2)
   - Congelamiento de funcionalidades ("code freeze" del dashboard).
   - Recolección de telemetría y comportamiento orgánico.
4. **Análisis de Evidencia**
   - Comparación de resultados reales vs. Criterios de Éxito.
5. **Iteración Basada en Datos**
   - Retomar el desarrollo (Fase 3) atacando exclusivamente las hipótesis fallidas o los "pain points" validados.

---

## Próximos Pasos (Observación Manual Inmediata)

Antes de implementar telemetría compleja, durante las próximas 2 semanas, el equipo usará la app diariamente anotando:

- *¿Qué fue lo primero que miré al abrir la app?*
- *¿Qué bloque ignoré por completo en toda la semana?*
- *¿Tuve que hacer alguna resta mental o esfuerzo cognitivo?*
- *¿Hice scroll involuntario buscando algo?*

**Nota de Diseño:** No se admitirán nuevos bloques (cards) hasta que esta matriz de validación tenga al menos 14 días de datos respaldando su comportamiento actual.
