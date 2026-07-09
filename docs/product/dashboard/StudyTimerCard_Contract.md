# StudyTimerCard — Contrato de Producto
> Versión 1.0 — estabilizada tras revisión de producto.

---

## Principio rector

> **El espacio libre no es un error de diseño. El contenido innecesario sí lo es.**

Cuando un espacio queda vacío en el card, no se busca llenarlo con métricas, badges o etiquetas. El vacío deliberado es el resultado de haber eliminado todo lo que no era esencial. Esta idea es una extensión directa de la filosofía del Dashboard (Principio de Sustracción).

---

## Contexto de uso

El usuario consulta el temporizador durante una sesión de estudio activa. Ese momento dura **menos de 1 segundo**. La pantalla se desbloquea brevemente y vuelve al bloqueo.

En ese segundo, el usuario solo puede procesar una sola cosa.

---

## La pregunta que responde

> **¿Cuánto falta para terminar esta sesión?**

No:
- ¿Qué modo estoy usando? *(lo elegí hace 2 minutos)*
- ¿A qué hora empecé? *(el cronómetro ya lo implica)*
- ¿Está activa? *(el número moviéndose lo comunica)*
- ¿Cuántas sesiones hice esta semana? *(no es relevante ahora)*

---

## Lo que el componente nunca muestra

| Elemento | Razón |
|---|---|
| Hora de inicio (`09:18`) | Redundante con el cronómetro. |
| Badge de modo (`Pomodoro`) | Configuración técnica, no contexto de sesión. |
| Footer "Sesión en curso" | El número moviéndose ya lo comunica. |
| Campo de intención de texto libre | Alta fricción, normalmente vacío. Diseñar para la excepción es un error. |
| Estadísticas históricas | No son relevantes durante la sesión. |

---

## Lo que comunica — y cómo

### 1. El tiempo (texto)
El único elemento textual obligatorio. Grande, legible en < 1 segundo.

### 2. El tipo de sesión (color, no texto)
El modo no se anuncia con un label. Se comunica a través del color del anillo SVG. El usuario lo aprende como un semáforo.

| Modo | Color del anillo |
|---|---|
| Concentración (Pomodoro) | Azul primario |
| Modo libre (Threshold) | Morado |
| Descanso corto | Verde |
| Descanso largo | Naranja |

Sin escribir absolutamente nada. Sin badges. Solo color.

### 3. El contexto de la sesión (texto automático, opcional)
Si el usuario seleccionó una materia en el modal de configuración, el card puede mostrar:

```
Estudiando
Álgebra
```

Este contexto es **derivado automáticamente** de la configuración — nunca ingresado como texto libre. Si no hay materia seleccionada, el espacio no existe.

**Regla de oro del contexto:** Solo se muestra si reduce incertidumbre durante la sesión. "Estudiando Álgebra" orienta. "Inicio 09:18" no orienta.

### 4. El anillo como protagonista adaptativo
Cuando no hay texto de contexto, el anillo no convive con un espacio vacío. **El anillo crece** para ocupar el protagonismo visual. El layout es responsive al contenido, no fijo.

- Sin materia: anillo grande, centrado, tiempo dentro.
- Con materia: anillo estándar, texto de contexto a su lado.

### 5. Vida visual durante sesión activa (animación, no texto)
Cuando la sesión está activa, el card lo comunica visualmente:

- El anillo tiene un **glow perimetral extremadamente sutil** en el color del modo.
- La libélula respira con **mayor amplitud y lentitud** cuando `isActive`.
- El ritmo es el de **Apple Watch**, no el de una app de gaming.

> Criterio de calibración: Si un usuario mira desde lejos piensa "sigue corriendo". Si piensa "¿qué brilla?", el glow es demasiado agresivo.

---

## Reglas de configuración vs. visualización

| Responsabilidad | Dónde ocurre |
|---|---|
| Elegir modo | Modal de configuración |
| Elegir duración | Modal de configuración |
| Seleccionar materia | Modal de configuración |
| Mostrar tiempo restante | Card |
| Mostrar contexto derivado | Card (solo lectura) |
| Mostrar progreso visual | Card |

**El card nunca configura. Solo muestra.**

---

## Estados del componente

| Estado | Protagonista visual | Texto de contexto |
|---|---|---|
| **Inactivo** | Anillo grande (sin progreso) | Ninguno |
| **Activo sin materia** | Anillo grande + glow sutil | Ninguno |
| **Activo con materia** | Anillo estándar + glow sutil | "Estudiando [Materia]" |
| **Pausado** | Anillo estático (sin glow) | "Estudiando [Materia]" si existe |

---

## Preguntas resueltas

| Pregunta | Decisión |
|---|---|
| ¿La intención se configura en el modal o en el card? | **En el modal. El card solo muestra.** |
| ¿Glow visual durante sesión activa? | **Sí. Extremadamente sutil. Respiración, no iluminación.** |
| ¿Qué pasa con el espacio cuando no hay materia? | **El anillo crece. El espacio no existe si no hay contenido que justifique su presencia.** |
| ¿Texto libre para intención? | **No. Introduce fricción y estará vacío el 80% del tiempo.** |


---
**Tags:** #dashboard
