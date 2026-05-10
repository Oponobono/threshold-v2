# Documentación de APIs - Threshold

El backend de Threshold expone una arquitectura **RESTful** segura construida sobre Node.js y Express. 

> **Tip:** La documentación interactiva (OpenAPI/Swagger) se genera en tiempo de ejecución. Cuando arranques el servidor, puedes probar todas las rutas visualmente entrando a: `http://localhost:<PUERTO>/api-docs`.

A continuación, se detalla cada uno de los módulos de la API, las rutas que expone y qué función cumplen dentro de la aplicación.

---

## 1. Módulo de Autenticación (`/api/auth`)
*Rutas públicas que no requieren token JWT.*

- **`POST /api/register`**: Registra un nuevo usuario encriptando la contraseña y devolviendo el token de acceso.
- **`POST /api/login`**: Valida credenciales y genera un nuevo token JWT de sesión.

---

## 2. Módulo de Usuarios (`/api/users`)
*Rutas privadas para la gestión de la cuenta personal (todas requieren token).*

- **`GET /api/users/me`**: Retorna el perfil completo del usuario autenticado (extraído del token JWT).
- **`PUT /api/users/me`**: Permite actualizar datos del perfil como nombre, universidad, o escala de calificación preferida.
- **`DELETE /api/users/me`**: Realiza un *Soft Delete* de la cuenta por privacidad y cierra la sesión.

---

## 3. Módulo Académico Central (`/api/subjects` & `/api/assessments` & `/api/schedules`)

### Materias (`/api/subjects`)
- **`GET /api/subjects`**: Obtiene todas las materias inscritas por el usuario.
- **`POST /api/subjects`**: Crea una nueva materia (asignando color e ícono).
- **`GET /api/subjects/:id`**: Devuelve los detalles de una materia específica.
- **`PUT /api/subjects/:id`**: Actualiza el profesor, créditos, o metas de la materia.
- **`DELETE /api/subjects/:id`**: Elimina la materia (hace borrado en cascada de sus archivos).

### Evaluaciones y Tareas (`/api/assessments`)
- **`GET /api/assessments`**: Lista todas las tareas y exámenes globales.
- **`GET /api/assessments/subject/:subjectId`**: Lista las tareas de una materia específica.
- **`POST /api/assessments`**: Crea una nueva tarea (peso, fecha, etc).
- **`PUT /api/assessments/:id`**: Actualiza una calificación (`score` y `out_of`) o marca la tarea como completada.

### Calendario (`/api/schedules`)
- **`GET /api/schedules`**: Devuelve todo el horario de clases de la semana.
- **`POST /api/schedules`**: Agrega una clase a un día de la semana.

---

## 4. Módulo de Documentos y Escaneos (`/api/scanned_documents` & `/api/gallery`)

### Documentos Escaneados
- **`GET /api/scanned_documents/subject/:subjectId`**: Obtiene los documentos PDF/DOCX asignados a una materia.
- **`POST /api/scanned_documents`**: Sube un documento (multipart/form-data). Extrae el texto con OCR/Parsing y lo asocia a la materia.
- **`DELETE /api/scanned_documents/:id`**: Elimina el documento.

### Galería Fotográfica (`/api/gallery`)
- **`GET /api/photos/subject/:subjectId`**: Retorna las fotos tomadas en el contexto de una materia.
- **`POST /api/photos`**: Sube una foto, ejecuta OCR para detectar texto en pizarras y guarda la metadata.
- **`DELETE /api/photos/:id`**: Borra la fotografía.

---

## 5. Módulo Multimedia y Transcripciones (`/api/audio` & `/api/youtube`)

### Grabaciones de Audio
- **`GET /api/audio`**: Lista todas las grabaciones del usuario.
- **`POST /api/audio/upload`**: Sube un archivo de audio (ej. `.m4a`), lo guarda y llama a un modelo de IA (ej. Whisper) para transcribirlo asíncronamente.
- **`DELETE /api/audio/:id`**: Borra el audio y su transcripción.

### Videos de YouTube
- **`GET /api/youtube`**: Lista los videos guardados.
- **`POST /api/youtube/add`**: Recibe una URL de YouTube, descarga la información del video (Thumbnail, Título) y extrae los subtítulos/transcripción de manera automática.

---

## 6. Módulo de Repaso Espaciado (`/api/flashcards`)

- **`GET /api/flashcards/decks`**: Lista todos los mazos del usuario.
- **`POST /api/flashcards/decks`**: Crea un mazo manual.
- **`POST /api/flashcards/generate`**: **Endpoint Core**. Recibe texto, imágenes o documentos en Base64, los envía a la IA y autogenera un mazo completo de preguntas y respuestas en un solo clic.
- **`GET /api/flashcards/decks/:deckId/review`**: Devuelve las tarjetas de un mazo ordenadas según el algoritmo de repaso espaciado (las más urgentes primero).
- **`POST /api/flashcards/cards/:cardId/review`**: Recibe la retroalimentación del usuario (`success` o `failure`) para una tarjeta y recalcula la próxima fecha de revisión de la misma.

---

## 7. Módulo del Tutor IA "Zyren" (`/api/ai`)

- **`POST /api/ai/chat`**: **Endpoint Principal**. Inicia o continúa una conversación con la IA. Internamente consolida todo el contexto del usuario (sus notas, sus transcripciones de audio, etc.) en un *Prompt Shield* seguro para darle contexto absoluto a la IA antes de responder a la duda del estudiante.
- **`GET /api/ai/sessions`**: Devuelve el historial de sesiones de chat del usuario.
- **`GET /api/ai/sessions/:id/messages`**: Trae la memoria de mensajes previos para continuar una charla.

---

## 8. Módulo de Productividad y Analítica (`/api/learning` & `/api/analytics`)

### Productividad (Study Sessions)
- **`POST /api/learning/sessions`**: Guarda el resultado de un temporizador de estudio (ej. "Estudió 45 mins de Matemáticas usando Pomodoro").

### Dashboards y Métricas
- **`GET /api/analytics/dashboard`**: Un endpoint agregado que calcula y devuelve de una vez: las notas promedio, el total de horas estudiadas, y la distribución de progreso por materia para alimentar la pantalla principal (Home) de la aplicación sin sobrecargar de múltiples peticiones al cliente.

---
*Todos los endpoints (salvo el grupo de Auth) están protegidos mediante el middleware JWT y validador de `userId` cruzado con el token.*
