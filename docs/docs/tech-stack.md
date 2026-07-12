# Tech Stack

> Actualizado: Julio 2026

## Arquitectura General

Threshold es una aplicación fullstack offline-first con tres capas principales.

## Frontend — Mobile App

| Tecnología | Versión | Rol |
|---|---|---|
| **React Native** | 0.81.5 | Framework base |
| **React** | 19.1.0 | UI Library |
| **Expo** | ~54.0.33 | SDK y build system |
| **Expo Router** | ~6.0.23 | File-based routing |
| **TypeScript** | ~5.9.2 | Tipado estático |
| **New Architecture** | enabled | JSI, Nitro Modules, Fabric |
| **Hermes** | (nativo RN 0.81) | Motor JS compilado a bytecode |

### State Management & Storage

| Tecnología | Versión | Rol |
|---|---|---|
| **Zustand** | ^5.0.13 | Estado global reactivo |
| **react-native-mmkv** | ^4.3.1 | Caché persistente C++ ultrarrápido |
| **AsyncStorage** | 2.2.0 | Almacenamiento legacy |
| **Expo Secure Store** | ~15.0.8 | Almacenamiento seguro de JWT |
| **Expo SQLite** | ~16.0.10 | Base de datos relacional local |

### Navigation & UI

| Tecnología | Versión | Rol |
|---|---|---|
| **React Navigation** | ^7.1.8 | Stack y tab navigation |
| **Reanimated** | ~4.1.1 | Animaciones de alta performance |
| **Gesture Handler** | ~2.28.0 | Gestos nativos |
| **Lottie** | ~7.3.1 | Animaciones JSON |
| **Skia** | 2.2.12 | Canvas 2D |
| **Victory Native** | ^36.9.2 | Gráficas |
| **expo-linear-gradient** | ~15.0.8 | Gradientes |
| **Safe Area Context** | ~5.6.0 | Safe areas |
| **Screens** | ~4.16.0 | Optimización de pantallas |
| **SVG** | 15.12.1 | Vectores SVG |
| **Chart Kit** | ^6.12.0 | Gráficas adicionales |

### Media & Camera

| Tecnología | Versión | Rol |
|---|---|---|
| **Expo Camera** | ~17.0.10 | Cámara nativa |
| **Expo Image Picker** | ~17.0.10 | Selección de imágenes |
| **Expo Image** | ~3.0.11 | Imagen optimizada con caché |
| **Expo AV** | ~16.0.8 | Reproducción/grabación audio/video |
| **Image Manipulator** | ~14.0.8 | Transformación de imágenes |
| **Media Library** | ~18.2.1 | Acceso a galería del dispositivo |
| **Document Scanner Plugin** | ^2.0.4 | Escáner de documentos |
| **YouTube Iframe** | ^2.4.1 | Reproductor YouTube embebido |

### AI On-Device

| Tecnología | Rol |
|---|---|
| **llama.rn** | Inferencia local LLM (Zyren offline) |
| **whisper.rn** | Transcripción de audio offline |
| **@react-native-ml-kit/text-recognition** | OCR local |

## Backend — API Server

| Tecnología | Versión | Rol |
|---|---|---|
| **Node.js** | v24.x | Runtime |
| **Express** | ^5.2.1 | Framework HTTP |
| **SQLite** (sqlite3) | ^6.0.1 | Base de datos principal |
| **PostgreSQL** (pg) | ^8.20.0 | BD alternativa futura |
| **jsonwebtoken** | ^9.0.3 | JWT |
| **bcrypt** | ^6.0.0 | Hashing de contraseñas |
| **zod** | ^4.4.3 | Validación de esquemas |
| **swagger-jsdoc** | ^6.2.8 | Documentación OpenAPI |
| **swagger-ui-express** | ^5.0.1 | Swagger UI en `/api-docs` |

### AI Cloud

| Modelo | Proveedor | Uso |
|---|---|---|
| llama-3.3-70b-versatile | Groq | Generación flashcards, chat (principal) |
| llama-3.1-8b-instant | Groq | Fallback rápido |
| llama-3.2-11b-vision-preview | Groq | OCR de imágenes |
| gemini-pro | Google | Contexto avanzado |

## Infraestructura

| Servicio | Rol |
|---|---|---|
| **Render** | Hosting backend Node.js |
| **Expo EAS Build** | Build nativo APK/IPA |
| **UploadThing** | CDN para archivos |
| **Docusaurus** | Sitio de documentación técnica |
| **Swagger** | Documentación interactiva API REST |

## Estructura del Monorepo

```
Threshold/
├── mobile/                    # App React Native / Expo
│   ├── app/                   # Rutas (Expo Router)
│   ├── src/
│   │   ├── components/        # Componentes UI
│   │   ├── hooks/             # Custom hooks
│   │   ├── services/          # API, cache, offline, sync
│   │   │   ├── api/           # Módulos REST por dominio
│   │   │   ├── sync/          # Sync Engine
│   │   │   ├── database/      # SQLite, repos, migraciones
│   │   │   └── media/         # Media playback
│   │   ├── store/             # Stores Zustand
│   │   ├── styles/            # Design tokens
│   │   ├── types/             # Tipos TypeScript
│   │   └── utils/             # Utilidades
│   └── modules/               # Módulos nativos propios
│
├── backend/                   # API Server Node.js
│   ├── controllers/           # Lógica de negocio
│   ├── routes/                # Endpoints Express
│   ├── middlewares/            # Auth, rate limit, validateOwner
│   ├── services/              # Motores académicos
│   ├── utils/                 # SM-2/FSRS, atomicCard
│   └── tests/                 # Stress + Convergence Suites
│       ├── convergence/       # Test de convergencia
│       └── stress/            # Stress test
│
├── analysis/                  # Documentación técnica
├── scripts/                   # Scripts auxiliares
├── docs/                      # Docusaurus (este sitio)
├── FEATURE_MATRIX.md
├── SYNC_PROTOCOL.md
├── MUTATION_MATRIX.md
└── OWNERSHIP_MATRIX.md
```

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
