# Casos de Uso — Threshold

> **Documento base**: `levantamiento_requisitos.md`
> **Total de requisitos funcionales**: 119 (RF-01 a RF-119)
> **Total de casos de uso**: 64

---

## Convenciones

| Actor | Descripción |
|---|---|
| **Usuario** | Estudiante universitario con cuenta activa |
| **Invitado** | Usuario sin sesión iniciada, acceso limitado |
| **Sistema** | La aplicación Threshold (frontend + backend) |
| **Uploadthing** | Servicio externo de almacenamiento en la nube |
| **IA (Zyren)** | Asistente de inteligencia artificial híbrido (cloud/local) |

**Formato de cada caso de uso:**

```
CU-XXX: Nombre del caso de uso
  Actor:       [Usuario | Sistema | Invitado]
  Disparador:  [qué inicia el caso de uso]
  RF asociado: [RF-XX, RF-XX]
  Descripción: [breve descripción]
  Precondiciones:
    - ...
  Flujo principal:
    1. ...
    2. ...
    3. ...
  Flujo alternativo:
    - ...
  Postcondiciones:
    - ...
```

---

## Módulo 1: Autenticación y Cuenta

### CU-001: Registrar usuario
| | |
|---|---|
| **Actor** | Usuario (nuevo) |
| **Disparador** | El usuario pulsa "Registrarse" en la pantalla de login |
| **RF asociado** | RF-01 |
| **Descripción** | El usuario crea una cuenta en 2 pasos: primero ingresa datos de perfil (nombre, universidad, carrera, semestre), luego credenciales (email, contraseña). El sistema persiste la sesión y redirige al dashboard. |
| **Precondiciones** | No haber iniciado sesión previamente |
| **Flujo principal** | 1. El usuario pulsa "Registrarse" en la pantalla de login<br>2. El sistema muestra paso 1: formulario de perfil<br>3. El usuario completa nombre, universidad, carrera, semestre<br>4. El sistema valida los campos y avanza al paso 2<br>5. El usuario ingresa email y contraseña<br>6. El sistema valida credenciales contra el backend<br>7. El sistema almacena el token en SecureStore<br>8. El sistema carga los datos iniciales y redirige al dashboard |
| **Flujo alternativo** | 6a. El backend rechaza el registro (email duplicado): el sistema muestra error y solicita otro email<br>6b. Error de red: el sistema registra localmente y encola la creación para sincronización posterior |
| **Postcondiciones** | Usuario autenticado, sesión activa, token almacenado en SecureStore |

### CU-002: Iniciar sesión con email y contraseña
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Iniciar sesión" |
| **RF asociado** | RF-02 |
| **Descripción** | El usuario ingresa sus credenciales, el sistema valida contra el backend y establece la sesión. |
| **Precondiciones** | Tener cuenta registrada |
| **Flujo principal** | 1. El usuario ingresa email y contraseña<br>2. El usuario pulsa "Iniciar sesión"<br>3. El sistema envía credenciales al backend<br>4. El backend valida y devuelve token JWT<br>5. El sistema almacena el token en SecureStore<br>6. El sistema carga datos precargados y redirige al dashboard |
| **Flujo alternativo** | 4a. Credenciales inválidas: el sistema muestra error "Email o contraseña incorrectos"<br>4b. Error de red: el sistema muestra mensaje de error y permite reintentar |
| **Postcondiciones** | Sesión iniciada, token almacenado |

### CU-003: Iniciar sesión como invitado
| | |
|---|---|
| **Actor** | Usuario (nuevo) |
| **Disparador** | El usuario pulsa "Entrar como invitado" |
| **RF asociado** | RF-03 |
| **Descripción** | El usuario accede a la app sin registro, con funcionalidad limitada de solo lectura. |
| **Precondiciones** | — |
| **Flujo principal** | 1. El usuario pulsa "Entrar como invitado"<br>2. El sistema genera un UUID de invitado<br>3. El sistema almacena el identificador en SecureStore<br>4. El sistema registra la visita en el backend (fire-and-forget)<br>5. El sistema redirige al dashboard en modo limitado |
| **Postcondiciones** | Sesión de invitado activa, acceso limitado a funcionalidades de solo lectura |

### CU-004: Autenticarse con biometría
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa el ícono de huella/Face ID en la pantalla de login |
| **RF asociado** | RF-04, RF-05 |
| **Descripción** | El usuario se autentica usando sensor biométrico del dispositivo. |
| **Precondiciones** | Haber inscrito token biométrico previamente |
| **Flujo principal** | 1. El usuario pulsa el ícono biométrico<br>2. El sistema muestra el diálogo nativo de biometría (huella o Face ID)<br>3. El usuario se autentica con el sensor<br>4. El sistema recupera el token biométrico almacenado<br>5. El sistema intercambia el token por una sesión JWT<br>6. El sistema redirige al dashboard |
| **Flujo alternativo** | 3a. Fallo de autenticación biométrica: el sistema permite reintentar o volver a login por email |
| **Postcondiciones** | Sesión iniciada mediante biometría |

### CU-005: Cerrar sesión
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Cerrar sesión" en Configuración |
| **RF asociado** | RF-06 |
| **Descripción** | El usuario cierra su sesión actual. El sistema limpia todos los datos locales y redirige al login. |
| **Precondiciones** | Sesión activa |
| **Flujo principal** | 1. El usuario navega a Configuración<br>2. El usuario pulsa "Cerrar sesión"<br>3. El sistema muestra confirmación<br>4. El usuario confirma<br>5. El sistema envía sign-out al backend<br>6. El sistema limpia SecureStore (token, preferencias)<br>7. El sistema redirige a la pantalla de login |
| **Postcondiciones** | Sesión cerrada, datos locales limpiados |

### CU-006: Eliminar cuenta
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Eliminar cuenta" en Configuración |
| **RF asociado** | RF-07 |
| **Descripción** | Proceso de 4 pasos para eliminar permanentemente la cuenta y todos los datos asociados. |
| **Precondiciones** | Sesión activa |
| **Flujo principal** | 1. El usuario pulsa "Eliminar cuenta"<br>2. El sistema muestra paso 1: confirmación de intención<br>3. El usuario confirma<br>4. El sistema muestra paso 2: verificación de contraseña<br>5. El usuario ingresa su contraseña actual<br>6. El sistema valida la contraseña<br>7. El sistema muestra paso 3: vista previa de datos a eliminar<br>8. El usuario revisa y confirma<br>9. El sistema muestra paso 4: confirmación final<br>10. El usuario confirma definitivamente<br>11. El sistema envía solicitud de eliminación al backend<br>12. El sistema limpia todos los datos locales<br>13. El sistema redirige a la pantalla de login |
| **Flujo alternativo** | 6a. Contraseña incorrecta: el sistema muestra error y permite reintentar |
| **Postcondiciones** | Cuenta eliminada, datos locales y remotos borrados |

### CU-007: Editar perfil
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Editar perfil" en Configuración |
| **RF asociado** | RF-08 |
| **Descripción** | El usuario modifica su información de perfil (nombre, universidad, carrera, semestre, meta de estudio). |
| **Precondiciones** | Sesión activa |
| **Flujo principal** | 1. El usuario abre el modal de edición de perfil<br>2. El sistema carga los datos actuales del perfil<br>3. El usuario modifica los campos deseados<br>4. El usuario pulsa "Guardar"<br>5. El sistema valida los campos<br>6. El sistema actualiza localmente (SQLite)<br>7. El sistema encola la sincronización al backend<br>8. El sistema muestra notificación de éxito |
| **Postcondiciones** | Perfil actualizado local y remotamente |

### CU-008: Detectar sesión al iniciar la app
| | |
|---|---|
| **Actor** | Sistema |
| **Disparador** | El usuario abre la aplicación |
| **RF asociado** | RF-09 |
| **Descripción** | Al abrir la app, el sistema verifica si existe un token de sesión válido y redirige automáticamente al dashboard o al login. |
| **Flujo principal** | 1. El usuario abre la app<br>2. El sistema muestra la pantalla de bienvenida con animación<br>3. El sistema verifica SecureStore en busca de token JWT<br>4. Si hay token válido → redirige al dashboard<br>5. Si no hay token → redirige a la pantalla de login |
| **Postcondiciones** | Usuario redirigido a la pantalla correspondiente según estado de sesión |

---

## Módulo 2: Dashboard / Inicio

### CU-009: Visualizar dashboard principal
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario accede a la pestaña de inicio |
| **RF asociado** | RF-10, RF-11, RF-13, RF-14 |
| **Descripción** | El sistema muestra la vista principal del dashboard con carrusel de materias, métricas, feed de actividad y herramientas de estudio. |
| **Precondiciones** | Sesión activa, datos precargados |
| **Flujo principal** | 1. El usuario navega a la pestaña de inicio<br>2. El sistema carga datos desde la caché local y refresca en segundo plano<br>3. El sistema muestra el carrusel de materias con promedios y completitud<br>4. El sistema muestra las tarjetas de métricas (promedio general, críticas, etc.)<br>5. El sistema muestra el feed de actividad reciente<br>6. El sistema muestra las herramientas de estudio rápido |
| **Postcondiciones** | Dashboard visible con datos actualizados |

### CU-010: Abrir menú de acceso rápido (FAB)
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa el botón flotante (FAB) en el dashboard |
| **RF asociado** | RF-12 |
| **Descripción** | El sistema muestra un menú contextual con opciones de acceso rápido: Registrar nota, Nueva tarea, Tomar foto. |
| **Flujo principal** | 1. El usuario pulsa el FAB<br>2. El sistema muestra el menú con 3 opciones<br>3. El usuario selecciona una opción<br>4. El sistema abre el modal correspondiente |
| **Postcondiciones** | Modal de la opción seleccionada abierto |

---

## Módulo 3: Materias

### CU-011: Crear materia
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Crear materia" en el dashboard o lista de materias |
| **RF asociado** | RF-16 |
| **Descripción** | El usuario crea una nueva materia académica con nombre, profesor, créditos, nota objetivo, color e ícono. |
| **Precondiciones** | Sesión activa |
| **Flujo principal** | 1. El usuario pulsa "Crear materia"<br>2. El sistema muestra el formulario de creación<br>3. El usuario ingresa nombre, profesor, créditos, nota objetivo<br>4. El usuario selecciona un color de paleta (18 colores)<br>5. El usuario selecciona un ícono (20 iconos)<br>6. El usuario pulsa "Guardar"<br>7. El sistema valida los campos obligatorios<br>8. El sistema guarda la materia en SQLite local<br>9. El sistema encola la sincronización al backend<br>10. El sistema actualiza el dashboard |
| **Flujo alternativo** | 7a. Nombre vacío: el sistema muestra error y no permite guardar |
| **Postcondiciones** | Materia creada y visible en el dashboard y lista de materias |

### CU-012: Editar materia
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Editar" en el contexto de una materia |
| **RF asociado** | RF-17 |
| **Descripción** | El usuario modifica los atributos de una materia existente. |
| **Precondiciones** | Materia existente |
| **Flujo principal** | 1. El usuario pulsa "Editar" en la materia (long-press o menú)<br>2. El sistema muestra el formulario precargado con datos actuales<br>3. El usuario modifica los campos deseados<br>4. El usuario pulsa "Guardar"<br>5. El sistema actualiza en SQLite<br>6. El sistema encola la sincronización |
| **Postcondiciones** | Materia actualizada |

### CU-013: Eliminar materia
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Eliminar" en el contexto de una materia |
| **RF asociado** | RF-17 |
| **Descripción** | El usuario elimina una materia y todos sus datos asociados (evaluaciones, fotos, documentos, etc.). |
| **Precondiciones** | Materia existente |
| **Flujo principal** | 1. El usuario pulsa "Eliminar" en la materia<br>2. El sistema muestra confirmación<br>3. El usuario confirma<br>4. El sistema elimina la materia y datos asociados de SQLite<br>5. El sistema encola la eliminación para sincronización |
| **Postcondiciones** | Materia y datos asociados eliminados |

### CU-014: Visualizar detalle de materia
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa una materia en el dashboard o lista |
| **RF asociado** | RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, RF-26 |
| **Descripción** | El sistema muestra la pantalla de detalle de la materia con toda su información: héroe, umbral, estadísticas, histórico de evaluaciones, galería, documentos, horario y FAB de IA. |
| **Precondiciones** | Materia existente |
| **Flujo principal** | 1. El usuario pulsa una materia<br>2. El sistema carga los datos de la materia desde SQLite<br>3. El sistema muestra la tarjeta héroe (ícono, nombre, profesor, progreso)<br>4. El sistema calcula y muestra el Umbral (Threshold)<br>5. El sistema muestra las estadísticas: Average, Proyectado, Entregas<br>6. El sistema muestra el histórico de evaluaciones con barras de progreso<br>7. El sistema carga y muestra la galería de fotos, documentos, grabaciones<br>8. El sistema muestra el horario semanal si existe<br>9. El sistema muestra el simulador de nota<br>10. El sistema muestra el FAB de IA para acceder a Zyren |
| **Postcondiciones** | Detalle de materia visible con todos los datos cargados |

### CU-015: Simular nota necesaria (umbral)
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa el simulador de nota en el detalle de materia |
| **RF asociado** | RF-25 |
| **Descripción** | El usuario ingresa su nota actual, la nota mínima para aprobar y el peso restante. El sistema calcula la nota mínima necesaria y la nota máxima alcanzable. |
| **Precondiciones** | Materia existente, datos de evaluaciones disponibles |
| **Flujo principal** | 1. El usuario pulsa el simulador de nota<br>2. El sistema muestra los campos: nota actual, nota requerida, peso restante<br>3. El sistema precarga la nota actual y peso restante desde los datos reales<br>4. El usuario ajusta los valores si lo desea<br>5. El sistema calcula y muestra: nota mínima necesaria y nota máxima alcanzable<br>6. El usuario puede guardar el resultado como nota objetivo |
| **Postcondiciones** | Umbral calculado y mostrado |

---

## Módulo 4: Calificaciones

### CU-016: Visualizar calificaciones generales
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario navega a la pestaña de calificaciones |
| **RF asociado** | RF-28, RF-29, RF-30 |
| **Descripción** | El sistema muestra el GPA general, radar de dominio por materia, simulador de proyección y lista de evaluaciones. |
| **Precondiciones** | Sesión activa, datos de evaluaciones cargados |
| **Flujo principal** | 1. El usuario navega a la pestaña de calificaciones<br>2. El sistema calcula y muestra el GPA general<br>3. El sistema muestra el selector de materia para filtrar<br>4. El sistema muestra el radar de dominio (Mastery Radar)<br>5. El sistema muestra el simulador de proyección<br>6. El sistema lista las evaluaciones con sus calificaciones |
| **Postcondiciones** | Pantalla de calificaciones visible con datos actualizados |

### CU-017: Crear evaluación (nota/tarea)
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Registrar nota" o "Nueva tarea" |
| **RF asociado** | RF-31 |
| **Descripción** | El usuario registra una nueva evaluación académica con nombre, tipo, peso, fecha, valor y porcentaje. |
| **Precondiciones** | Al menos una materia existente |
| **Flujo principal** | 1. El usuario selecciona "Registrar nota" o "Nueva tarea"<br>2. El sistema muestra el formulario de evaluación<br>3. El usuario selecciona la materia<br>4. El usuario selecciona la categoría de evaluación<br>5. El usuario ingresa nombre, tipo, peso, valor, porcentaje, fechas<br>6. El usuario pulsa "Guardar"<br>7. El sistema guarda la evaluación en SQLite<br>8. El sistema recalcula el promedio de la materia<br>9. El sistema encola la sincronización al backend<br>10. El sistema actualiza la interfaz |
| **Postcondiciones** | Evaluación creada, promedios recalculados |

### CU-018: Completar tarea
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Completar" en una tarea pendiente |
| **RF asociado** | RF-32 |
| **Descripción** | El usuario marca una tarea como completada, ingresando la nota y el porcentaje obtenido. |
| **Precondiciones** | Tarea pendiente existente |
| **Flujo principal** | 1. El usuario pulsa "Completar" en la tarea<br>2. El sistema muestra el formulario de calificación<br>3. El usuario ingresa el valor de nota y porcentaje obtenido<br>4. El usuario pulsa "Guardar"<br>5. El sistema actualiza la evaluación en SQLite<br>6. El sistema recalcula el promedio de la materia<br>7. El sistema encola la sincronización |
| **Postcondiciones** | Tarea marcada como completada, promedios recalculados |

### CU-019: Gestionar categorías de evaluación
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario navega a la gestión de categorías de una materia |
| **RF asociado** | RF-34, RF-35 |
| **Descripción** | El usuario crea, edita y elimina categorías de evaluación con peso configurable y función "drop lowest". El sistema verifica que el peso total no supere 100%. |
| **Precondiciones** | Materia existente |
| **Flujo principal** | 1. El usuario navega a la gestión de categorías de una materia<br>2. El sistema muestra la lista de categorías actuales con sus pesos<br>3. El sistema muestra la suma de pesos total<br>4. El usuario puede crear, editar o eliminar categorías<br>5. Al guardar, el sistema verifica que el peso total sea ≤ 100%<br>6. Si el peso total es < 100%, el sistema muestra advertencia |
| **Postcondiciones** | Categorías actualizadas, pesos validados |

---

## Módulo 5: Calendario

### CU-020: Visualizar calendario mensual
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario navega a la pestaña de calendario |
| **RF asociado** | RF-37, RF-38 |
| **Descripción** | El sistema muestra el calendario en vista de cuadrícula mensual con eventos y tareas, más una lista de agenda. |
| **Precondiciones** | Sesión activa |
| **Flujo principal** | 1. El usuario navega a la pestaña de calendario<br>2. El sistema carga eventos desde SQLite (evaluaciones, eventos de calendario, horarios)<br>3. El sistema muestra la cuadrícula mensual con marcadores de eventos<br>4. El sistema muestra la lista de agenda del día seleccionado<br>5. El usuario puede navegar entre meses |
| **Postcondiciones** | Calendario visible con eventos cargados |

### CU-021: Crear evento de calendario
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Nuevo evento" en el calendario |
| **RF asociado** | RF-39, RF-40, RF-41, RF-42 |
| **Descripción** | El usuario crea un evento académico o personal con tipo (examen/tarea/clase/otro), materia vinculada, fecha, hora y opción de plan de estudio automático. |
| **Precondiciones** | Sesión activa |
| **Flujo principal** | 1. El usuario pulsa "Nuevo evento"<br>2. El sistema muestra el modal de creación con diseño Bento<br>3. El usuario ingresa el título del evento<br>4. El usuario selecciona el tipo (examen, tarea, clase, otro)<br>5. Si no es "otro", el usuario selecciona la materia vinculada<br>6. El usuario configura fecha, hora y si es todo el día<br>7. Si es tipo "examen", el usuario puede activar "Crear plan de estudio"<br>8. El usuario pulsa "Guardar"<br>9. El sistema guarda el evento en SQLite<br>10. El sistema programa notificación recordatorio (15 min antes)<br>11. Si aplica, el sistema crea el plan de estudio automático<br>12. El sistema encola la sincronización |
| **Postcondiciones** | Evento creado, notificación programada, plan de estudio generado (si aplica) |

### CU-022: Ver detalle de evento
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa un evento en el calendario |
| **RF asociado** | RF-43 |
| **Descripción** | El sistema muestra el detalle del evento seleccionado y permite editarlo. |
| **Precondiciones** | Evento existente |
| **Flujo principal** | 1. El usuario pulsa un evento en el calendario<br>2. El sistema muestra el modal de detalle con toda la información<br>3. El usuario puede editar o eliminar el evento |
| **Postcondiciones** | Detalle del evento visible |

---

## Módulo 6: Flashcards

### CU-023: Crear mazo de tarjetas
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Nuevo mazo" en la pantalla de flashcards |
| **RF asociado** | RF-45 |
| **Descripción** | El usuario crea un nuevo mazo de tarjetas con título, descripción y materia opcional. |
| **Precondiciones** | Sesión activa |
| **Flujo principal** | 1. El usuario pulsa "Nuevo mazo"<br>2. El sistema muestra el formulario de creación<br>3. El usuario ingresa título y descripción<br>4. El usuario selecciona una materia (opcional)<br>5. El usuario pulsa "Guardar"<br>6. El sistema guarda el mazo en SQLite<br>7. El sistema encola la sincronización |
| **Postcondiciones** | Mazo creado y visible en la lista |

### CU-024: Crear tarjeta manualmente
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Añadir tarjeta" dentro de un mazo |
| **RF asociado** | RF-46 |
| **Descripción** | El usuario crea una tarjeta de estudio manualmente eligiendo entre 3 formatos: flashcard (Q&A), opción múltiple o verdadero/falso. |
| **Precondiciones** | Mazo existente |
| **Flujo principal** | 1. El usuario pulsa "Añadir tarjeta"<br>2. El sistema muestra paso 1: selección de tipo (flashcard / múltiple / verdadero-falso)<br>3. El usuario selecciona el tipo<br>4. El sistema muestra paso 2: formulario dinámico según el tipo<br>5. El usuario completa los campos (pregunta, respuesta, opciones, etc.)<br>6. El usuario pulsa "Guardar"<br>7. El sistema guarda la tarjeta en SQLite y MMKV<br>8. El sistema actualiza el contador del mazo<br>9. El sistema encola la sincronización |
| **Postcondiciones** | Tarjeta creada, contador del mazo actualizado |

### CU-025: Generar tarjetas con IA
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Generar con IA" en el creador de tarjetas o desde el detalle de una materia |
| **RF asociado** | RF-47 |
| **Descripción** | El usuario selecciona contenido (transcripción, OCR, documento) y el sistema genera tarjetas de estudio automáticamente mediante IA híbrida. |
| **Precondiciones** | Contenido de texto disponible (transcripción, OCR, documento) |
| **Flujo principal** | 1. El usuario pulsa "Generar con IA"<br>2. El sistema muestra selector de contenido: tipo de tarjeta y fuente de contenido<br>3. El usuario selecciona el contenido a usar (transcripción, OCR, etc.)<br>4. El usuario selecciona el tipo de tarjeta a generar (flashcard, MC, T/F)<br>5. El sistema envía el contenido a la IA (cloud o local según conectividad)<br>6. El sistema muestra las tarjetas generadas en vista previa<br>7. El usuario puede editar, eliminar o regenerar tarjetas<br>8. El usuario pulsa "Guardar todas"<br>9. El sistema guarda las tarjetas en el mazo<br>10. El sistema actualiza los contadores |
| **Flujo alternativo** | 5a. Sin conexión: el sistema usa IA local (llama.rn)<br>5b. Error de IA: el sistema muestra alerta y permite reintentar |
| **Postcondiciones** | Tarjetas generadas y guardadas en el mazo |

### CU-026: Importar mazos desde archivo
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Importar mazo" en la pantalla de flashcards |
| **RF asociado** | RF-48 |
| **Descripción** | El usuario selecciona un archivo JSON de mazo desde el dispositivo, el sistema lo parsea y guarda todas las tarjetas en MMKV. |
| **Precondiciones** | Archivo JSON de mazo válido |
| **Flujo principal** | 1. El usuario pulsa "Importar mazo"<br>2. El sistema abre el selector de archivos (DocumentPicker)<br>3. El usuario selecciona un archivo JSON<br>4. El sistema parsea el JSON y extrae mazo + tarjetas<br>5. El sistema muestra vista previa del mazo a importar<br>6. El usuario puede reasignar la materia<br>7. El usuario pulsa "Importar"<br>8. El sistema guarda el mazo en SQLite y cada tarjeta en MMKV<br>9. El sistema muestra confirmación con conteo de tarjetas |
| **Flujo alternativo** | 4a. JSON inválido: el sistema muestra error de formato |
| **Postcondiciones** | Mazo importado con todas sus tarjetas disponibles offline |

### CU-027: Exportar mazo a JSON
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Exportar" en un mazo |
| **RF asociado** | RF-49 |
| **Descripción** | El sistema exporta el mazo seleccionado a un archivo JSON que puede compartirse. |
| **Precondiciones** | Mazo existente con al menos una tarjeta |
| **Flujo principal** | 1. El usuario pulsa "Exportar" en el mazo<br>2. El sistema genera un archivo JSON con el mazo y todas sus tarjetas<br>3. El sistema abre el menú de compartir del sistema operativo<br>4. El usuario comparte o guarda el archivo |
| **Postcondiciones** | Archivo JSON generado y compartido |

### CU-028: Estudiar tarjetas (sesión de repaso)
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Estudiar" en un mazo |
| **RF asociado** | RF-50, RF-51 |
| **Descripción** | El usuario inicia una sesión de repaso espaciado. El sistema muestra las tarjetas una por una con animación de volteo. El usuario califica su respuesta (correcto/incorrecto) y el sistema actualiza el programador FSRS. |
| **Precondiciones** | Mazo existente con tarjetas |
| **Flujo principal** | 1. El usuario pulsa "Estudiar" en un mazo<br>2. El sistema carga las tarjetas pendientes según FSRS<br>3. El sistema muestra la primera tarjeta (anverso)<br>4. El usuario piensa la respuesta y pulsa para voltear<br>5. El sistema muestra el reverso de la tarjeta<br>6. El usuario pulsa "Correcto" o "Incorrecto"<br>7. El sistema registra el resultado y el tiempo de respuesta<br>8. El sistema actualiza la programación FSRS de la tarjeta<br>9. El sistema pasa a la siguiente tarjeta<br>10. Al terminar, el sistema muestra resumen de la sesión |
| **Flujo alternativo** | 4a. El usuario pulsa "Posponer" → ver CU-029 |
| **Postcondiciones** | Progreso de estudio guardado, programación FSRS actualizada |

### CU-029: Posponer tarjeta (snooze)
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Posponer" durante una sesión de estudio |
| **RF asociado** | RF-52 |
| **Descripción** | El usuario pospone una tarjeta para revisarla más tarde, con opciones de 15 min, 1h, 4h, mañana o fin de semana. |
| **Precondiciones** | Sesión de estudio activa |
| **Flujo principal** | 1. El usuario pulsa "Posponer" durante el estudio<br>2. El sistema muestra las opciones de snooze<br>3. El usuario selecciona el intervalo (15min, 1h, 4h, mañana, fin de semana)<br>4. El sistema guarda la posición en AsyncStorage<br>5. El sistema excluye la tarjeta del estudio hasta que venza el snooze<br>6. El sistema pasa a la siguiente tarjeta |
| **Postcondiciones** | Tarjeta pospuesta hasta la fecha seleccionada |

### CU-030: Compartir mazo con código PIN
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Compartir" en un mazo |
| **RF asociado** | RF-53 |
| **Descripción** | El usuario comparte un mazo de tarjetas generando un código PIN que otros usuarios pueden usar para unirse al grupo y acceder al mazo. |
| **Precondiciones** | Mazo existente |
| **Flujo principal** | 1. El usuario pulsa "Compartir" en el mazo<br>2. El sistema genera un código PIN único<br>3. El sistema muestra el PIN para que el usuario lo comparta<br>4. El usuario envía el PIN a otros usuarios<br>5. Otros usuarios ingresan el PIN para unirse al grupo<br>6. El sistema comparte el mazo con los miembros del grupo |
| **Postcondiciones** | Mazo compartido con grupo de estudio |

---

## Módulo 7: Documentos y Escáner

### CU-031: Escanear documento con la cámara
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Escanear" desde la galería o detalle de materia |
| **RF asociado** | RF-57, RF-58, RF-59 |
| **Descripción** | El usuario usa la cámara para escanear un documento. El sistema aplica corrección de perspectiva automática y permite aplicar filtros de mejora. El usuario puede exportar como imagen o PDF. |
| **Precondiciones** | Permiso de cámara concedido |
| **Flujo principal** | 1. El usuario pulsa "Escanear"<br>2. El sistema abre el escáner de documentos con guía de nivel (acelerómetro)<br>3. El usuario captura el documento<br>4. El sistema aplica corrección de perspectiva automática<br>5. El sistema muestra la imagen escaneada<br>6. El usuario puede aplicar filtros (B/N, Alto Contraste, Texto Mágico, etc.)<br>7. El usuario selecciona exportar como Imagen o PDF<br>8. El sistema ejecuta OCR híbrido para extraer texto<br>9. El usuario selecciona la materia asociada<br>10. El sistema guarda el documento en SQLite y el archivo localmente |
| **Postcondiciones** | Documento escaneado, OCR extraído, archivo guardado localmente |

### CU-032: Extraer texto con OCR
| | |
|---|---|
| **Actor** | Sistema |
| **Disparador** | Al escanear un documento, importar PDF o ver una imagen |
| **RF asociado** | RF-60, RF-61 |
| **Descripción** | El sistema ejecuta OCR sobre una imagen o PDF usando el proveedor híbrido (ML Kit si offline, cloud si online, respetando forceOfflineMode). |
| **Precondiciones** | Imagen o PDF disponible |
| **Flujo principal** | 1. El sistema recibe la imagen o PDF<br>2. El sistema consulta `resolveProvider()` para determinar el método<br>3. Si hay conexión y no está en modo offline forzado → OCR cloud (backend)<br>4. Si está offline o modo forzado → OCR local (ML Kit para imágenes, módulo nativo para PDF)<br>5. El sistema extrae el texto<br>6. El sistema asocia el texto extraído al documento |
| **Postcondiciones** | Texto extraído y asociado al documento |

### CU-033: Importar PDF desde el dispositivo
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Importar PDF" |
| **RF asociado** | RF-61 |
| **Descripción** | El usuario selecciona un archivo PDF del dispositivo. El sistema extrae el texto (híbrido) y lo guarda como documento escaneado. |
| **Precondiciones** | Permiso de almacenamiento concedido |
| **Flujo principal** | 1. El usuario pulsa "Importar PDF"<br>2. El sistema abre el selector de documentos<br>3. El usuario selecciona un archivo PDF<br>4. El sistema ejecuta `extractTextFromPDFHybrid`<br>5. El sistema guarda el documento escaneado con el texto extraído<br>6. El sistema asigna el documento a la materia seleccionada |
| **Flujo alternativo** | 4a. Error de extracción: el sistema muestra alerta y permite reintentar |
| **Postcondiciones** | PDF importado, texto extraído, documento guardado |

### CU-034: Tomar foto con la cámara
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Tomar foto" desde el FAB, galería o detalle de materia |
| **RF asociado** | RF-62 |
| **Descripción** | El usuario toma una foto con la cámara, la asigna a una materia y la guarda. |
| **Precondiciones** | Permiso de cámara concedido |
| **Flujo principal** | 1. El usuario pulsa "Tomar foto"<br>2. El sistema abre la cámara con control de flash<br>3. El usuario toma una o más fotos<br>4. El usuario selecciona la materia asociada<br>5. El sistema guarda la foto localmente<br>6. El sistema ejecuta OCR sobre la imagen<br>7. El sistema guarda la foto en SQLite<br>8. Si auto-upload está activo, el sistema sube la foto a Uploadthing |
| **Postcondiciones** | Foto guardada, OCR extraído |

### CU-035: Ver imagen en pantalla completa
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa una foto en la galería o detalle de materia |
| **RF asociado** | RF-63 |
| **Descripción** | El sistema muestra la imagen en pantalla completa con zoom, opciones de compartir, OCR y eliminar. |
| **Precondiciones** | Foto existente |
| **Flujo principal** | 1. El usuario pulsa una foto<br>2. El sistema abre el visor de imágenes en pantalla completa<br>3. El usuario puede hacer zoom con gestos de pellizco<br>4. El sistema permite deslizar entre fotos del mismo grupo<br>5. El usuario puede compartir, ver OCR, copiar texto o eliminar la foto |
| **Postcondiciones** | Imagen visualizada en pantalla completa |

### CU-036: Buscar y filtrar en la galería
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario navega a la pestaña de galería |
| **RF asociado** | RF-64 |
| **Descripción** | El usuario busca y filtra fotos por materia, texto OCR, favoritos o todas. |
| **Precondiciones** | Fotos existentes |
| **Flujo principal** | 1. El usuario navega a la galería<br>2. El sistema muestra la cuadrícula de fotos agrupadas<br>3. El usuario puede filtrar por: Todas, Favoritas, Con OCR<br>4. El usuario puede filtrar por materia usando chips<br>5. El usuario puede buscar por texto en el campo de búsqueda<br>6. El sistema actualiza los resultados en tiempo real |
| **Postcondiciones** | Galería filtrada según criterios del usuario |

---

## Módulo 8: Grabaciones de Audio

### CU-037: Grabar audio
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Grabar audio" |
| **RF asociado** | RF-67, RF-68 |
| **Descripción** | El usuario graba audio con visualización de forma de onda en tiempo real, con opciones de pausa y reanudación. |
| **Precondiciones** | Permiso de micrófono concedido |
| **Flujo principal** | 1. El usuario pulsa "Grabar audio"<br>2. El sistema abre el modal de grabación con visualización de forma de onda<br>3. El usuario pulsa el botón de grabar<br>4. El sistema comienza la grabación, mostrando la forma de onda en tiempo real<br>5. El usuario puede pausar y reanudar la grabación<br>6. El usuario pulsa "Detener"<br>7. El sistema guarda la grabación localmente<br>8. El usuario puede asignarla a una materia<br>9. El sistema guarda en SQLite<br>10. Si auto-upload está activo, sube a Uploadthing |
| **Postcondiciones** | Grabación guardada localmente |

### CU-038: Transcribir audio
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Transcribir" en el detalle de una grabación |
| **RF asociado** | RF-70 |
| **Descripción** | El sistema transcribe el audio seleccionado usando Groq Whisper (cloud) o Whisper local (offline). |
| **Precondiciones** | Grabación de audio existente |
| **Flujo principal** | 1. El usuario pulsa "Transcribir"<br>2. El sistema determina el proveedor según conectividad<br>3. Si hay conexión: envía el audio a Groq Whisper vía backend<br>4. Si está offline: carga Whisper Tiny local, transcribe, descarga Whisper<br>5. El sistema muestra el progreso de la transcripción<br>6. Al completar, el sistema muestra el texto transcrito<br>7. El usuario puede copiar el texto o generar flashcards |
| **Postcondiciones** | Transcripción completada y visible |

### CU-039: Resumir transcripción con IA
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Resumir" después de una transcripción |
| **RF asociado** | RF-71 |
| **Descripción** | El sistema genera un resumen académico de la transcripción usando IA híbrida. |
| **Precondiciones** | Transcripción completada |
| **Flujo principal** | 1. El usuario pulsa "Resumir"<br>2. El sistema envía la transcripción a la IA (Groq o local)<br>3. La IA genera un resumen estructurado<br>4. El sistema muestra el resumen con formato markdown<br>5. El usuario puede regenerar, copiar o generar flashcards |
| **Postcondiciones** | Resumen generado y visible |

---

## Módulo 9: Integración con YouTube

### CU-040: Agregar video de YouTube
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Añadir YouTube" |
| **RF asociado** | RF-75, RF-76, RF-79 |
| **Descripción** | El usuario ingresa una URL de YouTube. El sistema obtiene la información del video, su transcripción (si está disponible) y lo asigna a una materia. |
| **Precondiciones** | Conexión a internet |
| **Flujo principal** | 1. El usuario pulsa "Añadir YouTube"<br>2. El sistema muestra un campo para ingresar la URL<br>3. El usuario pega la URL de YouTube<br>4. El sistema valida la URL y obtiene la información del video<br>5. El sistema intenta obtener la transcripción (subtítulos)<br>6. El usuario selecciona la materia asociada<br>7. El sistema guarda el video en SQLite |
| **Postcondiciones** | Video de YouTube guardado con transcripción (si disponible) |

### CU-041: Ver video embebido
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa un video de YouTube en la lista |
| **RF asociado** | RF-77 |
| **Descripción** | El sistema reproduce el video de YouTube embebido dentro de la app y muestra su transcripción. |
| **Precondiciones** | Video de YouTube guardado, conexión a internet |
| **Flujo principal** | 1. El usuario pulsa un video de YouTube<br>2. El sistema navega al detalle del video<br>3. El sistema reproduce el video embebido (react-native-youtube-iframe)<br>4. El sistema muestra la transcripción si está disponible<br>5. El usuario puede generar resumen o flashcards |
| **Postcondiciones** | Video reproducido, transcripción visible |

---

## Módulo 10: Configuración y Backup

### CU-042: Activar/desactivar backup en la nube
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa el toggle de "Backup en la nube" en Configuración |
| **RF asociado** | RF-80, RF-81 |
| **Descripción** | El usuario activa o desactiva el respaldo en la nube y selecciona qué tipos de archivos respaldar. |
| **Precondiciones** | Sesión activa |
| **Flujo principal** | 1. El usuario navega a Configuración > Backup<br>2. El sistema muestra los controles de backup<br>3. El usuario activa el toggle principal de backup en la nube<br>4. El usuario configura los tipos de archivo a respaldar (fotos, audio, documentos, transcripciones)<br>5. El sistema guarda las preferencias en SecureStore |
| **Postcondiciones** | Preferencias de backup guardadas |

### CU-043: Ejecutar backup manual
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Respaldar Todo", "Solo Datos" o "Multimedia" |
| **RF asociado** | RF-82, RF-85 |
| **Descripción** | El sistema ejecuta el backup manual según el tipo seleccionado. Muestra el progreso en notificaciones del sistema y alertas en la app. |
| **Precondiciones** | Backup en la nube activado |
| **Flujo principal** | 1. El usuario pulsa uno de los botones de backup<br>2. El sistema muestra notificación inicial de progreso<br>3. Si es "Solo Datos" o "Ambos": sincroniza datos BD con el backend<br>4. Si es "Multimedia" o "Ambos": sube archivos multimedia a Uploadthing<br>5. Durante la subida, el sistema actualiza la notificación con progreso (X/Y items)<br>6. Al completar: la notificación desaparece<br>7. El sistema muestra alerta en la app con el resultado (éxito/parcial/error)<br>8. El sistema actualiza las estadísticas de backup |
| **Flujo alternativo** | 5a. Error en un archivo: el sistema continúa con el siguiente y lo reporta al final<br>6a. Backup parcial: el sistema muestra alerta de advertencia con conteo de errores |
| **Postcondiciones** | Datos y/o multimedia respaldados, estadísticas actualizadas |

### CU-044: Descargar archivos desde la nube
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Descargar Todo" |
| **RF asociado** | RF-83, RF-85 |
| **Descripción** | El sistema descarga todos los archivos del usuario desde Uploadthing al dispositivo local. Muestra progreso en notificaciones. |
| **Precondiciones** | Backup en la nube activado, archivos en la nube |
| **Flujo principal** | 1. El usuario pulsa "Descargar Todo"<br>2. El sistema muestra notificación inicial de descarga<br>3. El sistema obtiene la lista de archivos en la nube<br>4. El sistema descarga cada archivo que no existe localmente<br>5. Durante la descarga, el sistema actualiza la notificación con progreso<br>6. Al completar: la notificación desaparece<br>7. El sistema muestra alerta con el resultado<br>8. El sistema actualiza la fecha de última descarga |
| **Postcondiciones** | Archivos descargados al dispositivo |

### CU-045: Programar backup automático
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario configura el backup automático en Configuración |
| **RF asociado** | RF-84 |
| **Descripción** | El usuario programa un backup automático diario a una hora específica, seleccionando el tipo (solo datos, solo multimedia o ambos). |
| **Precondiciones** | Backup en la nube activado |
| **Flujo principal** | 1. El usuario activa el toggle de backup automático<br>2. El sistema muestra los controles de hora y tipo<br>3. El usuario selecciona la hora del backup<br>4. El usuario selecciona el tipo (datos / multimedia / ambos)<br>5. El sistema registra un background task con expo-background-fetch<br>6. El sistema ejecutará el backup diariamente a la hora programada |
| **Postcondiciones** | Backup automático registrado como tarea en segundo plano |

### CU-046: Activar modo offline forzado
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario activa "Forzar modo offline" en Configuración |
| **RF asociado** | RF-86 |
| **Descripción** | El usuario activa el modo offline forzado que deshabilita todas las comunicaciones de red y obliga al uso de IA local. |
| **Precondiciones** | — |
| **Flujo principal** | 1. El usuario navega a Configuración > Motor de IA Local<br>2. El usuario activa el toggle "Forzar modo offline"<br>3. El sistema actualiza el store `useLocalAIStore.forceOfflineMode = true`<br>4. El sistema muestra un indicador "Offline" en los headers de la app<br>5. A partir de este momento, todas las operaciones de IA usan modelos locales |
| **Postcondiciones** | Modo offline activo, todas las llamadas de red deshabilitadas |

### CU-047: Gestionar modelos de IA locales
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario navega a la sección de modelos de IA en Configuración |
| **RF asociado** | RF-87 |
| **Descripción** | El usuario descarga, elimina y gestiona modelos GGUF de IA local desde HuggingFace con progreso mostrado en notificaciones. |
| **Precondiciones** | — |
| **Flujo principal** | 1. El usuario navega a la sección de modelos de IA local<br>2. El sistema muestra el catálogo de modelos disponibles (Esencial, Avanzado, Qwen, Phi, Gemma)<br>3. El sistema detecta y muestra la RAM del dispositivo y los modelos compatibles<br>4. El usuario pulsa "Descargar" en un modelo<br>5. El sistema descarga el modelo desde HuggingFace<br>6. El sistema muestra el progreso en notificación del sistema<br>7. Al completar, el sistema permite cargar el modelo para usar IA local<br>8. El usuario puede eliminar modelos descargados para liberar espacio |
| **Postcondiciones** | Modelo descargado y disponible para inferencia local |

### CU-048: Cambiar idioma de la app
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario selecciona un idioma en Configuración |
| **RF asociado** | RF-89 |
| **Descripción** | El usuario cambia el idioma de la interfaz entre español e inglés. El sistema persiste la preferencia y actualiza la UI en tiempo real. |
| **Precondiciones** | — |
| **Flujo principal** | 1. El usuario navega a Configuración > Idioma<br>2. El sistema muestra las opciones: Español, English<br>3. El usuario selecciona un idioma<br>4. El sistema guarda la preferencia en SecureStore<br>5. El sistema actualiza i18next con el nuevo idioma<br>6. La interfaz se actualiza inmediatamente |
| **Postcondiciones** | Idioma cambiado y persistido |

---

## Módulo 11: Asistente de IA (Zyren)

### CU-049: Iniciar chat con Zyren
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa el FAB de IA en el detalle de materia o en la pantalla de chat |
| **RF asociado** | RF-97, RF-98 |
| **Descripción** | El usuario inicia una conversación con Zyren, el asistente académico de IA. Zyren responde preguntas contextuales sobre la materia y los archivos del usuario. |
| **Precondiciones** | Al menos una materia existente |
| **Flujo principal** | 1. El usuario pulsa el FAB de IA<br>2. El sistema abre el modal de chat con Zyren<br>3. El sistema construye el contexto inicial con la materia actual<br>4. El usuario escribe una pregunta o mensaje<br>5. El sistema determina proveedor de IA (cloud o local)<br>6. El sistema envía el mensaje + contexto a la IA<br>7. La IA procesa y devuelve la respuesta<br>8. El sistema muestra la respuesta con formato markdown<br>9. El historial de la conversación se mantiene durante la sesión |
| **Postcondiciones** | Conversación activa con Zyren |

### CU-050: Seleccionar archivos como contexto de IA
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Seleccionar contexto" en el chat de Zyren |
| **RF asociado** | RF-102 |
| **Descripción** | El usuario selecciona archivos (documentos, fotos, grabaciones, videos) para usarlos como contexto en la conversación con Zyren. |
| **Precondiciones** | Archivos existentes (documentos, fotos, grabaciones, videos) |
| **Flujo principal** | 1. El usuario pulsa "Seleccionar contexto" en el chat<br>2. El sistema muestra un modal con diseño Bento de archivos disponibles<br>3. El sistema agrupa los archivos por tipo (documentos, fotos, audio, video)<br>4. El usuario selecciona los archivos que desea incluir<br>5. El sistema añade el contenido (OCR, transcripciones) al contexto del chat<br>6. El usuario puede iniciar una consulta sobre los archivos seleccionados |
| **Postcondiciones** | Archivos seleccionados como contexto para Zyren |

### CU-051: Generar material de estudio con IA
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario solicita a Zyren generar flashcards, preguntas o material de estudio |
| **RF asociado** | RF-99 |
| **Descripción** | Zyren detecta la intención del usuario de generar material de estudio y produce tarjetas flash, preguntas de opción múltiple o material de repaso. |
| **Precondiciones** | Chat activo con Zyren, contexto disponible |
| **Flujo principal** | 1. El usuario escribe un mensaje solicitando material de estudio (ej: "crea flashcards sobre mitosis")<br>2. Zyren detecta la intención mediante regex<br>3. Zyren genera el material y lo devuelve en formato estructurado<br>4. El sistema parsea la respuesta y detecta el bloque `%%DECK_ACTION%%`<br>5. El sistema muestra el material generado al usuario<br>6. El usuario puede editar, regenerar o guardar el material como tarjetas |
| **Postcondiciones** | Material de estudio generado por IA |

### CU-052: Usar IA sin conexión
| | |
|---|---|
| **Actor** | Sistema |
| **Disparador** | El usuario está offline o en modo offline forzado y usa cualquier función de IA |
| **RF asociado** | RF-100 |
| **Descripción** | Cuando no hay conexión a internet o el modo offline forzado está activo, el sistema utiliza modelos locales (llama.rn) para todas las operaciones de IA. |
| **Precondiciones** | Modelo local descargado y cargado |
| **Flujo principal** | 1. El usuario realiza una solicitud de IA (chat, generar tarjetas, resumir)<br>2. El sistema consulta `resolveProvider()`<br>3. `resolveProvider()` detecta offline o forceOfflineMode → devuelve 'local'<br>4. El sistema verifica que el modelo local esté cargado<br>5. Si no está cargado, el sistema carga el modelo desde GGUF<br>6. El sistema ejecuta la inferencia local con llama.rn<br>7. La salida se restringe con GBNF grammar para formato JSON válido<br>8. El sistema devuelve el resultado al usuario |
| **Flujo alternativo** | 5a. Modelo no descargado: el sistema muestra mensaje solicitando descarga |
| **Postcondiciones** | Operación de IA completada localmente |

---

## Módulo 12: Horario de Clases

### CU-053: Crear horario semanal
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Planificar horario" en el dashboard o detalle de materia |
| **RF asociado** | RF-106 |
| **Descripción** | El usuario crea un horario semanal arrastrando materias a bloques horarios en una cuadrícula visual. |
| **Precondiciones** | Al menos una materia existente |
| **Flujo principal** | 1. El usuario pulsa "Planificar horario"<br>2. El sistema muestra una cuadrícula con días de la semana y bloques horarios<br>3. El usuario selecciona un día y un horario de inicio/fin<br>4. El usuario selecciona la materia para ese bloque<br>5. El sistema guarda el horario en SQLite<br>6. Si está activado, el sistema programa notificaciones de clase (5 min antes) |
| **Postcondiciones** | Horario guardado, notificaciones de clase programadas (si aplica) |

---

## Módulo 13: Notificaciones

### CU-054: Recibir notificación de fecha límite
| | |
|---|---|
| **Actor** | Sistema |
| **Disparador** | Se acerca la fecha de vencimiento de una tarea o examen (15 min antes) |
| **RF asociado** | RF-109 |
| **Descripción** | El sistema programa y dispara una notificación local recordando al usuario sobre una fecha límite próxima. |
| **Precondiciones** | Evento o evaluación con fecha futura |
| **Flujo principal** | 1. El usuario crea una evaluación o evento con fecha<br>2. El sistema calcula la fecha de notificación (15 min antes del evento)<br>3. El sistema programa una notificación local con expo-notifications<br>4. Cuando llega la fecha, el sistema muestra la notificación<br>5. Al pulsar la notificación, el sistema navega al calendario |
| **Postcondiciones** | Notificación de fecha límite mostrada |

### CU-055: Recibir resumen semanal
| | |
|---|---|
| **Actor** | Sistema |
| **Disparador** | Llega el día y hora configurados para el resumen semanal |
| **RF asociado** | RF-112 |
| **Descripción** | El sistema muestra una notificación con el resumen semanal de actividades, tareas pendientes y eventos próximos. |
| **Precondiciones** | Resumen semanal configurado por el usuario |
| **Flujo principal** | 1. El usuario configura el resumen semanal (día y hora)<br>2. El sistema programa una notificación semanal recurrente<br>3. En el día/hora configurados, el sistema muestra el resumen<br>4. Al pulsar la notificación, el sistema navega al dashboard |
| **Postcondiciones** | Resumen semanal mostrado |

---

## Módulo 14: Galería

### CU-056: Ver galería de fotos
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario navega a la pestaña de galería |
| **RF asociado** | RF-115, RF-116, RF-117, RF-118 |
| **Descripción** | El sistema muestra todas las fotos del usuario en cuadrícula agrupadas por materia, con opciones de filtro, búsqueda y favoritos. |
| **Precondiciones** | Fotos existentes |
| **Flujo principal** | 1. El usuario navega a la pestaña de galería<br>2. El sistema carga las fotos desde SQLite agrupadas por materia<br>3. El sistema muestra la cuadrícula con diseño adaptable<br>4. El usuario puede filtrar por materia, favoritos o fotos con OCR<br>5. El usuario puede buscar por texto<br>6. El usuario puede marcar/desmarcar fotos como favoritas |
| **Postcondiciones** | Galería visible con fotos cargadas y filtros disponibles |

### CU-057: Ver texto OCR de una foto
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa el badge de OCR en una foto de la galería |
| **RF asociado** | RF-119 |
| **Descripción** | El sistema muestra el texto extraído mediante OCR de una foto en un modal con opción de copiar al portapapeles. |
| **Precondiciones** | Foto con OCR extraído |
| **Flujo principal** | 1. El usuario pulsa el badge de OCR en una foto<br>2. El sistema abre el modal de visualización de OCR<br>3. El sistema muestra el texto extraído<br>4. El usuario puede copiar el texto al portapapeles |
| **Postcondiciones** | Texto OCR visualizado |

---

## Módulo Transversal: Sincronización y Offline

### CU-058: Sincronizar datos en segundo plano
| | |
|---|---|
| **Actor** | Sistema |
| **Disparador** | La conexión a internet se restablece o la cola de sincronización tiene elementos pendientes |
| **RF asociado** | RF-03b, RF-03c, RF-03e |
| **Descripción** | El sistema procesa la cola de sincronización cuando hay conexión, enviando las operaciones pendientes al backend. |
| **Precondiciones** | Cola de sincronización con elementos pendientes, conexión a internet disponible |
| **Flujo principal** | 1. El sistema detecta que hay conexión a internet<br>2. El sistema procesa la cola de sync FIFO<br>3. Para cada elemento, el sistema envía la operación al backend<br>4. Si tiene éxito, marca como "completed"<br>5. Si falla, incrementa reintentos y reintenta hasta 3 veces<br>6. Después de 3 fallos, marca como "failed" y continúa con el siguiente<br>7. Al terminar, el sistema refresca los datos locales desde el backend |
| **Postcondiciones** | Cola de sincronización procesada, datos locales actualizados |

### CU-059: Cachear datos para uso offline
| | |
|---|---|
| **Actor** | Sistema |
| **Disparador** | El usuario abre la app o los datos se cargan desde el backend |
| **RF asociado** | RF-03a |
| **Descripción** | El sistema almacena todos los datos en SQLite local para garantizar disponibilidad offline. |
| **Flujo principal** | 1. El usuario abre la app o realiza una operación de lectura<br>2. El sistema lee primero desde SQLite local<br>3. Si hay datos locales, los muestra inmediatamente<br>4. En segundo plano, el sistema consulta el backend para actualizar<br>5. Si hay datos nuevos, el sistema los guarda en SQLite<br>6. La UI se actualiza con los nuevos datos |
| **Postcondiciones** | Datos disponibles offline, caché actualizada |

---

## Módulo Transversal: Respaldos Automáticos

### CU-060: Ejecutar backup automático programado
| | |
|---|---|
| **Actor** | Sistema (background task) |
| **Disparador** | El background task se ejecuta a la hora programada |
| **RF asociado** | RF-84, RF-85 |
| **Descripción** | El sistema ejecuta automáticamente el backup según la configuración programada por el usuario, mostrando notificaciones de progreso. |
| **Precondiciones** | Backup automático configurado y activado, hora actual dentro de la tolerancia (±15 min) |
| **Flujo principal** | 1. El sistema operativo activa el background task<br>2. El sistema verifica la configuración y la hora<br>3. El sistema muestra notificación de inicio de backup<br>4. Si el tipo incluye datos: ejecuta syncService.sync()<br>5. Si el tipo incluye multimedia: ejecuta runBackup() con progreso en notificaciones<br>6. Al completar: la notificación desaparece<br>7. El sistema registra el resultado |
| **Postcondiciones** | Backup automático ejecutado, archivos respaldados |

---

## Módulo Transversal: Gestión de Archivos Multimedia

### CU-061: Subir archivo automáticamente al guardar
| | |
|---|---|
| **Actor** | Sistema |
| **Disparador** | El usuario crea una foto, grabación o documento y auto-upload está activado |
| **RF asociado** | RF-80 |
| **Descripción** | Cuando el usuario crea un archivo multimedia y auto-upload está activo, el sistema lo sube automáticamente a Uploadthing en segundo plano. |
| **Precondiciones** | Backup activado, auto-upload activado, archivo multimedia creado, conexión a internet |
| **Flujo principal** | 1. El usuario crea una foto, grabación o documento<br>2. El sistema guarda el archivo localmente<br>3. El sistema verifica que auto-upload esté activo<br>4. El sistema sube el archivo a Uploadthing vía backend proxy<br>5. El sistema registra la URL en el backend (`POST /backup/mark`)<br>6. Si la subida falla, el error se captura silenciosamente (el backup manual lo recuperará) |
| **Postcondiciones** | Archivo subido a Uploadthing (o pendiente para el próximo backup manual) |

### CU-062: Descargar modelo de IA
| | |
|---|---|
| **Actor** | Usuario |
| **Disparador** | El usuario pulsa "Descargar" en un modelo del catálogo de IA local |
| **RF asociado** | RF-87 |
| **Descripción** | El sistema descarga un modelo GGUF desde HuggingFace al dispositivo, mostrando el progreso en notificaciones del sistema. |
| **Precondiciones** | Espacio de almacenamiento suficiente |
| **Flujo principal** | 1. El usuario pulsa "Descargar" en un modelo<br>2. El sistema inicia la descarga desde HuggingFace<br>3. El sistema muestra notificación de progreso (porcentaje)<br>4. El sistema actualiza la notificación cada 10%<br>5. Al completar, el sistema muestra notificación de descarga completada<br>6. El modelo queda disponible para inferencia local |
| **Postcondiciones** | Modelo descargado y disponible |

---

## Módulo Transversal: Manejo de Errores

### CU-063: Manejar error de red
| | |
|---|---|
| **Actor** | Sistema |
| **Disparador** | Una operación de red falla |
| **RF asociado** | RNF-09b |
| **Descripción** | Cuando una operación de red falla, el sistema captura el error, muestra un mensaje apropiado al usuario y encola la operación para sincronización posterior si es de escritura. |
| **Precondiciones** | Operación de red en curso |
| **Flujo principal** | 1. El sistema intenta una operación de red<br>2. La operación falla por timeout, conexión perdida o error del servidor<br>3. Si es operación de escritura: el sistema guarda localmente y encola en sync_queue<br>4. Si es operación de lectura: el sistema muestra datos cacheados (si existen)<br>5. El sistema muestra un Toast o alerta informando del error |
| **Postcondiciones** | Operación manejada sin crashear la app |

### CU-064: Manejar error de inferencia de IA
| | |
|---|---|
| **Actor** | Sistema |
| **Disparador** | La inferencia de IA falla (local o cloud) |
| **RF asociado** | RNF-09e |
| **Descripción** | Cuando la inferencia de IA falla, el sistema intenta con el proveedor alternativo (si está disponible) o muestra un mensaje de error. |
| **Precondiciones** | Solicitud de IA en curso |
| **Flujo principal** | 1. El sistema inicia inferencia de IA con el proveedor principal<br>2. La inferencia falla (timeout, error de modelo, error de API)<br>3. Si hay un proveedor alternativo disponible: el sistema reintenta con el alternativo<br>4. Si no hay alternativo o también falla: el sistema muestra mensaje de error<br>5. El sistema permite al usuario reintentar manualmente |
| **Postcondiciones** | Error manejado, usuario informado |

---

## Matriz de Trazabilidad RF → CU

| Módulo | RFs | CUs |
|---|---|---|
| Autenticación y Cuenta | RF-01 a RF-09 | CU-001 a CU-008 |
| Dashboard | RF-10 a RF-15 | CU-009 a CU-010 |
| Materias | RF-16 a RF-27 | CU-011 a CU-015 |
| Calificaciones | RF-28 a RF-36 | CU-016 a CU-019 |
| Calendario | RF-37 a RF-44 | CU-020 a CU-022 |
| Flashcards | RF-45 a RF-56 | CU-023 a CU-030 |
| Documentos y Escáner | RF-57 a RF-66 | CU-031 a CU-036 |
| Grabaciones de Audio | RF-67 a RF-74 | CU-037 a CU-039 |
| YouTube | RF-75 a RF-79 | CU-040 a CU-041 |
| Configuración y Backup | RF-80 a RF-96 | CU-042 a CU-048 |
| Asistente de IA (Zyren) | RF-97 a RF-105 | CU-049 a CU-052 |
| Horario de Clases | RF-106 a RF-108 | CU-053 |
| Notificaciones | RF-109 a RF-114 | CU-054 a CU-055 |
| Galería | RF-115 a RF-119 | CU-056 a CU-057 |
| Transversales | — | CU-058 a CU-064 |

---
**Documento generado**: 05/06/2026
**Base**: `levantamiento_requisitos.md` (119 RF)
**Total casos de uso**: 64


---
**Tags:** #product
