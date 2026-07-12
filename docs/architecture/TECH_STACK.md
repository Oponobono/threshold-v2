# 🧱 Threshold — Tech Stack Completo

> Documento de referencia técnica. Inventario exhaustivo de todas las herramientas, dependencias y servicios.
> Última actualización: Julio 2026.

---

## 📐 Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│            MOBILE APP (React Native / Expo)         │
│   Expo Router · Zustand · MMKV · SQLite · Sync      │
│   Hermes (JS Engine) · New Architecture             │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / REST API
┌──────────────────────▼──────────────────────────────┐
│            BACKEND (Node.js / Express)               │
│    SQLite · PostgreSQL · JWT · Groq · Gemini         │
└──────────────────────┬──────────────────────────────┘
                       │ Deploy
┌──────────────────────▼──────────────────────────────┐
│            CLOUD INFRASTRUCTURE                      │
│    Render · EAS Build · UploadThing · GitHub Actions │
└─────────────────────────────────────────────────────┘
```

---

## 📱 Frontend — Mobile App

### Core Framework

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **React Native** | 0.81.5 | Framework base para la app nativa | `mobile/package.json` |
| **React** | 19.1.0 | UI Library | `mobile/package.json` |
| **Expo** | ~54.0.33 | SDK, build system y runtime | `mobile/package.json` |
| **Expo Router** | ~6.0.23 | File-based routing con typed routes | `mobile/package.json` |
| **TypeScript** | ~5.9.2 | Tipado estático en toda la capa mobile | `mobile/package.json` |
| **Hermes** | (nativo RN 0.81) | Motor JS optimizado para React Native (compilación a bytecode) | RN 0.81 default |
| **New Architecture** | enabled | JSI, Nitro Modules, Fabric renderer | `mobile/app.json` |
| **React Compiler** | (experimental) | Optimización automática de re-renders | `mobile/app.json` |

### State Management & Storage

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **Zustand** | ^5.0.13 | Estado global reactivo (player, AI, flashcards, data, connectivity) | `mobile/package.json` |
| **react-native-mmkv** | ^4.3.1 | Caché persistente C++ ultrarrápido (offline-first hydration) | `mobile/package.json` |
| **@react-native-async-storage/async-storage** | 2.2.0 | Almacenamiento legacy / HTTP cache con TTL | `mobile/package.json` |
| **expo-secure-store** | ~15.0.8 | Almacenamiento seguro de JWT tokens y credenciales | `mobile/package.json` |
| **expo-sqlite** | ~16.0.10 | Base de datos relacional local | `mobile/package.json` |

### Navigation & Routing

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **Expo Router** | ~6.0.23 | Routing file-based (36+ archivos lo importan) | `mobile/package.json` |
| **@react-navigation/native** | ^7.1.8 | Stack y tab navigation primitives | `mobile/package.json` |
| **@react-navigation/bottom-tabs** | ^7.4.0 | Navegación por pestañas del dashboard | `mobile/package.json` |
| **@react-navigation/elements** | ^2.6.3 | Componentes base de header/footer | `mobile/package.json` |
| **react-native-screens** | ~4.16.0 | Optimización de pantallas nativas | `mobile/package.json` |
| **react-native-safe-area-context** | ~5.6.0 | Manejo de notch, Dynamic Island y safe areas (44+ archivos) | `mobile/package.json` |
| **expo-linking** | ~8.0.11 | Deep linking y manejo de URLs externas | `mobile/package.json` |
| **expo-splash-screen** | ~31.0.13 | Pantalla de splash nativa durante bootstrap | `mobile/package.json` |

### Animations & UI

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **react-native-reanimated** | ~4.1.1 | Animaciones de alta performance (worklets en JS thread) | `mobile/package.json`, `babel.config.js` |
| **react-native-gesture-handler** | ~2.28.0 | Gestos nativos (swipe, drag, pinch) — 7 archivos | `mobile/package.json` |
| **@shopify/react-native-skia** | 2.2.12 | Canvas 2D de alta performance | `mobile/package.json` |
| **react-native-svg** | 15.12.1 | Renderizado de vectores SVG (5 archivos) | `mobile/package.json` |
| **lottie-react-native** | ~7.3.1 | Animaciones JSON (Zyren orb, loading states) — 6 archivos | `mobile/package.json` |
| **@lottiefiles/dotlottie-react** | ^0.13.5 | Soporte formato .lottie comprimido | `mobile/package.json` |
| **victory-native** | ^36.9.2 | Gráficas de progreso académico (MasteryRadar) | `mobile/package.json` |
| **react-native-chart-kit** | ^6.12.0 | Gráficas adicionales (bar, line charts) | `mobile/package.json` |
| **expo-linear-gradient** | ~15.0.8 | Gradientes lineales para UI premium (7 archivos) | `mobile/package.json` |
| **expo-image** | ~3.0.11 | Componente de imagen optimizado con caché | `mobile/package.json` |
| **@expo/vector-icons** | ^15.0.3 | Ionicons, MaterialCommunityIcons, Feather (100+ archivos) | `mobile/package.json` |
| **expo-symbols** | ~1.0.8 | Iconos SF Symbols (iOS) y Material (Android) | `mobile/package.json` |
| **react-native-markdown-display** | ^7.0.2 | Renderizado de Markdown en respuestas de Zyren | `mobile/package.json` |
| **highlight.js** | ^11.11.1 | Syntax highlighting para bloques de código (CodeHighlighter, 25 lenguajes) | `mobile/package.json` |
| **lottie-react-native** | ~7.3.1 | Animaciones Lottie | `mobile/package.json` |
| **react-native-safe-area-context** | ~5.6.0 | Safe areas | `mobile/package.json` |
| **react-native-screens** | ~4.16.0 | Pantallas nativas optimizadas | `mobile/package.json` |
| **expo-status-bar** | ~3.0.9 | Configuración de la barra de estado | `mobile/package.json` |
| **expo-system-ui** | ~6.0.9 | Colores del sistema (navigation bar, background) | `mobile/package.json` |

### Media & Camera

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **expo-av** | ~16.0.8 | Reproducción y grabación de audio/video | `mobile/package.json` |
| **expo-camera** | ~17.0.10 | Acceso a cámara nativa (foto, video) | `mobile/package.json`, `app.json` plugin |
| **expo-image-picker** | ~17.0.10 | Selección de imágenes de la galería (5 archivos) | `mobile/package.json` |
| **expo-image-manipulator** | ~14.0.8 | Transformación y compresión de imágenes | `mobile/package.json` |
| **expo-document-picker** | ~14.0.8 | Selector de archivos del sistema (PDFs, docs) — 4 archivos | `mobile/package.json` |
| **expo-file-system** | ~19.0.21 | Sistema de archivos local (29+ archivos) | `mobile/package.json` |
| **expo-print** | ~15.0.8 | Impresión y exportación a PDF | `mobile/package.json` |
| **expo-sharing** | ~14.0.8 | Compartir archivos con otras apps | `mobile/package.json` |
| **expo-media-library** | ~18.2.1 | Acceso a la biblioteca de medios del dispositivo | `mobile/package.json` |
| **react-native-document-scanner-plugin** | ^2.0.4 | Escáner de documentos con corrección de perspectiva | `mobile/package.json`, `app.json` plugin |
| **react-native-youtube-iframe** | ^2.4.1 | Reproductor de YouTube embebido (3 archivos) | `mobile/package.json` |

### AI On-Device

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **llama.rn** | ~0.12.4 | Inferencia local LLM (llama.cpp bindings) — Zyren offline | `mobile/package.json` |
| **whisper.rn** | ~0.6.0 | Transcripción de audio on-device (OpenAI Whisper local) | `mobile/package.json` |
| **@react-native-ml-kit/text-recognition** | ^2.0.0 | OCR on-device (Google ML Kit) | `mobile/package.json` |
| **react-native-nitro-modules** | ^0.35.9 | Bridge nativo de alta performance para módulos JSI | `mobile/package.json` |
| **react-native-worklets** | 0.5.1 | Ejecución de código JS en threads de background | `mobile/package.json` |

### Document Processing

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **pdf-lib** | ^1.17.1 | Generación y manipulación de PDFs on-device | `mobile/package.json` |
| **highlight.js** | ^11.11.1 | Syntax highlighting (25 lenguajes registrados) | `mobile/package.json`, `CodeHighlighter.tsx` |
| **react-native-markdown-display** | ^7.0.2 | Renderizado de Markdown | `mobile/package.json` |
| **react-native-get-random-values** | ^2.0.0 | Polyfill de crypto.getRandomValues para RN | `mobile/package.json` |

### IDs & UUIDs

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **uuid** (npm) | (transitivo vía backend) | Usado en 3 archivos mobile (ZyrenIngestionModal, FlashcardImportModal, migrateFlashcardsFromMMKV) | Imports directos |
| **expo-crypto** | ~15.0.8 | randomUUID() nativo usado por `utils/uuid.ts` como fuente primaria | `mobile/package.json` |

### Internationalization

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **i18next** | ^26.0.6 | Framework de internacionalización | `mobile/package.json` |
| **react-i18next** | ^17.0.4 | Integración i18next con React hooks (100+ archivos) | `mobile/package.json` |

### Network & Connectivity

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **@react-native-community/netinfo** | 11.4.1 | Detección del estado de red (online/offline) — 3 archivos | `mobile/package.json` |
| **expo-web-browser** | ~15.0.10 | Navegador integrado para OAuth y URLs externas | `mobile/package.json` |
| **expo-intent-launcher** | ~13.0.8 | Lanzar intents nativos de Android | `mobile/package.json` |
| **react-native-webview** | 13.15.0 | Renderizado de contenido web | `mobile/package.json` |
| **react-native-web-webview** | ^1.0.2 | WebView para la versión web (polyfill) | `mobile/package.json` |
| **expo-clipboard** | ~8.0.8 | Acceso al portapapeles del sistema (6 archivos) | `mobile/package.json` |
| **expo-linking** | ~8.0.11 | Deep linking | `mobile/package.json` |
| **uploadthing** | ^7.7.4 | Subida de archivos a la nube | `mobile/package.json` |

### Background Services & Notifications

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **expo-notifications** | ~0.32.16 | Push notifications y notificaciones locales (8 archivos) | `mobile/package.json`, `app.json` plugin |
| **expo-background-fetch** | ~14.0.9 | Tareas periódicas en segundo plano (sync, backup) | `mobile/package.json`, `app.json` plugin |
| **expo-task-manager** | ~14.0.9 | Registro y gestión de tareas en background | `mobile/package.json` |
| **expo-keep-awake** | ~15.0.8 | Mantener pantalla activa durante el timer de estudio | `mobile/package.json` |

### Biometrics & Security

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **expo-local-authentication** | ~17.0.8 | Face ID, Touch ID, fingerprint nativo | `mobile/package.json` |
| **expo-secure-store** | ~15.0.8 | Almacenamiento seguro de tokens JWT (8 archivos) | `mobile/package.json`, `app.json` plugin |
| **expo-crypto** | ~15.0.8 | Funciones criptográficas (hashing, random bytes, UUID) | `mobile/package.json` |

### Sensors & Device

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **expo-sensors** | ~15.0.8 | Acelerómetro, giroscopio (shake-to-refresh) | `mobile/package.json` |
| **expo-device** | ~8.0.10 | Información del hardware (modelo, OS, RAM total) | `mobile/package.json` |
| **expo-constants** | ~18.0.13 | Constantes de la app (manifest, expoConfig, platform) | `mobile/package.json` |
| **expo-application** | ~7.0.8 | Información de la aplicación (version, bundle ID) | `mobile/package.json` |
| **expo-haptics** | ~15.0.8 | Feedback háptico táctil | `mobile/package.json` |
| **react-native-haptic-feedback** | ^3.0.0 | Feedback háptico avanzado (Haptic Engine) | `mobile/package.json` |
| **expo-font** | ~14.0.11 | Carga de fuentes personalizadas | `mobile/package.json` |

### Inputs

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **@react-native-community/datetimepicker** | 8.4.4 | Selector nativo de fecha y hora (7 archivos) | `mobile/package.json`, `app.json` plugin |
| **@react-native-community/slider** | 5.0.1 | Control deslizante nativo | `mobile/package.json` |

### UI Web (Web Support)

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **react-native-web** | ~0.21.0 | Render de componentes React Native en el navegador | `mobile/package.json` |
| **react-dom** | 19.1.0 | Renderizado DOM para web | `mobile/package.json` |

### Dev Tools (Mobile)

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **ESLint** | ^9.25.0 | Linting de código | `mobile/package.json` |
| **eslint-config-expo** | ~10.0.0 | Reglas de ESLint específicas para Expo | `mobile/package.json` |
| **Jest** | ^29.7.0 | Testing framework (unitario, integración, regression) | `mobile/package.json` |
| **ts-jest** | ^29.2.5 | Transpilación TypeScript para Jest | `mobile/package.json` |
| **@types/jest** | ^29.5.14 | Tipos TypeScript para Jest | `mobile/package.json` |
| **@types/react** | ~19.1.0 | Tipos TypeScript para React | `mobile/package.json` |
| **@types/uuid** | ^10.0.0 | Tipos TypeScript para uuid | `mobile/package.json` |
| **cross-env** | ^10.1.0 | Variables de entorno cross-platform (usado en todos los scripts npm) | `mobile/package.json` |
| **@babel/helper-define-polyfill-provider** | ^0.6.8 | Polyfill provider para Babel | `mobile/package.json` |
| **babel-preset-expo** | (bundled) | Preset de Babel para Expo (vía `babel.config.js`) | `mobile/babel.config.js` |
| **@react-native/debugger-frontend** | (transitivo) | Fix postinstall para es-419.json | `mobile/package.json` postinstall |

### Expo Configuration (app.json)

| Propiedad | Valor |
|---|---|
| **name** | Threshold (slug: threshold) |
| **package** | com.oponobono.threshold |
| **New Architecture** | true |
| **Typed Routes** | true |
| **backgroundColor** | #0E0E18 |
| **Plugins** | expo-router, expo-background-fetch, expo-camera, expo-splash-screen, expo-notifications, expo-sqlite, expo-secure-store, datetimepicker, document-scanner |

---

## ⚙️ Backend — API Server

### Core Framework

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **Node.js** | >=18.0.0 | Runtime de JavaScript del servidor | `backend/package.json` engines |
| **Express** | ^5.2.1 | Framework HTTP REST API | `backend/package.json` |
| **JavaScript (CommonJS)** | — | Lenguaje del backend (`"type": "commonjs"`) | `backend/package.json` |

### Base de Datos

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **SQLite** (sqlite3) | ^6.0.1 | Base de datos principal de producción (Render) | `backend/package.json` (+ root `package.json`) |
| **PostgreSQL** (pg) | ^8.20.0 | Base de datos alternativa / migración futura | `backend/package.json` |

### Seguridad & Autenticación

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **jsonwebtoken** | ^9.0.3 | Generación y verificación de JWT tokens | `backend/package.json` |
| **bcrypt** | ^6.0.0 | Hashing de contraseñas | `backend/package.json` |
| **helmet** | ^8.1.0 | Headers HTTP de seguridad (CSP, HSTS, etc.) | `backend/package.json` |
| **cors** | ^2.8.6 | Cross-Origin Resource Sharing configurable | `backend/package.json` |
| **express-rate-limit** | ^8.5.1 | Rate limiting para prevenir brute-force | `backend/package.json` |
| **zod** | ^4.4.3 | Validación de esquemas de entrada | `backend/package.json` |

### AI Cloud (Backend)

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **@google/generative-ai** | ^0.24.1 | Google Gemini Pro (contexto avanzado, análisis académico) | `backend/package.json` |
| **Groq API** (REST) | — | Inferencia ultrarrápida LLM (Llama 3.3-70b, 3.1-8b, 3.2-11b-vision) | `eas.json` env vars |
| **OpenAI Whisper API** (REST) | — | Transcripción de audio cloud (fallback) | README |
| **Supadata.ai API** (REST) | — | Extracción de transcripciones de YouTube | `backend/controllers/youtubeController.js` |

### Document & File Processing (Backend)

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **multer** | ^1.4.5-lts.1 | Upload de archivos multipart/form-data | `backend/package.json` |
| **pdf-parse** | ^1.1.1 | Extracción de texto de PDFs en el servidor | `backend/package.json` |
| **pdfkit** | ^0.18.0 | Generación de PDFs en el servidor (reportes, analytics) | `backend/package.json` |
| **mammoth** | ^1.12.0 | Conversión de documentos .docx a HTML/texto | `backend/package.json` |

### YouTube (Backend)

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **@distube/ytdl-core** | ^4.16.12 | Descarga y extracción de metadata de YouTube | `backend/package.json` |
| **youtube-transcript** | ^1.3.1 | Extracción de transcripciones de YouTube (npm) | `backend/package.json` |

### File Storage (Backend)

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **uploadthing** | ^7.7.4 | CDN y almacenamiento de archivos en la nube | `backend/package.json` |

### Logging & Monitoring

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **morgan** | ^1.10.1 | Logger de peticiones HTTP | `backend/package.json` |

### Documentation (Backend)

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **swagger-jsdoc** | ^6.2.8 | Generación de spec OpenAPI desde JSDoc | `backend/package.json` |
| **swagger-ui-express** | ^5.0.1 | Interfaz visual de documentación API en `/api-docs` | `backend/package.json` |

### Configuration & Utilities

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **dotenv** | ^17.4.2 | Variables de entorno desde `.env` | `backend/package.json` |
| **uuid** | ^14.0.0 | Generación de UUIDs v4 (18+ archivos) | `backend/package.json` |
| **resend** | ^6.14.0 | Servicio de emails transaccionales | `backend/package.json` |

### Servicios Internos del Backend

| Servicio | Implementación | Rol |
|---|---|---|
| **Sync Version Guards** | `backend/helpers/syncVersion.js` | 4 funciones: incrementSyncVersion, incrementSyncCounterOnly, recordDeletion, recordDeletions |
| **Academic Workflow Engine** | `backend/services/academicWorkflowEngine.js` | Cálculo de notas con categorías ponderadas |
| **Grading Engine** | `backend/services/gradingEngine.js` | Normalización y desnormalización de notas entre sistemas |
| **SM-2 / FSRS Algorithm** | `backend/utils/sm2Algorithm.js`, `backend/utils/fsrsAlgorithm.js` | Algoritmo de repetición espaciada para flashcards |
| **Atomic Card Generator** | `backend/utils/atomicCardGenerator.js` | Fragmentación automática de flashcards densas |

---

## ☁️ Infraestructura & DevOps

### Deploy & Hosting

| Servicio | Rol |
|---|---|
| **Render** | Hosting del backend Node.js (PaaS, deploy desde Git) |
| **Expo EAS Build** | Build nativo de la app (APK/IPA) en la nube (CLI >= 18.8.1) |
| **Expo EAS Submit** | Publicación automática a Google Play y App Store |

### File Storage & CDN

| Servicio | Rol |
|---|---|
| **UploadThing** | CDN para fotos, documentos y audios subidos por el usuario |

### CI/CD

| Servicio | Rol |
|---|---|
| **GitHub Actions** | CI: Reminder Regression Suite (Node 18, Jest, 275 tests) |
| **Git** | Control de versiones |
| **GitHub** | Hosting del repositorio |

### Documentación

| Servicio | Versión / Detalle | Rol |
|---|---|---|
| **Docusaurus** | 3.10.1 | Sitio web de documentación técnica (`docs/`) con build estático |
| **Swagger UI** | 5.0.1 | Documentación interactiva de la API REST en `/api-docs` |

---

## 📝 Documentation Stack (docs/)

| Tecnología | Versión | Rol | Fuente |
|---|---|---|---|
| **@docusaurus/core** | 3.10.1 | Framework de documentación | `docs/package.json` |
| **@docusaurus/preset-classic** | 3.10.1 | Preset Docusaurus | `docs/package.json` |
| **@mdx-js/react** | ^3.0.0 | Soporte MDX | `docs/package.json` |
| **clsx** | ^2.0.0 | Utilidad de clases condicionales | `docs/package.json` |
| **prism-react-renderer** | ^2.3.0 | Syntax highlighting en docs | `docs/package.json` |
| **react** | ^19.0.0 | UI Library (docs) | `docs/package.json` |
| **react-dom** | ^19.0.0 | DOM rendering (docs) | `docs/package.json` |
| **TypeScript** | ~6.0.2 | Tipado (docs) | `docs/package.json` |
| **@docusaurus/module-type-aliases** | 3.10.1 | Tipos Docusaurus (dev) | `docs/package.json` |
| **@docusaurus/tsconfig** | 3.10.1 | Config TS Docusaurus (dev) | `docs/package.json` |
| **@docusaurus/types** | 3.10.1 | Tipos Docusaurus (dev) | `docs/package.json` |
| **Node.js** | >=20.0 | Runtime (docs) | `docs/package.json` engines |

---

## 🤖 AI Models Stack

### On-Device (Offline)

| Modelo | Framework | Uso |
|---|---|---|
| **Llama 3.2 / Phi / Mistral** (quantized GGUF) | llama.rn (llama.cpp) | Zyren en modo offline — chat sin internet |
| **Whisper (small/base)** | whisper.rn | Transcripción de audio offline |
| **Google ML Kit Text Recognition** | @react-native-ml-kit | OCR local de fotos |

### Cloud AI (Online)

| Modelo | Proveedor | Uso |
|---|---|---|
| **llama-3.3-70b-versatile** | Groq | Generación de flashcards, análisis de texto (modelo principal) |
| **llama-3.1-8b-instant** | Groq | Fallback rápido cuando el modelo principal supera rate limits |
| **llama-3.2-11b-vision-preview** | Groq | OCR de imágenes para generación de flashcards desde foto |
| **gemini-pro** | Google Gemini | Contexto avanzado, análisis académico complementario |
| **Whisper** (cloud) | OpenAI | Transcripción de audio cloud (fallback) |

---

## 🧠 Arquitectura de Datos Offline

| Capa | Tecnología | Rol |
|---|---|---|
| **Caché rápido (MMKV)** | react-native-mmkv | Hidratación síncrona inmediata al arrancar la app |
| **Caché HTTP (AsyncStorage)** | @react-native-async-storage | Respuestas GET cacheadas con TTL de 10 minutos |
| **Cola offline (MMKV)** | offlineSyncService | FIFO queue de operaciones POST/PUT/DELETE pendientes |
| **BD local (SQLite)** | expo-sqlite | Datos estructurados on-device (36+ tablas) |
| **Resolución de IDs temporales** | offlineSyncService (idMap) | Mapeo de IDs temporales a reales al sincronizar |

---

## 🎨 Design System

| Elemento | Tecnología |
|---|---|
| **Fuentes** | System fonts + expo-font para fuentes personalizadas |
| **Iconografía** | @expo/vector-icons (Ionicons, MaterialCommunityIcons, Feather) + expo-symbols |
| **Animaciones** | react-native-reanimated 4 + lottie-react-native + Skia canvas |
| **Tema** | Sistema de tokens centralizado en `src/styles/theme.ts` |
| **Estilos** | StyleSheet de React Native + archivos `.styles.ts` por componente (37+ archivos) |
| **Color scheme** | Dark mode por defecto (#0E0E18), light mode soportado |

---

## 🔐 Seguridad

| Capa | Implementación |
|---|---|
| **Autenticación** | JWT Bearer Token con expiración (jsonwebtoken) |
| **Almacenamiento de tokens** | expo-secure-store (Keychain iOS / Keystore Android) |
| **Contraseñas** | bcrypt con salt rounds configurable |
| **IDOR Prevention** | Middleware `validateOwner.js` en todos los recursos |
| **Rate Limiting** | express-rate-limit en endpoints de auth |
| **Headers** | helmet (CSP, HSTS, X-Frame-Options, etc.) |
| **Validación** | zod en endpoints críticos del backend |
| **Biometría** | expo-local-authentication (Face ID / Touch ID / fingerprint) |
| **Criptografía** | expo-crypto (hashing, random bytes, UUID) |

---

## 📊 Algoritmos del Sistema

| Algoritmo | Implementación | Uso |
|---|---|---|
| **FSRS (Free Spaced Repetition Scheduler) v4.5** | `mobile/src/domain/fsrs/calculateFSRS.ts` + `backend/utils/fsrsAlgorithm.js` | Algoritmo principal de repetición espaciada (mobile + backend) |
| **SM-2** | `backend/utils/sm2Algorithm.js` | Algoritmo legacy compatibilidad |
| **Academic Workflow Engine** | `backend/services/academicWorkflowEngine.js` | Cálculo de promedios ponderados por categoría |
| **Atomic Card Generator** | `backend/utils/atomicCardGenerator.js` | Fragmentación automática de tarjetas densas |
| **Grade Normalization** | `backend/services/gradingEngine.js` | Normalización entre sistemas (0-5, 0-10, 0-100, letras) |
| **SyncQueueReducer** | `mobile/src/services/sync/reducer/` | Reducción de cola de sincronización (OperationReducer, DependencyResolver, ValidationRules) |
| **ConflictResolver** | `mobile/src/services/sync/ConflictResolver.ts` | 4 estrategias: LWW, CLIENT, SERVER, MERGE |
| **KnowledgeSnapshotBuilder** | `mobile/src/domain/knowledge/KnowledgeSnapshotBuilder.ts` | Proyección inmutable del conocimiento del usuario |
| **Reminder System** | `mobile/src/services/reminders/` | Sistema de recordatorios (23 suites, 290 tests) |
| **AssetSyncEngine** | `mobile/src/services/sync/asset/AssetSyncEngine.ts` | Pipeline de assets (fotos, audio, documentos) |

---

## 🏗️ Módulos Nativos Propios

| Módulo | Plataforma | Tecnología | Rol |
|---|---|---|---|
| **threshold-pdf-extractor** | Android (Kotlin), iOS (Swift), Web (stub) | Expo Modules API | Extracción de texto de PDFs on-device vía PDFBox Android (`com.tom-roush:pdfbox-android:2.0.27.0`) + conversión audio a WAV |

---

## 🌍 Internacionalización

| Idioma | Estado |
|---|---|
| Español (es) | ✅ Principal |
| Inglés (en) | ✅ Completo |
| Português (pt) | ⚠️ Parcial |

---

## 📦 Plataformas Soportadas

| Plataforma | Estado |
|---|---|
| **Android** | ✅ Principal (package: `com.oponobono.threshold`) |
| **iOS** | ✅ Soportado |
| **Web** | ⚠️ Soporte experimental (Expo Web) |

---

## 📁 Estructura del Monorepo

```
Threshold/
├── mobile/                    # App React Native / Expo
│   ├── app/                   # Rutas (Expo Router file-based)
│   ├── src/
│   │   ├── components/        # Componentes UI por feature
│   │   ├── domain/            # Lógica de dominio pura (FSRS, Knowledge, Reminders)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/
│   │   │   ├── api/           # Módulos REST por dominio
│   │   │   ├── sync/          # Sync Engine (reducer, asset, validator, test)
│   │   │   ├── database/      # SQLite, repositorios, migraciones
│   │   │   └── reminders/     # Reminder System
│   │   ├── store/             # Stores Zustand globales
│   │   ├── styles/            # Design tokens + .styles.ts por componente
│   │   ├── types/             # Tipos TypeScript globales
│   │   └── utils/             # Utilidades puras
│   ├── modules/               # Módulos Expo nativos
│   │   └── threshold-pdf-extractor/  # Kotlin (Android) / Swift (iOS)
│   ├── app.json               # Expo config (New Arch, typed routes, plugins)
│   ├── eas.json               # EAS Build profiles
│   ├── babel.config.js        # Babel (expo preset + reanimated plugin)
│   ├── metro.config.js        # Metro bundler
│   ├── jest.config.js         # Jest config (ts-jest)
│   └── eslint.config.js       # ESLint flat config
│
├── backend/                   # API Server Node.js
│   ├── controllers/           # Lógica de negocio por dominio
│   ├── routes/                # Definición de endpoints Express
│   ├── middlewares/           # Auth, rate limit, validateOwner
│   ├── services/              # Motores académicos, grading, email
│   ├── utils/                 # FSRS, SM-2, atomicCard, syncVersion
│   ├── helpers/               # Helpers de sync
│   ├── database/              # Conexión, schema, migraciones
│   └── tests/
│       ├── convergence/       # Test de convergencia de sincronización
│       └── stress/            # Stress test con perturbaciones
│
├── docs/                      # Documentación Docusaurus
│   ├── docs/                  # Páginas del sitio
│   ├── src/                   # Componentes React del sitio
│   └── docusaurus.config.ts   # Configuración Docusaurus
│
├── .github/workflows/         # CI/CD
│   └── reminder-regression.yml # GitHub Actions: Reminder Regression Suite
│
├── analysis/                  # Documentación técnica legado
├── scripts/                   # Scripts auxiliares (phase6, update-local-ip, etc.)
├── .agents/                   # Skills de IA (security-review, find-skills)
├── FEATURE_MATRIX.md
├── SYNC_PROTOCOL.md
├── SYNC_ENTITY_SPEC.md
├── MUTATION_MATRIX.md
├── OWNERSHIP_MATRIX.md
├── AGENTS.md
├── skills-lock.json           # Skills lockfile
└── reorder.py                 # Script Python one-off
```

---

## 🔗 Enlaces Rápidos (Obsidian)

- **Estructura y Datos:** [[DATABASE_DOCUMENTATION]] | [[API_DOCUMENTATION]]
- **Lógica Offline:** [[OFFLINE_ARCHITECTURE]]
- **Inteligencia y Algoritmos:** [[LEARNING_ENGINEERING_DOCUMENTATION]] | [[spaced_repetition_logic]] | [[PREDICTIONS_ANALYSIS]]
- **IA y Asistentes:** [[AI_MODELS_AND_ZYREN_DOCUMENTATION]] | [[ZYREN_BORN]]
- **Sistema de Flashcards:** [[FLASHCARDS_COMPLETE_DOCUMENTATION]] | [[FLASHCARD_IMPORT_SCHEMA]]
- **Seguridad:** [[SECURITY]] | [[SECURITY_REVIEW_2026-05-30]]
- **Interfaces:** [[INTERFACES_ANALYSIS]]

---

**Tags:** #architecture
