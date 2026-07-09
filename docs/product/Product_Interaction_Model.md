# Product Interaction Model

> *"Threshold existe para reducir la incertidumbre académica. Cada interacción debe ayudar al estudiante a comprender su situación, confiar en la recomendación del sistema y avanzar con la menor carga cognitiva posible."*

## 1. Misión del Producto
**Threshold no optimiza tiempo; optimiza decisiones.** 

Muchas aplicaciones educativas venden la idea de ahorrar tiempo, pero el verdadero problema del estudiante es la carga cognitiva de la decisión: *"Tengo una hora libre. ¿Repaso flashcards? ¿Leo apuntes? ¿Empiezo un proyecto? ¿Qué es más urgente?"*. 

Threshold elimina precisamente esa incertidumbre transformando datos académicos en una única prioridad clara. El producto no dice *"Aquí están tus datos"*, dice: **"Ya hice el análisis por ti"**.

Para lograr esto, Threshold hace cuatro trabajos concretos antes de que el usuario haga un solo toque:
1. **Recolectar**
2. **Interpretar**
3. **Priorizar**
4. **Guiar**

El éxito se mide en claridad: si el usuario abre la aplicación y en cinco segundos sabe exactamente cuál es su situación y cuál es el siguiente paso, Threshold está cumpliendo su misión.

## 2. El Principio Conversacional
Threshold no es un conjunto de componentes apilados ni un visualizador pasivo de datos (un "dashboard" clásico). **Threshold mantiene una conversación continua con el estudiante.**

- Cada pantalla debe reducir la incertidumbre, nunca aumentarla.
- Cada pantalla responde preguntas concretas del usuario.
- Nunca se presenta información sin un propósito directo ligado a la toma de decisiones.

Los componentes de la interfaz dejan de ser "elementos visuales" y se convierten en "respuestas":
- *KnowledgeHealth* no muestra métricas; responde: **"¿Cómo estoy?"**
- *DailyReview* no lista tarjetas; responde: **"¿Qué debo hacer ahora?"**
- *NextClass/Exam* no muestra horarios; responde: **"¿Qué requiere mi atención?"**

## 3. El Patrón de Interacción Universal
Toda pantalla principal (ya sea el inicio, la vista de una materia o las estadísticas) debe seguir el mismo flujo cognitivo, respetando el orden natural en que el cerebro procesa la información para actuar:

1. **Comprender (Orientación):** Ubicar al usuario. *"Así está tu conocimiento hoy."*
2. **Priorizar (Foco):** Señalar lo urgente o importante. *"Esto requiere tu atención."*
3. **Actuar (Misión):** Un único llamado a la acción. *"Haz esto ahora."*
4. **Retroalimentar (Recompensa):** Confirmar el avance. *"Así vas esta semana. Buen trabajo."*
5. **Explorar (Ecosistema):** Liberar la navegación. *"Si quieres ver más, aquí tienes todo."*

## 4. La Regla de la Única Acción Dominante
Para proteger al usuario de la parálisis por análisis, **en cualquier momento dado debe existir una única llamada a la acción (CTA) principal**. 
Las demás acciones son secundarias y nunca deben competir visualmente con la prioridad absoluta dictada por el sistema. El producto asume la carga cognitiva de decidir qué es más importante en ese instante.

## 5. La Regla de la Única Pregunta (Defensa contra Feature Creep)
Como toda la aplicación es una conversación, **cada bloque o componente debe responder exactamente UNA pregunta del usuario. Nunca dos.**

*   `KnowledgeHealth` responde: **¿Cómo estoy?** (No muestra qué hacer ni el progreso semanal).
*   `DailyReview` responde: **¿Qué debo hacer?** (No habla del estado general ni del calendario).
*   `Lo Siguiente` responde: **¿Qué se aproxima?** (No te enseña cómo estudiar).
*   `Progreso Semanal` responde: **¿Está funcionando mi esfuerzo?**
*   `Ecosistema` responde: **¿Dónde quiero entrar?**

Si se propone agregar un dato nuevo a un componente, la pregunta de diseño obligatoria es: *¿Este nuevo dato responde a la misma pregunta original del componente?* Si la respuesta es "no", ese dato pertenece a otro lugar. Esta regla por sí sola evita la saturación cognitiva.

**El Filtro Anti-Feature Creep:**
En lugar de preguntar *"¿Esta función es útil?"*, la pregunta obligatoria pasa a ser: **"¿Reduce incertidumbre?"**. Si no lo hace, añade complejidad sin reforzar la propuesta de valor. 
Para proteger la ligereza del Dashboard a medida que el proyecto madura, rige la siguiente restricción: **No añadir nuevos cards al dashboard.** Cualquier nueva capacidad debe intentar responder a una de estas preguntas: *¿Hace mejor el diagnóstico? ¿Hace mejor la priorización? ¿Hace mejor la guía? ¿Hace mejor la retroalimentación?* Solo si la respuesta es "ninguna", se podría considerar un nuevo bloque.

## 6. Posicionamiento: Certeza vs. Caja de Herramientas
Threshold no compite por tener la mayor cantidad de funciones o herramientas en pantalla (el enfoque de aplicaciones como RemNote o Notion, cuyo mensaje es *"Aquí están todas tus herramientas"*). 

El posicionamiento de Threshold es de orquestación activa: **"Ya analicé tu situación académica. Esto es lo más inteligente que puedes hacer ahora mismo."**
Competir por reducir la incertidumbre del estudiante es una barrera arquitectónica y psicológica mucho más alta y difícil de replicar que competir por cantidad de features.

**La Redefinición de FSRS (El Motor de Confianza):**
Bajo esta filosofía, FSRS deja de ser simplemente un algoritmo de planificación espaciada. Se convierte en el **motor que permite al producto decir: "Confía en mí."** La recomendación de estudio no nace de una heurística arbitraria, sino de un modelo matemático respaldado por evidencia, lo que hace que la guía de Threshold sea absoluta y defendible.

## 7. Madurez del Usuario (El Organismo Vivo)
El producto no presenta pantallas estáticas, sino adaptativas. El contexto de la conversación cambia a lo largo del día y evoluciona según la madurez del usuario en la plataforma:

*   **Usuario Nuevo:** Necesita orientación constante. Leerá el diagnóstico (`KnowledgeHealth`) antes de saber qué hacer.
*   **Usuario Habitual:** Confía en el motor. Después de meses de uso, su cerebro ignorará el diagnóstico temporalmente y buscará el CTA de "Comenzar Repaso" de inmediato.

El diseño debe mantener la secuencia lógica (Diagnóstico → Acción) pero usar el **peso visual y el diseño UI** para que los CTA de acción (el "Comenzar") no queden bloqueados ni subordinados al diagnóstico en el caso de los usuarios recurrentes. El sistema es consciente del tiempo y del esfuerzo del estudiante.
