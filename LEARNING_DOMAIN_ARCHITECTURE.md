# Learning Domain Architecture

Este documento define las reglas arquitectónicas, autoridades, invariantes y responsabilidades del dominio de aprendizaje (Learning Domain) de la aplicación. Representa un patrón certificado de arquitectura **Local-First**, orientado a desacoplar completamente la lógica de negocio y cálculo del backend, asegurando rendimiento, offline-capability y robustez.

---

## 1. Principios

1. **Local-First Absoluto**: El dispositivo móvil es la única autoridad de cálculo. El backend es exclusivamente una capa de replicación, persistencia en la nube y sincronización.
2. **Determinismo**: Todas las funciones de cálculo matemático (como el algoritmo FSRS y proyecciones de tiempo) son puras. El mismo input siempre genera el mismo output. Cualquier dependencia externa (como la fecha actual) debe ser inyectada.
3. **Reactivismo por Eventos**: La UI nunca debe forzar recargas activas (`refresh()`). Todo cambio persistido se comunica mediante un Event Bus centralizado que actualiza reactivamente los stores (Zustand) y, subsecuentemente, la vista.
4. **Single Source of Truth**: Solo un punto en toda la arquitectura tiene el derecho de modificar el estado interno de aprendizaje de una entidad.

---

## 2. Flujo Completo (Review Cycle)

El flujo de un repaso (Flashcard Review) sigue un camino unidireccional estricto:

1. **UI**: El usuario responde a la tarjeta en React.
2. **FlashcardDomainService**: Actúa como orquestador del ciclo de vida.
3. **FSRS (Math)**: Funciones puras (`calculateElapsedDays`, `calculateFSRS`, `calculateNextReviewDate`) procesan el cálculo recibiendo dependencias (como `now = new Date()`).
4. **SQLite**: `BaseRepository` persiste el estado calculado.
5. **EventBus**: `RepositoryEventBus` intercepta la mutación en la tabla (`flashcards`) y emite un evento `batch_updated` con los IDs afectados.
6. **Store**: `useFlashcardsStore` escucha el evento, realiza un query O(1) solo de los mazos afectados, enriquece los contadores y actualiza Zustand.
7. **React**: La UI se re-renderiza con la nueva información reactiva.
8. **SyncQueue**: `FlashcardDomainService` encola la misma operación en segundo plano, la cual viajará asíncronamente al servidor sin bloquear al usuario.

---

## 3. Autoridades

| Elemento | Autoridad Única |
|----------|-----------------|
| `fsrs_stability` | `FlashcardDomainService` (Móvil) |
| `fsrs_difficulty` | `FlashcardDomainService` (Móvil) |
| `fsrs_repetitions` | `FlashcardDomainService` (Móvil) |
| `next_review_date` | `FlashcardDomainService` (Móvil) |
| `last_review_timestamp` | `FlashcardDomainService` (Móvil) |
| Actualización Local | `FlashcardRepository` (vía DomainService) |
| Actualización Remota | Cola de Sync (Replicador ciego) |

---

## 4. Invariantes

Estas son reglas estrictas de la arquitectura que **no pueden romperse nunca**:

1. **Autoridad Única de FSRS**: Solo `FlashcardDomainService` puede modificar metadatos FSRS. Está estrictamente prohibido que otro servicio, componente o hook intente sobrescribir los valores de retención.
2. **Funciones Puras**: `calculateFSRS` y sus helpers (`calculateElapsedDays`, `calculateNextReviewDate`) deben permanecer como funciones puras y deterministas, libres de estado o llamadas a I/O (BD, red).
3. **Dumb Backend**: El backend **nunca** recalcula lógica de repetición espaciada. Su única función es recibir los metadatos desde el dispositivo móvil y persistirlos.
4. **Mutación via Eventos**: Toda mutación persistente (SQLite) pasa por el repositorio, quien siempre emite un evento. Ninguna escritura directa en SQLite puede saltarse este canal.
5. **Prohibido Refresh UI**: La UI nunca fuerza recargas (`refresh()`, `loadDecks()`) para reflejar cambios tras una acción de modificación; responde exclusivamente a la propagación de eventos del dominio.
6. **Sincronización No Bloqueante**: La sincronización es siempre asíncrona (cola) y nunca bloquea ni detiene la interacción del usuario. El error de red no debe impedir que el usuario continúe su estudio.

---

## 5. Eventos y Re-Enriquecimiento Incremental

- El sistema utiliza `RepositoryEventBus` para notificar sobre `created`, `updated` o `deleted` en tablas específicas (ej. `flashcards`, `flashcard_decks`).
- Las mutaciones del Store deben ser **incrementales**. En lugar de realizar una re-lectura total de la base de datos (O(N)), el store intercepta el array de `entityId` afectados y re-enriquece **solamente los mazos implicados**, optimizando CPU, memoria y recargas de React.

---

## 6. Reglas de Sincronización

1. Toda mutación al modelo de memoria que se haga offline se anota en el Sync Journal (o tabla equivalente de encolamiento).
2. El encolamiento ocurre *después* de la escritura exitosa en SQLite, garantizando que el usuario siempre vea su progreso inmediato.
3. El payload enviado al servidor incluye la respuesta completa ya calculada (`next_review_date`, `fsrs_stability`, etc.).
4. Si la red no está disponible, el sistema reintenta periódicamente.

---

## 7. Responsabilidades de Cada Capa

- **React UI**: Presentación de datos y captura de interacciones (toques, swipes). Pasa la intención ("Respondió bien") pero no decide qué implica.
- **Store (Zustand)**: Mantiene el estado en memoria para un rendering rápido y escucha al `RepositoryEventBus` para mutaciones reactivas.
- **Domain Service (`FlashcardDomainService`)**: Orquestador principal. Traduce intenciones en cálculos, llama a las funciones matemáticas de FSRS y coordina la persistencia + encolamiento.
- **FSRS Core (`calculateFSRS`, etc.)**: Engine matemático. Pura matemática, matrices e intervalos.
- **Repository (`FlashcardRepository`)**: Puente tipado a SQLite. Responsable de despachar eventos post-escritura.
- **SyncQueue**: Pasarela de salida al backend.

---

## 8. Qué está Prohibido

- **NO** pasar objetos completos al Engine FSRS. Solo primitivas matemáticas.
- **NO** incluir dependencias de fecha (e.g. `new Date()`) dentro de la fórmula FSRS sin que sean inyectadas explícitamente desde el orquestador transaccional.
- **NO** utilizar `MMKV` u otro caché temporal para sobreescribir lógica de negocio; SQLite es la única fuente de verdad.
- **NO** colocar lógicas de recalculo de memoria espaciada en controladores de red (`Express / Node.js`).
- **NO** forzar la carga de datos con banderas como `skipCache: true` para simular reactividad.
