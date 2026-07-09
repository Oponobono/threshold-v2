# Dashboard UX Specification v1.1

## 1. Propósito
El Dashboard es la primera implementación concreta del **Product Interaction Model**. Su misión es reducir la incertidumbre del estudiante transformando su estado académico en un **Foco de Hoy** accionable en menos de 5 segundos.

No es un "dashboard" en el sentido clásico (un tablero de indicadores pasivos). Es un **Daily Briefing** (un orquestador de la jornada de estudio) que guía una conversación activa con el usuario.

## 2. Arquitectura de las 3 Capas
El diseño se aleja de la apilación de componentes para adoptar un modelo psicológico de *Progressive Disclosure*, dividido en tres grandes actos conversacionales:

### Capa 1: Orientación ("¿Cómo estoy?")
Responde a la necesidad humana de ubicarse antes de actuar.
- **Elementos:** Cabecera (Saludo, Avatar) y Diagnóstico Cognitivo (`KnowledgeHealthCard`).
- **Regla:** Solo información diagnóstica. Cero acciones.

### Capa 2: Foco de Hoy ("¿Qué requiere mi atención?")
Unifica acciones, advertencias y eventos bajo una misma narrativa táctica. Reemplaza la idea de "Plan del día" para incluir la urgencia.
- **Elementos:** `DailyReviewCard` (Acción), Próxima Clase (Evento), Próximo Examen (Advertencia).
- **Regla de Oro:** **Siempre debe existir un único CTA dominante**. Si hay examen inminente, el botón es "Preparar". Si no, es "Empezar repaso". Las opciones no compiten.
- **Organismo Vivo:** Esta capa muta a lo largo del día. Si la clase de las 10:00 ya pasó, desaparece, dando lugar a la siguiente prioridad (ej. repasar a las 11:30).

### Capa 3: Ecosistema ("¿Qué más existe?")
Una vez superadas las fases tácticas, se presenta el contenido estratégico y de navegación.
- **Elementos:** Carrusel de Cursos y Materias, Herramientas de Estudio (Temporizador, Scanner, Audio), Leaderboard, Feedback semanal.
- **Regla:** Todo este contenido reside *debajo* del *Above the Fold*. Nunca debe empujar hacia abajo a las Capas 1 y 2.

## 3. "Above the Fold"
La regla innegociable de la primera pantalla visible sin scroll:
Solo pueden existir la **Capa 1 (Orientación)** y la **Capa 2 (Foco de Hoy)**. Si el usuario necesita desplazarse para ver el botón de "Empezar Repaso" o descubrir que tiene examen, la pantalla ha fallado.

## 4. Abstracción del Algoritmo

> **El usuario estudia sesiones; el algoritmo administra tarjetas.**

Threshold separa estrictamente el estado del motor FSRS (New, Learning, Review) de la experiencia de usuario. El Dashboard no expone el inventario del algoritmo ("tienes 115 tarjetas pendientes"); propone un plan de trabajo ("Sesión de hoy: Foco en Biología, ≈69 min").

Esta separación permite que el motor se vuelva infinitamente sofisticado mientras la conversación con el estudiante se mantiene simple, accionable y enfocada en resultados ("Reducirá el riesgo de olvido") en lugar de mecánicas.

## 5. El Dashboard como Entrenador (Coach)
A diferencia de los gestores de tareas (que ponen la acción primero: *"Haz esto"*), Threshold pone el estado primero (*"Estás así, por tanto, haz esto"*). El orden `Estado → Acción` le otorga propósito al esfuerzo y consolida la identidad de Threshold como un copiloto académico.

## 6. Principios de Evolución
Cualquier cambio futuro a la interfaz principal debe someterse a este filtro:
1. **Intención antes que píxeles:** ¿Qué pregunta del usuario responde este nuevo componente?
2. **Ubicación Semántica:** ¿Pertenece a la Orientación, al Foco o al Ecosistema?
3. **Respeto a la Atención:** ¿Compromete la lectura de la única Acción Dominante del Foco de Hoy? Si lo hace, debe ser rediseñado o relegado.


---
**Tags:** #dashboard
