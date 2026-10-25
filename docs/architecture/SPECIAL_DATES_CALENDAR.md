# Calendario de fechas especiales — catálogo y política de presentación

Contrato del subsistema que resuelve las efemérides del calendario y decide qué
ítem encabeza cada día. Documenta la estructura modular del catálogo, la política
de presentación y las decisiones de producto que esa política materializa.

---

## 1. Alcance

**Cubre**

- Festivos oficiales de Colombia y sus anclas litúrgicas.
- Efemérides del catálogo: internacionales, de salud, nacionales colombianas y
  religiosas.
- El orden de presentación de esos ítems dentro de un mismo día.

**No cubre**

- Eventos personales del usuario (`calendar_events`): no participan de esta
  jerarquía. El calendario ordena efemérides del catálogo; un evento personal
  nunca compite por el titular del día.
- Recordatorios y notificaciones como sistema: el calendario aporta el
  contenido; el agendamiento pertenece al Reminder System
  (`docs/architecture/REMINDER_SYSTEM_V1_CONTRACT.md`).
- Clasificación editorial del catálogo: `category`, `basis`, `status` y
  `authority` son contrato de datos, no de presentación. Este documento no
  autoriza cambiar una categoría para alterar un titular.

---

## 2. Estructura del módulo

```
mobile/src/domain/calendar/
├── colombiaCommemorations.ts          # fachada pública (6 exportaciones)
├── colombiaHolidays.ts                # festivos oficiales + ancla de trasladados
├── specialDatesEngine.ts              # agrupa por día y ordena con la política
├── types.ts                           # contratos (DateRule, SpecialDateItem, ...)
└── commemorations/
    ├── index.ts                       # ÚNICO punto de composición
    ├── catalog/
    │   ├── international.ts           # 141 definiciones
    │   ├── health.ts                  #  39 definiciones
    │   ├── colombia.ts                #  38 definiciones
    │   └── religious.ts               #  18 definiciones
    └── engine/
        ├── calendarRules.ts           # reglas de fecha (nth/last weekday, bisiesto)
        ├── resolver.ts                # definición -> fecha(s) del año
        ├── proceduralObservances.ts   # ocurrencias generadas (Novena de Aguinaldos)
        ├── generateCommemorations.ts  # composición del año
        └── presentationPriority.ts    # POLÍTICA de presentación
```

**Reglas de dependencia**

1. Los catálogos solo declaran datos. No importan el motor ni se importan entre
   sí. Un catálogo no sabe que existe otro.
2. `index.ts` es el único punto de composición y el único lugar que fija el orden
   de concatenación: **internacional → salud → Colombia → religiosa** (236
   definiciones). Ese orden no debe depender del orden de imports ni de
   descubrimiento de archivos.
3. El motor no conoce React, SQLite, notificaciones ni el calendario del
   dispositivo.
4. `presentationPriority.ts` no importa catálogos: opera sobre ítems ya resueltos.

---

## 3. Contrato de la fachada

`colombiaCommemorations.ts` exporta exactamente seis símbolos. Es la superficie
que consumen `specialDatesEngine`, los tests y cualquier consumidor externo:

| Exportación | Responsabilidad |
|---|---|
| `isLeapYear(year)` | Regla de año bisiesto usada por las definiciones por día del año. |
| `getNthWeekdayOfMonth(...)` | Resolución de reglas `nth-weekday`. |
| `getLastWeekdayOfMonth(...)` | Resolución de reglas `last-weekday`. |
| `COMMEMORATION_DEFINITIONS` | Catálogo compuesto completo (solo lectura). |
| `resolveDefinition(definition, year)` | Fechas del año para una definición. |
| `generateCommemorations(year)` | Todos los ítems del año. |

La refactorización del catálogo fue **estructural**: el conjunto de ítems
generados, sus categorías, sus estados de verificación y sus textos son idénticos
a los previos. La equivalencia se verificó por comparación contra una captura del
comportamiento anterior (definiciones completas, resolución por definición y
conjunto generado por año, normalizando el único campo nuevo: `dateRule`).

### Campo `dateRule` en `SpecialDateItem`

`resolveDefinition` propaga la regla de fecha al ítem resuelto. La política lo
necesita para distinguir la liturgia móvil (`easter-offset`) de una liturgia de
fecha fija sin mantener una segunda lista de identificadores.

---

## 4. Resolución de fechas

Reglas soportadas (`DateRule`): `fixed`, `nth-weekday`, `last-weekday`,
`easter-offset`, `day-of-year` y `date-range`.

- `easter-offset` produce la liturgia móvil (Miércoles de Ceniza, Semana Santa,
  Pentecostés). Jueves y Viernes Santo además son festivos oficiales.
- `date-range` produce campañas multidiía (semanas internacionales).
- La **Novena de Aguinaldos** es la única observancia procedimental: nueve
  ocurrencias, del 16 al 24 de diciembre, con identificadores
  `commem-<fecha>-novena-dia-<1..9>`. Se genera en un solo lugar
  (`proceduralObservances.ts`), no como nueve definiciones de catálogo.
- Los festivos oficiales y sus anclas litúrgicas se generan en
  `colombiaHolidays.ts`; no viven en el catálogo de efemérides.

---

## 5. Política de presentación

`commemorations/engine/presentationPriority.ts` es una función pura sobre los
ítems ya resueltos para una fecha.

### 5.1 Jerarquía

| Nivel | Condición | Ejemplo |
|---|---|---|
| 0 — Festivo oficial | `isHoliday` **o** `category === 'festivo'` | Batalla de Boyacá; San José (19-mar) cuando el día libre se traslada |
| 1 — Liturgia móvil | `dateRule.type === 'easter-offset'` | Miércoles de Ceniza, Pentecostés |
| 2 — Efeméride nacional colombiana | `category === 'nacional'` | Día del Maestro en Colombia |
| 3 — Observancia de un día | resto sin rango | Día Internacional de la Danza |
| 4 — Campaña multidiía | `dateRange` presente | Semana Mundial de la Lactancia |

**El nivel 0 es absoluto.** Un festivo oficial encabeza el día aunque coexista con
cualquier otra efeméride.

El nivel 0 incluye el **ancla litúrgica de un festivo trasladado por la Ley
Emiliani**: ítems con `category: 'festivo'` e `isHoliday: false` (por ejemplo San
José el 19 de marzo, Corpus Christi o el Sagrado Corazón). Pertenecen a la familia
del festivo, no a la observancia suelta. Sin esta inclusión se producían 16
cambios de titular no deseados (46 en lugar de 31).

El nivel 2 materializa una decisión de producto: **el calendario es colombiano**;
una efeméride nacional propia precede a una internacional cuando coinciden.

### 5.2 Desempate

Cuando dos ítems comparten nivel:

1. Se aplican las excepciones declaradas en `LEGACY_TIE_BREAKS` (§7).
2. Cualquier otro empate conserva el **orden de declaración del catálogo
   compuesto**. El ordenamiento es un `sort` estable, así que ese desempate es
   explícito y reproducible: no depende del orden de imports, del orden de
   llegada de los datos ni del motor de ejecución.

### 5.3 API

| Función | Uso |
|---|---|
| `compareDayItems(a, b)` | Comparador de ordenamiento para los ítems de un día. `0` significa "conserva el orden declarado". |
| `selectPrimaryCommemoration(items)` | Conmemoración que encabeza el día, ignorando festivos oficiales. Es el cuerpo de la notificación de conmemoraciones. |
| `selectDayHeadline(items)` | Titular del día completo: el festivo si existe; si no, `selectPrimaryCommemoration`. Es el titular de la tarjeta. |

`specialDatesEngine` ordena cada día con `merged.sort(compareDayItems)`, de modo
que `items[0]` ya es el titular según la política.

### 5.4 Fuente única

`CommemorationCard` (titular y lista secundaria) y
`SpecialDatesNotificationScheduler` (cuerpo de la notificación) consumen el
**mismo módulo de política**. No hay una segunda regla de orden en la UI ni en el
programador; una divergencia entre tarjeta y notificación exigiría editar el
mismo archivo para ambas.

El motor y `selectDayHeadline` coinciden en los 2.445 días del rango 2023–2035
(prueba de invariante global). Esa igualdad es lo que permite que la tarjeta use
el titular calculado sin recalcular el orden.

---

## 6. Cambios deliberados de titular

Tres fechas cambian de titular respecto de la referencia previa. **No son un
efecto secundario del reordenamiento de archivos**: son la consecuencia directa
del nivel 2 (§5.1). El ítem anterior no desaparece; deja de encabezar y pasa a la
lista secundaria del día.

| Fecha | Antes | Ahora | Días afectados (2023–2035) |
|---|---|---|---|
| 29-abr | Día Internacional de la Danza | Día Nacional del Árbol | 10 |
| 15-may | Día Internacional de las Familias | Día del Maestro en Colombia | 13 |
| 08-jun | Día Mundial de los Océanos | Día del Estudiante en Colombia | 8 |

Total: **31 días**. En 08-jun de 2023 el titular del día es el ancla de Corpus
Christi (nivel 0), pero el ítem nacional ya encabeza las conmemoraciones no
festivas: por eso el cuerpo de la notificación cambia en 32 días, mientras el
titular de la tarjeta cambia en 31.

Referencias de catálogo:

- `arbol-colombia` — Decreto 1333 de 1942, `fixed` 29-abr, `status: verified`.
- `maestro-colombia` — Decreto de 1950 en honor a San Juan Bautista de La Salle,
  `fixed` 15-may, `status: verified`.
- `estudiante-colombia` — tradición estudiantil universitaria, `fixed` 08-jun,
  `status: verified`.

Los conteos menores a 13 tienen causas distintas y verificables:

- **29-abr (10 de 13).** En 2023, 2028 y 2034 el último sábado de abril cae el día
  29 y coincide con el Día de la Niñez, otra efeméride nacional del mismo nivel
  declarada antes en el catálogo: ese día encabeza la Niñez, no el Árbol.
- **08-jun (8 de 13).** En 2023, 2029 y 2034 el día lo encabeza el ancla de un
  festivo trasladado (Corpus Christi o Sagrado Corazón, nivel 0); en 2025 lo
  encabeza Pentecostés (liturgia móvil, nivel 1). En 2026 el titular es el festivo
  real de Corpus Christi, pero el cuerpo de la notificación —que ignora festivos
  oficiales— sí pasa a Estudiante: por eso ese año suma al conteo de
  conmemoraciones (9) y no al de titulares (8).

La tabla de la prueba verifica el conteo exacto año por año y el fixture conserva
el titular de cada uno.

---

## 7. Empates heredados (decisiones de producto revisables)

Cuatro empates de mismo nivel conservan el titular previo. En los cuatro casos el
ítem secundario está **declarado antes** en el catálogo compuesto: sin la
excepción, el desempate por orden declarado entregaría el titular al secundario.
Por eso la excepción es determinante y las pruebas lo verifican.

| Titular | Cede el titular | Criterio |
|---|---|---|
| Día Mundial del Autismo | Día Internacional del Libro Infantil | Respaldo de la Asamblea General (A/RES/62/139) sobre una celebración sectorial del IBBY. |
| Prevención de Ahogamientos (ONU/OMS) | Mujeres Afrodescendientes | Observancia mundial ONU/OMS sobre un encuentro regional. |
| Químico Farmacéutico (Colombia) | Desarme Nuclear | Fecha propia del gremio profesional colombiano sobre la efeméride internacional del mismo ámbito. |
| Rabia (OMS/GARC) | Acceso a la Información | Observancia mundial de salud sobre la efeméride UNESCO. |

Cada entrada declara su criterio en `reason`. Son **decisiones de producto**, no
coincidencias accidentales: si el criterio deja de aplicar, se elimina la entrada.

**Procedimiento de revisión.** Si el catálogo se reordena y una entrada deja de
ser determinante (el titular ya ganaría por orden declarado), la prueba
correspondiente falla y obliga a revisar la excepción y retirarla. No se
perpetúan por inercia.

Nota: `quimico-farmaceutico-colombia` es `category: 'educacion'`, no `nacional`.
Empata en nivel 3 con `desarme-nuclear`; su criterio es el ámbito gremial
nacional, no la categoría.

---

## 8. Cómo cambiar el calendario

| Cambio | Dónde | Qué no tocar |
|---|---|---|
| Agregar una efeméride | `catalog/*.ts` (el archivo del ámbito) | `index.ts`, salvo que se cree un catálogo nuevo |
| Agregar un catálogo | Archivo nuevo + concatenación en `index.ts` | Los catálogos existentes |
| Cambiar la jerarquía | `presentationPriority.ts` + tests + fixture de fechas en conflicto | Tarjeta, programador, motor |
| Fijar el titular de un empate | `LEGACY_TIE_BREAKS` con `reason` | Categorías del catálogo |
| Cambiar el texto de una efeméride | Definición del catálogo | Política |

Reglas:

- **Nunca** ordenar ítems en la tarjeta ni en el programador: ambas consumen la
  política.
- **Nunca** cambiar `category` para alterar un titular; la categoría es un dato
  editorial con fuente normativa.
- Un empate nuevo que necesite un titular específico se declara con su criterio;
  si no hay criterio, se acepta el orden declarado.

---

## 9. Verificación

```bash
cd mobile
npx jest --testPathPattern "specialDates|presentationPriority|calendar"
npx tsc --noEmit
npx eslint src/domain/calendar src/components/calendar/CommemorationCard.tsx \
  src/services/calendar/SpecialDatesNotificationScheduler.ts
```

Estado actual: **6 suites / 131 tests PASS**, `tsc` sin errores en
`domain/calendar`, ESLint limpio en los archivos del subsistema.

Cobertura relevante:

- `presentationPriority.test.ts` — jerarquía, API, 4 empates heredados (con
  guarda de determinancia), las 7 fechas en conflicto del fixture (2023–2035),
  los 3 cambios deliberados con sus 31 casos, invariantes globales e
  independencia del orden de entrada.
- `fixtures/conflictDates.fixture.ts` — referencia congelada de las 7 fechas en
  conflicto: titular y conmemoración por año. Si un cambio de política mueve una
  de esas fechas, el fixture obliga a declararlo.
- `specialDates.test.ts` — comportamiento del motor y de las notificaciones.

---

## 10. Fuera de alcance

- Perfiles o preferencias de calendario por usuario.
- Efemérides regionales o por institución.
- Ordenamiento de eventos personales frente a efemérides.
- Ampliación del catálogo por anticipación: una fecha entra cuando existe fuente
  y consumidor real.
