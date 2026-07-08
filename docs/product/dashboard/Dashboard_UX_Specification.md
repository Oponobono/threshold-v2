# Dashboard UX Specification v1.0

## 1. Propósito

El Dashboard es el punto de entrada diario de la aplicación. Su misión es **transformar el estado académico del estudiante en un plan de acción claro en menos de diez segundos**.

El Dashboard no es un tablero de métricas estático; es un *Briefing Diario* proactivo que elimina la fricción de empezar a estudiar. 

**El Dashboard como orquestador:** No genera información propia. Orquesta información proveniente de distintos dominios (aprendizaje, calendario, materias, evaluaciones y herramientas) para presentar una visión unificada del día sin albergar lógica de negocio pesada.

## 2. Principios de Diseño

- **Prioridad sobre completitud:** No mostrar toda la información. Mostrar primero la información que ayuda a decidir.
- **Diagnóstico antes que acción:** El usuario debe entender su situación (salud de su aprendizaje) antes de decidir qué hacer.
- **Una acción principal:** El Dashboard nunca debe competir consigo mismo. En cualquier momento debe existir una acción claramente dominante.
- **Prioridad de la información:** En caso de conflicto de espacio, la jerarquía innegociable es:
  1. Estado cognitivo
  2. Acción inmediata
  3. Urgencias del día
  4. Motivación y progreso
  5. Exploración y herramientas
- **El Dashboard evoluciona:** Un usuario nuevo y uno con cientos de sesiones no necesitan exactamente la misma información.
- **No reemplaza las pantallas especializadas:** Su objetivo es orientar. No sustituir el calendario, la gestión de materias ni las estadísticas profundas.

## 3. Principios de Interacción

- Un card debe tener una acción principal claramente identificable.
- Las acciones secundarias nunca deben competir visualmente con la principal.
- Toda información presentada debe conducir a una pantalla especializada cuando el usuario desee profundizar.
- El Dashboard debe minimizar la cantidad de decisiones necesarias para comenzar a estudiar.

## 4. Rendimiento Percibido (Offline-First)

El Dashboard debe transmitir inmediatez absoluta:
- Renderizar inmediatamente desde SQLite.
- Evitar indicadores de carga innecesarios o bloqueantes.
- Permitir que el usuario tome decisiones y actúe antes de finalizar sincronizaciones secundarias.
- Actualizar información de forma progresiva sin bloquear la interacción.

## 5. Flujo Cognitivo

La arquitectura de la pantalla sigue estrictamente el modelo mental del usuario al abrir la aplicación:

1. **Comprender:** *¿Cuál es mi contexto?*
2. **Decidir:** *De todo lo posible, ¿qué importa más hoy?*
3. **Actuar:** *Resolvamos la prioridad.*
4. **Reflexionar:** *¿Cómo me fue hoy/esta semana?*
5. **Explorar:** *¿Qué más hay en mi entorno académico?*

## 6. Arquitectura Funcional

El Dashboard se construye respondiendo a preguntas de usuario, no apilando componentes. La implementación visual puede cambiar con el tiempo, pero las preguntas fundamentales permanecen.

| Pregunta del Usuario | Objetivo del Producto | Implementación Actual |
| :--- | :--- | :--- |
| **¿Cómo estoy?** | Diagnóstico cognitivo rápido | `KnowledgeHealthCard` |
| **¿Qué debería hacer ahora?** | Acción inmediata con menor fricción | `DailyReviewCard` |
| **¿Qué requiere atención hoy?** | Eventos próximos (Calendario/Exámenes) | `NextClassCard` + `NextAssignmentCard` |
| **¿Cómo voy progresando?** | Motivación y feedback | *WeeklyProgressCard (Pendiente)* |
| **¿Qué quiero explorar?** | Navegación y gestión | Carruseles, `StudyTimerCard`, UI de herramientas |

## 7. "Above the Fold"

La regla de oro del área visible inmediata (sin hacer scroll) se rige por **objetivos, no por componentes**. 

Al abrir la app, el usuario **debe poder responder inmediatamente**:
1. *¿Cómo está mi aprendizaje?*
2. *¿Cuál es mi siguiente acción?*
3. *¿Existe alguna urgencia inminente para hoy?*

Si para responder alguna de estas tres preguntas el usuario necesita desplazarse hacia abajo, **el Dashboard no está cumpliendo su misión**. Ningún otro elemento exploratorio (como carruseles de materias, creación de contenido, o herramientas) puede empujar estas respuestas fuera del *Above the Fold*.

## 8. Progresión del Usuario

El Dashboard no es un póster fijo. Su composición se adapta a la etapa de madurez del estudiante en el ecosistema de la app:

- **Descubrimiento (Onboarding):** Enseñar el flujo de estudio. Foco extremo en crear/importar la primera tarjeta y hacer el primer repaso. Mucho aire, pocas distracciones exploratorias.
- **Construcción del hábito:** Reducir fricción para estudiar diariamente. Foco operativo. El *Above the fold* gobierna la experiencia.
- **Consolidación:** Mostrar progreso y mantener la motivación. El feedback del esfuerzo semanal/mensual comienza a tomar relevancia en el *middle fold*.
- **Dominio:** Facilitar decisiones avanzadas y análisis. El usuario ya confía en el sistema; se habilita información tendencial y distribución avanzada de esfuerzo.

## 9. Lo que el Dashboard NO es

Para evitar la acumulación técnica y visual (el *feature creep*), establecemos explícitamente qué roles no debe asumir el Dashboard:

- No es una pantalla de configuración.
- No es un catálogo exhaustivo de funciones de la app.
- No es un panel de administración para gestionar grandes volúmenes de datos.
- No es una lista completa de actividades o tareas.
- No intenta reemplazar las vistas especializadas (p. ej., no se estudia todo un temario desde el dashboard, se navega hacia él).

## 10. Principios de Evolución

Todo cambio futuro al `index.tsx` o a la experiencia del Dashboard debe ser auditado contra estas reglas:

1. **Intención antes que píxeles:** Agregar un nuevo card requiere definir primero qué pregunta fundamental responde.
2. **Ortogonalidad:** Ningún card debe duplicar información o intención de otro.
3. **Respeto a la jerarquía:** Ningún card secundario puede desplazar fuera del *above the fold* una pregunta más importante.
4. **Escalabilidad limpia:** Las acciones principales deben permanecer visibles e inmutables sin importar el crecimiento del resto del Dashboard.
5. **Adaptabilidad:** El Dashboard debe poder simplificarse automáticamente cuando los datos requeridos por un card complejo aún no existan para usuarios nuevos.

## 11. Definition of Success

Un Dashboard exitoso permite que un usuario habitual:

- Comprenda su estado académico en **menos de 10 segundos**.
- Identifique su siguiente acción **sin explorar otras pantallas**.
- Pueda comenzar una sesión de estudio con un **único toque**.
- No necesite desplazarse (scroll) para responder las **tres preguntas principales** del día.

Toda modificación futura al Dashboard deberá preservar o mejorar de forma medible estos objetivos.
