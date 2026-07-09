# Levantamiento de Requisitos — Threshold

---

## 1. Resumen de la Aplicación

**Threshold** es una aplicación móvil académica diseñada para estudiantes universitarios que necesitan gestionar sus materias, calificaciones, tareas, horarios y materiales de estudio en un solo lugar. Su característica distintiva es el cálculo del **"Umbral"** (Threshold): la nota mínima necesaria en el próximo examen para aprobar la materia, basado en el rendimiento actual y la ponderación restante.

La aplicación funciona **offline-first**: todos los datos se almacenan localmente en SQLite y se sincronizan en segundo plano con el backend cuando hay conexión. Además, integra un **asistente de IA híbrido (Zyren)** que puede funcionar tanto en la nube (Groq/Gemini) como localmente en el dispositivo (llama.rn), permitiendo generar flashcards, resúmenes, material de estudio y responder preguntas académicas sin conexión a internet.

- **Nombre**: Threshold
- **Plataforma**: iOS, Android (y web con soporte limitado)
- **Idioma**: Español (principal) e Inglés
- **Versión**: 1.0.0
- **Bundle ID Android**: `com.oponobono.threshold`
- **Esquema de deep link**: `threshold://`
- **Tema**: Oscuro por defecto (`#0E0E18`), compatible con light/dark automático

---

## 2. Stack Tecnológico

### Frontend (Mobile)

| Categoría | Tecnología | Propósito |
|---|---|---|
| Framework | React Native 0.81.5 + Expo 54 | Desarrollo multiplataforma |
| Lenguaje | TypeScript 5.9 | Tipado estático |
| Navegación | expo-router 6 + @react-navigation/bottom-tabs 7 | Routing basado en archivos |
| Estado global | Zustand 5 | Almacenamiento de estado liviano |
| Animaciones | react-native-reanimated 4, lottie-react-native 7, @shopify/react-native-skia | Animaciones y gráficos 2D |
| Iconos | @expo/vector-icons, expo-symbols | Iconografía |
| Gestos | react-native-gesture-handler 2 | Gestos táctiles |
| Safe Area | react-native-safe-area-context 5 | Insetos de navegación nativa |
| Markdown | react-native-markdown-display + highlight.js | Renderizado de texto enriquecido |
| Gráficos | victory-native 36, react-native-chart-kit 6 | Charts y radares |

### Almacenamiento Local

| Tecnología | Propósito |
|---|---|
| expo-sqlite 16 | Base de datos SQLite principal (13 tablas) |
| react-native-mmkv 4 | Almacenamiento local rápido para flashcards offline |
| @react-native-async-storage/async-storage | Preferencias y caché |
| expo-secure-store | Tokens de autenticación, datos biométricos |
| expo-file-system | Sistema de archivos para descargas |

### Inteligencia Artificial

| Tecnología | Propósito |
|---|---|
| llama.rn 0.12 | Inferencia local con modelos GGUF (Llama, Qwen, Phi, Gemma) |
| whisper.rn 0.6 | Transcripción de voz local (Whisper Tiny) |
| @react-native-ml-kit/text-recognition 2 | OCR offline (Google ML Kit) |
| Módulo nativo `threshold-pdf-extractor` | Extracción de texto de PDF local (PDFBox/PDFKit) |
| Groq API (vía backend) | Chat, transcripción y resúmenes en la nube |
| Gemini API (vía backend) | Chat en la nube con contexto extendido |

### Backend (Referencia)

| Componente | Descripción |
|---|---|
| API URL | `https://threshold-backend-cn82.onrender.com/api` |
| Cloud Storage | Uploadthing (fotos, audio, documentos) |
| Autenticación | JWT + SecureStore |
| LMS | Integración con Canvas, Moodle, Blackboard, Google Classroom, Schoology |

### Otros

| Categoría | Tecnología |
|---|---|
| Notificaciones | expo-notifications (locales y push) |
| Tareas en 2º plano | expo-background-fetch, expo-task-manager |
| Cámara | expo-camera, react-native-document-scanner-plugin |
| Audio/Video | expo-av, react-native-youtube-iframe |
| PDF | pdf-lib, expo-print |
| Traducciones | i18next + react-i18next (30 namespaces) |
| Biometría | Módulo biométrico nativo |
| Red | @react-native-community/netinfo |

---

## 3. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────┐
│                        THRESHOLD APP                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────┐   ┌────────────────┐   ┌──────────────────┐     │
│  │  Expo Router   │   │   Zustand      │   │    i18next       │     │
│  │  (file-based)  │   │   Stores       │   │  (es/en)          │     │
│  └───────┬───────┘   └───────┬────────┘   └──────────────────┘     │
│          │                   │                                      │
│  ┌───────▼───────────────────▼──────────────────────────────────┐  │
│  │                    HOOKS (23 hooks)                          │  │
│  │  useSubjects · useGrades · useFlashcards · useCalendar ·    │  │
│  │  useBackupLogic · useAudioRecorder · useWhisper · ...       │  │
│  └───────┬───────────────────┬──────────────────────────────────┘  │
│          │                   │                                      │
│  ┌───────▼───────────────────▼──────────────────────────────────┐  │
│  │                    SERVICES                                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐   │  │
│  │  │ API      │  │ Database │  │ AI       │  │ Backup     │   │  │
│  │  │ Layer    │  │ (SQLite) │  │ Hybrid   │  │ Services   │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐   │  │
│  │  │ Storage  │  │ Notifs   │  │ Upload   │  │ Local      │   │  │
│  │  │ Service  │  │ Service  │  │ thing    │  │ ML (OCR/   │   │  │
│  │  │          │  │          │  │          │  │  PDF/STT)  │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘   │  │
│  └───────┬───────────────────┬──────────────────────────────────┘  │
│          │                   │                                      │
├──────────▼───────────────────▼──────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐   │
│  │   SQLite DB     │    │   MMKV (Local)  │    │   SecureStore│   │
│  │   (13 tablas)   │    │   Flashcards    │    │   Tokens     │   │
│  └─────────────────┘    └─────────────────┘    └──────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                    CONECTIVIDAD                                      │
│  ┌──────────────────────┐    ┌────────────────────────────────┐    │
│  │  Backend (Render)    │    │  Uploadthing (Cloud Storage)   │    │
│  │  REST API            │    │  Fotos · Audio · Documentos    │    │
│  └──────────────────────┘    └────────────────────────────────┘    │
│  ┌──────────────────────┐    ┌────────────────────────────────┐    │
│  │  Groq API / Gemini   │    │  HuggingFace (modelos GGUF)    │    │
│  │  (Cloud AI)          │    │  Whisper (descarga)            │    │
│  └──────────────────────┘    └────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Patrón Arquitectónico: Offline-First / Local-First

1. **Lectura**: Siempre desde SQLite local primero (cache-first)
2. **Escritura**: Se escribe localmente + se encola en `sync_queue` para sincronización en segundo plano
3. **Sincronización**: `SyncService` procesa la cola cuando hay conexión (last-write-wins, máx. 3 reintentos)
4. **Multimedia**: Las fotos/audio/documentos se guardan localmente y se suben a Uploadthing vía `autoUploadIfEnabled` o backup manual
5. **IA híbrida**: `resolveProvider()` decide cloud vs local según conectividad y `forceOfflineMode`

---

## 4. Estructura de Navegación

```
ROOT STACK (expo-router)
│
├── /welcome                         → Animación de bienvenida, redirección a login o tabs
├── /login                           → Inicio de sesión (email, biométrico, invitado)
├── /register                        → Registro en 2 pasos (perfil + credenciales)
│
├── /(tabs)                          → TAB NAVIGATOR (5 pestañas)
│   ├── index                        → Dashboard / Inicio
│   ├── subjects                     → Lista de materias
│   ├── calendar                     → Calendario / Agenda
│   ├── grades                       → Calificaciones / Analytics
│   └── gallery                      → Galería de fotos
│
├── /settings                        → Configuración completa
├── /about                           → Información de la app y compañía
├── /subjects/[subjectId]            → Detalle de materia
├── /categories/[subjectId]          → Gestión de categorías de evaluación
├── /flashcards                      → Sistema de flashcards
├── /recordings                      → Grabaciones de audio + videos
└── /recordings/[id]                 → Detalle de grabación/video
```

---

## 5. Requisitos Funcionales

### MÓDULO 1: AUTENTICACIÓN Y CUENTA

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | El usuario debe poder registrarse con correo electrónico y contraseña en 2 pasos (perfil + credenciales) | Alta |
| RF-02 | El usuario debe poder iniciar sesión con correo/contraseña | Alta |
| RF-03 | El usuario debe poder iniciar sesión como invitado sin registro | Alta |
| RF-04 | El usuario debe poder autenticarse con huella digital o Face ID | Media |
| RF-05 | El usuario debe poder inscribir su huella digital para inicio de sesión biométrico | Media |
| RF-06 | El usuario debe poder cerrar sesión (sign out) | Alta |
| RF-07 | El usuario debe poder solicitar la eliminación de su cuenta con verificación de contraseña | Alta |
| RF-08 | El usuario debe poder editar su perfil (nombre, universidad, carrera, semestre, meta de estudio) | Media |
| RF-09 | El sistema debe detectar si la sesión existe al abrir la app y redirigir automáticamente | Alta |

### MÓDULO 2: DASHBOARD / INICIO

| ID | Requisito | Prioridad |
|---|---|---|
| RF-10 | El dashboard debe mostrar un carrusel de materias con promedio y porcentaje de completitud | Alta |
| RF-11 | El dashboard debe mostrar tarjetas de métricas clave (promedio general, materias críticas, etc.) | Alta |
| RF-12 | El dashboard debe tener un FAB (botón flotante) con menú de acceso rápido: Registrar nota, Nueva tarea, Tomar foto | Alta |
| RF-13 | El dashboard debe mostrar un feed de actividad reciente (evaluaciones, flashcards, estudio) | Media |
| RF-14 | El dashboard debe mostrar herramientas de estudio rápido (acceso a flashcards, timer) | Media |
| RF-15 | El usuario debe poder crear, editar y eliminar materias desde el dashboard | Alta |

### MÓDULO 3: MATERIAS (SUBJECTS)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-16 | El usuario debe poder crear materias con nombre, profesor, créditos, nota objetivo, color e ícono | Alta |
| RF-17 | El usuario debe poder editar y eliminar materias | Alta |
| RF-18 | La lista de materias debe mostrar el promedio general (GPA) con búsqueda y filtro por estado | Alta |
| RF-19 | Las materias con bajo rendimiento deben destacarse visualmente (materias críticas) | Media |
| RF-20 | El detalle de materia debe mostrar un héroe con ícono, nombre, profesor, progreso y promedio | Alta |
| RF-21 | El detalle de materia debe mostrar el **Umbral** (Threshold): nota mínima necesaria para aprobar | Alta |
| RF-22 | El detalle debe mostrar: Average, Proyectado (con delta), Entregas (con anillo de progreso) | Alta |
| RF-23 | El detalle debe mostrar el histórico de evaluaciones con barras de progreso coloridas | Alta |
| RF-24 | El detalle debe mostrar una galería de fotos, documentos, grabaciones y videos asociados | Media |
| RF-25 | El detalle debe incluir un **simulador de nota**: "¿Qué necesito en el final?" | Alta |
| RF-26 | El detalle debe mostrar un horario de clases semanal interactivo | Media |
| RF-27 | El detalle debe tener un **FAB de IA** para acceder al chat contextual con Zyren | Media |

### MÓDULO 4: CALIFICACIONES (GRADES)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-28 | La pantalla de calificaciones debe mostrar el GPA general con selector de materia | Alta |
| RF-29 | La pantalla debe incluir un **radar de dominio** (Mastery Radar) por materia | Media |
| RF-30 | La pantalla debe incluir un **simulador de proyección** de calificaciones | Alta |
| RF-31 | El usuario debe poder crear evaluaciones (notas, tareas) con nombre, tipo, peso, fecha, valor y porcentaje | Alta |
| RF-32 | El usuario debe poder editar y completar tareas desde la pantalla de notas | Alta |
| RF-33 | El sistema debe calcular el promedio ponderado (PA), promedio móvil exponencial (EMA) y nota proyectada (NP) | Alta |
| RF-34 | El usuario debe poder agrupar evaluaciones en **categorías** con peso configurable y "drop lowest" | Media |
| RF-35 | El sistema debe alertar si el peso total de las categorías no suma 100% | Media |
| RF-36 | El usuario debe poder descargar reportes de calificaciones | Baja |

### MÓDULO 5: CALENDARIO / EVENTOS

| ID | Requisito | Prioridad |
|---|---|---|
| RF-37 | El calendario debe mostrar una cuadrícula mensual con eventos y tareas | Alta |
| RF-38 | El calendario debe mostrar una lista de agenda con eventos del día/semana | Alta |
| RF-39 | El usuario debe poder crear eventos académicos y personales (examen, tarea, clase, otro) | Alta |
| RF-40 | El usuario debe poder vincular eventos a materias | Alta |
| RF-41 | El usuario debe poder crear eventos de día completo o con hora específica | Alta |
| RF-42 | El usuario debe poder crear un plan de estudio automático al crear un evento de tipo "examen" | Media |
| RF-43 | El usuario debe poder ver y editar detalles de eventos existentes | Alta |
| RF-44 | El sistema debe programar notificaciones recordatorias para eventos próximos (15 min antes) | Media |

### MÓDULO 6: FLASHCARDS / TARJETAS DE ESTUDIO

| ID | Requisito | Prioridad |
|---|---|---|
| RF-45 | El usuario debe poder crear mazos de tarjetas con título, descripción y materia opcional | Alta |
| RF-46 | El usuario debe poder crear tarjetas manualmente en 3 formatos: flashcard (Q&A), múltiple opción, verdadero/falso | Alta |
| RF-47 | El usuario debe poder **generar tarjetas con IA** desde contenido de texto (apuntes, transcripciones, OCR) | Alta |
| RF-48 | El usuario debe poder **importar mazos** desde archivos JSON | Alta |
| RF-49 | El usuario debe poder **exportar mazos** a archivos JSON para compartir | Media |
| RF-50 | El sistema debe implementar **FSRS** (Free Spaced Repetition Schedule) para el repaso espaciado | Alta |
| RF-51 | El usuario debe poder estudiar tarjetas con animación de volteo y botones de Correcto/Incorrecto | Alta |
| RF-52 | El usuario debe poder posponer tarjetas (snooze) por 15 min, 1h, 4h, mañana o fin de semana | Media |
| RF-53 | El usuario debe poder compartir mazos mediante **códigos PIN** y unirse a grupos de estudio | Media |
| RF-54 | El sistema debe notificar tarjetas atrasadas (due cards) con borde animado "marching ants" | Media |
| RF-55 | Las tarjetas deben funcionar **offline** (almacenamiento dual SQLite + MMKV) | Alta |
| RF-56 | El usuario debe poder analizar confusiones y generar tarjetas de diferenciación automáticamente | Media |

### MÓDULO 7: DOCUMENTOS Y ESCÁNER

| ID | Requisito | Prioridad |
|---|---|---|
| RF-57 | El usuario debe poder escanear documentos con la cámara con corrección de perspectiva automática | Alta |
| RF-58 | El usuario debe poder aplicar filtros de mejora de imagen (Blanco/Negro, Alto Contraste, Texto Mágico) | Media |
| RF-59 | El usuario debe poder exportar el escaneo como imagen o PDF | Alta |
| RF-60 | El usuario debe poder **extraer texto con OCR** de imágenes escaneadas (híbrido: ML Kit offline + cloud) | Alta |
| RF-61 | El usuario debe poder **importar PDFs** desde el dispositivo y extraer su texto (híbrido) | Alta |
| RF-62 | El usuario debe poder tomar fotos con la cámara y asignarlas a una materia | Alta |
| RF-63 | El usuario debe poder ver imágenes en pantalla completa con zoom y compartir | Alta |
| RF-64 | El usuario debe poder buscar fotos por materia, texto OCR o favoritos | Media |
| RF-65 | El usuario debe poder generar **tarjetas flash desde documentos** (OCR → IA → tarjetas) | Alta |
| RF-66 | El usuario debe poder realizar acciones por lote sobre documentos (exportar a PDF, generar flashcards, OCR) | Media |

### MÓDULO 8: GRABACIONES DE AUDIO

| ID | Requisito | Prioridad |
|---|---|---|
| RF-67 | El usuario debe poder grabar audio con visualización de forma de onda en tiempo real | Alta |
| RF-68 | El usuario debe poder pausar y reanudar la grabación | Alta |
| RF-69 | El usuario debe poder reproducir grabaciones con control de progreso | Alta |
| RF-70 | El usuario debe poder **transcribir** grabaciones mediante Groq Whisper o Whisper local | Alta |
| RF-71 | El usuario debe poder **resumir** transcripciones mediante IA (Groq/Llama) | Alta |
| RF-72 | El usuario debe poder generar tarjetas flash desde la transcripción | Alta |
| RF-73 | El usuario debe poder filtrar por tipo (audio/video) y buscar por nombre | Media |
| RF-74 | El usuario debe poder asignar grabaciones a materias | Alta |

### MÓDULO 9: INTEGRACIÓN CON YOUTUBE

| ID | Requisito | Prioridad |
|---|---|---|
| RF-75 | El usuario debe poder agregar videos de YouTube mediante URL | Media |
| RF-76 | El sistema debe obtener la transcripción/subtítulos del video automáticamente | Media |
| RF-77 | El usuario debe poder ver videos embebidos dentro de la app | Media |
| RF-78 | El usuario debe poder generar resúmenes y tarjetas flash desde transcripciones de video | Media |
| RF-79 | El usuario debe poder asignar videos a materias | Media |

### MÓDULO 10: CONFIGURACIÓN

| ID | Requisito | Prioridad |
|---|---|---|
| RF-80 | El usuario debe poder configurar el respaldo en la nube (backup) con Uploadthing | Alta |
| RF-81 | El usuario debe poder elegir tipos de archivo a respaldar (fotos, audio, documentos, transcripciones) | Alta |
| RF-82 | El usuario debe poder ejecutar backup manual: solo datos, solo multimedia, o ambos | Alta |
| RF-83 | El usuario debe poder descargar todos los archivos desde la nube | Alta |
| RF-84 | El usuario debe poder programar backups automáticos diarios a una hora específica | Media |
| RF-85 | El sistema debe mostrar el progreso del backup en **notificaciones del sistema** (X/Y archivos) | Alta |
| RF-86 | El usuario debe poder activar/desactivar el modo **offline forzado** (Force Offline Mode) | Alta |
| RF-87 | El usuario debe poder descargar y gestionar modelos de IA locales (llama.rn GGUF) | Media |
| RF-88 | El usuario debe poder elegir entre proveedores de IA (Groq vs Gemini) | Media |
| RF-89 | El usuario debe poder cambiar entre español e inglés | Alta |
| RF-90 | El usuario debe poder gestionar términos académicos (semestres) | Baja |
| RF-91 | El usuario debe poder configurar escalas de calificación personalizadas | Baja |
| RF-92 | El usuario debe poder integrar plataformas LMS (Canvas, Moodle, Blackboard, Google Classroom, Schoology) | Baja |
| RF-93 | El usuario debe poder crear grupos de estudio con código PIN | Baja |
| RF-94 | El usuario debe poder configurar la autenticación de dos factores (2FA) | Media |
| RF-95 | El usuario debe poder exportar sus datos en CSV o PDF | Baja |
| RF-96 | El usuario debe poder enviar comentarios y reportar bugs | Baja |

### MÓDULO 11: ASISTENTE DE IA (ZYREN)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-97 | El usuario debe poder chatear con Zyren, un tutor académico con IA | Alta |
| RF-98 | Zyren debe poder responder preguntas sobre cualquier materia con contexto de los archivos del usuario | Alta |
| RF-99 | Zyren debe poder generar tarjetas flash, material de estudio, y preguntas de opción múltiple | Alta |
| RF-100 | Zyren debe funcionar **sin conexión** cuando se usan modelos locales (llama.rn) | Alta |
| RF-101 | Zyren debe detectar cuándo el usuario quiere generar tarjetas y parsear la acción automáticamente | Media |
| RF-102 | El usuario debe poder seleccionar qué archivos (documentos, fotos, audio, videos) usar como contexto | Media |
| RF-103 | El chat debe renderizar markdown con resaltado de sintaxis en bloques de código | Media |
| RF-104 | Zyren debe mostrar su pensamiento interno en etiquetas `<think>` | Baja |
| RF-105 | El sistema debe gestionar la memoria de manera eficiente: descargar LLM antes de cargar Whisper y viceversa | Alta |

### MÓDULO 12: HORARIO DE CLASES

| ID | Requisito | Prioridad |
|---|---|---|
| RF-106 | El usuario debe poder crear un horario semanal con materias, días y bloques horarios | Media |
| RF-107 | El sistema debe mostrar el horario en cuadrícula visual en el detalle de materia | Media |
| RF-108 | El sistema debe notificar antes de cada clase según el horario configurado (5 min antes) | Baja |

### MÓDULO 13: NOTIFICACIONES

| ID | Requisito | Prioridad |
|---|---|---|
| RF-109 | El sistema debe notificar sobre fechas límite de tareas y exámenes (15 min antes) | Media |
| RF-110 | El sistema debe notificar sobre tarjetas flash atrasadas para repaso urgente | Media |
| RF-111 | El sistema debe notificar sobre clases próximas según el horario semanal (5 min antes) | Baja |
| RF-112 | El usuario debe poder configurar un resumen semanal (Weekly Digest) con día y hora | Baja |
| RF-113 | El sistema debe mostrar el progreso de descarga de modelos de IA en notificaciones | Media |
| RF-114 | El sistema debe mostrar el progreso de backup (subida/descarga) en notificaciones | Alta |

### MÓDULO 14: GALERÍA DE FOTOS

| ID | Requisito | Prioridad |
|---|---|---|
| RF-115 | El usuario debe poder ver todas las fotos en cuadrícula agrupadas por materia | Alta |
| RF-116 | El usuario debe poder marcar fotos como favoritas (starred) | Media |
| RF-117 | El usuario debe poder filtrar por materia, favoritos y fotos con OCR | Media |
| RF-118 | El usuario debe poder buscar fotos por texto o materia | Media |
| RF-119 | El usuario debe poder ver el texto OCR extraído de cada foto | Alta |

---

## 6. Requisitos No Funcionales

### RNF-01: Rendimiento

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-01a | La carga inicial de la app no debe exceder 5 segundos en dispositivos de gama media | Alta |
| RNF-01b | La navegación entre pantallas debe ser fluida (>50 FPS) | Alta |
| RNF-01c | El estudio de flashcards debe cargar en menos de 1 segundo | Alta |
| RNF-01d | La inferencia de IA local debe responder en menos de 10 segundos para consultas simples | Media |
| RNF-01e | Las consultas a SQLite deben ejecutarse en menos de 500ms | Alta |
| RNF-01f | La app debe mantener un uso de RAM inferior a 200 MB en operaciones normales | Alta |

### RNF-02: Almacenamiento

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-02a | La base de datos SQLite no debe exceder 50 MB en condiciones normales de uso | Media |
| RNF-02b | MMKV debe mantenerse por debajo de 30 MB (con limpieza automática) | Media |
| RNF-02c | Los archivos temporales deben limpiarse después de 1 hora | Baja |
| RNF-02d | La caché de AsyncStorage debe expirar después de 24 horas | Baja |
| RNF-02e | El perfil de usuario debe cachearse localmente con validez de 7 días | Media |

### RNF-03: Offline / Conectividad

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-03a | **Todas las funcionalidades principales deben funcionar sin conexión a internet** | Alta |
| RNF-03b | Las operaciones de escritura deben completarse localmente primero, luego sincronizar en segundo plano | Alta |
| RNF-03c | La sincronización debe reanudarse automáticamente cuando se restablezca la conexión | Alta |
| RNF-03d | El modo offline forzado debe deshabilitar todas las llamadas de red | Alta |
| RNF-03e | La cola de sincronización debe reintentar operaciones fallidas hasta 3 veces | Media |
| RNF-03f | Los conflictos de sincronización deben resolverse con estrategia "last-write-wins" por campo | Media |

### RNF-04: Seguridad

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-04a | Las credenciales y tokens deben almacenarse en SecureStore (encriptado) | Alta |
| RNF-04b | Las comunicaciones con el backend deben usar HTTPS | Alta |
| RNF-04c | La autenticación biométrica debe usar el hardware de seguridad del dispositivo | Alta |
| RNF-04d | Las claves API (Groq, Uploadthing) deben residir en el backend, no en el cliente | Alta |
| RNF-04e | El usuario debe poder eliminar su cuenta con verificación de contraseña | Alta |
| RNF-04f | Los tokens de sesión deben tener expiración y renovación automática | Alta |

### RNF-05: Experiencia de Usuario

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-05a | La interfaz debe estar disponible en español e inglés con cambio de idioma en tiempo real | Alta |
| RNF-05b | Los modales y hojas inferiores deben respetar el área segura del navbar nativo | Alta |
| RNF-05c | Las animaciones deben ser suaves y con retroalimentación háptica | Media |
| RNF-05d | El tema oscuro debe ser el predeterminado, con soporte para modo claro | Media |
| RNF-05e | Los iconos deben usar la librería SF Symbols en iOS cuando esté disponible | Baja |
| RNF-05f | El texto debe renderizarse con tipografía legible y tamaños consistentes | Alta |

### RNF-06: Mantenibilidad

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-06a | Todo el código debe estar escrito en TypeScript con tipos estrictos | Alta |
| RNF-06b | Los estilos deben usar un sistema de tokens (theme.ts) con colores, espaciado y tipografía | Alta |
| RNF-06c | Las traducciones deben estar centralizadas en archivos JSON por namespace | Alta |
| RNF-06d | La lógica de negocio debe estar en hooks, separada de los componentes de UI | Alta |
| RNF-06e | El esquema de base de datos debe tener migraciones versionadas | Alta |

### RNF-07: Escalabilidad

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-07a | La app debe soportar un número ilimitado de materias, evaluaciones y tarjetas | Media |
| RNF-07b | La galería debe cargar fotos de manera progresiva (paginación virtual con FlatList) | Alta |
| RNF-07c | El calendario debe manejar eventos de múltiples años sin degradación de rendimiento | Media |
| RNF-07d | La cola de sincronización debe procesar lotes de hasta 100 operaciones | Media |

### RNF-08: Compatibilidad

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-08a | La app debe ejecutarse en iOS 16.4+ | Alta |
| RNF-08b | La app debe ejecutarse en Android 8.0+ (API 26+) | Alta |
| RNF-08c | La app debe funcionar en tablets (iOS y Android) | Media |
| RNF-08d | La app debe tener soporte web básico (PWA) | Baja |
| RNF-08e | La app debe soportar gestos predictivos de Android | Baja |

### RNF-09: Confiabilidad

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-09a | Las operaciones de base de datos deben usar transacciones para asegurar consistencia | Alta |
| RNF-09b | Los errores de red deben capturarse y manejarse sin crashear la app | Alta |
| RNF-09c | La app debe detectar y manejar archivos multimedia faltantes (ghost files) | Media |
| RNF-09d | El backup debe manejar archivos faltantes marcándolos como "ghost_file" en lugar de fallar | Media |
| RNF-09e | La inferencia de IA local debe tener timeouts y recuperación ante fallos | Alta |

### RNF-10: Privacidad

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-10a | Los datos biométricos no deben almacenarse en el backend | Alta |
| RNF-10b | El usuario debe poder eliminar todos sus datos locales y en la nube | Alta |
| RNF-10c | Las grabaciones de audio y fotos deben almacenarse localmente antes de subirse | Alta |
| RNF-10d | Las transcripciones y resúmenes generados por IA pertenecen al usuario | Media |

---

## 7. Base de Datos — Esquema SQLite

13 tablas + 9 índices en la migración inicial (versión 1):

| Tabla | Columnas Clave | Foreign Keys |
|---|---|---|
| **users** | id, email (UNIQUE), name, token, refresh_token, profile_image_url | — |
| **subjects** | id, user_id, code, name, credits, professor, color, icon, target_grade, avg_score, normalized_avg_score, completion_percent, gpa_equivalent | — |
| **assessments** | id, subject_id, name, type, date, weight, out_of, score, percentage, grade_value, category_id, due_date, grading_date | subject_id → subjects(id) CASCADE |
| **assessment_categories** | id, user_id, subject_id, name, weight, drop_lowest | — |
| **schedules** | id, user_id, subject_id, day_of_week (1-7), start_time, end_time, name, color | subject_id → subjects(id) SET NULL |
| **flashcard_decks** | id, user_id, subject_id, title, description, card_count, review_count, learning_count, new_count, subject_name, subject_color, subject_icon, owner_username, owner_name | subject_id → subjects(id) SET NULL |
| **flashcards** | id, deck_id, front, back, status, created_at | deck_id → flashcard_decks(id) CASCADE |
| **card_logs** | id, card_id, user_id, result, response_time_ms, question_word_count | — |
| **study_sessions** | id, user_id, subject_id, deck_id, duration_minutes, cards_reviewed, rating | deck_id → flashcard_decks(id) SET NULL |
| **photos** | id, subject_id, local_uri, ocr_text, tags, cloud_url, is_backed_up, es_favorita, group_id | subject_id → subjects(id) CASCADE |
| **audio_recordings** | id, user_id, subject_id, name, local_uri, duration, transcript_text, summary_uri, cloud_url, is_backed_up | subject_id → subjects(id) SET NULL |
| **youtube_videos** | id, user_id, subject_id, youtube_url, video_id, title, thumbnail_url, duration, transcript_text, summary_uri | subject_id → subjects(id) SET NULL |
| **scanned_documents** | id, subject_id, user_id, local_uri, ocr_text, cloud_url, is_backed_up | subject_id → subjects(id) SET NULL |
| **calendar_events** | id, user_id, title, description, event_type (exam/task/class/other), start_date, end_date, all_day, subject_id, study_plan_flag | — |
| **sync_queue** | id (AUTOINCREMENT), entity_type, entity_id, operation (CREATE/UPDATE/DELETE), payload (JSON), status (pending/processing/completed/failed), retries, error | — |

**Índices**: email, assessments(subject_id), schedules(subject_id), flashcards(deck_id), photos(subject_id), audio(subject_id), youtube(subject_id), documents(subject_id), sync_queue(status).

---

## 8. Roles de Usuario

| Rol | Descripción |
|---|---|
| **Invitado** | Acceso limitado de solo lectura al dashboard. Puede registrarse después |
| **Estudiante** | Acceso completo a todas las funcionalidades académicas: materias, notas, tarjetas, calendario, documentos, grabaciones, galería |
| **Miembro de grupo** | Puede acceder a mazos de tarjetas compartidos mediante código PIN |
| **Administrador de cuenta** | Puede gestionar 2FA, eliminar cuenta, cambiar contraseña |

---

## 9. Integraciones Externas

| Sistema | Propósito | Tipo |
|---|---|---|
| **Uploadthing** | Almacenamiento en la nube de fotos, audio y documentos | Cloud Storage |
| **Groq API** | Chat IA, transcripción (Whisper), resúmenes | Cloud AI |
| **Gemini API** | Chat IA con contexto extendido | Cloud AI |
| **HuggingFace** | Descarga de modelos GGUF para inferencia local | Model Hub |
| **Render** | Backend REST API | Hosting |
| **Canvas / Moodle / Blackboard / Google Classroom / Schoology** | Integración LMS para sincronizar tareas y calificaciones | LMS |

---

## 10. Funcionalidades Clave (Diferenciadores)

1. **Umbral (Threshold)**: Cálculo de la nota mínima necesaria en el próximo examen para aprobar, basado en el rendimiento actual y la ponderación restante. Es la métrica central de la app.

2. **IA Híbrida Offline-First**: Zyren (asistente académico) funciona con Groq en la nube o con modelos locales (llama.rn) sin conexión. La app detecta automáticamente el proveedor disponible.

3. **OCR Offline**: Extracción de texto de imágenes mediante Google ML Kit, 100% local, sin necesidad de internet.

4. **Transcripción de Audio Offline**: Whisper Tiny (~75 MB) se ejecuta localmente para transcribir grabaciones sin conexión.

5. **FSRS (Spaced Repetition)**: Algoritmo moderno de repaso espaciado para flashcards, más eficiente que SM-2/Anki.

6. **Dual Storage Flashcards**: Las tarjetas se almacenan en SQLite (sincronizado) y MMKV (local), fusionándose en tiempo de lectura para garantizar disponibilidad offline.

7. **Notificaciones de Progreso**: El backup y la descarga de modelos muestran progreso en vivo en las notificaciones del sistema (X/Y items).

8. **Generación Automática de Flashcards**: Desde transcripciones de audio, OCR de documentos, videos de YouTube, o directamente por chat con Zyren.

---

## 11. Estados de la Aplicación

| Estado | Descripción |
|---|---|
| **Carga inicial** | Splash screen + precarga progresiva de datos (cache primero, luego server) |
| **Online** | Conexión normal. Sincronización en segundo plano activa. IA en la nube disponible |
| **Offline (forzado)** | Modo offline forzado por el usuario. Sin llamadas de red. IA local solamente |
| **Offline (sin conexión)** | Sin internet. Operaciones locales solamente. Sincronización en cola |
| **Sincronizando** | La cola de sync se está procesando. Indicador de actividad visible |
| **Backup en progreso** | Subiendo/descargando archivos a Uploadthing. Notificación de progreso activa |
| **IA procesando** | Inferencia de IA en curso (local o cloud). Loader con animación premium |
| **Error** | Error de red, base de datos o IA. Manejo con CustomAlert o Toast |

---

## 12. Glosario

| Término | Definición |
|---|---|
| **Threshold (Umbral)** | Nota mínima necesaria en el próximo examen para aprobar la materia |
| **Zyren** | Asistente académico con IA integrado en la app |
| **PA** | Promedio Ponderado (Weighted Average) |
| **EMA** | Promedio Móvil Exponencial (exponencial smoothing para proyecciones) |
| **NP** | Nota Proyectada (Proyected Grade) basada en rendimiento actual |
| **FSRS** | Free Spaced Repetition Schedule — algoritmo de repaso espaciado |
| **GGUF** | Formato de modelo cuantizado para llama.cpp |
| **Bento** | Diseño de cuadrícula adaptativa con tarjetas de diferentes tamaños |
| **Force Offline Mode** | Modo que deshabilita todas las conexiones de red forzando IA local |
| **GBNF** | Gramática para forzar formato JSON en la salida de modelos LLM locales |
| **MMKV** | Almacenamiento clave-valor rápido (usado para flashcards offline) |
| **Uploadthing** | Servicio de almacenamiento de archivos en la nube |
| **Dual Storage Merge** | Estrategia de combinar datos de SQLite y MMKV en tiempo de lectura |
| **Marching Ants** | Animación de borde punteado móvil para indicar tarjetas pendientes |
| **Drop Lowest** | Función de categoría que elimina la calificación más baja del cálculo |
| **Ghost File** | Archivo multimedia cuyo archivo local no existe pero cuyo registro está en la BD |


---
**Tags:** #product
