# Boot Presentation Cache — Patrón Oficial del Dashboard

## Propósito

El **Boot Presentation Cache (BPC)** es un patrón arquitectónico que resuelve la latencia percibida en el arranque de componentes del Dashboard que dependen de SQLite o cómputo intensivo.

**Objetivo:** la UI muestra datos conocidos del último uso desde el frame 0, sin esperar a que el sistema operativo de datos termine de inicializarse.

---

## Principios

| Principio | Descripción |
|---|---|
| **SQLite = fuente de verdad** | Ninguna decisión de negocio depende del BPC. |
| **MMKV = presentación de arranque** | El BPC acelera el primer render. Nada más. |
| **El store nace hidratado** | Los componentes nunca conocen MMKV. Consumen Zustand. |
| **Hidratación ≠ validación de TTL** | El BPC siempre hidrata si el payload es válido. El refresco de fondo decide cuándo invalidar. |
| **Un solo punto de lectura** | `loadXFromCache()` se llama **una vez** por sesión, en el constructor del store. |

---

## Flujo canónico

```
App boot
    │
    ▼
useDataStore.create()
    │
    ├─── MMKV.getString(key)          ← síncrono, ~0ms
    │         │
    │    validar { schemaVersion, userId }
    │         │
    │    set({ data, source: 'cache' })
    │
    ▼
UI renderiza con datos del caché anterior (frame 0)
    │
    ▼
DashboardCoordinator.start()
    │
    ▼
SQLite recalcula (background)
    │
    ▼
set({ data: fresh, source: 'fresh' })
    │
    ▼
UI se actualiza silenciosamente
```

---

## Contrato del Payload

Todo Boot Presentation Cache **debe** serializar exactamente estos campos:

```typescript
interface BootCachePayload<T> {
  schemaVersion: number;  // Incrementar cuando cambie la forma del payload
  generatedAt: number;    // Date.now() — para debugging, no para invalidación en UI
  userId: string;         // Protección contra sesiones cruzadas
  data: T;                // El dato de dominio
}
```

### Reglas de invalidación al leer

```typescript
if (
  payload.schemaVersion !== CURRENT_SCHEMA_VERSION ||
  payload.userId !== currentUserId ||
  !payload.data
) {
  return null; // no hidratar
}
// en todos los demás casos: hidratar sin importar la edad del dato
```

---

## Estado de origen (`source`)

Los componentes distinguen el origen de los datos para evitar mostrar afirmaciones incorrectas sobre estado vacío.

| `source` | Significado |
|---|---|
| `'none'` | Sin caché disponible. Mostrar skeleton neutro. |
| `'cache'` | Dato de arranque. Puede estar desactualizado. No afirmar estado vacío como definitivo. |
| `'fresh'` | Dato calculado por SQLite en esta sesión. Puede afirmarse como correcto. |

### Regla de oro

> **"¡Todo al día!" (o cualquier afirmación de estado vacío) solo aparece cuando `source === 'fresh'`.**

---

## Implementaciones actuales

| Componente | Cache Key | Schema | Source field |
|---|---|---|---|
| `KnowledgeHealthCard` | `knowledge_snapshot_v1_{userId}` | `KNOWLEDGE_SCHEMA_VERSION = 1` | `knowledgeLoading` (implícito) |
| `DailyReviewCard` | `predictions_cache_v1` | `PREDICTIONS_SCHEMA_VERSION = 1` | `predictionsSource` |

---

## Cómo agregar una nueva implementación

1. **Define el payload** con `schemaVersion`, `generatedAt`, `userId` y tu dato.
2. **Escribe `load` y `save`** en el archivo del hook/servicio correspondiente. Ambos son síncronos (MMKV).
3. **Hidrata en el store**, en `create()`, después de resolver el `userId` del `userRepository`.
4. **Agrega un campo `source`** al estado del store: `'none' | 'cache' | 'fresh'`.
5. **Actualiza el componente** para distinguir los tres estados.
6. **Actualiza esta tabla** con la nueva implementación.

---

## Lo que NO debe hacer el BPC

- ❌ Tomar decisiones de negocio basadas en datos del caché.
- ❌ Reemplazar datos frescos con datos del caché.
- ❌ Usarse fuera del arranque (para eso existe el estado de Zustand).
- ❌ Crecer el payload con datos que no son necesarios para el primer render.
- ❌ Ser leído desde componentes — siempre vía Zustand.
