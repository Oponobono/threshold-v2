# Patrón Visual del Dashboard

El Dashboard de Threshold utiliza un lenguaje visual estructurado para presentar datos complejos de manera procesable. En lugar de ser un simple contenedor de métricas, cada componente debe acompañar al usuario desde la comprensión del estado hasta la acción.

Este documento establece la gramática visual que deben seguir los *Cards* del Dashboard para mantener coherencia a medida que la aplicación escala (p. ej., estado de aprendizaje, repasos diarios, próximos eventos, rendimiento en evaluaciones).

## Anatomía de un Card

Los cards del Dashboard se estructuran verticalmente siguiendo 4 bloques secuenciales que guían el modelo mental del usuario:

### 1. Identidad (Título y Contexto)
**Responde a:** *¿De qué me está hablando este card?*
- **Layout:** Fila superior (`flexDirection: 'row'`).
- **Elementos:** Un icono semántico (`MaterialCommunityIcons` o similar) seguido de un título corto, directo y centrado en la intención (ej. "Repasos de hoy" en lugar de "Tarjetas pendientes").
- **Tono:** Humano, claro, nunca técnico ni alarmista.

### 2. Información Principal (Métricas Clave)
**Responde a:** *¿Cuál es la fotografía actual?*
- **Layout:** Fila destacada con fondo contrastante (ej. `theme.colors.card` o `F2F2F7`).
- **Elementos:** Números grandes con pesos tipográficos fuertes (`800`) acompañados de *labels* pequeños (`500`).
- **Regla de oro:** No más de 3 métricas en línea para no abrumar cognitivamente. Deben leerse de un solo vistazo (ej. `32 tarjetas • 5 materias • ≈19 min`).

### 3. Contexto o Desglose Operativo (El "Por qué" o "Cómo")
**Responde a:** *¿Dónde está el esfuerzo o el problema?*
- **Layout:** Lista vertical o componente visual secundario (ej. un gráfico de anillo para salud, o una lista de "Empieza por" para repasos).
- **Elementos:** Si hay un elemento destacado, darle tratamiento de "héroe secundario" (fondo sutilmente tintado). Para listas, limitar visualmente a 3-4 ítems y agrupar el resto bajo un "+N más".
- **Comportamiento:** Si la lista es vacía o los datos no ameritan desglose, este bloque puede colapsar suavemente.

### 4. Acción Guiada o Conclusión (CTA y Footer)
**Responde a:** *¿Por qué me importa y qué hago ahora?*
- **Layout:** Fila inferior separada por un divisor (`theme.colors.border`).
- **Elementos:** 
  - A la izquierda: Un texto de apoyo (hint) que traduzca el impacto de la acción al modelo de dominio (ej. "Completar esta sesión ayudará a mantener tu conocimiento consolidado").
  - A la derecha: Un CTA primario (botón con color de acento y elevación visual).
- **Regla de oro:** El botón es el elemento de mayor peso visual del card. No debe competir con bordes o textos secundarios pesados.

## Estados Importantes

Todo card del Dashboard debe diseñar explícitamente para los siguientes estados:

- **Empty State (Estado Vacío):** Nunca ocultar silenciosamente un card central a menos que sea temporal. Si el usuario terminó sus tareas, mostrar un *Empty State* positivo (ej. "¡Todo al día! Disfruta tu día.").
- **Animaciones Discretas:** Usar `LayoutAnimation.easeInEaseOut` al cambiar entre estados (ej. resolver un grupo de tarjetas) para dar sensación de aplicación viva sin distraer.
- **Microcopys Dinámicos:** Los textos del footer y del CTA deben ser capaces de adaptarse al contexto (ej. nombrar las 2 materias más críticas en lugar de usar textos genéricos).

## Ejemplo de Implementación (DailyReviewCard)
1. **Identidad:** 📖 Repasos de hoy
2. **Métricas:** 32 tarjetas • 5 materias • ≈19 min
3. **Desglose:** 🎯 Empieza por: Matemáticas (12 tarjetas). Otras materias: Historia, Inglés...
4. **Acción:** Hint: "Esta sesión reducirá el riesgo de olvido en Matemáticas." CTA: [Comenzar →]


---
**Tags:** #architecture
