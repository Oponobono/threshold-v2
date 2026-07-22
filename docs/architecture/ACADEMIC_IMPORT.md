# Especificación Técnica: Academic Import

Este documento especifica las reglas de negocio, el formato y la infraestructura técnica para la importación académica en Threshold.

---

## 1. Semántica del Dominio

### Jerarquía de Entidades

```
User
└── Course (programa académico o carrera)
      └── Subject (asignatura)
            └── Assessment (evaluación)
```

- **Course:** Representa el **programa académico o carrera** del usuario (ej. "Administración de Empresas", "Bootcamp Full Stack", "Ingeniería de Sistemas"). Mapea directamente a la tabla `courses`.

  > **Nota arquitectónica:** La entidad `AcademicPeriod` (períodos cronológicos como "2026-I", "2026-II") **no existe aún** en el modelo de datos. Cuando se introduzca en el futuro, quedará entre `Course` y `Subject`. La columna `Curso` del CSV v1 **NO debe usarse para períodos cronológicos**.

- **Subject:** Asignatura cursada dentro del programa. Puede tener código, profesor, créditos y nota mínima aprobatoria.

- **Assessment:** Evaluación individual. Puede tener peso, nota obtenida, nota máxima y fecha.

---

## 2. CSV Contract v1 (Congelado)

### Columnas en orden canónico

| Bloque | Columna | Campo BD | Requerido |
|---|---|---|---|
| **Course** | Curso | `courses.name` | ✅ |
| | Plataforma | `courses.platform` | ❌ |
| | Instructor | `courses.instructor` | ❌ |
| | URL del Curso | `courses.main_url` | ❌ |
| | Horas Totales | `courses.total_hours` | ❌ |
| **Subject** | Materia | `subjects.name` | ✅ |
| | Código | `subjects.code` | ❌ |
| | Profesor | `subjects.professor` | ❌ |
| | Créditos | `subjects.credits` | ❌ |
| | Nota Mínima | `subjects.target_grade` | ❌ |
| **Assessment** | Evaluación | `assessments.name` | ✅ |
| | Peso (%) | `assessments.weight` | ❌ |
| | Nota Obtenida | `assessments.score` | ❌ |
| | Nota Máxima | `assessments.out_of` | ❌ |
| | Fecha (YYYY-MM-DD) | `assessments.date` | ❌ |

### Cabecera oficial (es)
```
Curso,Plataforma,Instructor,URL del Curso,Horas Totales,Materia,Código,Profesor,Créditos,Nota Mínima,Evaluación,Peso (%),Nota Obtenida,Nota Máxima,Fecha (YYYY-MM-DD)
```

### Cabecera oficial (en)
```
Course,Platform,Instructor,Course URL,Total Hours,Subject,Code,Professor,Credits,Minimum Grade,Assessment,Weight (%),Score,Out Of,Date (YYYY-MM-DD)
```

### Metadatos de plantilla

```
# Threshold Academic Import
# Version: 1
# Locale: es
# GeneratedAt: <ISO-8601 UTC>
```

La clave `Version: 1` identifica este contrato. Futuras versiones publicarán `Version: 2` sin romper compatibilidad con archivos v1.

### Registro de versiones

| Versión | Estado | Compatibilidad | Descripción |
|---|---|---|---|
| **v1** | ✅ Frozen | Lectura y escritura | Contrato base: Course, Subject, Assessment. 15 columnas. |
| **v2** | 🔒 Reservada | Solo lectura v1 | Añade columna `Período` entre `Curso` y `Materia` para `AcademicPeriod`. |
| **v3** | 🔒 Reservada | — | Soporte Excel (.xlsx) nativo y columnas de IA. |

### Principio de evolución del contrato

> **El contrato CSV solo podrá crecer añadiendo columnas opcionales al final del bloque correspondiente. Nunca se eliminarán ni reordenarán columnas existentes dentro de una misma versión.**

Este principio garantiza que:
- Los archivos v1 existentes seguirán siendo válidos para siempre.
- Los exportadores, integraciones, scripts y backups no se rompen entre versiones.
- El `HeaderNormalizer` puede ignorar columnas desconocidas sin errores.

---

## 3. Reglas de Negocio

### Creación automática
El importador procesa el árbol de entidades de forma ascendente e incremental. Si cualquier `Course` o `Subject` con ese nombre ya existe, se reutiliza. Los `Assessment` siempre se crean.

### Validación de datos
| Campo | Regla |
|---|---|
| `weight` | Si se provee: `>= 0` y `<= 100` |
| `score` | Si se provee: `>= 0` |
| `outOf` | Si se provee: `> 0`. Por defecto `100` si existe `score` |
| `credits` | Si se provee: `>= 0` |
| `date` | Formato `YYYY-MM-DD` |

### Atomicidad
Toda la importación es **atómica** (SQLite transaction). Si una fila falla, se hace `ROLLBACK` completo. Ninguna entidad queda huérfana.

### Detección de duplicados
Firma de duplicado: `Curso + Materia + Evaluación + Peso + Nota + Nota Máxima`. Si todas coinciden exactamente, la fila se considera duplicada y se detiene la importación mostrando el listado al usuario.

---

## 4. Simetría Import/Export

El contrato CSV v1 es simétrico:

```
SQLite → AcademicImportModel → CSV   (Export)
CSV   → AcademicImportModel → SQLite (Import)
```

El `AcademicImportModel` es el contrato compartido entre ambas direcciones. Cuando se implemente el Sprint de Academic Export, se reutilizará entre el 80–90% del pipeline existente.

---

## 5. Matriz de Compatibilidad

| Formato | Versión | Estado | Notas |
|---|---|---|---|
| **CSV** | v1 | ✅ Soportado | 15 columnas, delimitador `,` o `;` |
| **CSV** | v2 | ⏳ Planeado | Herencia de filas vacías para evitar repetición de Curso/Materia |
| **Excel (.xlsx)** | — | ⏳ Planeado | Lectura binaria nativa |
| **PDF** | — | ⏳ IA (Zyren) | OCR + LLM sobre reportes oficiales |
| **Imágenes** | — | ⏳ IA (Zyren) | Capturas de pantalla de notas universitarias |

---

## 6. Evolución Futura del Dominio

Cuando se introduzca la entidad `AcademicPeriod`, la jerarquía pasará a ser:

```
Course (programa)
  └── AcademicPeriod (2026-I, 2026-II, Cohorte 3...)
        └── Subject
              └── Assessment
```

El CSV v2 añadirá una columna `Período` entre `Curso` y `Materia`. Los archivos v1 (sin esa columna) seguirán siendo válidos gracias al campo `# Version: 1` en los metadatos.
