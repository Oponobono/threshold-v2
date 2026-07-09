# 🧱 Threshold — Tech Stack Completo

> Documento de referencia técnica. Última actualización: Mayo 2026.
[[TECH_STACK]]
---

## 📐 Arquitectura General

Threshold es una aplicación **fullstack offline-first** con tres capas principales:

```
┌─────────────────────────────────────────────────┐
│           MOBILE APP (React Native / Expo)      │
│  Expo Router · Zustand · MMKV · Offline Queue   │
└────────────────────┬────────────────────────────┘
                     │ HTTPS / REST API
┌────────────────────▼────────────────────────────┐
│           BACKEND (Node.js / Express)           │
│    SQLite · JWT · Groq AI · Gemini AI           │
└────────────────────┬────────────────────────────┘
                     │ Deploy
┌────────────────────▼────────────────────────────┐
│           CLOUD INFRASTRUCTURE                  │
│    Render · UploadThing · EAS Build             │
└─────────────────────────────────────────────────┘
```

---

## 📱 Frontend — Mobile App

### Core Framework

| Tecnología | Versión | Rol |
|---|---|---|
| **React Native** | 0.81.5 | Framework base para la app nativa |
| **React** | 19.1.0 | UI Library con React Compiler activado |
| **Expo** | ~54.0.33 | SDK, build system y runtime |
| **Expo Router** | ~6.0.23 | File-based routing (similar a Next.js) con typed routes |
| **TypeScript** | ~5.9.2 | Tipado estático en toda la capa mobile |
| **New Architecture** | enabled | JSI, Nitro Modules, Fabric renderer activados |

### State Management & Storage

| Tecnología | Versión | Rol |
|---|---|---|
| **Zustand** | ^5.0.13 | Estado global reactivo (subjects, assessments, predictions) |
| **react-native-mmkv** | ^4.3.1 | Caché persistente C++ ultrarrápido (offline-first hydration) |
| **AsyncStorage** | 2.2.0 | Almacenamiento legacy / compatibilidad |
| **Expo Secure Store** | ~15.0.8 | Almacenamiento seguro de JWT tokens y credenciales |
| **Expo SQLite** | ~16.0.10 | Base de datos relacional local (datos estructurados on-device) |

### Navigation & Routing

| Tecnología | Versión | Rol |
|---|---|---|
| **Expo Router** | ~6.0.23 | Routing principal basado en sistema de archivos |
| **React Navigation Native** | ^7.1.8 | Stack y tab navigation primitives |
| **React Navigation Bottom Tabs** | ^7.4.0 | Navegación por pestañas del dashboard |
| **React Navigation Elements** | ^2.6.3 | Componentes base de header/footer |

### Animations & UI

| Tecnología | Versión | Rol |
|---|---|---|
| **React Native Reanimated** | ~4.1.1 | Animaciones de alta performance (worklets en JS thread) |
| **React Native Gesture Handler** | ~2.28.0 | Gestos nativos (swipe, drag, pinch) |
| **Lottie React Native** | ~7.3.1 | Animaciones JSON (orb de Zyren, loading states) |
| **@lottiefiles/dotlottie-react** | ^0.13.5 | Soporte formato .lottie comprimido |
| **@shopify/react-native-skia** | 2.2.12 | Canvas 2D de alta performance (gráficas, efectos) |
| **Victory Native** | ^36.9.2 | Gráficas de progreso académico |
| **React Native Chart Kit** | ^6.12.0 | Gráficas adicionales (bar, line charts) |
| **React Native SVG** | 15.12.1 | Renderizado de vectores SVG |
| **Expo Linear Gradient** | ~15.0.8 | Gradientes lineales para UI premium |
| **Expo Symbols** | ~1.0.8 | Iconos SF Symbols (iOS) y Material (Android) |
| **@expo/vector-icons** | ^15.0.3 | Ionicons, MaterialCommunityIcons, etc. |
| **React Native Safe Area Context** | ~5.6.0 | Manejo de notch y safe areas |
| **React Native Screens** | ~4.16.0 | Optimización de pantallas nativas |
| **Expo Haptics** | ~15.0.8 | Feedback háptico táctil |
| **React Native Haptic Feedback** | ^3.0.0 | Feedback háptico avanzado (Haptic Engine) |

### Media & Camera

| Tecnología | Versión | Rol |
|---|---|---|
| **Expo Camera** | ~17.0.10 | Acceso a cámara nativa (foto, video) |
| **Expo Image Picker** | ~17.0.10 | Selección de imágenes de la galería |
| **Expo Image** | ~3.0.11 | Componente de imagen optimizado con caché |
| **Expo Image Manipulator** | ~14.0.8 | Transformación y compresión de imágenes |
| **Expo AV** | ~16.0.8 | Reproducción y grabación de audio/video |
| **Expo Media Library** | ~18.2.1 | Acceso a la biblioteca de medios del dispositivo |
| **React Native Document Scanner Plugin** | ^2.0.4 | Escáner de documentos con corrección de perspectiva |
| **React Native Youtube Iframe** | ^2.4.1 | Reproductor de YouTube embebido |

### AI & On-Device Intelligence

| Tecnología | Versión | Rol |
|---|---|---|
| **llama.rn** | ~0.12.4 | Inferencia local de modelos LLM (llama.cpp bindings) — Zyren offline |
| **whisper.rn** | ~0.6.0 | Transcripción de audio on-device (OpenAI Whisper local) |
| **@react-native-ml-kit/text-recognition** | ^2.0.0 | OCR on-device (Google ML Kit) |
| **React Native Nitro Modules** | ^0.35.9 | Bridge nativo de alta performance para módulos JSI |
| **React Native Worklets** | 0.5.1 | Ejecución de código JS en threads de background |

### Document Processing

| Tecnología | Versión | Rol |
|---|---|---|
| **pdf-lib** | ^1.17.1 | Generación y manipulación de PDFs on-device |
| **Expo Print** | ~15.0.8 | Impresión y exportación a PDF |
| **Expo Document Picker** | ~14.0.8 | Selector de archivos del sistema (PDFs, docs) |
| **Expo File System** | ~19.0.21 | Sistema de archivos local (lectura/escritura) |
| **Expo Sharing** | ~14.0.8 | Compartir archivos con otras apps |
| **highlight.js** | ^11.11.1 | Syntax highlighting para bloques de código en el chat |
| **React Native Markdown Display** | ^7.0.2 | Renderizado de Markdown en respuestas de Zyren |

### Internationalization

| Tecnología | Versión | Rol |
|---|---|---|
| **i18next** | ^26.0.6 | Framework de internacionalización |
| **react-i18next** | ^17.0.4 | Integración i18next con React hooks |

### Network & Connectivity

| Tecnología | Versión | Rol |
|---|---|---|
| **@react-native-community/netinfo** | 11.4.1 | Detección del estado de red (online/offline) |
| **Expo Web Browser** | ~15.0.10 | Navegador integrado para OAuth y URLs externas |
| **React Native WebView** | 13.15.0 | Renderizado de contenido web (YouTube, iframes) |
| **React Native Web WebView** | ^1.0.2 | WebView para la versión web |
| **youtube-transcript** | ^1.3.1 | Extracción de transcripciones de YouTube |
| **uploadthing** | ^7.7.4 | Subida de archivos a la nube (fotos, documentos) |

### Native Modules Propios

| Módulo | Plataforma | Rol |
|---|---|---|
| **threshold-pdf-extractor** | Android (Kotlin) | Módulo Expo nativo para extracción de texto de PDFs on-device |

### Biometría & Seguridad

| Tecnología | Versión | Rol |
|---|---|---|
| **Expo Local Authentication** | ~17.0.8 | Face ID, Touch ID, fingerprint nativo |
| **Expo Crypto** | ~15.0.8 | Funciones criptográficas (hashing, random bytes) |

### Sensors & Device

| Tecnología | Versión | Rol |
|---|---|---|
| **Expo Sensors** | ~15.0.8 | Acelerómetro, giroscopio (shake-to-refresh) |
| **Expo Keep Awake** | ~15.0.8 | Mantener pantalla activa durante el timer de estudio |
| **Expo Intent Launcher** | ~13.0.8 | Lanzar intents nativos de Android |
| **Expo Application** | ~7.0.8 | Información de la aplicación (version, bundle ID) |
| **Expo Clipboard** | ~8.0.8 | Acceso al portapapeles del sistema |
| **Expo Notifications** | ~0.32.16 | Push notifications y notificaciones locales |

### Inputs

| Tecnología | Versión | Rol |
|---|---|---|
| **@react-native-community/datetimepicker** | 8.4.4 | Selector nativo de fecha y hora |
| **@react-native-community/slider** | 5.0.1 | Control deslizante nativo |

### UI Web (Web Support)

| Tecnología | Versión | Rol |
|---|---|---|
| **React Native Web** | ~0.21.0 | Render de componentes React Native en el navegador |
| **React DOM** | 19.1.0 | Renderizado DOM para web |

### Dev Tools (Mobile)

| Tecnología | Versión | Rol |
|---|---|---|
| **ESLint** | ^9.25.0 | Linting de código |
| **eslint-config-expo** | ~10.0.0 | Reglas de ESLint específicas para Expo |
| **@types/react** | ~19.1.0 | Tipos TypeScript para React |
| **React Compiler** | (experimental) | Optimización automática de re-renders |

---

## ⚙️ Backend — API Server

### Core Framework

| Tecnología | Versión | Rol |
|---|---|---|
| **Node.js** | v24.x | Runtime de JavaScript del servidor |
| **Express** | ^5.2.1 | Framework HTTP REST API |
| **JavaScript (CommonJS)** | — | Lenguaje del backend |

### Base de Datos

| Tecnología | Versión | Rol |
|---|---|---|
| **SQLite** (sqlite3) | ^6.0.1 | Base de datos principal de producción (Render) |
| **PostgreSQL** (pg) | ^8.20.0 | Base de datos alternativa / migración futura |

### Seguridad & Autenticación

| Tecnología | Versión | Rol |
|---|---|---|
| **jsonwebtoken** | ^9.0.3 | Generación y verificación de JWT tokens |
| **bcrypt** | ^6.0.0 | Hashing de contraseñas (bcrypt con salt rounds) |
| **helmet** | ^8.1.0 | Headers HTTP de seguridad (CSP, HSTS, etc.) |
| **cors** | ^2.8.6 | Cross-Origin Resource Sharing configurable |
| **express-rate-limit** | ^8.5.1 | Rate limiting para prevenir brute-force |
| **zod** | ^4.4.3 | Validación de esquemas de entrada |

### AI & Machine Learning (Cloud)

| Tecnología | Versión | Rol |
|---|---|---|
| **Groq API** (fetch nativo) | — | Inferencia ultrarrápida LLM (llama-3.3-70b, llama-3.1-8b, llama-3.2-11b-vision) |
| **@google/generative-ai** | ^0.24.1 | Google Gemini Pro (backup / análisis avanzado) |

### Document & File Processing

| Tecnología | Versión | Rol |
|---|---|---|
| **multer** | ^1.4.5-lts.1 | Upload de archivos multipart/form-data |
| **pdf-parse** | ^1.1.1 | Extracción de texto de PDFs en el servidor |
| **pdfkit** | ^0.18.0 | Generación de PDFs en el servidor |
| **mammoth** | ^1.12.0 | Conversión de documentos .docx a HTML/texto |

### Media & YouTube

| Tecnología | Versión | Rol |
|---|---|---|
| **@distube/ytdl-core** | ^4.16.12 | Descarga y extracción de metadata de YouTube |
| **youtube-transcript** | ^1.3.1 | Extracción de transcripciones automáticas de YouTube |

### File Storage

| Tecnología | Versión | Rol |
|---|---|---|
| **uploadthing** | ^7.7.4 | CDN y almacenamiento de archivos en la nube |

### Logging & Monitoring

| Tecnología | Versión | Rol |
|---|---|---|
| **morgan** | ^1.10.1 | Logger de peticiones HTTP |

### Documentation

| Tecnología | Versión | Rol |
|---|---|---|
| **swagger-jsdoc** | ^6.2.8 | Generación de spec OpenAPI desde JSDoc |
| **swagger-ui-express** | ^5.0.1 | Interfaz visual de documentación API en `/api-docs` |

### Configuration

| Tecnología | Versión | Rol |
|---|---|---|
| **dotenv** | ^17.4.2 | Variables de entorno desde `.env` |

### Servicios Internos del Backend

| Servicio | Archivo | Rol |
|---|---|---|
| **Academic Workflow Engine** | `services/academicWorkflowEngine.js` | Motor de cálculo de notas con categorías ponderadas |
| **Grading Engine** | `services/gradingEngine.js` | Normalización y desnormalización de notas entre sistemas |
| **SM-2 / FSRS Algorithm** | `utils/sm2Algorithm.js` | Algoritmo de repetición espaciada para flashcards |
| **Atomic Card Generator** | `utils/atomicCardGenerator.js` | Fragmentación automática de flashcards densas |

---

## ☁️ Infraestructura & DevOps

### Deploy & Hosting

| Servicio | Rol |
|---|---|
| **Render** | Hosting del backend Node.js (PaaS, deploy desde Git) |
| **Expo EAS Build** | Build nativo de la app (APK/IPA) en la nube |
| **Expo EAS Submit** | Publicación automática a Google Play y App Store |

### File Storage & CDN

| Servicio | Rol |
|---|---|
| **UploadThing** | CDN para fotos, documentos y audios subidos por el usuario |

### Version Control

| Servicio | Rol |
|---|---|
| **Git** | Control de versiones |
| **GitHub / repositorio remoto** | Hosting del repositorio y CI/CD con Render |

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

---

## 🧠 Arquitectura de Datos Offline

| Capa | Tecnología | Rol |
|---|---|---|
| **Caché rápido (MMKV)** | react-native-mmkv | Hidratación síncrona inmediata al arrancar la app |
| **Caché HTTP (AsyncStorage)** | @react-native-async-storage | Respuestas GET cacheadas con TTL de 10 minutos |
| **Cola offline (MMKV)** | offlineSyncService | FIFO queue de operaciones POST/PUT/DELETE pendientes |
| **BD local (SQLite)** | expo-sqlite | Datos estructurados on-device |
| **Resolución de IDs temporales** | offlineSyncService (idMap) | Mapeo de IDs temporales a reales al sincronizar |

---

## 🎨 Design System

| Elemento | Tecnología |
|---|---|
| **Fuentes** | System fonts + fuentes personalizadas via expo-font |
| **Iconografía** | Expo Vector Icons (Ionicons, MaterialCommunityIcons) + SF Symbols |
| **Animaciones** | Reanimated 4 + Lottie + Skia canvas |
| **Tema** | Sistema de tokens centralizado en `src/styles/theme.ts` |
| **Estilos** | StyleSheet de React Native + archivos `.styles.ts` por componente |

---

## 🔐 Seguridad

| Capa | Implementación |
|---|---|
| **Autenticación** | JWT Bearer Token con expiración |
| **Almacenamiento de tokens** | expo-secure-store (Keychain iOS / Keystore Android) |
| **Contraseñas** | bcrypt con salt rounds configurable |
| **IDOR Prevention** | Middleware `validateOwner.js` en todos los recursos |
| **Rate Limiting** | express-rate-limit en endpoints de auth |
| **Headers** | helmet (CSP, HSTS, X-Frame-Options, etc.) |
| **Validación** | zod en endpoints críticos del backend |
| **Biometría** | expo-local-authentication (Face ID / Touch ID) |

---

## 📊 Algoritmos Académicos

| Algoritmo | Implementación | Uso |
|---|---|---|
| **FSRS (Free Spaced Repetition Scheduler)** | `utils/sm2Algorithm.js` | Algoritmo principal de repetición espaciada |
| **SM-2** | `utils/sm2Algorithm.js` | Algoritmo legacy compatibilidad |
| **Academic Workflow Engine** | `services/academicWorkflowEngine.js` | Cálculo de promedios ponderados por categoría |
| **Atomic Card Generator** | `utils/atomicCardGenerator.js` | Fragmentación automática de tarjetas densas |
| **Grade Normalization** | `services/gradingEngine.js` | Normalización entre sistemas (0-5, 0-10, 0-100, letras) |

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
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # Capa de servicios (API, cache, offline)
│   │   │   ├── api/           # Módulos REST por dominio
│   │   │   ├── cacheService.ts
│   │   │   ├── offlineSyncService.ts
│   │   │   └── dataPreloader.ts
│   │   ├── store/             # Stores Zustand globales
│   │   ├── styles/            # Design tokens y estilos
│   │   ├── types/             # Tipos TypeScript globales
│   │   └── utils/             # Utilidades puras
│   └── modules/               # Módulos Expo nativos propios
│       └── threshold-pdf-extractor/  # Kotlin (Android)
│
├── backend/                   # API Server Node.js
│   ├── controllers/           # Lógica de negocio por dominio
│   ├── routes/                # Definición de endpoints Express
│   ├── middlewares/           # Auth, rate limit, validateOwner
│   ├── services/              # Motores académicos y de grading
│   ├── utils/                 # Algoritmos SM-2/FSRS, atomicCard
│   └── config/                # Configuración de secrets
│
└── analysis/                  # Documentación técnica
    ├── [[TECH_STACK]]          # Este documento
    ├── [[DATABASE_DOCUMENTATION]]
    ├── [[API_DOCUMENTATION]]
    ├── [[OFFLINE_ARCHITECTURE]]
    ├── [[LEARNING_ENGINEERING_DOCUMENTATION]]
    ├── [[FLASHCARDS_COMPLETE_DOCUMENTATION]]
    ├── [[AI_MODELS_AND_ZYREN_DOCUMENTATION]]
    ├── [[SECURITY]]
    └── ...

---

## 🔗 Enlaces Rápidos en tu Bóveda (Obsidian)

Explora a fondo la arquitectura y lógica del proyecto navegando por estos documentos interconectados:

- **Estructura y Datos:** [[DATABASE_DOCUMENTATION]] | [[API_DOCUMENTATION]]
- **Lógica Offline:** [[OFFLINE_ARCHITECTURE]]
- **Inteligencia y Algoritmos:** [[LEARNING_ENGINEERING_DOCUMENTATION]] | [[spaced_repetition_logic]] | [[PREDICTIONS_ANALYSIS]]
- **IA y Asistentes:** [[AI_MODELS_AND_ZYREN_DOCUMENTATION]] | [[ZYREN_BORN]]
- **Sistema de Flashcards:** [[FLASHCARDS_COMPLETE_DOCUMENTATION]] | [[FLASHCARD_IMPORT_SCHEMA]]
- **Seguridad:** [[SECURITY]] | [[SECURITY_REVIEW_2026-05-30]]
- **Interfaces:** [[INTERFACES_ANALYSIS]]


---
**Tags:** #architecture
