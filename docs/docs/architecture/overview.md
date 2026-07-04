# Arquitectura General

## Capas del Sistema

```
┌──────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                   │
│  Expo Router · Componentes · Hooks · Stores (Zustand)    │
├──────────────────────────────────────────────────────────┤
│                   CAPA DE SERVICIOS                       │
│  API Client · Sync Engine · Cache · Offline Queue        │
├──────────────────────────────────────────────────────────┤
│                   CAPA DE PERSISTENCIA                    │
│  SQLite (datos) · MMKV (caché/metadatos) · File System   │
├──────────────────────────────────────────────────────────┤
│                    CAPA DE RED                            │
│  HTTPS · JWT · Backend Detector · Competitive Race       │
├──────────────────────────────────────────────────────────┤
│                     CAPA BACKEND                          │
│  Express · Controllers · Middlewares · Sync Controller    │
│  AI Services · Academic Engine · Grading Engine          │
└──────────────────────────────────────────────────────────┘
```

## Flujo de Inicialización (Bootstrap)

```
Database → Storage → Network → Auth → Sync → Momentum → Ready
```

1. **Database**: Abrir SQLite, ejecutar migraciones
2. **Storage**: Inicializar MMKV
3. **Network**: `initializeApiClient()` — detecta backend con competitive race + AbortController (Render gana en ~307ms)
4. **Auth**: Restaurar JWT desde SecureStore
5. **Sync**: Ejecutar sync inicial o delta
6. **Momentum**: Calcular métricas de estudio
7. **Ready**: Emitir evento READY, `loadAllData()` del store

## Arquitectura Híbrida de Datos

| Capa | Tecnología | Rol |
|---|---|---|
| **Caché rápido** | MMKV | Hidratación síncrona inmediata al arrancar |
| **Caché HTTP** | AsyncStorage | Respuestas GET cacheadas con TTL |
| **Cola offline** | MMKV (offlineSyncService) | FIFO de operaciones pendientes |
| **BD local** | expo-sqlite | Datos estructurados on-device |
| **BD servidor** | SQLite / PostgreSQL | Fuente de verdad remota |

## Estrategia Offline

**Stale-while-revalidate**: El caché local nunca se elimina por TTL. Los datos expirados se sirven siempre para evitar pantallas en blanco. El store decide cuándo refrescar según conectividad.

## Backend Detector

El cliente detecta automáticamente el backend disponible usando **competitive race**:

1. `findAvailableBackendParallel()` lanza 7 checks simultáneos
2. El primer 200 gana (Render ~307ms vs LAN ~2338ms)
3. Los 7 checks perdedores se abortan sin logs
4. **Platform-aware**: `localhost` eliminado en Android; solo `10.0.2.2` (emulador) + LAN IP (físico) + Render

## Device Tier

Clasificación automática del dispositivo:

| Tier | RAM Total | Características |
|---|---|---|
| **high** | ≥ 6 GB | AI on-device habilitado |
| **medium** | ≥ 3 GB | AI on-device parcial |
| **low** | < 3 GB | Todo en cloud |

*Se usa RAM total (estable), no RAM disponible (fluctuante).*
