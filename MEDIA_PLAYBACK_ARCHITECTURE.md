# Arquitectura del Sistema de Reproducción de Medios (Course Platforms)

Este documento describe la arquitectura implementada en la aplicación móvil de Threshold para gestionar la reproducción de videos y contenidos multimedia provenientes de plataformas de cursos (ej. YouTube) directamente dentro de la aplicación (in-app playback / floating player).

## 🎯 Objetivo
Interceptar los enlaces de cursos desde el dashboard o cualquier otra sección, detectar si la plataforma es compatible con reproducción nativa in-app, cargar el progreso guardado del usuario (en qué video se quedó) y lanzar un reproductor flotante sin interrumpir la navegación.

---

## 🏗️ Componentes de la Arquitectura

El sistema está diseñado bajo el principio de Responsabilidad Única (SRP) usando un patrón de "Servicio Orquestador + Dumb UI Component".

### 1. `MediaPlaybackService.ts` (Orquestador Central)
**Ruta:** `mobile/src/services/media/MediaPlaybackService.ts`
Actúa como el "cerebro" del sistema. No tiene interfaz gráfica.
- **`handleUrl(url)`:** Parsea enlaces externos e identifica a qué proveedor (`provider`) pertenecen (YouTube, Vimeo, etc.).
- **Retoma de progreso:** Consulta a la base de datos si existe un progreso guardado para ese curso antes de reproducirlo.
- **Ruteo externo:** Maneja la lógica de `openExternally` para derivar al usuario a la app nativa (ej. la app de YouTube) o al navegador.

### 2. `mediaProgress.ts` (Persistencia Rápida)
**Ruta:** `mobile/src/services/media/mediaProgress.ts`
Gestiona el almacenamiento local usando `react-native-mmkv` para operaciones síncronas sin latencia.
- Almacena objetos tipo: `{ provider: 'youtube', mediaId: 'xyz', listId: 'abc', savedAt: 123 }`.
- Se indexa por `courseId`, garantizando que cada curso tenga su propio seguimiento independiente.

### 3. `usePlayerStore.ts` (Estado Global de UI)
**Ruta:** `mobile/src/store/usePlayerStore.ts`
Un store de Zustand agnóstico a la plataforma. No contiene lógica de negocio, solo variables reactivas.
- `provider`: 'youtube' | 'vimeo' | 'other'
- `mediaId`, `listId`, `courseId`
- `isPlaying`, `isVisible`

### 4. `FloatingYouTubePlayer.tsx` (Dumb Component Reactivo)
**Ruta:** `mobile/src/components/player/FloatingYouTubePlayer.tsx`
Componente visual alojado en el layout principal.
- Solo se renderiza si `provider === 'youtube'`.
- Ignora la persistencia y la lógica de ruteo; simplemente obedece al store.
- **Captura pasiva:** Periódicamente lee el estado del iframe (ej. cuando la lista de reproducción avanza sola) y llama a `MediaPlaybackService.onMediaChanged` para actualizar el store y la base de datos.

### 5. `linking.ts` (Interceptor de URLs)
**Ruta:** `mobile/src/utils/linking.ts`
Su única responsabilidad relacionada a medios es delegar: *"Recibí esta URL, ¿`MediaPlaybackService` puedes hacerte cargo?"*. Si el servicio responde `true`, detiene el flujo externo normal.

---

## 🔄 Flujos de Ejecución

### A. Apertura de un Curso (Link de Landing Page o Playlist)
1. Usuario hace clic en el link del curso en el Dashboard.
2. `linking.ts` llama a `MediaPlaybackService.handleUrl(url)`.
3. `MediaPlaybackService` parsea la URL y detecta que es un link de YouTube (`listId: 'PL123'`).
4. Revisa `mediaProgress.ts` para ese `courseId`.
5. Si hay progreso (ej. iba en el video 3: `mediaId: 'xyz'`), invoca `usePlayerStore.playMedia(youtube, xyz, PL123)`.
6. Si no hay progreso, invoca `usePlayerStore.playMedia(youtube, null, PL123)`.
7. `FloatingYouTubePlayer.tsx` reacciona al store, se hace visible e inicializa el iframe de YouTube.

### B. Seguimiento de Progreso Automático
1. El usuario está viendo la playlist. YouTube avanza automáticamente del video A al video B.
2. `FloatingYouTubePlayer` detecta el cambio de estado (`playing`).
3. El componente ejecuta `captureCurrentVideo()` leyendo la API del iframe.
4. Invoca `MediaPlaybackService.onMediaChanged(..., nuevoVideoB, ... )`.
5. El servicio actualiza el store y guarda en MMKV (`mediaProgress`).

---

## 🚀 Cómo agregar una nueva plataforma (Ej. Vimeo)

El sistema está diseñado para escalar sin romper componentes existentes. Si deseas integrar "Vimeo":

1. **Actualiza el tipado:** En `MediaPlaybackService.ts` y `usePlayerStore.ts`, añade `'vimeo'` al type `MediaProvider`.
2. **Añade el Parser:** En `MediaPlaybackService.ts`, crea un método `parseVimeoUrl(url)` y agrégalo a la secuencia de evaluación dentro de `handleUrl`.
3. **Crea el Player:** Crea un archivo `FloatingVimeoPlayer.tsx` (basado en el de YouTube).
4. **Agrega al Layout:** Renderiza `<FloatingVimeoPlayer />` en el Root Layout de la aplicación.
5. **Listo:** La misma persistencia (`mediaProgress`) y el mismo store (`usePlayerStore`) funcionarán mágicamente para Vimeo.
