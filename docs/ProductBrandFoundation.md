# Threshold — Product & Brand Foundation

**Estado**: Documento estratégico base  
**Propósito**: definir qué es Threshold, para quién existe, qué problema resuelve, qué principios lo distinguen y qué territorio conceptual debe guiar posteriormente la identidad de marca y de la aplicación.  
**Alcance**: producto, posicionamiento, usuarios, problema, propuesta de valor, visión, principios, lenguaje conceptual y criterios para futuras decisiones de marca.  
**Última revisión**: julio de 2026

---

## Leyenda de clasificación

Este documento distingue tres tipos de afirmación:

| Marca | Tipo | Significa |
|---|---|---|
| ✅ | **Confirmado** | Lo que Threshold **es hoy**. Respaldo: producto actual, arquitectura existente, decisiones ya tomadas. |
| 🎯 | **Visión** | Lo que **queremos que Threshold llegue a ser**. Dirección deseada, no realidad actual. |
| ❓ | **Hipótesis** | Afirmación estratégica o de marca que **todavía no está validada** con usuarios, datos o investigación. Debe tratarse como territorio a explorar, no como verdad establecida. |

> **Regla**: una sección sin marcador explícito hereda la clasificación de la sección que la contiene. Cuando un párrafo individual cambia de categoría respecto a su sección, lleva su propio marcador.

---

## 1. Resumen ejecutivo

✅ Threshold es una plataforma personal de gestión, procesamiento y recuperación del conocimiento orientada al aprendizaje, construida bajo un enfoque **local-first / offline-first**.

✅ En Threshold, el conocimiento y el estado de trabajo del usuario existen y permanecen operables localmente; la sincronización con servicios remotos actúa como mecanismo complementario de convergencia, respaldo y continuidad entre dispositivos. Esta arquitectura no es únicamente una decisión técnica: expresa un principio de producto según el cual el conocimiento del usuario debe estar disponible, bajo su control y no depender de una conexión permanente para ser utilizado.

✅ Su punto de entrada es el contexto académico, especialmente el de estudiantes universitarios que necesitan gestionar simultáneamente materias, documentos, apuntes, evaluaciones, horarios, fechas, recordatorios y procesos de estudio.

🎯 Sin embargo, su arquitectura y su modelo conceptual no están limitados a una universidad ni a un único tipo de contenido: el producto está diseñado para poder evolucionar hacia una Personal Knowledge Platform para aprendizaje continuo, formación profesional y gestión personal del conocimiento.

✅ La tesis central de Threshold es que el problema del aprendizaje moderno no es solamente la falta de información. El problema es que la información está fragmentada en múltiples lugares, formatos y momentos, mientras que el proceso de aprendizaje exige convertirla en algo que pueda ser entendido, organizado, relacionado, revisado, recordado y utilizado.

✅ Por eso Threshold no debe definirse como un simple gestor de notas, calendario, biblioteca documental, sistema de recordatorios o aplicación de estudio. Esos son componentes de una solución mayor.

❓ **La categoría estratégica que mejor describe el producto es:**

> Personal Knowledge Platform for Learning

❓ **Y su posicionamiento inicial puede expresarse como:**

> Threshold reúne el contexto, los materiales y las acciones del aprendizaje en un sistema personal que ayuda a convertir información dispersa en conocimiento utilizable.

❓ La marca debería construirse alrededor de conceptos como contexto, continuidad, comprensión, conexión, progreso, claridad y recuperación del conocimiento, evitando quedar encerrada en códigos visuales demasiado obvios de una "app escolar".

---

## 2. Qué es Threshold

### 2.1 Definición de producto

✅ Threshold es un software de conocimiento personal, offline-first / local-first, diseñado para acompañar de forma continua el ciclo de aprendizaje.

✅ El sistema integra, entre otros, estos dominios:

- estructura académica: cursos, materias, evaluaciones, profesores y créditos;
- documentos y fuentes de conocimiento;
- lectura y workspace documental;
- notas de estudio (StudyNote);
- calendario, horarios y planificación;
- recordatorios y seguimiento temporal;
- recuperación y revisión del conocimiento;
- organización y descubrimiento de información;
- sincronización entre dispositivo y backend.

✅ La arquitectura es deliberadamente mayor que cualquiera de estas funciones por separado.

🎯 La intención es que el producto pueda representar el contexto completo del aprendizaje, no solamente una pieza del proceso.

### 2.2 Qué no es Threshold

✅ Threshold **no** debe posicionarse principalmente como:

- un editor genérico como Notion;
- un almacenamiento de archivos como Google Drive;
- un gestor de tareas como Todoist;
- una plataforma de flashcards como Anki o Quizlet;
- un LMS institucional como Moodle, Canvas o Blackboard;
- una aplicación de calendario;
- una aplicación de notas tradicional.

✅ Puede incorporar capacidades relacionadas con esos productos, pero ninguna de ellas define por sí sola el producto.

✅ La diferencia fundamental es de propósito y relación entre componentes: Threshold intenta conectar información, contexto y actividad de aprendizaje dentro de un mismo sistema personal.

---

## 3. La categoría del producto

### 3.1 Categoría principal

❓ > Personal Knowledge Platform

### 3.2 Vertical inicial

✅ > Learning / Education / Academic Knowledge Management

### 3.3 Descripción recomendada

✅ - **Para documentación interna**: Threshold es una Personal Knowledge Platform orientada inicialmente al aprendizaje académico.
❓ - **Para comunicación externa**: Threshold es un sistema personal para organizar, estudiar y recuperar conocimiento.

✅ La primera formulación ayuda a definir la naturaleza tecnológica y estratégica del producto.

❓ La segunda resulta más comprensible para usuarios finales.

### 3.4 Implicación estratégica

🎯 La categoría importa porque determina el espacio de crecimiento del producto.

🎯 Si Threshold se define únicamente como "app para estudiantes", cada nueva capacidad deberá justificarse dentro de ese perímetro.

🎯 Si se define como "plataforma personal de conocimiento para aprender", el escenario cambia: la universidad se convierte en el primer dominio de aplicación, no necesariamente en el límite final del producto.

### 3.5 Perfil arquitectónico del producto

❓ La categoría de producto es una hipótesis estratégica. Pero el enfoque arquitectónico —cómo está construido realmente— es un hecho confirmado y debería influir en la identidad de marca tanto como la categoría.

✅ | Dimensión | Descripción |
|---|---|---|
| **Tipo de producto** | Personal Knowledge Platform |
| **Enfoque de experiencia** | Local-first / offline-first |
| **Fuente de verdad de la experiencia** | SQLite local (el estado de UI y los datos del usuario residen y se operan localmente) |
| **Backend** | Sincronización y servicios remotos (mecanismo complementario de convergencia, respaldo y continuidad entre dispositivos) |
| **Principio arquitectónico** | Local state first, remote sync second |

> **Implicación para la marca**: Threshold no depende de que el usuario esté conectado para existir como sistema de conocimiento. Esto comunica **autonomía, disponibilidad, control, privacidad percibida, resiliencia y propiedad del conocimiento**. Son atributos de producto reales, no aspiracionales, y deberían tener peso en la identidad.

✅ **Distinción conceptual importante**:
- **Local-first** → filosofía de producto y arquitectura: el estado local es primario, la nube no constituye la fuente de verdad de la UI.
- **Offline-first** → consecuencia de esa filosofía en la experiencia: el sistema funciona sin conexión porque el estado local ya es suficiente.

---

## 4. La población objetivo

### 4.1 Usuario principal: estudiante universitario

✅ El usuario primario es un estudiante de educación superior que maneja una cantidad importante de información y responsabilidades simultáneas.

✅ Sus características típicas son:

- cursa varias materias al mismo tiempo;
- recibe información desde múltiples fuentes;
- trabaja con PDFs, presentaciones, imágenes, apuntes y otros documentos;
- necesita controlar fechas, evaluaciones, horarios y resultados;
- captura información desde el móvil;
- estudia en momentos y lugares variables;
- necesita encontrar rápidamente información anterior;
- su carga cognitiva aumenta cuando la información está dispersa.

✅ No es necesario que sea un usuario técnico. De hecho, el problema de Threshold es más importante para personas cuya vida académica ya genera una cantidad considerable de fragmentación.

### 4.2 Segmento primario de mayor afinidad

✅ La propuesta puede ser especialmente relevante para estudiantes con:

- múltiples materias y dependencias entre contenidos;
- alta carga documental;
- evaluaciones frecuentes;
- clases presenciales y virtuales combinadas;
- necesidad constante de consultar material anterior;
- hábitos de estudio no completamente estructurados.

✅ Esto incluye carreras como ingeniería, administración, derecho, medicina, economía, ciencias sociales, educación y otras áreas con alto volumen de documentación y evaluación.

### 4.3 Usuario secundario: lifelong learner / profesional en formación

❓ La arquitectura de Threshold también encaja con usuarios que no pertenecen a una universidad formal:

- profesionales que realizan cursos online;
- personas que preparan certificaciones;
- trabajadores que realizan formación continua;
- autodidactas;
- investigadores independientes;
- personas que construyen conocimiento técnico personal.

❓ La condición común no es ser estudiante universitario.  
❓ La condición común es tener que aprender y gestionar conocimiento de forma sostenida.

> **Nota**: estos segmentos son plausibles por la arquitectura del producto, pero Threshold no ha sido probado ni optimizado para ellos. Es una hipótesis de expansión, no un hecho actual.

### 4.4 Usuario que no define el producto

✅ Instituciones educativas, docentes y administradores pueden representar oportunidades futuras, pero no deben confundirse con el usuario central actual.

✅ Threshold, en su forma actual, está conceptualmente centrado en el sistema personal del aprendiz, no en la administración institucional del aprendizaje.

---

## 5. El problema que resuelve

### 5.1 El problema aparente

✅ El usuario cree tener muchos problemas separados:

- "Mis PDFs están repartidos."
- "No encuentro mis apuntes."
- "Se me pasan fechas."
- "No recuerdo dónde estaba esa información."
- "Tengo demasiadas cosas para estudiar."
- "Tengo mis materias en un lugar, sus documentos en otro y mis notas en otro."

### 5.2 El problema estructural

✅ En realidad, todos esos síntomas apuntan a una misma causa:

> El conocimiento del usuario está fragmentado mientras que el aprendizaje exige continuidad y contexto.

✅ El estudiante recibe información en momentos y medios diferentes, pero necesita reconstruir posteriormente el contexto en el que esa información tenía significado.

```
Clase
  ↓
Foto de pizarra
  ↓
PDF del profesor
  ↓
Apunte personal
  ↓
Evaluación
  ↓
Revisión posterior
```

✅ En un ecosistema fragmentado, cada elemento vive aislado.  
✅ Threshold intenta mantener la relación entre ellos.

### 5.3 La consecuencia

✅ La fragmentación genera:

- pérdida de contexto;
- duplicación de información;
- mayor carga mental;
- dificultad para recuperar conocimiento;
- menor continuidad entre sesiones de estudio;
- dependencia excesiva de memoria externa;
- dificultad para convertir materiales en conocimiento reutilizable.

✅ Por eso el problema de Threshold es más profundo que "organizar apuntes".  
✅ Es un problema de **continuidad cognitiva** y **gestión personal del conocimiento**.

---

## 6. La propuesta de valor

### 6.1 Propuesta de valor central

❓ > Threshold convierte información académica y personal dispersa en un sistema de conocimiento contextual, organizado y recuperable.

> **Nota**: esta propuesta refleja la intención del producto, pero no ha sido validada con usuarios externos. Es la hipótesis de valor que el producto intenta demostrar.

### 6.2 Qué obtiene el usuario

🎯 El usuario obtiene un entorno donde puede:

1. **Capturar** información cuando aparece.
2. **Organizarla** dentro de su contexto académico o personal.
3. **Procesarla** mediante lectura, notas y herramientas de estudio.
4. **Relacionarla** con cursos, materias, evaluaciones y momentos.
5. **Revisarla** en el momento adecuado.
6. **Recuperarla** posteriormente sin reconstruir todo el contexto.

> **Nota**: algunos de estos pasos funcionan hoy (capturar, organizar), otros están en desarrollo o son parciales (revisión contextual, recuperación semántica). La secuencia completa es la visión aspiracional.

### 6.3 Beneficio funcional

❓ Menos fragmentación y menor fricción para encontrar, estudiar y reutilizar información.

### 6.4 Beneficio cognitivo

❓ Menor carga mental derivada de recordar dónde está cada cosa y cómo se relaciona con las demás.

### 6.5 Beneficio emocional

❓ Mayor sensación de control, continuidad y claridad frente a una carga académica compleja.

---

## 7. El modelo conceptual de Threshold

✅ La mejor representación conceptual del producto no es una colección de funcionalidades, sino un ciclo:

```
CAPTURAR
   ↓
ORGANIZAR
   ↓
COMPRENDER
   ↓
CONECTAR
   ↓
REVISAR
   ↓
RECORDAR
   ↓
UTILIZAR
   ↺
```

✅ Esto puede verse como una transformación:

```
Información dispersa
        ↓
      contexto
        ↓
    organización
        ↓
    comprensión
        ↓
      memoria
        ↓
 conocimiento utilizable
```

✅ La palabra **conocimiento** es importante: Threshold no debería medir su éxito únicamente por cuánto contenido almacena, sino por cuánto ayuda al usuario a encontrar, comprender, recordar y utilizar aquello que ha aprendido.

---

## 8. La arquitectura del producto como expresión de la visión

✅ Una de las características más importantes de Threshold es que la arquitectura técnica no es accidental: refleja la filosofía del producto.

### 8.1 Local-first / offline-first

✅ SQLite funciona como la fuente de verdad para la experiencia de usuario.

✅ Esto expresa una idea de producto:

> El conocimiento del usuario pertenece al usuario y debe estar disponible incluso cuando la conectividad no sea perfecta.

✅ El backend y la sincronización complementan el sistema; no deberían convertir la experiencia principal en una experiencia dependiente de red.

### 8.2 El documento como entidad de conocimiento

✅ La arquitectura documental separa fuente, extracción, modelo y presentación.

✅ Conceptualmente esto significa que Threshold no trata un documento simplemente como "un archivo".

- Un archivo es una **fuente**.
- El contenido extraído es **información**.
- El modelo documental es una **representación utilizable**.
- La experiencia de lectura es la **interfaz** para trabajar con esa información.

✅ Esta distinción es fundamental para una plataforma de conocimiento.

### 8.3 StudyNote como agregado de conocimiento

✅ StudyNote representa el contenido producido o capturado por el usuario durante su proceso de aprendizaje.

✅ Su contrato establece además un principio importante:

> La IA puede asistir al usuario, pero no debe apropiarse del conocimiento original ni sobrescribirlo silenciosamente.

❓ Esto introduce una dimensión de confianza que puede ser relevante para la futura identidad del producto.

### 8.4 Reminder Engine

✅ Los recordatorios no existen únicamente como alarmas.

✅ Dentro del modelo de Threshold son una herramienta para conectar conocimiento y tiempo:

```
Conocimiento
     +
Contexto
     +
Tiempo
     ↓
Acción de revisión / seguimiento
```

✅ Esto acerca el producto al concepto de **continuidad del aprendizaje**.

---

## 9. Principios de producto

✅ Estos principios deberían considerarse candidatos a convertirse posteriormente en principios de marca.

1. ✅ **El conocimiento pertenece al usuario** — Los datos, notas, documentos y contexto del usuario deben permanecer bajo su control.

2. ✅ **La continuidad es más importante que la novedad** — Threshold debe ayudar a continuar procesos de aprendizaje, no solamente a ejecutar acciones aisladas.

3. ✅ **El contexto importa** — Información sin contexto pierde valor. Curso, materia, fecha, documento, nota, evaluación y momento forman parte de la utilidad del conocimiento.

4. ✅ **La captura debe ser fácil; la estructura debe aparecer después** — El sistema debe reducir la fricción de introducir información y utilizar el contexto existente para organizarla.

5. ✅ **La inteligencia debe asistir, no sustituir** — Las herramientas automáticas y la IA deben aumentar la capacidad del usuario sin ocultar el origen del contenido ni reemplazar su criterio.

6. ✅ **El sistema debe poder trabajar sin depender de la nube** — Offline-first no es únicamente una decisión técnica. Es un principio de confiabilidad y autonomía.

7. ✅ **La complejidad debe permanecer debajo de la interfaz** — La arquitectura puede ser sofisticada; la experiencia no debe obligar al usuario a comprender esa complejidad.

8. ✅ **Cada componente debe contribuir a un sistema coherente** — Documentos, notas, materias, calendario y recordatorios no deben sentirse como productos independientes pegados en una misma aplicación.

---

## 10. Diferenciación

✅ Threshold puede competir por funcionalidades con muchas aplicaciones. Ese no debería ser su principal mecanismo de diferenciación.

❓ La verdadera diferenciación está en la **integración semántica** de esas capacidades.

✅ Un usuario puede tener:

| Herramienta | Propósito |
|---|---|
| Drive | documentos |
| Calendar | fechas |
| Notes | apuntes |
| Tasks | pendientes |
| Anki | memoria |
| LMS | materias |

🎯 Threshold busca construir una capa donde esas piezas compartan contexto.

❓ La propuesta diferencial no es:

> "Tenemos documentos."

❓ sino:

> "Tus documentos forman parte de tu conocimiento."

❓ No es:

> "Tenemos recordatorios."

❓ sino:

> "El sistema sabe cuándo el conocimiento necesita volver a tu atención."

❓ No es:

> "Tenemos notas."

❓ sino:

> "Tus notas forman parte del proceso mediante el cual conviertes información en conocimiento."

> **Nota**: las afirmaciones diferenciales de la columna derecha expresan la ambición del producto. Algunas están parcialmente respaldadas por la arquitectura actual (documentos como entidades de conocimiento, recordatorios vinculados a contexto). Otras son aspiracionales (que el sistema "sepa" cuándo el conocimiento necesita atención). Deben tratarse como dirección, no como claim validado.

---

## 11. Territorio conceptual de la marca

❓ La futura identidad de Threshold debería construirse alrededor de un territorio semántico más rico que "educación".

### 11.1 Conceptos centrales ❓

- conocimiento
- aprendizaje
- contexto
- continuidad
- conexión
- claridad
- progreso
- profundidad
- descubrimiento
- memoria
- comprensión
- control personal
- autonomía

### 11.2 Conceptos secundarios ❓

- foco
- organización
- disciplina
- trayectoria
- evolución
- recuperación
- preparación
- reflexión

### 11.3 Conceptos que deberían evitar dominar la marca ❓

- escolaridad infantil
- "productividad genérica"
- simple toma de notas
- estética corporativa excesivamente institucional
- gamificación superficial
- dependencia de la IA como protagonista

---

## 12. Qué significa "Threshold" como nombre

❓ El nombre puede interpretarse como **umbral**, es decir, el punto de transición entre un estado y otro.

❓ Para el producto, esta semántica resulta especialmente fértil.

❓ Threshold puede representar el paso:

- información → comprensión
- comprensión → conocimiento
- conocimiento → dominio
- intención → acción
- estudio → recuerdo
- fragmentación → contexto

❓ El nombre no tiene que significar explícitamente "educación". Esa ausencia puede ser una ventaja estratégica.

❓ Permite construir una marca alrededor de la idea de **transformación**.

❓ > La hipótesis conceptual más potente es: Threshold es el lugar donde la información cruza el umbral y se convierte en algo útil para la persona.

✅ Esta interpretación todavía debe validarse contra investigación de marca, naming, disponibilidad legal y percepción de usuarios; por ahora funciona como territorio estratégico, no como claim definitivo.

---

## 13. Personalidad potencial de la marca

❓ Como hipótesis para futuras fases de branding, Threshold podría proyectar una personalidad:

| Atributo | Descripción |
|---|---|
| **Inteligente** | No necesita demostrar inteligencia constantemente. La expresa mediante claridad y contexto. |
| **Sobria** | No depende de una estética infantil ni de exceso de elementos visuales. |
| **Cercana** | Debe sentirse como una herramienta personal, no como un sistema administrativo universitario. |
| **Profunda** | Debe transmitir que el producto está diseñado para trabajar con conocimiento, no simplemente con datos. |
| **Confiable** | La confianza en datos, sincronización y contenido debe ser central. |
| **Progresiva** | Debe sugerir avance y evolución sin convertirse en una aplicación de "motivación". |

> **Nota**: cada uno de estos atributos necesita validación con usuarios reales antes de informar decisiones de diseño visual o verbal.

---

## 14. Posicionamiento

❓ ### 14.1 Posicionamiento estratégico

> Para estudiantes y personas que aprenden de forma continua y necesitan gestionar grandes cantidades de información, Threshold es una plataforma personal de conocimiento que conecta materiales, contexto, notas, planificación y revisión en un único sistema, para que aprender no dependa de información fragmentada entre múltiples herramientas.

❓ ### 14.2 Promesa funcional

> Todo tu aprendizaje, conectado por contexto.

*Hipótesis estratégica, no necesariamente el slogan final.*

❓ ### 14.3 Promesa emocional

> Sentir que tienes control sobre todo lo que estás aprendiendo.

❓ ### 14.4 Promesa de producto

> No solo guarda lo que aprendes; ayuda a que puedas volver a encontrarlo, entenderlo y utilizarlo.

---

## 15. La visión a largo plazo

🎯 La visión de Threshold puede formularse así:

> Construir un sistema personal que acompañe a una persona durante todo su proceso de aprendizaje y convierta su información acumulada en conocimiento accesible, contextual y útil.

🎯 La palabra clave es **acompañar**.

🎯 Threshold no necesita ser solamente el lugar donde alguien entra a "estudiar". Puede convertirse en la infraestructura personal que permanece alrededor de su aprendizaje.

🎯 Esto permite imaginar una evolución:

| Etapa | Descripción |
|---|---|
| Etapa 1 | Estudiante universitario |
| Etapa 2 | Gestión integral del aprendizaje |
| Etapa 3 | Formación profesional continua |
| Etapa 4 | Sistema personal de conocimiento |

> **Nota**: esta progresión no es un roadmap comprometido. Es un horizonte conceptual que ayuda a tomar decisiones coherentes hoy.

---

## 16. El problema de fondo: conocimiento versus información

❓ Uno de los pilares filosóficos potenciales de Threshold es distinguir entre almacenar información y construir conocimiento.

| Concepto | Descripción |
|---|---|
| **Información** | Algo que el usuario recibe. |
| **Contexto** | Información situada dentro de una estructura significativa. |
| **Comprensión** | El usuario interpreta y relaciona esa información. |
| **Memoria** | El contenido permanece disponible mentalmente y puede recuperarse. |
| **Conocimiento utilizable** | El usuario puede aplicar aquello que aprendió. |

❓ Threshold opera principalmente en el tránsito entre estas etapas.  
❓ Eso lo distingue conceptualmente de un simple repositorio documental.

> **Nota**: esta es una interpretación estratégica del dominio, no una verdad demostrada por el producto actual. Puede convertirse en un pilar de marca si la investigación la respalda.

---

## 17. La experiencia ideal del usuario

🎯 La experiencia ideal debería producir la sensación de:

> "Threshold sabe dónde encaja cada cosa."

🎯 El usuario no debería tener que construir manualmente un mapa perfecto de su propio conocimiento antes de poder utilizar el sistema.

🎯 Debería percibir una progresión natural:

```
Agrego algo
   ↓
Threshold entiende el contexto disponible
   ↓
Lo relaciona con mi actividad
   ↓
Puedo trabajar con ello
   ↓
Puedo volver a encontrarlo
   ↓
Puedo revisarlo cuando importa
```

🎯 La interfaz, por tanto, debería sentirse contextual, no meramente administrativa.

> **Nota**: esta sección describe una experiencia deseada. El producto actual automatiza algunas relaciones (contexto académico, vinculación entre entidades) pero está lejos de la fluidez descrita aquí. Es dirección, no descripción.

---

## 18. Implicaciones para UX/UI ❓

La identidad visual futura debería apoyarse en una experiencia que transmita:

- claridad
- jerarquía
- calma
- continuidad
- profundidad
- control

❓ Debe evitar la sensación de "panel de administración universitario".

✅ La interfaz puede ser densa en información cuando sea necesario, pero la densidad debe estar organizada.

❓ La sofisticación de Threshold debería aparecer en:

- relaciones entre entidades
- contexto
- navegación
- automatización
- recuperación de información
- consistencia del sistema

❓ No necesariamente en una interfaz visualmente complicada.

---

## 19. Implicaciones para IA

✅ La IA puede convertirse en una capacidad importante, pero estratégicamente debería permanecer **subordinada al sistema de conocimiento**.

✅ **Principio rector:**

> AI as augmentation, not authority.

✅ La IA puede:

- resumir
- explicar
- transformar
- clasificar
- sugerir relaciones
- ayudar a estudiar
- generar material derivado

✅ Pero el conocimiento original del usuario debe permanecer distinguible y bajo su control.

✅ Esto es especialmente coherente con el contrato de StudyNote, donde los resultados asistidos son independientes del contenido original.

---

## 20. Trust & reliability como parte de la identidad

❓ La arquitectura de Threshold sugiere una oportunidad de marca poco habitual en productos educativos: la confiabilidad puede ser parte explícita de la personalidad.

✅ Elementos que contribuyen a ello:

- local-first;
- sincronización idempotente y convergente;
- contratos de dominio congelados cuando corresponde;
- separación clara entre fuente y representación;
- persistencia local;
- ausencia de dependencia absoluta de conectividad;
- respeto por el contenido original del usuario.

❓ Esto permite que una futura identidad de marca comunique no solamente "aprende mejor", sino también:

> "Puedes confiar en que tu conocimiento está aquí."

> **Nota**: los elementos de confianza son reales (✅); la afirmación de que esto debe convertirse en un pilar de marca explícito es una hipótesis (❓) que debe validarse.

---

## 21. Arquitectura de marca sugerida ❓

Todavía no hace falta definir una arquitectura comercial completa, pero conceptualmente conviene pensar en:

| Capa | Descripción |
|---|---|
| **Threshold** | La marca/producto principal. |
| **Learning** | El dominio inicial. |
| **Knowledge** | La capa conceptual transversal. |
| **Workspace** | La superficie donde el usuario trabaja con información. |
| **Study** | Las herramientas para transformar información en aprendizaje. |
| **Recall / Review** | Las capacidades de recuperación y memoria. |

❓ Esta separación puede ayudar más adelante a evitar que cada nueva funcionalidad se convierta en una marca independiente.

---

## 22. Métrica conceptual de éxito ❓

Una definición útil para el futuro no es solamente "cuántos usuarios usan Threshold", sino:

> ¿Cuánto reduce Threshold la fricción entre tener información y poder utilizar el conocimiento que esa información representa?

❓ Esto sugiere métricas de producto relacionadas con:

- tiempo para encontrar información;
- continuidad de sesiones de aprendizaje;
- recuperación de contenido;
- uso cruzado entre documentos, notas y contexto académico;
- revisión de material relevante;
- reducción de duplicación o dispersión;
- satisfacción con la sensación de control.

> **Nota**: estas métricas no están implementadas ni validadas. Son una hipótesis de lo que podría medir el éxito real del producto.

---

## 23. Lo que Threshold está construyendo realmente

✅ Visto desde una perspectiva de producto, el proyecto tiene cuatro capas:

| Capa | Descripción |
|---|---|
| **1. Infrastructure** | Persistencia, sincronización, estabilidad, contratos y confiabilidad. ✅ |
| **2. Platform** | Capacidades reutilizables para documentos, datos académicos, eventos, recordatorios y conocimiento. ✅ |
| **3. Experience** | Dashboard, cursos, materias, documentos, lectura, notas, agenda, estudio y recuperación. ✅ |
| **4. Meaning** | Una visión coherente: ayudar a una persona a construir y mantener un sistema personal de conocimiento. 🎯 |

✅ Las cuatro capas importan.  
🎯 La cuarta es la que finalmente convierte un conjunto de funcionalidades en un producto con identidad.

---

## 24. Evolución del proyecto como evidencia de posicionamiento

✅ La historia de Threshold refuerza esta interpretación.

| Versión | Etapa |
|---|---|
| v1.0.0 | Infraestructura |
| v1.4.0 | Plataforma |
| v1.6.0 | Convergencia |
| v1.7.0 | Knowledge Platform |

✅ La evolución no representa únicamente crecimiento técnico.  
✅ Representa una progresión conceptual:

> de gestionar datos → a construir un sistema → a conectar dominios → a gestionar conocimiento.

✅ Esto debe conservarse como parte de la historia del producto.

---

## 25. Narrativa de producto ❓

Una narrativa inicial que puede servir en futuras presentaciones es:

> Hoy el aprendizaje vive fragmentado entre archivos, notas, calendarios, plataformas educativas, fotografías, mensajes y aplicaciones independientes. Cada herramienta resuelve una parte del problema, pero ninguna mantiene necesariamente el contexto completo.
>
> Threshold nace para resolver esa fragmentación.
>
> Su objetivo es crear un sistema personal donde los materiales que recibes, las notas que produces, las materias que cursas, los eventos que debes recordar y el conocimiento que construyes puedan coexistir dentro del mismo contexto.
>
> Threshold no intenta reemplazar la capacidad de aprender. Intenta quitarle al usuario el trabajo innecesario de reconstruir su propio sistema de información cada vez que necesita estudiar.
>
> El resultado buscado no es simplemente más organización.  
> Es más continuidad entre información, comprensión, memoria y acción.

> **Nota**: narrativa interna no testada con audiencias externas. Debe validarse antes de usarse en comunicación pública.

---

## 26. Hipótesis central de marca ❓

La hipótesis que más vale la pena preservar para futuras fases es:

> Threshold representa un umbral: el punto donde la información deja de ser algo que simplemente recibes y empieza a convertirse en conocimiento que puedes usar.

❓ Esta hipótesis puede evolucionar hacia:

- naming de módulos;
- tono de voz;
- sistema visual;
- motion design;
- onboarding;
- mensajes de producto;
- narrativa de marketing;
- iconografía;
- metáforas de navegación;
- claims.

✅ Pero debe tratarse como territorio conceptual, no como una conclusión definitiva de branding.

---

## 27. Guardrails para futuras decisiones de marca ❓

Toda futura decisión importante de identidad debería poder responder afirmativamente a varias de estas preguntas:

- ¿Hace que Threshold parezca más una plataforma de conocimiento que una simple app escolar?
- ¿Comunica confianza y control del usuario?
- ¿Refuerza la idea de contexto y continuidad?
- ¿Puede seguir funcionando si el producto se expande más allá de la universidad?
- ¿Evita depender de tendencias visuales pasajeras?
- ¿Permite expresar inteligencia sin parecer fría o corporativa?
- ¿Distingue a Threshold de un simple gestor de notas?
- ¿Ayuda a que la complejidad técnica se perciba como simplicidad de experiencia?

❓ Si una decisión de marca contradice sistemáticamente estos principios, debería revisarse.

---

## 28. Definiciones canónicas

| Atributo | Valor | Tipo |
|---|---|---|
| **Producto** | Threshold | ✅ |
| **Categoría** | Personal Knowledge Platform | ❓ |
| **Vertical inicial** | Learning / Academic Knowledge Management | ✅ |
| **Usuario primario** | Estudiante universitario con alta carga de información y múltiples responsabilidades académicas. | ✅ |
| **Usuarios secundarios** | Lifelong learners, profesionales en formación, autodidactas e investigadores independientes. | ❓ |
| **Problema principal** | Fragmentación de información y pérdida de contexto durante el proceso de aprendizaje. | ✅ |
| **Solución** | Un sistema personal que conecta información, contexto, conocimiento, planificación y recuperación. | ✅ |
| **Beneficio funcional** | Menor fricción para organizar, encontrar, estudiar y recuperar información. | ❓ |
| **Beneficio cognitivo** | Mayor continuidad y menor carga mental. | ❓ |
| **Beneficio emocional** | Mayor sensación de control y claridad sobre el propio aprendizaje. | ❓ |
| **Principio de confianza** | El usuario conserva el control sobre su conocimiento y contenido original. | ✅ |
| **Principio tecnológico** | Local-first / offline-first. | ✅ |
| **Enfoque de experiencia** | Local-first / offline-first — el conocimiento del usuario existe y es operable localmente; la sincronización remota es complementaria. | ✅ |
| **Fuente de verdad** | SQLite local (no el backend ni la nube). | ✅ |
| **Principio arquitectónico** | Local state first, remote sync second. | ✅ |
| **Territorio conceptual** | El umbral entre información y conocimiento utilizable. | ❓ |

---

## 29. Qué debe venir después

✅ Este documento no pretende cerrar la identidad de marca. Pretende establecer el territorio estratégico sobre el que esa identidad deberá construirse.

✅ Las siguientes fases naturales son:

| Fase | Área | Elementos |
|---|---|---|
| **Fase A** | Brand Strategy | misión, visión, propósito, posicionamiento, valores, personalidad, arquetipo de marca, promesa, RTBs, audiencia, competidores, diferenciadores |
| **Fase B** | Verbal Identity | naming architecture, tagline / claim, tono de voz, vocabulario, palabras permitidas y evitadas, UX writing, narrativa de producto |
| **Fase C** | Visual Identity | símbolo/logotipo, color, tipografía, iconografía, composición, superficies, motion, ilustración, lenguaje de componentes |
| **Fase D** | Product Identity | onboarding, navegación, empty states, notifications, feedback, estados de carga, mensajes de error, sistema de documentos, dashboard, herramientas de estudio |

---

## 30. Conclusión

✅ Threshold no debe construirse mentalmente como una colección de herramientas para estudiantes.

🎯 Su interpretación estratégica más sólida es:

> una plataforma personal que ayuda a una persona a construir, organizar, mantener y utilizar su propio sistema de conocimiento.

✅ El ámbito académico es el primer territorio donde este problema aparece con suficiente intensidad para justificar el producto completo.

🎯 La universidad es, por tanto, un mercado inicial y un contexto de uso, no necesariamente la definición permanente de la categoría.

❓ La identidad de Threshold debería nacer de esa idea.

❓ No de "una app para estudiar".  
❓ No de "una app con IA".  
❓ No de "una app de productividad".

❓ Sino de una idea más profunda:

> Threshold ayuda a cruzar el umbral entre información y conocimiento.

❓ Esa puede ser la base conceptual sobre la que posteriormente se construyan la marca, la voz, el lenguaje visual y la experiencia completa del producto.

---

## Apéndice A — Mapa conceptual de producto

```
                         THRESHOLD
                             │
             PERSONAL KNOWLEDGE PLATFORM
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
     CONTEXTO              CONTENIDO          TIEMPO
         │                   │                   │
  Course / Subject      Documents             Schedule
  Assessment            StudyNote             Events
  Academic structure    Reading               Reminders
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ↓
                     KNOWLEDGE SYSTEM
                             │
            ┌────────────────┼────────────────┐
            ↓                ↓                ↓
        ORGANIZAR         COMPRENDER       RECORDAR
            │                │                │
            └────────────────┼────────────────┘
                             ↓
                       UTILIZAR
```

---

## Apéndice B — Frase de referencia interna ❓

> Threshold is a personal knowledge platform for learning — designed to turn fragmented information into contextual, usable knowledge.

*Esta frase funciona como referencia estratégica interna; no debe considerarse todavía tagline comercial definitivo.*

---

## Apéndice C — Resumen de clasificación por sección

| Sección | Tema | Tipo |
|---|---|---|
| 1 | Resumen ejecutivo | Mix (✅ tesis central, ❓ categoría/posicionamiento, 🎯 expansión) |
| 2.1 | Definición de producto | ✅ (excepto último párrafo 🎯) |
| 2.2 | Qué no es | ✅ |
| 3.1 | Categoría principal | ❓ |
| 3.2 | Vertical inicial | ✅ |
| 3.3 | Descripciones | ✅ / ❓ |
| 3.4 | Implicación estratégica | 🎯 |
| 3.5 | Perfil arquitectónico del producto | ✅ (con ❓ en la categoría que la engloba) |
| 4.1–4.2 | Usuario principal | ✅ |
| 4.3 | Usuario secundario | ❓ |
| 4.4 | Fuera del foco | ✅ |
| 5 | Problema | ✅ |
| 6.1 | Propuesta de valor central | ❓ |
| 6.2–6.5 | Beneficios | 🎯 / ❓ |
| 7 | Modelo conceptual | ✅ |
| 8 | Arquitectura | ✅ (excepto observación confianza ❓ en 8.3) |
| 9 | Principios | ✅ |
| 10 | Diferenciación | Mix (✅ diagnóstico, ❓ claims diferenciales, 🎯 ambición) |
| 11 | Territorio conceptual | ❓ |
| 12 | Significado del nombre | ❓ |
| 13 | Personalidad | ❓ |
| 14 | Posicionamiento | ❓ |
| 15 | Visión | 🎯 |
| 16 | Conocimiento vs información | ❓ |
| 17 | Experiencia ideal | 🎯 |
| 18 | UX/UI | ❓ (salvo indicaciones contrarias) |
| 19 | IA | ✅ |
| 20 | Trust & reliability | ❓ (✅ los elementos, ❓ la tesis de marca) |
| 21 | Arquitectura de marca | ❓ |
| 22 | Métrica conceptual | ❓ |
| 23 | Capas del proyecto | ✅ / 🎯 (capa 4) |
| 24 | Evolución | ✅ |
| 25 | Narrativa | ❓ |
| 26 | Hipótesis central | ❓ |
| 27 | Guardrails | ❓ |
| 28 | Definiciones canónicas | Mix (ver tabla) |
| 29 | Próximos pasos | ✅ |
| 30 | Conclusión | Mix (✅ base, 🎯 expansión, ❓ hipótesis de identidad) |
