# Performance Architecture v1.0

> Estado: **Activo**. Este documento define la arquitectura de rendimiento de Threshold.
> Fecha: Julio 2026

---

## 1. Por qué existe este documento

Threshold cruzó el umbral de "optimizaciones puntuales" a "necesitar una arquitectura de rendimiento".

En la sesión anterior se implementaron mejoras dispersas (useMemo aquí, useCallback allá, React.memo en otro sitio). Funcionaron, pero crearon deuda técnica: optimizaciones difíciles de mantener, inconsistencias entre pantallas, y un error crítico (`undefined is not a function`) que obligó a revertir.

**Lección aprendida**: El rendimiento no se "arregla". Se diseña. Igual que existe un SyncManager, un Reminder Engine o un Document Pipeline, debe existir una Performance Architecture con reglas, componentes y contratos claros.

---

## 2. Principios fundamentales

### Principio 1: Performance by Design

La optimización no se hace al final. Forma parte del diseño. Cada componente nuevo responde:

- **¿Quién es dueño de los datos?** (Store, no componente)
- **¿Quién calcula?** (Presenter, no JSX)
- **¿Quién cachea?** (Repository + CachePolicyManager, no hook ad-hoc)
- **¿Quién invalida?** (Evento explícito, no focus)
- **¿Quién renderiza?** (Componente memoizado, no padre)

### Principio 2: Datos inmutables

Los ViewModels son inmutables (`readonly`). No se reconstruyen continuamente. Cada build genera una nueva instancia. `Object.freeze()` en runtime cuando sea posible.

### Principio 3: Separación de responsabilidades

```
SQLite → Repository → Store → Presenter → ViewModel → Componente
```

La pantalla nunca calcula pesado. Solo renderiza.

### Principio 4: Medir antes de optimizar

Ninguna optimización entra sin una medición que la respalde. Sin métrica → sin cambio.

### Principio 5: Un cambio = un commit

Cada optimización es un commit atómico con mensaje claro. Nunca mezclar múltiples optimizaciones.

### Principio 6: El rendimiento es una propiedad emergente del sistema

No se optimiza un HeroCard. No se optimiza un useMemo. No se optimiza un FlatList.

Se optimiza el flujo completo:

```
SQLite → Repository → Cache → Store → Presenter → React → Navegación
```

Si una optimización mejora un componente pero empeora ese flujo, no es una buena optimización.

### Principio 7: Nunca abstraer APIs fundamentales de React

**No crear wrappers para**: `useMemo`, `useCallback`, `useEffect`, `useFocusEffect`, `React.memo`.

Esas APIs son estables, conocidas y bien documentadas. El problema que vivimos apareció precisamente cuando empezamos a introducir una capa adicional de abstracción. Cada capa nueva aumenta el riesgo de errores de importación, exportación o comportamiento inesperado.

**La arquitectura construye sobre React, no reemplaza partes de React.**

Los helpers que creamos son utilidades pequeñas y específicas, no reemplazos del comportamiento de React.

---

## 3. Estado actual — Auditoría completa (Julio 2026)

### 3.1 Problemas críticos encontrados

| # | Problema | Impacto | Ubicación |
|---|---------|---------|-----------|
| **C1** | Zustand store sin selectores individuales | Cualquier `set()` en el store re-renderiza todos los consumidores | `index.tsx:61`, `subjects.tsx:49` |
| **C2** | ViewModels reconstruidos dentro de `renderItem` | `React.memo` en HeroCards nunca actúa (nueva referencia siempre) | `index.tsx:788-866` |
| **C3** | SubjectTile no memoizado importado | Dashboard usa versión sin memo de `DashboardWidgets.tsx` en vez de `DashboardCards.tsx` | `DashboardWidgets.tsx:20` |
| **C4** | Carga masiva redundante en focus de Subjects | `loadAllData()` + `refreshCourses()` + 5 consultas SQLite en cada focus | `useSubjects.ts:121-135`, `subjects.tsx:52` |
| **C5** | CachePolicyManager construido pero no integrado | Políticas TTL/stale-while-revalidate definidas pero nunca consumidas | `CachePolicy.ts` |
| **C6** | Sin PerformanceMonitor global | Solo Reminder System tiene instrumentación | — |
| **C7** | SubjectHeroCard sin React.memo | Componente complejo se re-renderiza en cada actualización del padre | `SubjectHeroCard.tsx` |
| **C8** | KnowledgeHealthCard sin React.memo | Componente complejo sin protección de re-render | `KnowledgeHealthCard.tsx` |

### 3.2 Problemas medios

| # | Problema | Impacto | Ubicación |
|---|---------|---------|-----------|
| **M1** | Cadenas de enriquecimiento duplicadas | Dashboard y useSubjects calculan `enrichedSubjects` desde los mismos datos | `index.tsx:370`, `useSubjects.ts:200` |
| **M2** | `recentActivity` computación pesada | 11 fuentes de datos en un solo `useMemo` | `useSubjects.ts:252` |
| **M3** | `console.log` en producción | Logs ejecutándose en Release | `useSubjectGrades.ts:59,150-161` |
| **M4** | `console.trace` en loadAllData | Captura stack traces en cada carga | `useDataStore.ts:166` |
| **M5** | Duplicación de estado local/store | `profile`, `todaySchedules`, `overallGpa`, `userGroups` en store Y en useState | `index.tsx:62,122-125` |
| **M6** | 16x duplicación del carrusel | `carouselSubjects` crea 16 copias de todos los subjects | `index.tsx:439` |
| **M7** | Sin comparadores personalizados en React.memo | 17 usos con comparación shallow por defecto | Múltiples archivos |
| **M8** | `console.trace` y `console.log` en producción | Costo de performance en Release | `useDataStore.ts:166`, `useSubjectGrades.ts` |

### 3.3 Patrones positivos existentes

| # | Patrón | Dónde |
|---|--------|-------|
| **P1** | Presenter pattern (GlobalHeroPresenter, CourseHeroPresenter) | `presentation/heroes/` |
| **P2** | Cadenas `useMemo` bien estructuradas | `index.tsx:370-448`, `useSubjects.ts:143-260` |
| **P3** | RepositoryEventBus con batching (50ms) | `database/repositories/` |
| **P4** | `useKnowledgeInsights` debounce (300ms) | `hooks/useKnowledgeInsights.ts` |
| **P5** | `useProgressiveDataLoading` guard | `hooks/useProgressiveDataLoading.ts` |
| **P6** | `useNextClass` usa selectores individuales | `hooks/useNextClass.ts:14-15` |
| **P7** | CachePolicyManager con TTL/stale-while-revalidate | `services/cache/CachePolicy.ts` |
| **P8** | ViewModels `readonly` e inmutables | `types/heroViewModels.ts` |

---

## 4. Arquitectura

### 4.1 Diagrama de capas

```
┌─────────────────────────────────────────────────────────┐
│                    UI Components                         │
│  (React.memo selectivo + comparadores personalizados)    │
├─────────────────────────────────────────────────────────┤
│                     Hooks Layer                          │
│  useStableViewModel() · useStableCallback()             │
│  useStableArray() · selectores individuales              │
├─────────────────────────────────────────────────────────┤
│                   Presenter Layer                        │
│  (Clases puras: GlobalHeroPresenter, CourseHeroPresenter)│
│  Construyen ViewModels. Nunca renderizan.                │
├─────────────────────────────────────────────────────────┤
│                   Store Layer (Zustand)                  │
│  (Selectores individuales + derivación estable)          │
├─────────────────────────────────────────────────────────┤
│              Repository + Cache Layer                    │
│  RepositoryEventBus (batching 50ms)                      │
│  CachePolicyManager (TTL + stale-while-revalidate)      │
│  Invalidación explícita por evento                       │
├─────────────────────────────────────────────────────────┤
│                 Repository Layer (SQLite)                │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Flujo de datos correcto

```
Mount: SQLite → Repository → Store → Presenter → useStableViewModel() → Componente
Focus: Cache → Validate → (si expiró) → Background Refresh → Store → Componente
```

### 4.3 Ownership por capa

| Capa | Responsable | Propiedad |
|------|-------------|-----------|
| Repository | Obtener datos de SQLite/API | Fuente de verdad de persistencia |
| CachePolicyManager | Validez del caché (TTL, stale-while-revalidate) | Políticas de frescura |
| RepositoryEventBus | Invalidación de caché | Eventos de cambio |
| Store | Estado observable | Estado central |
| Presenter | Transformación dominio → ViewModel | Lógica de presentación pura |
| Component | Renderizado | Solo renderiza, no calcula |
| PerformanceDiagnostics | Medición | Observabilidad |

### 4.4 Flujo de invalidación de caché

Cuando un usuario modifica un dato, el flujo completo hasta la UI es:

```
AssessmentRepository.save()
    ↓
repositoryEventBus.emit('assessments')
    ↓
CachePolicyManager.invalidate('assessments.*')
    ↓
Store.refreshAssessments()  ← relee de SQLite
    ↓
Presenter.build()           ← reconstruye ViewModel
    ↓
React render()              ← actualiza UI
```

Cada capa tiene una única responsabilidad. Ninguna capa salta a otra.

### 4.5 Flujo de datos incorrecto (actual)

```
Focus: SQLite → Analytics → Refresh → Re-render → Múltiples renders
```

---

## 5. Presenters — El engine que ya existe

**No se crea un ViewModelEngine nuevo.** Los Presenters YA son el engine.

```
Presenter → useStableViewModel() → Componente
```

Nada más.

### Presenters existentes

| Presenter | Input | Output | Ubicación |
|-----------|-------|--------|-----------|
| `GlobalHeroPresenter` | subjects, courses, assessments | `GlobalHeroViewModel` | `presentation/heroes/GlobalHeroPresenter.ts` |
| `CourseHeroPresenter` | course, subjects | `CourseHeroViewModel` | `presentation/heroes/CourseHeroPresenter.ts` |

### Regla

Los Presenters construyen ViewModels. Los hooks los estabilizan. Los componentes los consumen.

Ningún componente ejecuta `presenter.build()` directamente. Siempre a través de `useStableViewModel()`.

```typescript
// ❌ ACTUAL — build() dentro de renderItem
const renderItem = ({ item }) => {
  const vm = presenter.build(item); // Nueva referencia cada render
  return <CourseHeroCard viewModel={vm} />;
};

// ✅ CORRECTO — build() en el hook, referencia estable
const heroViewModels = useMemo(() => 
  items.map(item => presenter.build(item)),
  [items]
);
return <CourseHeroCard viewModel={heroViewModels[index]} />;
```

---

## 6. Hooks de estabilización

Estos son helpers pequeños y específicos. **No son wrappers de React.** No reemplazan `useCallback`, `useMemo` ni `React.memo`. Son complementos para casos específicos.

### useStableViewModel()

Estabiliza la referencia de un ViewModel construido por un Presenter.

```typescript
function useStableViewModel<T>(
  builder: () => T,
  deps: DependencyList,
  comparator?: (prev: T, next: T) => boolean
): T {
  const prevRef = useRef<T>();
  
  return useMemo(() => {
    const next = builder();
    if (prevRef.current && comparator?.(prevRef.current, next)) {
      return prevRef.current;
    }
    prevRef.current = next;
    return next;
  }, deps);
}
```

**Uso**: Cuando un Presenter construye un ViewModel y necesitas que la referencia no cambie si los datos relevantes son idénticos.

### useStableCallback()

Mantiene un callback estable sin cambiar de referencia. **No reemplaza `useCallback`** — se usa para callbacks que necesitan acceso al valor más reciente sin agregarlo como dependencia.

```typescript
function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const ref = useRef(callback);
  ref.current = callback;
  return useCallback((...args) => ref.current(...args), []) as T;
}
```

**Uso**: Solo para callbacks que se pasan a componentes memoizados y necesitan acceso al último valor sin causar re-render.

### useStableArray()

Mantiene la referencia de un array estable cuando los elementos no cambiaron.

```typescript
function useStableArray<T>(
  items: T[],
  keyFn: (item: T) => string | number
): T[] {
  const prevRef = useRef<T[]>([]);
  
  return useMemo(() => {
    if (prevRef.current.length === items.length &&
        prevRef.current.every((p, i) => keyFn(p) === keyFn(items[i]))) {
      return prevRef.current;
    }
    prevRef.current = items;
    return items;
  }, [items]);
}
```

**Uso**: Para arrays que se reconstruyen pero contienen los mismos elementos (ej: `predictions?.cards ?? []` que crea nuevo array cada render).

---

## 7. Selectores Zustand — Regla obligatoria

### Problema actual

```typescript
// ❌ ACTUAL — destruye todo el store
const { subjects, courses, assessments, loadAllData, ...rest } = useDataStore();
// Cualquier set() re-renderiza este componente
```

### Solución

```typescript
// ✅ CORRECTO — selectores individuales
const subjects = useDataStore(s => s.subjects);
const courses = useDataStore(s => s.courses);
const loadAllData = useDataStore(s => s.loadAllData);
```

### Para selectores complejos

```typescript
// ✅ Selector con igualdad personalizada
const enrichedSubjects = useDataStore(
  s => s.subjects.map(sub => ({
    id: sub.id,
    name: sub.name,
    averageGrade: sub.averageGrade,
  })),
  shallowEqual
);
```

### Regla

Todo componente que consuma `useDataStore` debe usar selectores individuales. La única excepción es `loadAllData` y acciones que no causan re-render.

**No se crea un `useStableSelector`** — Zustand ya resuelve esto con su segundo parámetro de igualdad.

---

## 8. React.memo — Regla selectiva

**No todo componente merece memo.** `React.memo` tiene costo (comparación de props en cada render). Solo se aplica cuando el componente es un cuello de botella medido.

### Cuándo usar React.memo

| Condición | Acción |
|-----------|--------|
| Componente en lista (FlatList/SectionList) | Memoizar |
| Render > 2ms medido | Memoizar |
| Recibe props que cambian raramente | Memoizar |
| Componente hoja (sin hijos complejos) | Evaluar |

### Cuándo NO usar React.memo

| Condición | Acción |
|-----------|--------|
| Se renderiza una vez | No memoizar |
| Props cambian en cada render (inevitable) | No memoizar — resolver la causa |
| Componente ligero (< 1ms) | No memoizar |
| Modal que se abre/cierra | No memoizar |

### Siempre con comparador personalizado

Cuando se usa `React.memo`, siempre incluir un comparador para componentes de lista:

```typescript
const CourseHeroCard = React.memo(CourseHeroCardInner, (prev, next) => {
  return (
    prev.viewModel.progress.percentage === next.viewModel.progress.percentage &&
    prev.viewModel.knowledge.score === next.viewModel.knowledge.score &&
    prev.viewModel.momentum === next.viewModel.momentum &&
    prev.isActive === next.isActive
  );
});
```

---

## 9. Navigation Policy

**`Focus ≠ Lugar para cargar datos`.** Solo mount puede ejecutar trabajo pesado.

### Reglas por fase

| Fase | Permitido | Prohibido |
|------|-----------|-----------|
| **Mount** | preload, hydrate, loadAllData, buildCache | — |
| **Focus** | validate, refreshIfExpired, syncLightState | getAll, loadAllData, refreshCourses, analytics, build, aggregate |
| **Blur** | save, cleanup | network calls |
| **Unmount** | cleanup | — |

### Implementación

```typescript
// ✅ Dashboard — mount only
useEffect(() => {
  preloadRelatedData();
}, []); // Solo en mount

useFocusEffect(
  useCallback(() => {
    // Focus: solo validación ligera
    const cached = cacheEngine.get('dashboard');
    if (cached?.isStale) {
      backgroundRefresh();
    }
  }, [])
);

// ❌ Dashboard — focus carga pesada (ACTUAL)
useFocusEffect(
  useCallback(() => {
    preloadRelatedData(); // ¡Esto no debería estar aquí!
  }, [])
);
```

---

## 10. Caché — Integrar lo existente

**No se crea un CacheEngine nuevo.** Ya existen:
- `CachePolicyManager` — Define TTLs y stale-while-revalidate para 14 entidades
- `RepositoryEventBus` — Batching de 50ms para invalidación

### Qué se hace

Integrar el `CachePolicyManager` en la capa de carga de datos:

```
CachePolicyManager (políticas) → Repository (carga) → Store (estado)
         ↑                              ↑
    define TTL                   ejecuta carga
         │                              │
         └──── RepositoryEventBus ──────┘
              (invalidación por evento)
```

### Flujo

1. Hook necesita datos → consulta CacheEngine (Map en memoria)
2. Si fresh → usar caché, no cargar
3. Si stale → servir caché + background refresh
4. Si expirado → load synchronizado
5. Cuando Repository actualiza → RepositoryEventBus invalida caché

### Regla

Ningún hook tiene su propia caché ad-hoc. Todo pasa por el CachePolicyManager + RepositoryEventBus.

---

## 11. Performance Diagnostics — Middleware automático

**No se usan `measure()`, `trackRender()`, `trackQuery()` manuales.** Eso termina olvidándose.

Se construye un sistema de métricas automático que publica desde cada capa.

### Arquitectura

```
PerformanceMonitor (agrega métricas)
    ├── Repository metrics (auto: cada query)
    ├── Navigation metrics (auto: mount/focus/blur)
    ├── React metrics (auto: render tracking)
    └── Store metrics (auto: set() tracking)
```

### Qué mide automáticamente

| Capa | Métrica | Cómo |
|------|---------|------|
| Repository | Query duration, query count | `databaseService.getAllTracked()` (ya existe) |
| Navigation | Mount time, focus time, transition time | Middleware en `useFocusEffect` |
| React | Render count per component | `__DEV__` only render tracking |
| Store | Set frequency, subscriber count | Zustand middleware |

### Presupuestos de referencia por pantalla

| Métrica | Objetivo |
|---------|----------|
| Bootstrap completo | < 1 s |
| Dashboard mount | < 200 ms |
| Dashboard focus (skip) | < 5 ms |
| Subjects mount (primera vez) | < 3 s |
| Subjects focus (subsiguiente) | < 10 ms |
| KnowledgeSnapshot.build() | < 100 ms |
| HeroCard render | < 16 ms (60fps) |
| Consulta SQLite individual | < 50 ms |
| Transición entre tabs | < 100 ms |

### Presupuestos por operación crítica

| Operación | Presupuesto | Dónde se mide |
|-----------|-------------|---------------|
| SQLite query individual | < 50 ms | `databaseService.getAllTracked()` |
| Presenter.build() | < 10 ms | PerformanceDiagnostics |
| Hero ViewModel build | < 5 ms | PerformanceDiagnostics |
| Subject enrichment | < 100 ms | PerformanceDiagnostics |
| KnowledgeSnapshot build | < 100 ms | `useKnowledgeInsights` |
| React render (componente) | < 16 ms | React DevTools Profiler |
| Cache hit (lectura) | < 1 ms | CachePolicyManager |
| Store update (set) | < 5 ms | Zustand middleware |
| Navigation transition | < 100 ms | PerformanceDiagnostics |

Cuando una pantalla supera su presupuesto, se consulta esta tabla para localizar el cuello de botella.

### En Release

`PerformanceDiagnostics` se deshabilita completamente. Cero costo en producción.

---

## 12. Anti-patrones prohibidos

| Anti-patrón | Por qué | Alternativa |
|-------------|---------|-------------|
| `console.log` sin `__DEV__` | Costo en Release | Gate con `__DEV__` o eliminar |
| `console.trace` en producción | Captura de stack traces costosa | Solo en debug |
| Callback inline en JSX | Nueva referencia cada render | `useCallback` o `useStableCallback` |
| `React.memo` sin comparador | Shallow comparison insuficiente | Comparador personalizado |
| Carga en `focus` | Trabajo redundante | Solo en `mount` |
| Datos calculados en componente | Re-calculación en cada render | Presenter + `useStableViewModel` |
| Caché ad-hoc en hooks | Inconsistencia, bugs | CachePolicyManager + RepositoryEventBus |
| Selectores de store sin granularity | Re-renders excesivos | Selectores individuales |
| Wrapper de `useMemo`/`useCallback` | Rompe semántica de React | Usar APIs nativas directamente |
| `subjects.map()` dentro del JSX | Re-calculación en cada render | `useMemo` en el hook |
| `new Date()`, `Date.now()` en loops | GC pressure | Timestamps pre-calculados |
| `new Set()`, `new Map()`, `{}` en render | Nuevos objetos cada render | Pre-calculados en hook |

---

## 13. Performance Lint (ESLint)

Reglas detectables automáticamente:

```json
{
  "rules": {
    "no-console-without-dev": "error",
    "no-date-in-render": "error",
    "no-map-in-jsx": "warn",
    "no-object-creation-in-render": "warn",
    "no-inline-callback-jsx": "warn",
    "no-destructuring-full-store": "error"
  }
}
```

Esto evita errores humanos. El linter captura lo que el revisor puede olvidar.

---

## 14. Optimization Contract

Cada optimización debe responder:

| Campo | Descripción |
|-------|-------------|
| **Problema** | ¿Qué cuello de botella se resuelve? (con medición) |
| **Hipótesis** | ¿Por qué este cambio debería mejorar? |
| **Métrica** | ¿Cómo se mide la mejora? (antes/después) |
| **Cambio** | ¿Qué se modifica exactamente? |
| **Riesgo** | ¿Qué podría romperse? |
| **Rollback** | ¿Cómo se revierte? |

Si no puede responder esas preguntas, no entra al código.

### Ejemplo

| Campo | Valor |
|-------|-------|
| Problema | HeroCards se reconstruyen en cada render del FlatList |
| Hipótesis | Mover `presenter.build()` a `useMemo` estabiliza referencias |
| Métrica | Renders de CourseHeroCard: antes 15, después < 3 |
| Cambio | `index.tsx:788-866` — build en hook, no en renderItem |
| Riesgo | Bajo — solo cambia dónde se ejecuta el build |
| Rollback | `git revert` del commit |

---

## 15. Performance Lifecycle

El ciclo de vida completo de una optimización, desde la detección hasta la validación.

### 15.1 Flujo

```
Nueva pantalla / Componente detectado
    ↓
1. Baseline (Performance AUDIT.md)
    ↓
2. Auditoría (renders, queries, memoria, mount, focus)
    ↓
3. Optimization Contract (problema → hipótesis → métrica)
    ↓
4. Implementación (UN solo cambio)
    ↓
5. Debug (sin errores)
    ↓
6. Release APK (sin TypeError)
    ↓
7. Comparación de métricas (antes/después)
    ↓
8. Commit (si mejoró) o Rollback (si empeoró)
```

### 15.2 Reglas del lifecycle

| Fase | Regla |
|------|-------|
| Baseline | Obligatorio antes de cualquier cambio. Sin baseline, no se optimiza |
| Auditoría | Medir 7 dimensiones: renders, SQLite, memoria, mount, focus, transición, GC |
| Contract | Documentar antes de escribir código. Si no puede documentar, no hay cambio |
| Implementación | UN solo cambio por commit. Nunca mezclar optimizaciones |
| Debug | Pasar sin errores. Si falla, revertir inmediatamente |
| Release APK | Pasar sin TypeError. Si falla, revertir inmediatamente |
| Comparación | Métrica antes vs después. Si no mejoró, no se mergea |
| Commit | Mensaje claro con métrica: `perf(scope): description (Xms → Yms)` |

### 15.3 Criterio de merge

Un cambio de performance se mergea **solo si**:

- [ ] Pasó Debug sin errores
- [ ] Pasó Release APK sin TypeError
- [ ] La métrica objetivo mejoró
- [ ] No empeoró ninguna otra métrica
- [ ] El Optimization Contract está completo
- [ ] Se puede revertir con un solo `git revert`

---

## 16. Migración — Fase 1: Infraestructura

### 5.1 Hooks a crear

**Crear**: `mobile/src/services/performance/hooks/`

```
mobile/src/services/performance/
├── hooks/
│   ├── useStableCallback.ts
│   ├── useStableViewModel.ts
│   └── useStableArray.ts
├── comparators/
│   ├── heroComparators.ts
│   ├── subjectComparators.ts
│   └── index.ts
├── types.ts
└── index.ts
```

### 5.2 Integrar CachePolicyManager

**Modificar**: Hooks que cargan datos para consultar CachePolicyManager antes de ejecutar queries.

### 5.3 Selectores Zustand

**Migrar** consumers a selectores individuales:
- Dashboard (`index.tsx`)
- Subjects (`subjects.tsx`)
- TabLayout
- Todos los hooks que usen `useDataStore()`

### 5.4 Performance Diagnostics (middleware)

**Crear**: `mobile/src/services/performance/Diagnostics.ts`

- Middleware automático (no manual)
- Solo activo en `__DEV__`
- Presupuestos por pantalla

### 5.5 Medir baseline

Antes de cualquier cambio, medir:
- Renders por navegación
- Tiempo de mount/focus
- Consultas SQLite por ciclo
- FPS en transiciones

---

## 17. Migración — Fase 2: Dashboard

### 6.1 Correcciones urgentes

| Cambio | Archivo | Descripción |
|--------|---------|-------------|
| Selectores individuales | `index.tsx:61` | Reemplazar destructuring por selectores |
| ViewModels fuera de renderItem | `index.tsx:788-866` | Mover `presenter.build()` a `useMemo` |
| SubjectTile memoizado | `DashboardWidgets.tsx` | Importar desde `DashboardCards.tsx` o eliminar duplicado |
| Callbacks inline → useCallback | `index.tsx:686-698` | Estabilizar |
| Array vacío estable | `index.tsx:648` | Constante fuera del render |

### 6.2 Mejoras

| Cambio | Archivo | Descripción |
|--------|---------|-------------|
| React.memo + comparador | `KnowledgeHealthCard.tsx` | Solo si render > 2ms |
| React.memo + comparador | `DailyReviewCard.tsx` | Solo si render > 2ms |
| React.memo + comparador | `NextClassCard.tsx` | Solo si render > 2ms |
| Eliminar duplicación local | `index.tsx:62,122-125` | Eliminar `useState` que duplica store |
| Estabilizar carrusel | `index.tsx:439` | Referencia estable |

---

## 18. Migración — Fase 3: Subjects

### 7.1 Correcciones urgentes

| Cambio | Archivo | Descripción |
|--------|---------|-------------|
| Mover carga a mount | `useSubjects.ts:121-135` | Eliminar `loadAllData` + 5 queries del focus |
| Eliminar refreshCourses redundante | `subjects.tsx:52` | No ejecutar en cada focus |
| Integrar CachePolicyManager | `useSubjects.ts` | Usar caché en vez de carga ad-hoc |
| Selectores individuales | `subjects.tsx:49` | Reemplazar destructuring |

### 7.2 Mejoras

| Cambio | Archivo | Descripción |
|--------|---------|-------------|
| React.memo | `SubjectHeroCard.tsx` | Solo si render > 2ms |
| React.memo | `SubjectGridSection.tsx` | Solo si render > 2ms |
| Comparadores personalizados | Todos los Subject* | Campos relevantes |

---

## 19. Migración — Fase 4: Resto de pantallas

Cada pantalla sigue el mismo patrón:

1. **Auditar**: ¿Qué carga en focus? ¿Qué carga en mount?
2. **Mover**: Todo trabajo pesado a mount
3. **Selectores**: Migrar a selectores individuales
4. **Memoizar**: React.memo selectivo + comparadores
5. **ViewModels**: Mover `build()` fuera de JSX
6. **Medir**: Comparar métricas antes/después

**Pantallas a migrar** (en orden de prioridad):
1. Calendar (`calendar.tsx`)
2. Flashcards (`flashcards.tsx`)
3. Documents (`documents.tsx`)
4. Recordings (`recordings.tsx`)
5. Gallery (`gallery.tsx`)
6. Settings (`settings.tsx`)
7. Grades (`grades.tsx`)

---

## 20. Integración con sistemas existentes

### 9.1 CachePolicyManager (ya existente)

Define TTLs y stale-while-revalidate para 14 entidades. **Nunca fue integrado** en la capa de carga de datos.

**Plan de integración**:
1. Los hooks consultan al CachePolicyManager antes de cargar
2. Si los datos son fresh → usar caché del store
3. Si son stale → servir caché + background refresh
4. Si están expirados → load synchronizado
5. RepositoryEventBus invalida cuando hay cambios

### 9.2 RepositoryEventBus (ya existente)

Batching de 50ms. **Extenderlo** para invalidar caché del store:

```typescript
repositoryEventBus.on('subjects', () => {
  // Store invalida su caché internamente
  useDataStore.getState().refreshSubjects();
});
```

### 9.3 Presenters (ya existentes)

`GlobalHeroPresenter` y `CourseHeroPresenter` ya son clases puras. **Solo necesitan** ser consumidos por `useStableViewModel()` en vez de `renderItem`.

### 9.4 BootstrapManager (ya existente)

Separa fases bloqueantes (SQLite, MMKV) de fire-and-forget (Network, Auth, Sync). **Extenderlo** para incluir Phase de Performance:

```
DATABASE → STORAGE → PERFORMANCE_INIT → NETWORK → AUTH → SYNC → READY
```

`PERFORMANCE_INIT` precarga datos frescos de SQLite en el store.

---

## 21. Evitar otro "undefined is not a function"

### 10.1 Causa raíz

El error surgió de un commit que mezclaba múltiples optimizaciones sin validación Release. La combinación de cambios creó un estado intermedio donde una función era llamada como método pero existía como exportación default.

### 10.2 Prevención

| Regla | Implementación |
|-------|---------------|
| Un cambio = un commit | Commit convention estricta |
| Validación Debug + Release | Pipeline antes de cada commit |
| Performance Contract | Documentar qué cambia y por qué |
| Sin microoptimizaciones oportunistas | Solo optimizar lo medido |
| Tests de regresión | `npm run test:regression` antes de cada PR |
| Rollback inmediato | Si Release falla, revertir |
| No abstraer APIs de React | Usar useMemo, useCallback, React.memo directamente |

### 10.3 Checklist pre-commit

- [ ] ¿Este cambio modifica solo UN aspecto del rendimiento?
- [ ] ¿Pasó en Debug sin errores?
- [ ] ¿Pasó en Release APK sin TypeError?
- [ ] ¿Tiene métrica antes/después?
- [ ] ¿Está documentado en el Optimization Contract?
- [ ] ¿Se puede revertir con un solo `git revert`?

---

## 22. Métricas de éxito

### KPIs por fase

| Fase | KPI | Objetivo |
|------|-----|----------|
| Fase 1 (Infraestructura) | Hooks + integraciones creados | 3 hooks + CachePolicy integrado |
| Fase 2 (Dashboard) | Tiempo de focus | < 16 ms |
| Fase 2 (Dashboard) | Renders por navegación | < 3 |
| Fase 3 (Subjects) | Tiempo de focus | < 16 ms |
| Fase 3 (Subjects) | Consultas SQLite en focus | 0 |
| Fase 4 (Resto) | Consistencia entre pantallas | 100% usan patrones |
| General | TypeError en Release | 0 |
| General | Performance budget violations | 0 en 7 días |

---

## 23. Roadmap

### Fase 1 — Baseline e infraestructura (1-2 semanas)
- [ ] Crear `PERFORMANCE_ARCHITECTURE.md` (este documento)
- [ ] Crear hooks de estabilización (`useStableViewModel`, `useStableCallback`, `useStableArray`)
- [ ] Integrar CachePolicyManager en capa de carga
- [ ] Migrar selectores Zustand en Dashboard y Subjects
- [ ] Crear PerformanceDiagnostics (middleware automático)
- [ ] Medir baseline actual (renders, tiempos, queries)

### Fase 2 — Dashboard (1 semana)
- [ ] ViewModels fuera de renderItem
- [ ] SubjectTile memoizado (eliminar duplicado)
- [ ] Callbacks inline → useCallback
- [ ] React.memo selectivo + comparadores
- [ ] Eliminar duplicación de estado local
- [ ] Medir mejora

### Fase 3 — Subjects (1 semana)
- [ ] Mover carga pesada a mount
- [ ] Eliminar refreshCourses redundante
- [ ] Integrar CachePolicyManager
- [ ] Selectores individuales
- [ ] React.memo selectivo en Subject* components
- [ ] Medir mejora

### Fase 4 — Resto de pantallas (2 semanas)
- [ ] Calendar
- [ ] Flashcards
- [ ] Documents
- [ ] Recordings
- [ ] Gallery
- [ ] Settings
- [ ] Grades
- [ ] Validación Release final

### Fase 5 — Validación continua (permanente)
- [ ] PerformanceDiagnostics en Development
- [ ] Performance Lint rules (ESLint)
- [ ] Regression tests de performance
- [ ] Optimization Contract para cada cambio
- [ ] PERFORMANCE_AUDIT.md por pantalla

---

## 24. Comparación con apps de referencia

| App | Estrategia de rendimiento | Threshold equivalent |
|-----|--------------------------|---------------------|
| **Notion** | Virtualización agresiva + caché en memoria | FlatList + CachePolicyManager |
| **Instagram** | Render first, sync after | Mount → render → background refresh |
| **Spotify** | Caché local + stale-while-revalidate | CachePolicyManager (ya existe) |
| **YouTube** | Precomputación de ViewModels | Presenter + useStableViewModel |
| **Linear** | Selectores Zustand granulares | Selectores individuales |
| **Figma** | Memoización selectiva | React.memo selectivo + comparadores |

---

## 25. Glosario

| Término | Definición |
|---------|-----------|
| **ViewModel** | Objeto readonly que contiene solo los datos necesarios para renderizar un componente |
| **Presenter** | Clase pura que transforma datos de dominio en ViewModels |
| **CachePolicyManager** | Sistema existente de caché con TTL y stale-while-revalidate |
| **RepositoryEventBus** | Sistema existente de eventos con batching para invalidación |
| **NavigationPolicy** | Reglas que definen qué operaciones están permitidas en cada fase de navegación |
| **Optimization Contract** | Documento que describe qué resuelve una optimización, cómo se mide y cómo se revierte |
| **Performance Budget** | Tiempo máximo permitido para una operación específica |
| **Stable Reference** | Referencia de objeto que no cambia entre renders si los datos son idénticos |
| **Selector** | Función que extrae un dato específico del store Zustand |
| **Comparador personalizado** | Función que determina si un `React.memo` debe re-renderizar |

---

> **Regla de gobierno**: No implementar una funcionalidad de rendimiento mientras exista un componente sin validar en Release. La confianza en el sistema se construye con mediciones, no con suposiciones.
