# StudyTimerCard — Estados Visuales
> Documento complementario al *StudyTimerCard_Contract.md*. Define estrictamente la composición visual del componente en sus distintos estados.

Este documento sirve como "Fase de Validación Visual". Responde a la pregunta de cómo se distribuye el espacio físico del componente antes de escribir una sola línea de código, garantizando que el diseño no se rompa bajo diferentes contextos (sesiones largas, ausencia de materia, pausas, etc.).

---

## Anatomía General

El componente asume una caja rectangular horizontal (aprox. 390x140px). Su interior opera bajo un layout **elástico y responsive** a la cantidad de información presente, pivotando principalmente en el tamaño del anillo SVG.

---

## Estado 1: Inactivo (Estado por defecto)
El usuario no ha iniciado ninguna sesión. La tarjeta invita a la acción. No hay contexto secundario.

```text
┌──────────────────────────────────────┐
│                                      │
│               ◜──────◝               │
│             ◜          ◝             │
│            │   25:00    │            │
│             ◟          ◞             │
│               ◟──────◞               │
│                                      │
│          [ Toca para iniciar ]       │
│                                      │
└──────────────────────────────────────┘
```

**Composición:**
- **Anillo:** Tamaño máximo (ej. diámetro grande). Trazo opaco o gris sutil.
- **Tiempo:** Dentro del anillo o centrado. Tipografía Bold y muy grande.
- **Color:** Neutro (gris o color de base). Sin "glow".
- **Botones:** Ocultos (se inicia tocando toda la tarjeta para abrir configuración).

---

## Estado 2: Activo sin materia (Focus Mode puro)
Sesión corriendo. El usuario no seleccionó materia, por lo que el anillo mantiene su máximo tamaño.

```text
┌──────────────────────────────────────┐
│                                      │
│               ◜──────◝               │
│             ◜          ◝             │
│            │   18:42    │            │
│             ◟          ◞             │
│               ◟──────◞               │
│                                      │
│                 ⏸︎ ■                  │
│                                      │
└──────────────────────────────────────┘
```

**Composición:**
- **Anillo:** Tamaño máximo. El trazo de progreso se dibuja con el color del modo (ej. Azul para Pomodoro).
- **Animación:** *Glow* sutil perimetral (efecto respiración lenta).
- **Controles:** Pausa y Stop sutiles bajo el anillo, centrados.

---

## Estado 3: Activo con materia (Contexto asignado)
Sesión en curso y vinculada a un área de conocimiento. El layout se transforma: el anillo reduce su tamaño para hacer lugar (visualmente equilibrado) al contexto textual.

```text
┌──────────────────────────────────────┐
│                                      │
│        ◜─────◝                       │
│      ◜         ◝       Estudiando    │
│     │   18:42   │      Álgebra       │
│      ◟         ◞                     │
│        ◟─────◞                       │
│                                      │
│                 ⏸︎ ■                  │
│                                      │
└──────────────────────────────────────┘
```

**Composición:**
- **Anillo:** Se reduce ligeramente de tamaño y se alinea hacia la izquierda o centro-izquierda.
- **Texto:** Aparece a la derecha del anillo. Tipografía clara pero de menor peso que el tiempo.
- **Color:** El color del anillo sigue determinando el modo de sesión.
- **Controles:** Permanecen en la zona inferior o se alinean de forma que no compitan con el nombre de la materia.

---

## Estado 4: Pausado
El tiempo se detiene. La sesión está viva pero congelada.

```text
┌──────────────────────────────────────┐
│                                      │
│        ◜─────◝                       │
│      ◜         ◝       Estudiando    │
│     │   18:42   │      Álgebra       │
│      ◟         ◞                     │
│        ◟─────◞                       │
│                                      │
│                 ▶︎ ■                  │
│                                      │
└──────────────────────────────────────┘
```

**Composición:**
- **Anillo:** Estático. Pierde el *glow* pulsante. 
- **Color:** El trazo de progreso puede volverse semitransparente o grisáceo para indicar pausa, o mantener el color pero sin animación.
- **Controles:** El icono de Pausa cambia a Play.

---

## Estado 5: Modos Alternativos (Semántica de Color)
No cambia la disposición, cambia la identidad del anillo en cualquier estado activo.

- **Pomodoro (Concentración):** Anillo azul/primario.
- **Threshold (Modo libre progresivo):** Anillo morado.
- **Descanso Corto:** Anillo verde.
- **Descanso Largo:** Anillo naranja.

*(Nota: En modo libre, el reloj avanza hacia adelante y puede llegar a formatos como `01:03:42`, requiriendo asegurar que el tamaño máximo de la fuente soporte `HH:MM:SS` sin desbordarse del anillo o del card).*

---

## Validaciones Pendientes
Antes de pasar a código, debe validarse en papel/diseño:
1. ¿El tamaño del anillo grande `25:00` entra cómodamente sin chocar con el borde superior?
2. Cuando el texto de materia es extremadamente largo (ej. "Introducción a la Programación"), ¿cómo trunca? ¿Se adapta o rompe el layout?
3. ¿Cómo escala el tiempo si pasa de `45:00` a `1:05:00`?


---
**Tags:** #dashboard
