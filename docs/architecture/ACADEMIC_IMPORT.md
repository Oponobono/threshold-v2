# Especificación Técnica: Academic Import

Este documento especifica las especificaciones de negocio, formato e infraestructura técnica para la importación académica de calificaciones en Threshold.

## 1. Reglas de Negocio

### Jerarquía y Semántica de Entidades
El importador procesará el árbol de entidades de manera ascendente e incremental. Es fundamental comprender la semántica actual del dominio:
- **Course (Curso / Período):** Representa un **período académico** definido por el usuario (semestre, trimestre, año, cohorte o cualquier agrupación temporal de materias). **No representa el programa académico o carrera** (ej. "Ingeniería de Sistemas"). En futuras versiones se planea introducir la entidad superior `AcademicProgram`, pero en esta versión de importación, la columna `Curso` actúa puramente como `AcademicPeriod` (ej. "2026-I", "Primer Semestre 2026"). Si no existe ningún curso con el nombre especificado, se crea.
- **Materia:** Asignatura con peso crediticio opcional. Si no existe una materia con ese nombre asociada al curso correspondiente, se crea.
- **Calificación (Assessment):** Registro individual. Se creará siempre para la materia correspondiente. Se permiten múltiples evaluaciones con el mismo nombre (ej: "Quiz 1", "Quiz 1").

### Validación de Datos
El importador validará de manera estricta los tipos de datos y rangos de las filas procesadas:
1. **Curso (Nombre):** Texto no vacío.
2. **Materia (Nombre):** Texto no vacío.
3. **Créditos:** Opcional. Si se provee, debe ser `>= 0`.
4. **Evaluación (Nombre):** Texto no vacío.
5. **Peso:** Opcional. Si se provee, debe ser `>= 0` y `<= 100`.
6. **Nota (Score):** Opcional. Si se provee, debe ser `>= 0`.
7. **Nota Máxima (OutOf):** Opcional. Si se provee, debe ser `> 0` (por defecto `100` si está vacío pero existe una nota).

### Atomicidad de la Operación
Toda la importación masiva es **atómica**. Se ejecuta dentro de un único bloque transaccional en la base de datos local SQLite:
- Si una sola fila falla en su validación o en la inserción de SQLite, se ejecuta un `ROLLBACK` completo.
- Ninguna entidad (cursos, materias, evaluaciones) se creará de forma huérfana o parcial.
- No se enviará ningún mensaje a la cola de sincronización en caso de fallo.

### Detección de Duplicados (Firma Compuesta Fuerte)
Antes de insertar, se verifica si alguna fila ya existe en SQLite utilizando la firma:
`Firma = Curso + Materia + Nombre de Evaluación + Peso + Nota + Nota Máxima`

Si una fila coincide exactamente en estos 6 valores con algún registro en base de datos, la importación se detiene y se muestra un listado detallado de duplicados al usuario para su corrección.

---

## 2. Metadatos de Plantilla

Para evitar romper la compatibilidad en versiones futuras, la plantilla exportada y parseada incluirá metadatos al inicio como comentarios (`#`):

- **Format:** `Threshold Academic Import`
- **Version:** `1`
- **Locale:** `es` | `en`
- **GeneratedAt:** Marca de tiempo ISO.

---

## 3. Matriz de Compatibilidad

| Formato | Versión de Plantilla | Estado | Notas |
| :--- | :--- | :--- | :--- |
| **CSV** | v1 (Columnas completas) | ✅ Soportado | Plantilla de 7 columnas separadas por `,` o `;` |
| **CSV** | v2 (Herencia de filas vacías) | ⏳ Planeado | Para evitar repetición de Cursos/Materias |
| **Excel (.xlsx)** | - | ⏳ Planeado | Lectura nativa binaria sin configurar plantilla externa |
| **PDF** | - | ⏳ IA (Zyren) | Parseo por visión/OCR + LLM de reportes oficiales |
| **Imágenes** | - | ⏳ IA (Zyren) | Captura de pantalla de notas universitarias |

---

## 4. Estándar Simétrico Import/Export

El formato del CSV generado por la plantilla constituye el estándar de exportación oficial de Threshold. Cualquier exportación futura de notas del usuario generará un CSV con la cabecera e información formateada exactamente igual, permitiendo al usuario utilizar hojas de cálculo (Excel, Numbers, Sheets) como editores masivos bidireccionales de su historial académico.
