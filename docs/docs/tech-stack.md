# Tech Stack

> Inventario exhaustivo de todas las herramientas, dependencias y servicios.
> Actualizado: Julio 2026

## Arquitectura General

Threshold es una aplicación fullstack offline-first con tres capas principales.

## Frontend — Mobile App

| Tecnología | Versión | Rol |
|---|---|---|
| **React Native** | 0.81.5 | Framework base |
| **React** | 19.1.0 | UI Library |
| **Expo** | ~54.0.33 | SDK y build system |
| **Expo Router** | ~6.0.23 | File-based routing con typed routes |
| **TypeScript** | ~5.9.2 | Tipado estático |
| **New Architecture** | enabled | JSI, Nitro Modules, Fabric |
| **Hermes** | (nativo RN 0.81) | Motor JS compilado a bytecode |
| **React Compiler** | (experimental) | Optimización de re-renders |

### State Management & Storage

| Tecnología | Versión | Rol |
|---|---|---|
| **Zustand** | ^5.0.13 | Estado global reactivo |
| **react-native-mmkv** | ^4.3.1 | Caché persistente C++ ultrarrápido |
| **@react-native-async-storage/async-storage** | 2.2.0 | Almacenamiento legacy / HTTP cache |
| **expo-secure-store** | ~15.0.8 | Almacenamiento seguro de JWT |
| **expo-sqlite** | ~16.0.10 | Base de datos relacional local |

### Navigation & UI

| Tecnología | Versión | Rol |
|---|---|---|
| **@react-navigation/native** | ^7.1.8 | Stack y tab navigation |
| **@react-navigation/bottom-tabs** | ^7.4.0 | Navegación por pestañas |
| **react-native-safe-area-context** | ~5.6.0 | Safe areas |
| **react-native-screens** | ~4.16.0 | Pantallas nativas optimizadas |
| **expo-linking** | ~8.0.11 | Deep linking |
| **react-native-reanimated** | ~4.1.1 | Animaciones de alta performance |
| **react-native-gesture-handler** | ~2.28.0 | Gestos nativos |
| **@shopify/react-native-skia** | 2.2.12 | Canvas 2D |
| **react-native-svg** | 15.12.1 | Vectores SVG |
| **lottie-react-native** | ~7.3.1 | Animaciones JSON |
| **victory-native** | ^36.9.2 | Gráficas |
| **react-native-chart-kit** | ^6.12.0 | Gráficas adicionales |
| **expo-linear-gradient** | ~15.0.8 | Gradientes |
| **expo-image** | ~3.0.11 | Imagen optimizada con caché |
| **@expo/vector-icons** | ^15.0.3 | Iconos (Ionicons, MaterialCommunityIcons) |
| **expo-status-bar** | ~3.0.9 | Barra de estado |
| **expo-splash-screen** | ~31.0.13 | Splash nativa |
| **expo-system-ui** | ~6.0.9 | Colores del sistema |
| **expo-symbols** | ~1.0.8 | SF Symbols (iOS) |

### Media & Camera

| Tecnología | Versión | Rol |
|---|---|---|
| **expo-av** | ~16.0.8 | Reproducción/grabación audio/video |
| **expo-camera** | ~17.0.10 | Cámara nativa |
| **expo-image-picker** | ~17.0.10 | Selección de imágenes |
| **expo-image-manipulator** | ~14.0.8 | Transformación de imágenes |
| **expo-document-picker** | ~14.0.8 | Selector de archivos |
| **expo-file-system** | ~19.0.21 | Sistema de archivos local |
| **expo-print** | ~15.0.8 | Impresión / PDF |
| **expo-sharing** | ~14.0.8 | Compartir archivos |
| **expo-media-library** | ~18.2.1 | Biblioteca de medios |
| **react-native-document-scanner-plugin** | ^2.0.4 | Escáner de documentos |
| **react-native-youtube-iframe** | ^2.4.1 | Reproductor YouTube |

### AI On-Device

| Tecnología | Versión | Rol |
|---|---|---|
| **llama.rn** | ~0.12.4 | Inferencia local LLM (Zyren offline) |
| **whisper.rn** | ~0.6.0 | Transcripción de audio offline |
| **@react-native-ml-kit/text-recognition** | ^2.0.0 | OCR local |
| **react-native-nitro-modules** | ^0.35.9 | Bridge nativo JSI |
| **react-native-worklets** | 0.5.1 | Background threads |

### Background Services

| Tecnología | Versión | Rol |
|---|---|---|
| **expo-notifications** | ~0.32.16 | Notificaciones push y locales |
| **expo-background-fetch** | ~14.0.9 | Tareas periódicas en segundo plano |
| **expo-task-manager** | ~14.0.9 | Gestión de tareas en background |
| **expo-keep-awake** | ~15.0.8 | Pantalla activa durante estudio |

### Security & Biometrics

| Tecnología | Versión | Rol |
|---|---|---|
| **expo-local-authentication** | ~17.0.8 | Face ID / Touch ID |
| **expo-secure-store** | ~15.0.8 | Almacenamiento de tokens |
| **expo-crypto** | ~15.0.8 | Crypto / UUID |

### Networking

| Tecnología | Versión | Rol |
|---|---|---|
| **@react-native-community/netinfo** | 11.4.1 | Estado de red (online/offline) |
| **expo-web-browser** | ~15.0.10 | Navegador integrado |
| **expo-clipboard** | ~8.0.8 | Portapapeles |
| **react-native-webview** | 13.15.0 | WebView |
| **uploadthing** | ^7.7.4 | Subida de archivos a la nube |

### i18n

| Tecnología | Versión | Rol |
|---|---|---|
| **i18next** | ^26.0.6 | Internacionalización |
| **react-i18next** | ^17.0.4 | Integración React |

### Inputs

| Tecnología | Versión | Rol |
|---|---|---|
| **@react-native-community/datetimepicker** | 8.4.4 | Selector fecha/hora |
| **@react-native-community/slider** | 5.0.1 | Slider |

### Dev Tools

| Tecnología | Versión | Rol |
|---|---|---|
| **ESLint** | ^9.25.0 | Linting |
| **eslint-config-expo** | ~10.0.0 | Reglas Expo |
| **Jest** | ^29.7.0 | Testing |
| **ts-jest** | ^29.2.5 | TypeScript para Jest |
| **cross-env** | ^10.1.0 | Env cross-platform |
| **@types/react** | ~19.1.0 | Tipos React |
| **@types/uuid** | ^10.0.0 | Tipos uuid |

### Document Processing

| Tecnología | Versión | Rol |
|---|---|---|
| **pdf-lib** | ^1.17.1 | Manipulación de PDFs on-device |
| **highlight.js** | ^11.11.1 | Syntax highlighting (25 lenguajes) |
| **react-native-markdown-display** | ^7.0.2 | Renderizado Markdown |
| **react-native-get-random-values** | ^2.0.0 | Polyfill crypto |

## Backend — API Server

| Tecnología | Versión | Rol |
|---|---|---|
| **Node.js** | >=18.0.0 | Runtime |
| **Express** | ^5.2.1 | Framework HTTP |
| **SQLite** (sqlite3) | ^6.0.1 | Base de datos principal |
| **PostgreSQL** (pg) | ^8.20.0 | BD alternativa |
| **jsonwebtoken** | ^9.0.3 | JWT |
| **bcrypt** | ^6.0.0 | Hashing de contraseñas |
| **helmet** | ^8.1.0 | Headers de seguridad |
| **express-rate-limit** | ^8.5.1 | Rate limiting |
| **zod** | ^4.4.3 | Validación de esquemas |
| **multer** | ^1.4.5-lts.1 | Upload de archivos |
| **pdf-parse** | ^1.1.1 | Extracción de texto PDF |
| **pdfkit** | ^0.18.0 | Generación de PDFs |
| **mammoth** | ^1.12.0 | Conversión .docx |
| **@google/generative-ai** | ^0.24.1 | Gemini Pro |
| **@distube/ytdl-core** | ^4.16.12 | YouTube metadata |
| **youtube-transcript** | ^1.3.1 | Transcripciones YouTube |
| **uploadthing** | ^7.7.4 | File storage |
| **resend** | ^6.14.0 | Email transaccional |
| **uuid** | ^14.0.0 | UUIDs |
| **morgan** | ^1.10.1 | HTTP logger |
| **swagger-jsdoc** | ^6.2.8 | OpenAPI spec |
| **swagger-ui-express** | ^5.0.1 | Swagger UI |
| **dotenv** | ^17.4.2 | Variables de entorno |
| **cors** | ^2.8.6 | CORS |

### AI Cloud

| Modelo | Proveedor | Uso |
|---|---|---|
| llama-3.3-70b-versatile | Groq | Generación flashcards, chat (principal) |
| llama-3.1-8b-instant | Groq | Fallback rápido |
| llama-3.2-11b-vision-preview | Groq | OCR de imágenes |
| gemini-pro | Google | Contexto avanzado |
| Whisper | OpenAI | Transcripción audio (fallback) |
| Supadata API | Supadata.ai | Transcripciones YouTube |

## Infraestructura

| Servicio | Rol |
|---|---|
| **Render** | Hosting backend Node.js |
| **Expo EAS Build** | Build nativo APK/IPA |
| **UploadThing** | CDN para archivos |
| **GitHub Actions** | CI (Reminder Regression Suite, 275 tests) |
| **Docusaurus** 3.10.1 | Sitio de documentación técnica |
| **Swagger** | Documentación interactiva API REST |

## Módulos Nativos Propios

| Módulo | Plataforma | Rol |
|---|---|---|
| **threshold-pdf-extractor** | Android (Kotlin), iOS (Swift) | Extracción de texto de PDFs on-device + conversión audio a WAV |

## Algoritmos del Sistema

| Algoritmo | Implementación |
|---|---|
| **FSRS v4.5** | `mobile/src/domain/fsrs/` + `backend/utils/fsrsAlgorithm.js` |
| **SM-2** | `backend/utils/sm2Algorithm.js` |
| **Academic Workflow Engine** | `backend/services/academicWorkflowEngine.js` |
| **Atomic Card Generator** | `backend/utils/atomicCardGenerator.js` |
| **Grade Normalization** | `backend/services/gradingEngine.js` |
| **SyncQueueReducer** | `mobile/src/services/sync/reducer/` |
| **ConflictResolver (4 estrategias)** | `mobile/src/services/sync/ConflictResolver.ts` |
| **KnowledgeSnapshotBuilder** | `mobile/src/domain/knowledge/` |
| **Reminder System** | `mobile/src/services/reminders/` (23 suites, 290 tests) |
| **AssetSyncEngine** | `mobile/src/services/sync/asset/` |

## Plataformas Soportadas

| Plataforma | Estado |
|---|---|
| **Android** | ✅ Principal (`com.oponobono.threshold`) |
| **iOS** | ✅ Soportado |
| **Web** | ⚠️ Experimental (Expo Web) |

## Internacionalización

| Idioma | Estado |
|---|---|
| Español (es) | ✅ Principal |
| Inglés (en) | ✅ Completo |
| Português (pt) | ⚠️ Parcial |
