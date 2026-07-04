# Threshold

**Threshold** es una aplicación full-stack **offline-first** diseñada para estudiantes universitarios que buscan organizar, estudiar y rendir mejor académicamente. Combina un sistema de flashcards con repetición espaciada (SM-2 + FSRS), gestión académica integral (materias, evaluaciones, horarios), y un asistente IA (Zyren) para generar material de estudio automáticamente.

## Filosofía

> *"Si no puedes observar una sincronización, no puedes confiar en ella."*

Toda operación de lectura y escritura académica está diseñada para funcionar **sin conexión** y sincronizar automáticamente al recuperar red. El motor de sincronización (Sync Engine v1.0) garantiza convergencia entre dispositivos mediante versionado estricto (`sync_version`/`deletion_version`).

## Características Clave

| Funcionalidad | Descripción |
|--------------|-------------|
| **Offline-first** | Toda operación funciona sin internet. Sincronización automática al recuperar red |
| **Sync Engine v1.0** | Protocolo de sincronización con versionado, reducer, detección de conflictos y garantías de convergencia |
| **Repetición Espaciada** | Algoritmos SM-2 y FSRS para maximizar retención de conocimiento |
| **Zyren AI** | Asistente inteligente que genera flashcards, resume apuntes, transcribe audios y responde dudas |
| **Gestión Académica** | Materias, evaluaciones, horarios, cálculo de GPA y proyección de notas |
| **Assets Pipeline** | Fotos, grabaciones de audio, documentos escaneados y videos de YouTube con OCR/transcripción |
| **Multiplataforma** | Android (principal), iOS, Web (experimental) |

## Stack Tecnológico

```
┌─────────────────────────────────────────────────┐
│           MOBILE (React Native / Expo)          │
│  Expo Router · Zustand · MMKV · SQLite · Skia   │
├─────────────────────────────────────────────────┤
│           BACKEND (Node.js / Express)           │
│    SQLite · JWT · Groq AI · Gemini AI · Swagger │
├─────────────────────────────────────────────────┤
│           INFRAESTRUCTURA                       │
│    Render · UploadThing · EAS Build · GitHub    │
└─────────────────────────────────────────────────┘
```

## Principios Arquitectónicos

1. **SQLite como única fuente de verdad** para datos de negocio. MMKV reservado para JWT, tokens, flags, configuración y metadatos.
2. **No refactorizar código estable** sin ganancia funcional clara — excepto bugs confirmados por el test framework.
3. **UI no importa directamente de services/api** — lo hace vía DataStore, Repositories o Queries.
4. **Toda entidad sincronizable** debe cumplir 10 invariantes del protocolo (sync_version, user_id, initial/delta/pull/push, etc).

## Documentos Relacionados

- [Tech Stack](tech-stack.md) — Stack tecnológico detallado
- [Sync Protocol v1.0](sync-protocol.md) — Protocolo de sincronización
- [API Reference](api-reference.md) — Referencia de la API REST
- [Feature Matrix](feature-matrix.md) — Matriz de funcionalidades
