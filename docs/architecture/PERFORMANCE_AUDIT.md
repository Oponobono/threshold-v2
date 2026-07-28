# Performance Audit — Threshold

> Estado: **Activo**. Auditoría de rendimiento por pantalla.
> Fecha: Julio 2026
> Regla: Sin checklist, no se optimiza.

---

## Checklist pre-auditoría

Antes de tocar cualquier pantalla:

- [ ] Medir renders (React DevTools Profiler)
- [ ] Medir SQLite queries (`getAllTracked` logs)
- [ ] Medir memoria (Android Profiler)
- [ ] Medir mount time (PerformanceDiagnostics)
- [ ] Medir focus time (PerformanceDiagnostics)
- [ ] Medir transición entre tabs
- [ ] Medir GC (Android Profiler)
- [ ] Documentar baseline en esta tabla

---

## Dashboard (`app/(tabs)/index.tsx`)

### Baseline

| Métrica | Valor | Objetivo | Estado |
|---------|-------|----------|--------|
| Mount time | — ms | < 200 ms | ⬜ |
| Focus time | — ms | < 5 ms | ⬜ |
| Renders por navegación | — | < 3 | ⬜ |
| SQLite queries en mount | — | < 7 | ⬜ |
| SQLite queries en focus | 0 | 0 | ⬜ |
| HeroCard render time | — ms | < 16 ms | ⬜ |
| FPS en scroll | — | 60 | ⬜ |
| Memoria baseline | — MB | — | ⬜ |

### Problemas encontrados

| # | Problema | Ubicación | Impacto | Estado |
|---|---------|-----------|---------|--------|
| D1 | Store destructurado completo | `index.tsx:61` | Crítico | ⬜ |
| D2 | ViewModels en renderItem | `index.tsx:788-866` | Crítico | ⬜ |
| D3 | SubjectTile no memoizado | `DashboardWidgets.tsx:20` | Alto | ⬜ |
| D4 | Callbacks inline en JSX | `index.tsx:686-698` | Medio | ⬜ |
| D5 | Array vacío inestable | `index.tsx:648` | Medio | ⬜ |
| D6 | Duplicación estado local/store | `index.tsx:62,122-125` | Medio | ⬜ |
| D7 | 16x carrusel | `index.tsx:439` | Bajo | ⬜ |

### Optimizaciones aplicadas

| Cambio | Métrica antes | Métrica después | Commit |
|--------|--------------|----------------|--------|
| — | — | — | — |

---

## Subjects (`app/(tabs)/subjects.tsx`)

### Baseline

| Métrica | Valor | Objetivo | Estado |
|---------|-------|----------|--------|
| Mount time (primera) | — ms | < 3 s | ⬜ |
| Mount time (subsiguiente) | — ms | < 100 ms | ⬜ |
| Focus time | — ms | < 10 ms | ⬜ |
| SQLite queries en mount | — | < 6 | ⬜ |
| SQLite queries en focus | — | 0 | ⬜ |
| FPS en scroll | — | 60 | ⬜ |
| Memoria baseline | — MB | — | ⬜ |

### Problemas encontrados

| # | Problema | Ubicación | Impacto | Estado |
|---|---------|-----------|---------|--------|
| S1 | loadAllData en focus | `useSubjects.ts:121-135` | Crítico | ⬜ |
| S2 | refreshCourses redundante | `subjects.tsx:52` | Crítico | ⬜ |
| S3 | 5 queries SQLite en focus | `useSubjects.ts:129-135` | Alto | ⬜ |
| S4 | Store destructurado completo | `subjects.tsx:49` | Alto | ⬜ |
| S5 | recentActivity computación pesada | `useSubjects.ts:252` | Medio | ⬜ |

### Optimizaciones aplicadas

| Cambio | Métrica antes | Métrica después | Commit |
|--------|--------------|----------------|--------|
| — | — | — | — |

---

## Calendar (`app/(tabs)/calendar.tsx`)

### Baseline

| Métrica | Valor | Objetivo | Estado |
|---------|-------|----------|--------|
| Mount time | — ms | < 450 ms | ⬜ |
| Focus time | — ms | < 16 ms | ⬜ |
| SQLite queries en mount | — | < 3 | ⬜ |
| SQLite queries en focus | — | 0 | ⬜ |
| FPS en scroll | — | 60 | ⬜ |

### Problemas encontrados

| # | Problema | Ubicación | Impacto | Estado |
|---|---------|-----------|---------|--------|
| — | — | — | — | — |

### Optimizaciones aplicadas

| Cambio | Métrica antes | Métrica después | Commit |
|--------|--------------|----------------|--------|
| — | — | — | — |

---

## Flashcards (`app/(tabs)/flashcards.tsx`)

### Baseline

| Métrica | Valor | Objetivo | Estado |
|---------|-------|----------|--------|
| Mount time | — ms | < 500 ms | ⬜ |
| Focus time | — ms | < 16 ms | ⬜ |
| SQLite queries en mount | — | < 4 | ⬜ |
| SQLite queries en focus | — | 0 | ⬜ |

### Problemas encontrados

| # | Problema | Ubicación | Impacto | Estado |
|---|---------|-----------|---------|--------|
| — | — | — | — | — |

### Optimizaciones aplicadas

| Cambio | Métrica antes | Métrica después | Commit |
|--------|--------------|----------------|--------|
| — | — | — | — |

---

## Documents (`app/(tabs)/documents.tsx`)

### Baseline

| Métrica | Valor | Objetivo | Estado |
|---------|-------|----------|--------|
| Mount time | — ms | < 500 ms | ⬜ |
| Focus time | — ms | < 16 ms | ⬜ |

### Problemas encontrados

| # | Problema | Ubicación | Impacto | Estado |
|---|---------|-----------|---------|--------|
| — | — | — | — | — |

### Optimizaciones aplicadas

| Cambio | Métrica antes | Métrica después | Commit |
|--------|--------------|----------------|--------|
| — | — | — | — |

---

## Recordings (`app/(tabs)/recordings.tsx`)

### Baseline

| Métrica | Valor | Objetivo | Estado |
|---------|-------|----------|--------|
| Mount time | — ms | < 500 ms | ⬜ |
| Focus time | — ms | < 16 ms | ⬜ |

### Problemas encontrados

| # | Problema | Ubicación | Impacto | Estado |
|---|---------|-----------|---------|--------|
| — | — | — | — | — |

### Optimizaciones aplicadas

| Cambio | Métrica antes | Métrica después | Commit |
|--------|--------------|----------------|--------|
| — | — | — | — |

---

## Gallery (`app/(tabs)/gallery.tsx`)

### Baseline

| Métrica | Valor | Objetivo | Estado |
|---------|-------|----------|--------|
| Mount time | — ms | < 500 ms | ⬜ |
| Focus time | — ms | < 16 ms | ⬜ |

### Problemas encontrados

| # | Problema | Ubicación | Impacto | Estado |
|---|---------|-----------|---------|--------|
| — | — | — | — | — |

### Optimizaciones aplicadas

| Cambio | Métrica antes | Métrica después | Commit |
|--------|--------------|----------------|--------|
| — | — | — | — |

---

## Settings (`app/(tabs)/settings.tsx`)

### Baseline

| Métrica | Valor | Objetivo | Estado |
|---------|-------|----------|--------|
| Mount time | — ms | < 300 ms | ⬜ |
| Focus time | — ms | < 16 ms | ⬜ |

### Problemas encontrados

| # | Problema | Ubicación | Impacto | Estado |
|---|---------|-----------|---------|--------|
| — | — | — | — | — |

### Optimizaciones aplicadas

| Cambio | Métrica antes | Métrica después | Commit |
|--------|--------------|----------------|--------|
| — | — | — | — |

---

## Grades (`app/(tabs)/grades.tsx`)

### Baseline

| Métrica | Valor | Objetivo | Estado |
|---------|-------|----------|--------|
| Mount time | — ms | < 400 ms | ⬜ |
| Focus time | — ms | < 16 ms | ⬜ |

### Problemas encontrados

| # | Problema | Ubicación | Impacto | Estado |
|---|---------|-----------|---------|--------|
| — | — | — | — | — |

### Optimizaciones aplicadas

| Cambio | Métrica antes | Métrica después | Commit |
|--------|--------------|----------------|--------|
| — | — | — | — |

---

## Resumen global

| Pantalla | Mount | Focus | Queries focus | Memoria | Estado |
|----------|-------|-------|---------------|---------|--------|
| Dashboard | — | — | — | — | ⬜ |
| Subjects | — | — | — | — | ⬜ |
| Calendar | — | — | — | — | ⬜ |
| Flashcards | — | — | — | — | ⬜ |
| Documents | — | — | — | — | ⬜ |
| Recordings | — | — | — | — | ⬜ |
| Gallery | — | — | — | — | ⬜ |
| Settings | — | — | — | — | ⬜ |
| Grades | — | — | — | — | ⬜ |

---

## Regla de gobierno

> Sin baseline medido, no se optimiza. Sin métrica antes/después, no se commitea.
