# Sistema de Reproducción de Medios

## Objetivo

Interceptar enlaces de cursos desde el dashboard, detectar si la plataforma es compatible con reproducción nativa in-app, cargar el progreso guardado y lanzar un reproductor flotante sin interrumpir la navegación.

## Componentes

### 1. MediaPlaybackService.ts (Orquestador Central)

**Ruta**: `mobile/src/services/media/MediaPlaybackService.ts`

Actúa como el "cerebro" del sistema. Sin interfaz gráfica.

- `handleUrl(url)`: Parsea enlaces externos e identifica el proveedor
- Retoma de progreso: consulta a la BD antes de reproducir
- Ruteo externo: deriva a app nativa o navegador según corresponda

### 2. mediaProgress.ts (Persistencia Rápida)

**Ruta**: `mobile/src/services/media/mediaProgress.ts`

Almacena progreso en MMKV para operaciones síncronas: `{ provider: 'youtube', mediaId: 'xyz', listId: 'abc', savedAt: 123 }`.

### 3. usePlayerStore.ts (Estado Global)

**Ruta**: `mobile/src/store/usePlayerStore.ts`

Store Zustand agnóstico a la plataforma:
- `provider`: 'youtube' | 'vimeo' | 'other'
- `mediaId`, `listId`, `courseId`
- `isPlaying`, `isVisible`

### 4. FloatingYouTubePlayer.tsx (UI Component)

Componente visual alojado en el layout principal. Solo se renderiza si `provider === 'youtube'`. Lee el estado del iframe periódicamente y actualiza el store.

### 5. linking.ts (Interceptor de URLs)

Delega a `MediaPlaybackService.handleUrl(url)`. Si responde `true`, detiene el flujo externo normal.

## Flujo de Ejecución

```
1. Usuario hace clic en link del curso en Dashboard
2. linking.ts → MediaPlaybackService.handleUrl(url)
3. Detecta YouTube (listId: 'PL123')
4. Revisa mediaProgress.ts para ese courseId
5. Si hay progreso → usaPlayerStore.playMedia(youtube, mediaId, PL123)
6. FloatingYouTubePlayer reacciona al store
```

## Cómo agregar una nueva plataforma

1. Actualizar tipo `MediaProvider` en tipados
2. Añadir parser en `MediaPlaybackService.handleUrl`
3. Crear `Floating{Provider}Player.tsx`
4. Renderizar en el Root Layout
5. La persistencia y store existentes funcionan automáticamente
